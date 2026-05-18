# Security & Architecture Fixes — tucanchera-dev

Auditoría completa del proyecto `ztwtxrsanjehzpdbitxg`.

---

## Migraciones SQL (aplicar en orden)

| Archivo | Problema | Código | DB |
|---|---|---|---|
| `20250513000001_fix_functions_security.sql` | Funciones SECURITY DEFINER expuestas a `anon` | ✅ Creada | ⏳ Aplicar |
| `20250513000002_fix_storage_listing.sql` | Bucket listing abierto a anon | ✅ Creada | ⏳ Aplicar |
| `20260518000001_cierre_mensual_archivado.sql` | Cierre mensual borraba reservas permanentemente | ✅ Creada | ⏳ Aplicar |
| `20260518000002_marcar_asistencia_safe.sql` | Race condition al registrar asistencia | ✅ Creada | ⏳ Aplicar |

**Cómo aplicarlas:** Dashboard → SQL Editor → pegar el contenido → Run.
O bien: `supabase db push` si tenés el CLI configurado.

---

## PROBLEMA 1 — Funciones SECURITY DEFINER accesibles por `anon`

### Qué hace la migración `20250513000001`
- `handle_new_user()`: trigger interno → `REVOKE EXECUTE FROM PUBLIC/anon/authenticated`
- `notificar_cambio_reserva()`: ídem (puede no existir)
- `get_my_rol()`: solo authenticated → `REVOKE FROM PUBLIC`, `GRANT TO authenticated`

### Verificación
```sql
SELECT grantee, routine_name, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('get_my_rol', 'handle_new_user', 'cerrar_mes_complejo', 'marcar_asistencia')
ORDER BY routine_name, grantee;
-- handle_new_user → sin filas
-- get_my_rol, cerrar_mes_complejo, marcar_asistencia → solo grantee='authenticated'
```

---

## PROBLEMA 2 — Storage listing abierto

### Qué hace la migración `20250513000002`
- Elimina políticas SELECT amplias (anon/public) sobre `logos` y `fotos-complejos`.
- Crea políticas SELECT para el admin dueño del complejo y para superadmin.
- **Las URLs públicas directas siguen funcionando** (los buckets son `public=true`,
  Supabase sirve archivos vía `/storage/v1/object/public/` sin pasar por RLS).

### Verificación
```bash
# Debe devolver 403 / array vacío:
curl -s "https://ztwtxrsanjehzpdbitxg.supabase.co/storage/v1/object/list/logos" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -d '{}' -X POST

# Las URLs directas deben seguir funcionando:
curl -I "https://ztwtxrsanjehzpdbitxg.supabase.co/storage/v1/object/public/logos/<complejo_id>/logo.jpg"
# Esperado: HTTP 200
```

---

## PROBLEMA 3 — `pg_net` instalada en schema `public`

**Solo ejecutable desde el Dashboard — no se puede con SQL puro en Supabase Cloud.**

### Pasos

**1. Crear el schema `extensions` si no existe** (SQL Editor):
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
```

**2. Desinstalar `pg_net` del schema `public`**
> La función `notificar_cambio_reserva` fue eliminada en el cleanup de n8n/MP, por lo que no hay dependencias activas.

Dashboard → **Database** → **Extensions** → buscar `pg_net` → toggle OFF → confirmar.

**3. Reinstalar en el schema correcto**
Dashboard → **Database** → **Extensions** → buscar `pg_net` → toggle ON → **cambiar schema a `extensions`** → confirmar.

**4. Verificar**:
```sql
SELECT extname, extnamespace::regnamespace AS schema
FROM pg_extension WHERE extname = 'pg_net';
-- Esperado: pg_net | extensions
```

---

## PROBLEMA 4 — Leaked Password Protection deshabilitado

Dashboard → **Authentication** → **Providers** → **Email** → activar **"Leaked password protection"** → Save.

> Si no aparece ahí: **Authentication** → **Security** → **Password Security**.

---

## PROBLEMA 5 — Cierre mensual borraba reservas permanentemente

### Qué hace la migración `20260518000001`
- Crea la tabla `reservas_archivadas` (misma estructura que `reservas`, sin FK constraints,
  con columnas extra: `complejo_id`, `archivado_en`, `archivado_por_mes`, `archivado_por_anio`).
- Crea la función `cerrar_mes_complejo(complejo_id, anio, mes)` que:
  1. Verifica ownership del complejo.
  2. Calcula KPIs.
  3. Guarda KPIs en `resumen_meses` (upsert idempotente).
  4. Copia reservas a `reservas_archivadas`.
  5. Borra reservas de la tabla operativa.
- Actualiza el job pg_cron para archivar en lugar de borrar directo.
- RLS sobre `reservas_archivadas`: solo el admin del complejo puede leer.

### Verificación
```sql
-- 1. Tabla existe:
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public' AND tablename='reservas_archivadas';
-- Esperado: rowsecurity=true

-- 2. Función tiene permisos correctos:
SELECT grantee FROM information_schema.routine_privileges
WHERE routine_name='cerrar_mes_complejo';
-- Esperado: solo 'authenticated'

-- 3. Cron actualizado:
SELECT jobname, command FROM cron.job WHERE jobname='limpiar-reservas-antiguas';
-- Esperado: command contiene 'INSERT INTO public.reservas_archivadas'

-- 4. Probar el cierre (con admin autenticado):
SELECT cerrar_mes_complejo('<complejo_id>', 2025, 1);
-- Esperado: {"ok": true, "ya_cerrado": false, "totalReservas": N, ...}
-- Segunda llamada (idempotencia):
SELECT cerrar_mes_complejo('<complejo_id>', 2025, 1);
-- Esperado: {"ok": true, "ya_cerrado": true, ...}
```

---

## PROBLEMA 6 — Race condition al registrar asistencia

### Qué hace la migración `20260518000002`
- Crea la función `marcar_asistencia(reserva_id, asistio)` con `SELECT FOR UPDATE`
  para bloquear la fila durante la operación.
- Códigos de retorno:
  - `UPDATED` → registrado exitosamente
  - `ALREADY_MARKED` → ya tenía ese valor (idempotente, `ok=true`)
  - `CONFLICT` → ya marcado con valor **distinto** (`ok=false`, incluye `actual`)
  - `NOT_FOUND` → reserva inexistente o sin permiso
  - `UNAUTHORIZED` → sin sesión válida

### Verificación
```sql
-- Como admin autenticado:
SELECT marcar_asistencia('<reserva_id>', true);
-- Esperado: {"ok": true, "code": "UPDATED", "asistio": true}

SELECT marcar_asistencia('<reserva_id>', true);
-- Esperado: {"ok": true, "code": "ALREADY_MARKED", "asistio": true}

SELECT marcar_asistencia('<reserva_id>', false);
-- Esperado: {"ok": false, "code": "CONFLICT", "actual": true, "msg": "..."}
```

```bash
# Como anon (sin JWT de usuario):
curl -X POST "https://ztwtxrsanjehzpdbitxg.supabase.co/rest/v1/rpc/marcar_asistencia" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"p_reserva_id":"<uuid>","p_asistio":true}'
# Esperado: 403 permission denied
```

---

## Resumen de estado

| # | Problema | Código | DB/Dashboard |
|---|---|---|---|
| 1 | Funciones SECURITY DEFINER expuestas a `anon` | ✅ Migración creada | ⏳ Aplicar en SQL Editor |
| 2 | Buckets con listing abierto | ✅ Migración creada | ⏳ Aplicar en SQL Editor |
| 3 | `pg_net` en schema `public` | ✅ Documentado | ⏳ Manual vía Dashboard Extensions |
| 4 | Leaked password protection deshabilitado | — | ⏳ Manual vía Authentication → Email |
| 5 | Cierre mensual borraba datos irrecuperables | ✅ Migración + código TS | ⏳ Aplicar en SQL Editor |
| 6 | Race condition en marcar asistencia | ✅ Migración + código TS | ⏳ Aplicar en SQL Editor |
| 7 | Archivos huérfanos en Storage | ✅ Fix en adminService.ts | ✅ En código (no requiere migración) |
| 8 | Sin UI para historial archivado | ✅ Drawer en ResumenesMensuales | ✅ En código (no requiere migración) |
