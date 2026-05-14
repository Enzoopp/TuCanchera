# Security Fixes — tucanchera-dev

Auditoría de seguridad y acciones necesarias para el proyecto `ztwtxrsanjehzpdbitxg`.

---

## Migraciones SQL (aplicar en orden)

| Archivo | Problema | Método de aplicación |
|---|---|---|
| `20250513000001_fix_functions_security.sql` | Funciones SECURITY DEFINER expuestas a `anon` | `supabase db push` o Dashboard SQL Editor |
| `20250513000002_fix_storage_listing.sql` | Bucket listing abierto | `supabase db push` o Dashboard SQL Editor |

---

## PROBLEMA 3 — `pg_net` instalada en schema `public`

### Por qué importa

`pg_net` permite a cualquier función SQL hacer peticiones HTTP salientes.
Si está en `public` y una función SECURITY DEFINER mal protegida la llama,
un atacante podría exfiltrar datos a un servidor externo.
La convención de Supabase es instalar extensiones de infraestructura en el
schema `extensions`, separadas del código de la aplicación.

### Cómo moverla (solo vía Dashboard, no se puede con SQL puro en Supabase Cloud)

**Paso 1 — Crear el schema `extensions` si no existe**

En el Dashboard → SQL Editor, ejecutar:
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
```

**Paso 2 — Desinstalar `pg_net` del schema `public`**

> ⚠️ Esto requiere que ninguna función activa use `net.*` en ese momento.
> En `tucanchera-dev` la función `notificar_cambio_reserva` fue eliminada
> con el cleanup de n8n/MercadoPago, así que no hay dependencias activas.

En Dashboard → **Database** → **Extensions**:
1. Buscar `pg_net` en la lista.
2. Click en el toggle para **deshabilitarla**.
3. Confirmar la desactivación.

**Paso 3 — Reinstalar en el schema correcto**

En Dashboard → **Database** → **Extensions**:
1. Buscar `pg_net` nuevamente.
2. Activar el toggle.
3. En el modal que aparece, **cambiar el schema a `extensions`** antes de confirmar.
4. Confirmar la instalación.

**Paso 4 — Verificar**

```sql
SELECT extname, extnamespace::regnamespace AS schema
FROM pg_extension
WHERE extname = 'pg_net';
-- Debe mostrar: pg_net | extensions
```

**Nota:** Si en el futuro se necesita llamar a `net.http_post()` desde una función,
usar el path completo `extensions.net_http_post(...)` o agregar `extensions` al
`search_path` de esa función específica.

---

## PROBLEMA 4 — Leaked Password Protection deshabilitado

### Por qué importa

Supabase puede verificar contraseñas nuevas contra la base de datos de
[HaveIBeenPwned](https://haveibeenpwned.com/Passwords) (k-anonymity, sin exponer
la contraseña real). Si una contraseña fue filtrada en algún breach conocido,
Supabase la rechaza durante el registro o cambio de contraseña.

### Cómo activarlo

1. Ir al **Supabase Dashboard** del proyecto `tucanchera-dev`.
2. Menú lateral izquierdo → **Authentication**.
3. Pestaña **Providers** → sección **Email**.
4. Buscar la opción **"Leaked password protection"** (o **"Check for leaked passwords"**).
5. Activar el toggle.
6. Guardar cambios.

> Si no aparece en Providers/Email, buscar en:
> **Authentication** → **Security** → sección **Password Security**.

### Comportamiento tras activarlo

- Los nuevos registros (`/auth/v1/signup`) con contraseñas filtradas reciben error:
  `"Password should not be part of a data breach"`.
- El cambio de contraseña (`supabase.auth.updateUser({ password })`) también verifica.
- Las contraseñas **existentes** no se validan retroactivamente.
- La verificación usa k-anonymity: solo se envían los primeros 5 caracteres del hash
  SHA-1, nunca la contraseña en texto plano.

---

## Resumen de estado post-fixes

| # | Problema | Archivo/Acción | Estado |
|---|---|---|---|
| 1 | Funciones SECURITY DEFINER expuestas a `anon` | `20250513000001_fix_functions_security.sql` | ⏳ Pendiente |
| 2 | Buckets con listing abierto | `20250513000002_fix_storage_listing.sql` | ⏳ Pendiente |
| 3 | `pg_net` en schema `public` | Dashboard → Extensions (ver instrucciones arriba) | ⏳ Pendiente |
| 4 | Leaked password protection deshabilitado | Dashboard → Authentication → Providers → Email | ⏳ Pendiente |
