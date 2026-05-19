-- ============================================================================
-- MIGRACIÓN: 20260518000001_cierre_mensual_archivado.sql
-- Proyecto: tucanchera-dev (ztwtxrsanjehzpdbitxg)
--
-- PROBLEMA: El cierre mensual borra reservas permanentemente.
-- Si el admin no guardó bien el PDF, el detalle histórico se pierde
-- para siempre. Los KPIs se mantienen en resumen_meses, pero no hay
-- forma de recuperar el detalle individual.
--
-- SOLUCIÓN: Tabla reservas_archivadas.
--   - Al cerrar un mes, las reservas se COPIAN a reservas_archivadas.
--   - Luego se ELIMINAN de reservas (para mantener la tabla operativa liviana).
--   - El admin puede consultar el detalle histórico desde reservas_archivadas.
--   - El pg_cron de limpieza automática también archiva en lugar de borrar ciego.
--
-- ESTRUCTURA:
--   - Mismas columnas que reservas (preserva todos los campos).
--   - Sin FK constraints (datos de archivo: deben sobrevivir aunque se borre
--     una cancha o un perfil en el futuro).
--   - complejo_id denormalizado para queries de historial por complejo.
--   - archivado_en, archivado_por_mes, archivado_por_anio para saber cuándo
--     y en qué cierre mensual se archivó.
--   - PRIMARY KEY sobre id para garantizar idempotencia (ON CONFLICT DO NOTHING).
--
-- IDEMPOTENCIA:
--   - CREATE TABLE IF NOT EXISTS.
--   - DROP POLICY IF EXISTS + CREATE POLICY.
--   - cron.unschedule() + cron.schedule() en el mismo bloque.
-- ============================================================================


-- ============================================================================
-- PASO 1: Tabla reservas_archivadas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reservas_archivadas (
  -- Datos originales de la reserva (copiados tal cual de public.reservas)
  id              UUID        NOT NULL,
  cancha_id       UUID,                      -- sin FK: el dato debe persistir aunque se borre la cancha
  cliente_id      UUID,                      -- sin FK: ídem para perfiles
  fecha           DATE        NOT NULL,
  hora_inicio     TIME        NOT NULL,
  hora_fin        TIME        NOT NULL,
  metodo_pago     TEXT        NOT NULL,
  estado          TEXT        NOT NULL,
  mp_payment_id   TEXT,
  asistio         BOOLEAN,
  creado_en       TIMESTAMPTZ,

  -- Metadatos de archivado
  complejo_id     UUID        NOT NULL,      -- denormalizado para queries de historial
  archivado_en    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archivado_por_mes  INTEGER  NOT NULL,      -- mes del cierre (1–12)
  archivado_por_anio INTEGER  NOT NULL,      -- año del cierre

  PRIMARY KEY (id)
);

-- Índice para historial por complejo + período
CREATE INDEX IF NOT EXISTS idx_reservas_archivadas_complejo_fecha
  ON public.reservas_archivadas (complejo_id, fecha);

-- Índice para historial por mes/año de cierre
CREATE INDEX IF NOT EXISTS idx_reservas_archivadas_cierre
  ON public.reservas_archivadas (complejo_id, archivado_por_anio, archivado_por_mes);


-- ============================================================================
-- PASO 2: RLS sobre reservas_archivadas
-- ============================================================================

ALTER TABLE public.reservas_archivadas ENABLE ROW LEVEL SECURITY;

-- Admin puede ver el historial archivado de su complejo
DROP POLICY IF EXISTS "archivadas_select_admin" ON public.reservas_archivadas;

CREATE POLICY "archivadas_select_admin"
  ON public.reservas_archivadas
  FOR SELECT
  USING (
    complejo_id IN (
      SELECT c.id
      FROM   public.complejos c
      JOIN   public.profiles  p ON p.id = c.admin_id
      WHERE  p.user_id = auth.uid()
    )
  );

-- Solo funciones internas (SECURITY DEFINER) pueden insertar en esta tabla.
-- Los admins no insertan directamente: lo hace cerrar_mes_complejo() o el cron.
-- No se otorga INSERT a ningún rol de aplicación.


-- ============================================================================
-- PASO 3: Función cerrar_mes_complejo()
-- ============================================================================
-- Reemplaza la lógica de cerrarMes() del frontend:
--   1. Guarda KPIs en resumen_meses (upsert — idempotente).
--   2. Copia las reservas del mes a reservas_archivadas.
--   3. Borra las reservas del mes de la tabla operativa.
--
-- Retorna JSONB con los KPIs calculados para que el frontend pueda
-- generar el PDF sin una segunda query.
--
-- Seguridad:
--   - SECURITY DEFINER para poder escribir en reservas_archivadas sin
--     otorgar INSERT a authenticated en esa tabla.
--   - Verifica explícitamente que el complejo_id pertenece al admin
--     que invoca la función (auth.uid()).
-- ============================================================================

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
  v_ya_cerrado  BOOLEAN;
BEGIN
  -- ── Autorización: el complejo debe pertenecer al usuario autenticado ──────
  SELECT p.id INTO v_profile_id
  FROM   public.profiles p
  WHERE  p.user_id = auth.uid();

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: usuario no autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.complejos
    WHERE id = p_complejo_id
      AND admin_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: el complejo no pertenece a este admin';
  END IF;

  -- ── Validar mes ───────────────────────────────────────────────────────────
  IF p_mes < 1 OR p_mes > 12 THEN
    RAISE EXCEPTION 'INVALID_MES: mes debe estar entre 1 y 12';
  END IF;

  v_desde := make_date(p_anio, p_mes, 1);
  v_hasta := (make_date(p_anio, p_mes, 1) + INTERVAL '1 month - 1 day')::DATE;

  -- ── Idempotencia: no re-cerrar si ya existe el resumen ───────────────────
  SELECT EXISTS(
    SELECT 1 FROM public.resumen_meses
    WHERE complejo_id = p_complejo_id
      AND anio = p_anio
      AND mes  = p_mes
  ) INTO v_ya_cerrado;

  -- Si ya fue cerrado, igual retornar los KPIs guardados (idempotente)
  IF v_ya_cerrado THEN
    SELECT
      jsonb_build_object(
        'ok',            true,
        'ya_cerrado',    true,
        'totalReservas', total_reservas,
        'confirmadas',   confirmadas,
        'canceladas',    canceladas,
        'asistieron',    asistieron,
        'noAsistieron',  no_asistieron,
        'ingresos',      ingresos
      )
    INTO STRICT v_ya_cerrado  -- reuse variable just for the query
    FROM public.resumen_meses
    WHERE complejo_id = p_complejo_id
      AND anio = p_anio
      AND mes  = p_mes;

    -- Return the stored KPIs
    RETURN (
      SELECT jsonb_build_object(
        'ok',            true,
        'ya_cerrado',    true,
        'totalReservas', rm.total_reservas,
        'confirmadas',   rm.confirmadas,
        'canceladas',    rm.canceladas,
        'asistieron',    rm.asistieron,
        'noAsistieron',  rm.no_asistieron,
        'ingresos',      rm.ingresos
      )
      FROM public.resumen_meses rm
      WHERE rm.complejo_id = p_complejo_id
        AND rm.anio = p_anio
        AND rm.mes  = p_mes
    );
  END IF;

  -- ── Calcular KPIs ─────────────────────────────────────────────────────────
  SELECT
    COUNT(*)                                                       AS total,
    COUNT(*) FILTER (WHERE r.estado = 'confirmada')               AS conf,
    COUNT(*) FILTER (WHERE r.estado = 'cancelada_admin')          AS canc,
    COUNT(*) FILTER (WHERE r.asistio = true)                      AS asist,
    COUNT(*) FILTER (WHERE r.asistio = false)                     AS no_asist,
    COALESCE(
      SUM(ca.precio) FILTER (WHERE r.estado = 'confirmada'), 0
    )                                                              AS ingresos
  INTO
    v_total, v_confirmadas, v_canceladas, v_asistieron, v_no_asist, v_ingresos
  FROM   public.reservas r
  JOIN   public.canchas ca ON ca.id = r.cancha_id
  WHERE  ca.complejo_id = p_complejo_id
    AND  r.fecha BETWEEN v_desde AND v_hasta;

  -- ── Guardar KPIs en resumen_meses ─────────────────────────────────────────
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

  -- ── Archivar reservas del mes ─────────────────────────────────────────────
  INSERT INTO public.reservas_archivadas (
    id, cancha_id, cliente_id,
    fecha, hora_inicio, hora_fin,
    metodo_pago, estado, mp_payment_id,
    asistio, creado_en,
    complejo_id,
    archivado_en, archivado_por_mes, archivado_por_anio
  )
  SELECT
    r.id, r.cancha_id, r.cliente_id,
    r.fecha, r.hora_inicio, r.hora_fin,
    r.metodo_pago, r.estado, r.mp_payment_id,
    r.asistio, r.creado_en,
    ca.complejo_id,
    NOW(), p_mes, p_anio
  FROM   public.reservas r
  JOIN   public.canchas ca ON ca.id = r.cancha_id
  WHERE  ca.complejo_id = p_complejo_id
    AND  r.fecha BETWEEN v_desde AND v_hasta
  ON CONFLICT (id) DO NOTHING;   -- idempotente si se reintenta

  -- ── Borrar de la tabla operativa (ya están archivadas) ────────────────────
  DELETE FROM public.reservas
  WHERE  id IN (
    SELECT r.id
    FROM   public.reservas r
    JOIN   public.canchas ca ON ca.id = r.cancha_id
    WHERE  ca.complejo_id = p_complejo_id
      AND  r.fecha BETWEEN v_desde AND v_hasta
  );

  -- ── Retornar KPIs al frontend para generar el PDF ─────────────────────────
  RETURN jsonb_build_object(
    'ok',            true,
    'ya_cerrado',    false,
    'totalReservas', v_total,
    'confirmadas',   v_confirmadas,
    'canceladas',    v_canceladas,
    'asistieron',    v_asistieron,
    'noAsistieron',  v_no_asist,
    'ingresos',      v_ingresos
  );
END;
$$;

-- Revocar de PUBLIC/anon, conceder solo a authenticated
REVOKE EXECUTE ON FUNCTION public.cerrar_mes_complejo(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cerrar_mes_complejo(UUID, INTEGER, INTEGER) TO authenticated;


-- ============================================================================
-- PASO 4: Actualizar el job pg_cron de limpieza automática
-- El cron actual hace DELETE directo. Lo reemplazamos por un bloque que
-- primero archiva y luego borra, igual que el cierre manual.
-- ============================================================================

-- Desregistrar el job anterior (no falla si no existe)
SELECT cron.unschedule('limpiar-reservas-antiguas');

-- Registrar el nuevo job con lógica de archivo
SELECT cron.schedule(
  'limpiar-reservas-antiguas',
  '0 3 * * 1',   -- lunes 03:00 UTC
  $$
    -- Paso 1: Archivar reservas con más de 60 días de antigüedad
    INSERT INTO public.reservas_archivadas (
      id, cancha_id, cliente_id,
      fecha, hora_inicio, hora_fin,
      metodo_pago, estado, mp_payment_id,
      asistio, creado_en,
      complejo_id,
      archivado_en,
      archivado_por_mes,
      archivado_por_anio
    )
    SELECT
      r.id, r.cancha_id, r.cliente_id,
      r.fecha, r.hora_inicio, r.hora_fin,
      r.metodo_pago, r.estado, r.mp_payment_id,
      r.asistio, r.creado_en,
      ca.complejo_id,
      NOW(),
      EXTRACT(MONTH FROM r.fecha)::INTEGER,
      EXTRACT(YEAR  FROM r.fecha)::INTEGER
    FROM   public.reservas r
    JOIN   public.canchas ca ON ca.id = r.cancha_id
    WHERE  r.estado   = 'confirmada'
      AND  r.creado_en < NOW() - INTERVAL '60 days'
    ON CONFLICT (id) DO NOTHING;

    -- Paso 2: Borrar las que ya fueron archivadas
    DELETE FROM public.reservas
    WHERE  estado    = 'confirmada'
      AND  creado_en < NOW() - INTERVAL '60 days'
      AND  id IN (SELECT id FROM public.reservas_archivadas);
  $$
);


-- ============================================================================
-- PASO 5: Verificación post-migración
-- ============================================================================

-- 5a. Confirmar que la tabla existe con la estructura correcta:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'reservas_archivadas'
-- ORDER BY ordinal_position;

-- 5b. Confirmar RLS habilitado:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'reservas_archivadas';
-- Esperado: rowsecurity = true

-- 5c. Confirmar función creada con permisos correctos:
-- SELECT grantee, routine_name, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public' AND routine_name = 'cerrar_mes_complejo';
-- Esperado: solo authenticated tiene EXECUTE

-- 5d. Confirmar cron actualizado:
-- SELECT jobname, schedule, command FROM cron.job
-- WHERE jobname = 'limpiar-reservas-antiguas';
-- Esperado: command contiene INSERT INTO public.reservas_archivadas
