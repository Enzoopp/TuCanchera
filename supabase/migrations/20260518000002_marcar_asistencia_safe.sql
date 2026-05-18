-- ============================================================================
-- MIGRACIÓN: 20260518000002_marcar_asistencia_safe.sql
-- Proyecto: tucanchera-dev (ztwtxrsanjehzpdbitxg)
--
-- PROBLEMA: registrarAsistencia() en el frontend hace un UPDATE directo.
-- Si dos tabs del admin marcan asistencia simultáneamente con valores
-- distintos (ej: tab A marca "asistió", tab B marca "no asistió"), el
-- último en ejecutar gana silenciosamente sin que nadie lo sepa.
--
-- SOLUCIÓN: Función marcar_asistencia() con bloqueo FOR UPDATE.
--   - Bloquea la fila a nivel de fila (SELECT ... FOR UPDATE) antes de
--     leer el valor actual, garantizando exclusión mutua.
--   - Idempotente: si ya está marcado con el mismo valor, devuelve
--     'ALREADY_MARKED' sin error (operación segura de reintentar).
--   - Conflicto explícito: si está marcado con valor distinto, devuelve
--     'CONFLICT' con el valor actual → el frontend muestra un error claro
--     en lugar de sobreescribir silenciosamente.
--   - Autorización: verifica que la reserva pertenece al complejo del admin
--     que llama, dentro del mismo FOR UPDATE (no hay TOCTOU).
--
-- CÓDIGOS DE RETORNO (campo 'code' en el JSONB):
--   UPDATED        → asistencia registrada exitosamente
--   ALREADY_MARKED → ya tenía ese mismo valor (idempotente, ok=true)
--   CONFLICT       → ya tenía un valor DISTINTO (ok=false, incluye 'actual')
--   NOT_FOUND      → la reserva no existe o no pertenece al admin
--   UNAUTHORIZED   → el usuario no está autenticado
--
-- SEGURIDAD:
--   - SECURITY DEFINER para ejecutar como owner y hacer FOR UPDATE sin
--     depender del grant de UPDATE en la sesión del cliente.
--   - Verifica ownership del complejo manualmente (join a complejos + profiles).
--   - search_path fijado a public para evitar search_path hijacking.
--   - REVOKE de PUBLIC/anon, GRANT solo a authenticated.
--
-- IDEMPOTENCIA: CREATE OR REPLACE + REVOKE/GRANT son seguros de re-ejecutar.
-- ============================================================================


-- ============================================================================
-- Función marcar_asistencia(p_reserva_id, p_asistio)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.marcar_asistencia(
  p_reserva_id UUID,
  p_asistio    BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_reserva    public.reservas%ROWTYPE;
BEGIN
  -- ── 1. Autenticación ───────────────────────────────────────────────────────
  SELECT id INTO v_profile_id
  FROM   public.profiles
  WHERE  user_id = auth.uid();

  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHORIZED');
  END IF;

  -- ── 2. Bloqueo + autorización en un solo SELECT FOR UPDATE ────────────────
  -- El JOIN a complejos valida ownership: si la reserva no pertenece al
  -- complejo del admin, la fila no se selecciona → NOT FOUND.
  -- FOR UPDATE bloquea la fila hasta el fin de la transacción,
  -- impidiendo que otra sesión concurrent la modifique entre el SELECT y el UPDATE.
  SELECT r.*
  INTO   v_reserva
  FROM   public.reservas  r
  JOIN   public.canchas   ca ON ca.id          = r.cancha_id
  JOIN   public.complejos co ON co.id          = ca.complejo_id
  WHERE  r.id             = p_reserva_id
    AND  co.admin_id      = v_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- La reserva no existe o no pertenece al complejo de este admin
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  END IF;

  -- ── 3. Idempotencia: mismo valor → no-op ──────────────────────────────────
  -- IS NOT DISTINCT FROM maneja el caso NULL = NULL correctamente.
  IF v_reserva.asistio IS NOT DISTINCT FROM p_asistio THEN
    RETURN jsonb_build_object(
      'ok',     true,
      'code',   'ALREADY_MARKED',
      'asistio', v_reserva.asistio
    );
  END IF;

  -- ── 4. Conflicto: ya marcado con valor distinto ────────────────────────────
  -- asistio IS NOT NULL pero difiere → conflicto real.
  -- Devolvemos el valor actual para que el frontend lo muestre al usuario.
  IF v_reserva.asistio IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok',     false,
      'code',   'CONFLICT',
      'actual', v_reserva.asistio,
      'msg',    format(
        'La asistencia ya fue marcada como %s por otra sesión.',
        CASE WHEN v_reserva.asistio THEN 'presente' ELSE 'ausente' END
      )
    );
  END IF;

  -- ── 5. Actualizar ─────────────────────────────────────────────────────────
  UPDATE public.reservas
  SET    asistio = p_asistio
  WHERE  id      = p_reserva_id;

  RETURN jsonb_build_object(
    'ok',     true,
    'code',   'UPDATED',
    'asistio', p_asistio
  );
END;
$$;

-- ── Permisos ──────────────────────────────────────────────────────────────────
-- Revocar el grant implícito a PUBLIC (que incluye anon)
REVOKE EXECUTE ON FUNCTION public.marcar_asistencia(UUID, BOOLEAN) FROM PUBLIC;
-- Conceder solo a usuarios autenticados
GRANT  EXECUTE ON FUNCTION public.marcar_asistencia(UUID, BOOLEAN) TO authenticated;

RAISE NOTICE '[OK] marcar_asistencia: EXECUTE revocado de PUBLIC/anon, concedido a authenticated';


-- ============================================================================
-- Verificación post-migración
-- ============================================================================

-- 1. Confirmar permisos de la función:
-- SELECT grantee, routine_name, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public' AND routine_name = 'marcar_asistencia';
-- Esperado: una fila con grantee = 'authenticated', EXECUTE

-- 2. Test básico de concurrencia (requiere dos sesiones simultáneas o
--    verificar la lógica de retorno con una llamada de prueba):
-- SELECT public.marcar_asistencia('<reserva_id_real>', true);
-- Esperado: {"ok": true, "code": "UPDATED", "asistio": true}
-- Segunda llamada con mismo valor:
-- SELECT public.marcar_asistencia('<reserva_id_real>', true);
-- Esperado: {"ok": true, "code": "ALREADY_MARKED", "asistio": true}
-- Segunda llamada con valor distinto:
-- SELECT public.marcar_asistencia('<reserva_id_real>', false);
-- Esperado: {"ok": false, "code": "CONFLICT", "actual": true, "msg": "..."}

-- 3. Test de autorización como anon (sin JWT):
-- curl -X POST \
--   "https://<project>.supabase.co/rest/v1/rpc/marcar_asistencia" \
--   -H "apikey: <ANON_KEY>" \
--   -H "Authorization: Bearer <ANON_KEY>" \
--   -H "Content-Type: application/json" \
--   -d '{"p_reserva_id":"<uuid>","p_asistio":true}'
-- Esperado: error 403 / permission denied
