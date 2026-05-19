-- ============================================================================
-- MIGRACIÓN: 20250513000002_fix_storage_listing.sql
-- Proyecto: tucanchera-dev (ztwtxrsanjehzpdbitxg)
--
-- PROBLEMA: Los buckets `logos` y `fotos-complejos` tienen políticas SELECT
-- amplias que permiten al rol `anon` listar el contenido completo del bucket
-- vía GET /storage/v1/object/list/<bucket> o supabase.storage.from(...).list()
-- exponiendo rutas, nombres de archivo y metadata de todos los complejos.
--
-- DISEÑO DE LA SOLUCIÓN:
--   Los buckets son PUBLIC → Supabase sirve archivos individuales vía la URL
--   /storage/v1/object/public/<bucket>/<path> SIN pasar por RLS.
--   Las políticas RLS sobre storage.objects solo afectan al acceso
--   programático (SDK list/download) y a los uploads.
--
--   Por lo tanto:
--     ✅ Las imágenes siguen siendo accesibles por URL directa (comportamiento
--        actual del frontend, que usa getPublicUrl).
--     ❌ El listing del bucket por anon queda bloqueado.
--     ✅ Los admins pueden listar y gestionar los objetos de SU complejo.
--     ✅ Los superadmins pueden listar todo.
--
-- ESTRUCTURA DE PATHS asumida (coherente con uploadLogo y uploadFotoComplejo):
--   logos/          → {complejo_id}/{filename}
--   fotos-complejos → {complejo_id}/{filename}
--
--   (storage.foldername(name))[1] extrae el primer segmento del path,
--   que debe ser el complejo_id en ambos buckets.
--
-- IDEMPOTENCIA:
--   Todas las políticas nuevas usan DROP POLICY IF EXISTS + CREATE POLICY.
--   El DO block de limpieza es seguro de re-ejecutar.
-- ============================================================================


-- ============================================================================
-- PASO 1: Eliminar políticas SELECT demasiado permisivas (anon / public)
-- ============================================================================
-- Buscamos en pg_policies todas las políticas SELECT (o ALL) sobre
-- storage.objects que referencien estos buckets y estén asignadas a `anon`
-- o a `public` (rol especial que incluye a todos).
-- Se emite un NOTICE por cada política eliminada para auditoría.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND cmd        IN ('SELECT', 'ALL')
      AND (
        qual ILIKE '%''logos''%'
        OR qual ILIKE '%''fotos-complejos''%'
      )
      AND (
        'anon'   = ANY(roles)
        OR 'public' = ANY(roles)
        -- También capturamos políticas sin rol explícito (equivalen a PUBLIC)
        OR roles = '{}'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    RAISE NOTICE '[DROPPED] storage.objects policy: %', r.policyname;
  END LOOP;

  IF NOT FOUND THEN
    RAISE NOTICE '[INFO] No se encontraron políticas anon/public para eliminar en storage.objects';
  END IF;
END $$;


-- ============================================================================
-- PASO 2: Políticas de SELECT para el bucket `logos`
-- ============================================================================

-- ── 2a. Admin del complejo ────────────────────────────────────────────────────
-- El admin puede listar y acceder a los objetos cuyo primer segmento de path
-- coincida con el id de SU complejo.
-- Relación: complejos.admin_id → profiles.id (UUID generado, ≠ auth.uid())
--            profiles.user_id  = auth.uid()

DROP POLICY IF EXISTS "logos_select_admin_own" ON storage.objects;

CREATE POLICY "logos_select_admin_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM   public.complejos c
    JOIN   public.profiles  p ON p.id = c.admin_id
    WHERE  p.user_id = auth.uid()
  )
);


-- ── 2b. Superadmin ───────────────────────────────────────────────────────────
-- El superadmin puede ver todo el bucket.

DROP POLICY IF EXISTS "logos_select_superadmin" ON storage.objects;

CREATE POLICY "logos_select_superadmin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'logos'
  AND EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  user_id = auth.uid()
    AND    rol     = 'superadmin'
  )
);


-- ============================================================================
-- PASO 3: Políticas de SELECT para el bucket `fotos-complejos`
-- ============================================================================

-- ── 3a. Admin del complejo ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "fotos_complejos_select_admin_own" ON storage.objects;

CREATE POLICY "fotos_complejos_select_admin_own"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'fotos-complejos'
  AND (storage.foldername(name))[1] IN (
    SELECT c.id::text
    FROM   public.complejos c
    JOIN   public.profiles  p ON p.id = c.admin_id
    WHERE  p.user_id = auth.uid()
  )
);


-- ── 3b. Superadmin ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "fotos_complejos_select_superadmin" ON storage.objects;

CREATE POLICY "fotos_complejos_select_superadmin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'fotos-complejos'
  AND EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  user_id = auth.uid()
    AND    rol     = 'superadmin'
  )
);


-- ============================================================================
-- PASO 4: Verificación post-migración
-- ============================================================================
-- Ejecutar manualmente después de aplicar:

-- 4a. Listar políticas activas sobre estos buckets:
-- SELECT policyname, cmd, roles, qual
-- FROM   pg_policies
-- WHERE  schemaname = 'storage'
--   AND  tablename  = 'objects'
--   AND  (qual ILIKE '%logos%' OR qual ILIKE '%fotos-complejos%')
-- ORDER BY policyname;

-- 4b. Test de listing como anon (debe devolver error 403 o array vacío):
-- curl -s "https://<project-ref>.supabase.co/storage/v1/object/list/logos" \
--   -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
--   -d '{}' -X POST
-- Esperado: {"statusCode":"403","error":"Unauthorized",...}

-- 4c. Confirmar que las URLs públicas directas siguen funcionando:
-- curl -I "https://<project-ref>.supabase.co/storage/v1/object/public/logos/<complejo_id>/logo.jpg"
-- Esperado: HTTP 200 (los buckets públicos sirven objetos sin RLS)
