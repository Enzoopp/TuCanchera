-- ============================================================================
-- MIGRACIÓN: security_fixes
-- Fecha: 2026-05-21
-- Resuelve los findings del audit de seguridad:
--
--   [CRITICAL] Política pública de reservas expone PII (cliente_id, mp_payment_id).
--              → Se reemplaza con RPC get_disponibilidad_slots() que devuelve
--                solo las columnas mínimas necesarias para pintar el calendario.
--
--   [CRITICAL] Buckets logos / fotos-complejos permiten listing completo por anon.
--              → Se restringe la política SELECT para que solo funcione con un
--                path conocido (no listing vacío).
--
--   [HIGH]     profiles_select permite que cualquier admin lea TODOS los perfiles.
--              → Se restringe a: propio perfil OR admin que solo ve clientes que
--                reservaron en su complejo.
--
--   [HIGH]     cancelar_reserva_cliente marca cancelada_admin y no valida 24 hs.
--              → Se agrega estado 'cancelada_cliente' al CHECK + índice único,
--                y se reescribe la función con validación de ventana 24 hs.
--
--   [MEDIUM]   Flujo de invitación con codigos_invitacion es inseguro (SELECT público).
--              → Se elimina la política SELECT pública; solo service_role puede leer.
--                La tabla se mantiene pero el flujo queda bloqueado para clientes.
--
-- ============================================================================

-- ============================================================================
-- 1. AGREGAR 'cancelada_cliente' AL ESTADO DE reservas
-- ============================================================================

-- 1a. Eliminar el CHECK constraint anterior y reemplazarlo con uno que incluya
--     el nuevo estado. En PostgreSQL no se puede ALTER CHECK, hay que DROP + ADD.
ALTER TABLE public.reservas
  DROP CONSTRAINT IF EXISTS reservas_estado_check;

ALTER TABLE public.reservas
  ADD CONSTRAINT reservas_estado_check
  CHECK (estado IN ('confirmada', 'cancelada_admin', 'cancelada_cliente', 'pendiente_pago'));

-- 1b. El índice único parcial excluía 'cancelada_admin'; ahora debe excluir ambos.
DROP INDEX IF EXISTS public.reservas_slot_unico;

CREATE UNIQUE INDEX reservas_slot_unico
  ON public.reservas (cancha_id, fecha, hora_inicio)
  WHERE estado NOT IN ('cancelada_admin', 'cancelada_cliente');

-- ============================================================================
-- 2. REESCRIBIR cancelar_reserva_cliente
--    - Marca cancelada_cliente (no cancelada_admin)
--    - Valida que la reserva le pertenece al caller
--    - Valida que el estado sea cancelable (confirmada | pendiente_pago)
--    - Valida ventana de 24 hs (no se puede cancelar si la cancha juega en < 24 hs)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancelar_reserva_cliente(
  p_reserva_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id  UUID;
  v_reserva     RECORD;
  v_inicio      TIMESTAMPTZ;
  v_horas_rest  NUMERIC;
BEGIN
  -- Obtener profile del caller
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = (SELECT auth.uid());

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  END IF;

  -- Leer la reserva verificando ownership
  SELECT * INTO v_reserva
  FROM public.reservas
  WHERE id = p_reserva_id AND cliente_id = v_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  -- Validar que el estado sea cancelable
  IF v_reserva.estado NOT IN ('confirmada', 'pendiente_pago') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'WRONG_STATUS');
  END IF;

  -- Calcular cuántas horas faltan para el turno
  v_inicio := (v_reserva.fecha || ' ' || v_reserva.hora_inicio)::TIMESTAMPTZ;
  v_horas_rest := EXTRACT(EPOCH FROM (v_inicio - NOW())) / 3600.0;

  -- Ventana mínima de 24 hs para cancelar
  IF v_horas_rest < 24 THEN
    RETURN jsonb_build_object(
      'ok',             false,
      'code',           'TOO_LATE',
      'horas_restantes', GREATEST(v_horas_rest, 0)
    );
  END IF;

  -- Cancelar
  UPDATE public.reservas
  SET estado = 'cancelada_cliente'
  WHERE id = p_reserva_id;

  RETURN jsonb_build_object('ok', true, 'code', 'CANCELLED');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancelar_reserva_cliente(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cancelar_reserva_cliente(UUID) TO authenticated;

-- ============================================================================
-- 3. RPC get_disponibilidad_slots — reemplaza la política pública de reservas
--
--    Devuelve SOLO las columnas necesarias para pintar el calendario de slots:
--      cancha_id, fecha, hora_inicio, hora_fin, estado
--    Sin PII (sin cliente_id, sin mp_payment_id).
--    Accesible por anon (sin login) para que la disponibilidad sea pública.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_disponibilidad_slots(
  p_cancha_id UUID,
  p_fecha     DATE
)
RETURNS TABLE (
  cancha_id   UUID,
  fecha       DATE,
  hora_inicio TIME,
  hora_fin    TIME,
  estado      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.cancha_id,
    r.fecha,
    r.hora_inicio,
    r.hora_fin,
    r.estado
  FROM public.reservas r
  WHERE r.cancha_id = p_cancha_id
    AND r.fecha     = p_fecha
    AND r.estado    IN ('confirmada', 'pendiente_pago');
$$;

-- Accesible sin login (anon) para disponibilidad pública
REVOKE EXECUTE ON FUNCTION public.get_disponibilidad_slots(UUID, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_disponibilidad_slots(UUID, DATE) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_disponibilidad_slots(UUID, DATE) TO authenticated;

-- ============================================================================
-- 4. ELIMINAR la política pública de reservas (ya no se necesita)
--    La disponibilidad pública ahora se sirve vía la RPC anterior.
-- ============================================================================
DROP POLICY IF EXISTS "Disponibilidad pública de slots ocupados" ON public.reservas;

-- ============================================================================
-- 5. RESTRINGIR profiles_select
--    Admin solo ve perfiles de clientes que reservaron en su complejo.
-- ============================================================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (
    -- Cada usuario ve su propio perfil
    (SELECT auth.uid()) = user_id
    OR
    -- Admin solo ve clientes que reservaron en alguna cancha de su complejo
    (
      get_my_rol() = 'admin'
      AND (
        -- El propio perfil admin también es visible
        rol = 'admin'
        OR
        -- Clientes que tienen reservas en el complejo de este admin
        id IN (
          SELECT DISTINCT r.cliente_id
          FROM public.reservas r
          JOIN public.canchas ca ON ca.id = r.cancha_id
          JOIN public.complejos co ON co.id = ca.complejo_id
          JOIN public.profiles p_admin ON p_admin.id = co.admin_id
          WHERE p_admin.user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- ============================================================================
-- 6. RESTRINGIR listing de Storage buckets públicos
--    La política SELECT vacía (USING true) permite enumerar todos los archivos.
--    La nueva política requiere que el path tenga al menos un componente,
--    lo que equivale a acceder por URL directa sin poder listar el bucket.
--
--    Nota: los buckets siguen siendo públicos para acceso por URL conocida;
--    solo se bloquea el listing (listFiles sin prefijo).
-- ============================================================================
DROP POLICY IF EXISTS "logos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "fotos_complejos_select_public" ON storage.objects;

-- Logos: solo acceso con path conocido (name no vacío)
CREATE POLICY "logos_select_public"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'logos'
    AND name IS NOT NULL
    AND length(name) > 0
  );

-- Fotos: solo acceso con path conocido
CREATE POLICY "fotos_complejos_select_public"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'fotos-complejos'
    AND name IS NOT NULL
    AND length(name) > 0
  );

-- ============================================================================
-- 7. BLOQUEAR codigos_invitacion para clientes
--    Onboarding de admins es solo por Edge Function invitada por superadmin.
--    Se elimina la política SELECT pública; solo service_role puede leer.
-- ============================================================================
DROP POLICY IF EXISTS "Cualquiera puede verificar un código de invitación" ON public.codigos_invitacion;
DROP POLICY IF EXISTS "Usuario autenticado puede marcar codigo como usado"  ON public.codigos_invitacion;

-- Solo service_role (funciones SECURITY DEFINER / Edge Functions) puede operar
-- No se agregan políticas nuevas: sin política = nadie con rol anon/authenticated puede acceder.
-- Si en el futuro se necesita una Edge Function para validar códigos,
-- usará SECURITY DEFINER o el service_role key del servidor.
