-- ============================================================================
-- MIGRACIÓN: fix_precio_numeric
-- Fecha: 2026-05-21
-- Corrige el drift entre la migración 20260519000001 (que agregó precio como
-- INTEGER) y el schema.sql actualizado (que lo define como NUMERIC(10,2)).
--
-- La migración original usó INTEGER; el schema actual tiene NUMERIC(10,2).
-- Esta migración alinea el tipo de columna con el schema.
--
-- También corrige la función cerrar_mes_complejo en la migración anterior
-- que sumaba ca.precio (precio de la cancha) en lugar de r.precio
-- (precio efectivo al momento de la reserva).
-- ============================================================================

-- 1. Cambiar tipo de reservas.precio de INTEGER a NUMERIC(10,2)
--    ALTER TYPE de INTEGER a NUMERIC es compatible (no hay pérdida de datos).
ALTER TABLE public.reservas
  ALTER COLUMN precio TYPE NUMERIC(10,2) USING precio::NUMERIC(10,2);

-- Mismo fix para reservas_archivadas (ya era NUMERIC pero por si acaso)
ALTER TABLE public.reservas_archivadas
  ALTER COLUMN precio TYPE NUMERIC(10,2) USING precio::NUMERIC(10,2);

-- 2. Actualizar comentario descriptivo
COMMENT ON COLUMN public.reservas.precio IS
  'Precio efectivo pagado al momento de la reserva (NUMERIC para centavos).';

-- 3. Reemplazar cerrar_mes_complejo para usar r.precio en vez de ca.precio
--    La versión anterior en 20260518000001 sumaba ca.precio (precio base de cancha)
--    que es incorrecto cuando hay franjas_precio configuradas.
--    r.precio contiene el precio efectivo ya calculado al momento de reservar.
CREATE OR REPLACE FUNCTION public.cerrar_mes_complejo(
  p_complejo_id UUID,
  p_anio        INTEGER,
  p_mes         INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id  UUID;
  v_desde       DATE;
  v_hasta       DATE;
  v_total       INTEGER;
  v_confirmadas INTEGER;
  v_canceladas  INTEGER;
  v_asistieron  INTEGER;
  v_no_asist    INTEGER;
  v_ingresos    NUMERIC(12,2);
BEGIN
  SELECT p.id INTO v_profile_id
  FROM public.profiles p WHERE p.user_id = (SELECT auth.uid());

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.complejos
    WHERE id = p_complejo_id AND admin_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_desde := make_date(p_anio, p_mes, 1);
  v_hasta := (v_desde + INTERVAL '1 month - 1 day')::DATE;

  -- Verificar si ya fue cerrado
  IF EXISTS (
    SELECT 1 FROM public.resumen_meses
    WHERE complejo_id = p_complejo_id AND anio = p_anio AND mes = p_mes
  ) THEN
    RETURN (
      SELECT jsonb_build_object(
        'ok',           true,
        'already_closed', true,
        'total',        rm.total_reservas,
        'confirmadas',  rm.confirmadas,
        'canceladas',   rm.canceladas,
        'asistieron',   rm.asistieron,
        'noAsistieron', rm.no_asistieron,
        'ingresos',     rm.ingresos
      )
      FROM public.resumen_meses rm
      WHERE rm.complejo_id = p_complejo_id
        AND rm.anio = p_anio
        AND rm.mes  = p_mes
    );
  END IF;

  -- ── Calcular KPIs usando r.precio (precio efectivo de la reserva) ──────────
  SELECT
    COUNT(*)                                                             AS total,
    COUNT(*) FILTER (WHERE r.estado = 'confirmada')                     AS conf,
    COUNT(*) FILTER (WHERE r.estado IN ('cancelada_admin','cancelada_cliente')) AS canc,
    COUNT(*) FILTER (WHERE r.asistio = true)                            AS asist,
    COUNT(*) FILTER (WHERE r.asistio = false)                           AS no_asist,
    COALESCE(
      SUM(r.precio) FILTER (WHERE r.estado = 'confirmada'), 0
    )                                                                    AS ingresos
  INTO
    v_total, v_confirmadas, v_canceladas, v_asistieron, v_no_asist, v_ingresos
  FROM   public.reservas r
  JOIN   public.canchas ca ON ca.id = r.cancha_id
  WHERE  ca.complejo_id = p_complejo_id
    AND  r.fecha BETWEEN v_desde AND v_hasta;

  -- ── Guardar KPIs ────────────────────────────────────────────────────────────
  INSERT INTO public.resumen_meses (
    complejo_id, anio, mes,
    total_reservas, confirmadas, canceladas,
    asistieron, no_asistieron, ingresos,
    cerrado_en
  ) VALUES (
    p_complejo_id, p_anio, p_mes,
    v_total, v_confirmadas, v_canceladas,
    v_asistieron, v_no_asist, v_ingresos,
    NOW()
  )
  ON CONFLICT (complejo_id, anio, mes) DO UPDATE
    SET total_reservas = EXCLUDED.total_reservas,
        confirmadas    = EXCLUDED.confirmadas,
        canceladas     = EXCLUDED.canceladas,
        asistieron     = EXCLUDED.asistieron,
        no_asistieron  = EXCLUDED.no_asistieron,
        ingresos       = EXCLUDED.ingresos,
        cerrado_en     = EXCLUDED.cerrado_en;

  -- ── Archivar reservas del mes ────────────────────────────────────────────────
  INSERT INTO public.reservas_archivadas (
    id, cancha_id, cliente_id,
    fecha, hora_inicio, hora_fin,
    metodo_pago, estado, mp_payment_id,
    asistio, creado_en, precio,
    complejo_id, archivado_en,
    archivado_por_mes, archivado_por_anio
  )
  SELECT
    r.id, r.cancha_id, r.cliente_id,
    r.fecha, r.hora_inicio, r.hora_fin,
    r.metodo_pago, r.estado, r.mp_payment_id,
    r.asistio, r.creado_en, r.precio,
    p_complejo_id, NOW(),
    p_mes, p_anio
  FROM   public.reservas r
  JOIN   public.canchas ca ON ca.id = r.cancha_id
  WHERE  ca.complejo_id = p_complejo_id
    AND  r.fecha BETWEEN v_desde AND v_hasta
  ON CONFLICT (id) DO NOTHING;

  -- ── Eliminar reservas archivadas de la tabla operativa ─────────────────────
  DELETE FROM public.reservas
  WHERE id IN (
    SELECT ra.id FROM public.reservas_archivadas ra
    JOIN public.canchas ca ON ca.id = ra.cancha_id
    WHERE ca.complejo_id = p_complejo_id
      AND ra.archivado_por_anio = p_anio
      AND ra.archivado_por_mes  = p_mes
  );

  RETURN jsonb_build_object(
    'ok',         true,
    'total',      v_total,
    'confirmadas', v_confirmadas,
    'canceladas', v_canceladas,
    'asistieron', v_asistieron,
    'noAsistieron', v_no_asist,
    'ingresos',   v_ingresos
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cerrar_mes_complejo(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cerrar_mes_complejo(UUID, INTEGER, INTEGER) TO authenticated;
