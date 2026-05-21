# Auditoría Completa — TuCanchera (rama develop)
**Fecha:** 20 de mayo de 2026  
**Proyecto Supabase:** `ztwtxrsanjehzpdbitxg`  
**Stack:** React 19 + TypeScript 6 + Vite 8 + Supabase + TanStack Query + Tailwind 4

---

## Resumen ejecutivo

El proyecto está en buen estado general. La arquitectura es sólida (Service Layer, Context API, hooks separados, funciones PG atómicas), el RLS está habilitado en todas las tablas, y las migraciones más críticas ya fueron aplicadas. Sin embargo, hay **3 problemas de seguridad que requieren acción antes de ir a producción con tráfico real**, y un conjunto de optimizaciones de performance en las políticas RLS que impactarán a escala.

| Prioridad | Cantidad |
|-----------|----------|
| 🔴 Crítico/Alto | 3 |
| 🟡 Medio | 7 |
| 🟢 Bajo / Mejora | 9 |

---

## 🔴 CRÍTICOS / ALTOS (acción antes de producción)

### 1. Leaked Password Protection deshabilitado
**Qué es:** Supabase Auth puede verificar contraseñas contra HaveIBeenPwned.org y rechazar contraseñas conocidas como comprometidas. Está deshabilitado.

**Riesgo:** Usuarios con contraseñas del tipo `123456` o `password` pueden registrarse sin problemas.

**Solución:** Dashboard → Authentication → Sign In / Sign Up → Password Security → activar "Leaked password protection" → Save.

---

### 2. `pg_net` instalado en schema `public`
**Qué es:** La extensión `pg_net` (HTTP requests desde PG) está en el schema `public` en lugar de `extensions`. Esto la expone potencialmente a la API REST de Supabase.

**Estado en DB:**
```
pg_net  →  schema: public   ← problema
pgcrypto → schema: extensions ← correcto
uuid-ossp → schema: extensions ← correcto
```

**Solución:** Dashboard → Database → Extensions → buscar `pg_net` → toggle OFF → toggle ON seleccionando schema `extensions`. Verificar que `notificar_cambio_reserva()` no exista antes (fue eliminada en el cleanup de n8n/MP).

---

### 3. Storage: 4 políticas INSERT sin WITH CHECK (roles=public)
**Qué es:** Las políticas `logos_admin_insert`, `fotos_admin_insert`, `Admin sube logo de su complejo` y `Admin sube fotos de su complejo` existen **en duplicado**, y las versiones legacy (`logos_admin_insert`, `fotos_admin_insert`) tienen `roles={public}` con `qual=null` — lo que significa que cualquier usuario puede invocarlas sin restricción de path.

**Las políticas de INSERT en storage que necesitan WITH CHECK:**
```sql
-- Actual (peligroso):
-- logos_admin_insert → roles={public}, sin WITH CHECK

-- Correcto (el que SÍ está bien):
-- "Admin sube logo de su complejo" → roles={authenticated}, con check de complejo_id
```

**Solución:** Eliminar las políticas legacy (`logos_admin_insert`, `fotos_admin_insert`, `logos_admin_update`, `logos_admin_delete`, `fotos_admin_update`, `fotos_admin_delete`) que tienen `roles={public}`. Las nuevas versiones `authenticated` ya hacen el mismo trabajo correctamente.

```sql
DROP POLICY IF EXISTS "logos_admin_insert"   ON storage.objects;
DROP POLICY IF EXISTS "logos_admin_update"   ON storage.objects;
DROP POLICY IF EXISTS "logos_admin_delete"   ON storage.objects;
DROP POLICY IF EXISTS "fotos_admin_insert"   ON storage.objects;
DROP POLICY IF EXISTS "fotos_admin_update"   ON storage.objects;
DROP POLICY IF EXISTS "fotos_admin_delete"   ON storage.objects;
```

---

## 🟡 MEDIOS

### 4. `get_my_rol()` sin `SET search_path` (según advisor)
**Qué es:** El advisor de Supabase reporta que `get_my_rol()` tiene un search_path mutable. El `schema.sql` la define CON `SET search_path = public`, pero podría haber sido recreada en alguna migración sin ese parámetro.

**Verificar:**
```sql
SELECT prosrc, proconfig
FROM pg_proc
WHERE proname = 'get_my_rol' AND pronamespace = 'public'::regnamespace;
-- proconfig debe incluir: search_path=public
```

**Solución si falta:**
```sql
ALTER FUNCTION public.get_my_rol() SET search_path = public;
```

---

### 5. Inconsistencia de tipos: `reservas.precio` es INTEGER en DB pero NUMERIC en schema.sql
**Qué es:** La migración `20260519233538_add_precio_reserva` creó la columna como `INTEGER NOT NULL DEFAULT 0`, pero el `schema.sql` la describe como `NUMERIC(10,2)`. El tipo TypeScript (`precio: number`) aguanta ambos, pero puede causar problemas al escalar a precios con decimales (por ejemplo para pádel con tarifas fraccionadas).

**Verificación:**
```sql
SELECT data_type FROM information_schema.columns
WHERE table_name='reservas' AND column_name='precio';
-- Resultado actual: integer
```

**Solución (si se van a usar precios con decimales):**
```sql
ALTER TABLE reservas ALTER COLUMN precio TYPE NUMERIC(10,2);
-- Actualizar también schema.sql para que refleje la realidad.
```

---

### 6. `cerrar_mes_complejo()` calcula ingresos con `ca.precio` (precio base) en lugar de `reservas.precio` (precio efectivo)
**Qué es:** Desde que se agregó `reservas.precio` (precio al momento de reservar, incluyendo franjas horarias), el campo correcto para calcular ingresos es `r.precio`, no `ca.precio`. La función PG todavía usa `ca.precio`.

**Código actual en la función:**
```sql
COALESCE(SUM(ca.precio) FILTER (WHERE r.estado = 'confirmada'), 0) AS ingresos
```

**Correcto:**
```sql
COALESCE(SUM(r.precio) FILTER (WHERE r.estado = 'confirmada'), 0) AS ingresos
```

**Impacto:** Los resúmenes mensuales y PDFs mostrarán ingresos calculados con precio base, ignorando los precios de franjas horarias premium/descuento. Esto puede subestimar o sobreestimar los ingresos reales.

**Solución:** Actualizar la función `cerrar_mes_complejo()` y el job pg_cron para usar `r.precio`.

---

### 7. Tabla `codigos_invitacion` en DB pero ausente en `schema.sql` y en el código fuente
**Qué es:** La DB tiene una tabla `codigos_invitacion` (3 filas, RLS habilitado) que no aparece en `schema.sql`, en los types de TypeScript, ni en ningún servicio. Tiene RLS activo pero la política `"Usuario autenticado puede marcar codigo como usado"` no verifica ownership.

**Riesgo:** Cualquier usuario autenticado puede marcar como usado cualquier código de invitación, lo que podría permitir bypass del sistema de invitaciones si se usa en algún flujo futuro.

**Acción:** Decidir si esta tabla es activa o residual. Si es residual, eliminarla. Si es activa, documentarla en `schema.sql` y agregar los tipos correspondientes.

---

### 8. Edge Function `invite-admin`: CORS con wildcard `*`
**Qué es:** La función `invite-admin` tiene `'Access-Control-Allow-Origin': '*'` que permite llamadas desde cualquier origen.

**Solución para producción:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? 'https://tucanchera.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

---

### 9. `cancelarReservaAdmin` hace UPDATE directo sin pasar por RPC
**Qué es:** En `adminService.ts`, `cancelarReservaAdmin()` hace un `.update({ estado: 'cancelada_admin' })` directo sobre la tabla, sin validar que la reserva pertenece al complejo del admin. La política RLS `"El admin puede actualizar reservas de su complejo"` protege esto a nivel DB, pero si en el futuro se agrega lógica de negocio (notificaciones, validaciones de tiempo, etc.) habría que recordar moverlo a una función PG.

**Recomendación:** Convertir a RPC `cancelar_reserva_admin()` similar a `cancelar_reserva_cliente()`.

---

### 10. `profiles` tiene dos políticas UPDATE superpuestas (`profiles_update` y `profiles_update_admin`)
**Qué es:** Detectado por el advisor como `multiple_permissive_policies`. Ambas políticas aplican para `authenticated` en UPDATE, lo que hace que PG evalúe ambas para cada fila.

**Solución:** Fusionarlas en una sola política:
```sql
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
-- profiles_update ya cubre el caso de un usuario actualizando su propio perfil
```

---

## 🟢 BAJOS / MEJORAS DE PERFORMANCE

### 11. FK sin índices (6 claves foráneas) — detectado por advisor
Todas las FK principales carecen de índice cubriente, lo que degrada JOINs a escala:

```sql
CREATE INDEX IF NOT EXISTS idx_bloqueos_cancha_id       ON bloqueos      (cancha_id);
CREATE INDEX IF NOT EXISTS idx_canchas_complejo_id      ON canchas       (complejo_id);
CREATE INDEX IF NOT EXISTS idx_complejos_admin_id       ON complejos     (admin_id);
CREATE INDEX IF NOT EXISTS idx_fotos_complejo_id        ON fotos_complejo (complejo_id);
CREATE INDEX IF NOT EXISTS idx_horarios_cancha_id       ON horarios_cancha (cancha_id);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente_id      ON reservas      (cliente_id);
```

---

### 12. RLS: `auth.uid()` evaluado por fila en ~20 políticas — detectado por advisor
**Qué es:** Las políticas usan `auth.uid()` directamente en lugar de `(SELECT auth.uid())`. PG evalúa `auth.uid()` una vez por fila cuando se usa como expresión, pero lo cachea cuando se usa como subquery.

**Impacto a escala:** Con miles de filas, esto multiplica las llamadas a la función de auth innecesariamente.

**Patrón correcto (ejemplo):**
```sql
-- Antes (lento):
USING (cliente_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))

-- Después (eficiente):
USING (cliente_id = (SELECT id FROM profiles WHERE user_id = (SELECT auth.uid())))
```

Afecta a: `complejos`, `fotos_complejo`, `canchas`, `horarios_cancha`, `bloqueos`, `reservas`, `profiles`, `resumen_meses`, `reservas_archivadas`, `codigos_invitacion`.

---

### 13. Políticas SELECT duplicadas en `bloqueos` y `reservas`
**Qué es:** `bloqueos` tiene `"Lectura pública de bloqueos"` + `"El admin puede ver bloqueos de sus canchas"`. `reservas` tiene 3 políticas SELECT superpuestas. PG ejecuta todas en cada query (OR lógico).

**Solución:** Para `bloqueos`, la política pública ya cubre todo — eliminar la del admin para SELECT (el admin ve todo por la pública de todas formas). Para `reservas`, consolidar en una política que maneje todos los casos.

---

### 14. Índices sin uso (4) — detectado por advisor
```
idx_canchas_franjas_precio       → nunca usado
idx_reservas_archivada           → nunca usado  
idx_reservas_archivadas_complejo_fecha → nunca usado (tabla vacía)
idx_reservas_archivadas_cierre   → nunca usado (tabla vacía)
```

Los dos últimos son justificables (la tabla recién fue creada, se usarán cuando haya datos). Los primeros dos podrían eliminarse si no se prevé su uso.

---

### 15. `franjas_precio` es JSONB sin validación de esquema en runtime
**Qué es:** La columna `canchas.franjas_precio` almacena `FranjaPrecio[]` como JSONB, pero no hay un CHECK constraint que valide la estructura. Si alguien inserta JSON malformado directamente en DB, el frontend crasheará al intentar leer `f.desde` / `f.hasta`.

**Recomendación:** Agregar un CHECK constraint o usar `zod` para validar al leer desde el service.

---

### 16. `useSlots` en Reservar.tsx: no hay manejo de error de red
**Qué es:** Si `fetchHorariosByCancha`, `fetchReservasConfirmadas` o `fetchBloqueosByCancha` falla, `useQuery` setea `isError=true` pero la página `Reservar.tsx` no renderiza ningún mensaje de error — el usuario ve un grid vacío sin explicación.

**Recomendación:** Agregar manejo del estado `isError` en `Reservar.tsx`.

---

### 17. `reordenarFotos` hace N queries individuales
**Qué es:** En `adminService.ts`, `reordenarFotos()` dispara un UPDATE por foto en un `Promise.all`. Para ≤10 fotos no es un problema, pero es ineficiente.

**Alternativa (una sola query):**
```sql
UPDATE fotos_complejo AS f
SET orden = c.orden
FROM (VALUES ...) AS c(id, orden)
WHERE f.id = c.id::uuid;
```

---

### 18. `schema.sql` desincronizado con las migraciones aplicadas
**Qué es:** El `schema.sql` no incluye `codigos_invitacion`, y documenta `reservas.precio` como `NUMERIC(10,2)` cuando en la DB real es `INTEGER`. Hay 37 migraciones en la DB pero el schema solo refleja un subconjunto.

**Recomendación:** Ejecutar `supabase db dump --schema-only > supabase/schema_real.sql` y reemplazar el `schema.sql` con la salida real para que sea la fuente de verdad.

---

### 19. `.env.local` contiene credenciales reales y está correctamente en `.gitignore`
**Estado:** ✅ El archivo `.gitignore` incluye `*.local`, por lo que `.env.local` **no se sube a git**. Sin embargo, la clave `VITE_SUPABASE_ANON_KEY` real está en el archivo local. La `anon key` es segura para exponer en el frontend (es la clave pública), pero si el proyecto se abre a colaboradores externos, recordar no compartir `.env.local` por Slack/email.

---

## Estado de seguridad verificado en producción

| Check | Estado |
|-------|--------|
| RLS habilitado en todas las tablas | ✅ Sí (10/10 tablas) |
| `handle_new_user()` no ejecutable por `anon` | ✅ Correcto |
| `get_my_rol()` solo para `authenticated` | ✅ Correcto |
| `cerrar_mes_complejo()` solo para `authenticated` | ✅ Correcto |
| `marcar_asistencia()` solo para `authenticated` | ✅ Correcto |
| `cancelar_reserva_cliente()` solo para `authenticated` | ✅ Correcto |
| Índice único anti-doble-booking (`reservas_slot_unico`) | ✅ Existe |
| Trigger de rol: un signup normal nunca obtiene `admin` | ✅ Doble verificación (`invited_at` + metadata) |
| Isolation multi-tenant en Storage (path = complejo_id/) | ✅ Implementado |
| `pg_net` en schema correcto | ❌ Está en `public`, mover a `extensions` |
| Leaked Password Protection | ❌ Deshabilitado |
| Políticas INSERT de Storage sin wildcard | ⚠️ Duplicadas, eliminar versiones legacy |

---

## Plan de acción priorizado

**Hacer antes de ir a tráfico real:**

1. Activar Leaked Password Protection en el Dashboard de Auth.
2. Mover `pg_net` de `public` a `extensions` (Dashboard → Extensions).
3. Eliminar las 6 políticas legacy de Storage (`logos_admin_*`, `fotos_admin_*` con `roles=public`).

**Hacer en el próximo sprint:**

4. Corregir el cálculo de ingresos en `cerrar_mes_complejo()` para usar `r.precio` en lugar de `ca.precio`.
5. Agregar los 6 índices de FK faltantes (query de 2 segundos).
6. Verificar y fijar el `search_path` de `get_my_rol()`.
7. Resolver la tabla `codigos_invitacion` (activa o eliminar).
8. Unificar la política UPDATE duplicada en `profiles`.

**Mejoras de calidad (backlog):**

9. Optimizar las 20 políticas RLS con el patrón `(SELECT auth.uid())`.
10. Consolidar políticas SELECT duplicadas en `bloqueos` y `reservas`.
11. Agregar manejo de error en `Reservar.tsx` cuando falla la carga de slots.
12. Convertir `cancelarReservaAdmin` a RPC para centralizar lógica de negocio.
13. Agregar CHECK constraint o validación Zod para `franjas_precio`.
14. Actualizar `schema.sql` con `supabase db dump`.
15. Restringir CORS de la Edge Function `invite-admin` al dominio de producción.
