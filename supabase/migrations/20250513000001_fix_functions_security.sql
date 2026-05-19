-- ============================================================================
-- MIGRACIÓN: 20250513000001_fix_functions_security.sql
-- Proyecto: tucanchera-dev (ztwtxrsanjehzpdbitxg)
--
-- PROBLEMA: Funciones SECURITY DEFINER accesibles por el rol `anon`
-- vía POST /rest/v1/rpc/<función> sin JWT. Cualquier visitante
-- anónimo puede invocarlas directamente, lo que viola el principio
-- de mínimo privilegio.
--
-- SOLUCIÓN:
--   - handle_new_user()        → trigger interno: revocar de PUBLIC,
--                                anon y authenticated.
--   - notificar_cambio_reserva() → ídem (puede no existir si se eliminó
--                                con el cleanup de MercadoPago/n8n).
--   - get_my_rol()              → solo usuarios logueados: revocar de
--                                anon, GRANT a authenticated.
--
-- NOTA sobre search_path: ambas funciones ya tienen
--   SET search_path = public  en su definición (verificado en schema.sql).
--   No se necesita ALTER FUNCTION adicional.
--
-- IDEMPOTENCIA: REVOKE/GRANT son idempotentes. El DO block con
--   EXCEPTION WHEN undefined_function hace que el script sea
--   seguro de re-ejecutar aunque alguna función no exista.
-- ============================================================================

-- ─── 1. handle_new_user() — trigger interno ──────────────────────────────────
-- Este trigger NUNCA debe ser callable vía RPC. Su invocador legítimo
-- es el motor de triggers de PostgreSQL, que usa los privilegios del
-- owner de la función (postgres/supabase_admin), no del rol del cliente.
-- Revocar de PUBLIC implica revocar de anon Y authenticated en un solo paso;
-- los REVOKE individuales son defensivos en caso de grants explícitos previos.

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
  REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
  RAISE NOTICE '[OK] handle_new_user: EXECUTE revocado de PUBLIC/anon/authenticated';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '[SKIP] handle_new_user() no encontrada — omitiendo';
END $$;


-- ─── 2. notificar_cambio_reserva() — trigger interno (MercadoPago/n8n) ───────
-- Puede haber sido eliminada en el cleanup. El bloque EXCEPTION la ignora
-- si ya no existe, sin fallar la migración.

DO $$ BEGIN
  REVOKE EXECUTE ON FUNCTION public.notificar_cambio_reserva() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.notificar_cambio_reserva() FROM anon;
  REVOKE EXECUTE ON FUNCTION public.notificar_cambio_reserva() FROM authenticated;
  RAISE NOTICE '[OK] notificar_cambio_reserva: EXECUTE revocado de PUBLIC/anon/authenticated';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '[SKIP] notificar_cambio_reserva() no encontrada — omitiendo';
END $$;


-- ─── 3. get_my_rol() — función para usuarios autenticados ────────────────────
-- Esta función SÍ debe ser callable por usuarios logueados (la usan las
-- políticas RLS de varias tablas). Solo revocar de anon.
--
-- Flujo correcto:
--   anon   → sin JWT → no puede llamarla (REVOKE abajo)
--   authenticated → con JWT válido → puede llamarla (GRANT abajo)
--   triggers/RLS  → se ejecutan con privilegios del owner → no usan grants de rol

DO $$ BEGIN
  -- Primero quitar el grant implícito a PUBLIC (que incluye anon)
  REVOKE EXECUTE ON FUNCTION public.get_my_rol() FROM PUBLIC;

  -- Volver a conceder explícitamente a authenticated
  GRANT EXECUTE ON FUNCTION public.get_my_rol() TO authenticated;

  RAISE NOTICE '[OK] get_my_rol: EXECUTE revocado de anon, mantenido para authenticated';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '[SKIP] get_my_rol() no encontrada — omitiendo';
END $$;


-- ─── 4. Verificación post-migración ──────────────────────────────────────────
-- Ejecutar manualmente para confirmar el estado final.
-- Esperado:
--   handle_new_user         → sin filas (ningún rol tiene acceso)
--   notificar_cambio_reserva → sin filas (o función no existe)
--   get_my_rol              → una fila con grantee = 'authenticated'

-- SELECT grantee, routine_name, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('get_my_rol', 'handle_new_user', 'notificar_cambio_reserva')
-- ORDER BY routine_name, grantee;
