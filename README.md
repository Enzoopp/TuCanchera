# TuCanchera

Plataforma SaaS multi-tenant para reservas de canchas deportivas (fútbol 5, fútbol 7, pádel). Cada complejo tiene su propio portal público (`/c/:slug`) donde los clientes reservan turnos en tiempo real.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | CSS-in-JS (inline) + Space Grotesk / DM Sans |
| Routing | React Router v6 |
| Auth | Supabase Auth (email/password + Google OAuth) |
| Base de datos | Supabase (PostgreSQL) con RLS |
| Storage | Supabase Storage (logos y fotos de complejos) |
| Edge Functions | Supabase Edge Functions (Deno) — invite-admin |
| Hosting | Vercel |

## Roles

- **cliente** — reserva turnos en complejos públicos
- **admin** — gestiona su complejo (canchas, horarios, bloqueos, reservas, cierres mensuales)
- **superadmin** — invita nuevos admins desde el panel `/superadmin`

## Setup local

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env.local
# Completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 3. Correr en modo desarrollo
npm run dev
```

## Variables de entorno

| Variable | Descripción | Obligatoria |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública de Supabase | ✅ |
| `VITE_MP_ENABLED` | Habilita botón MercadoPago (`true`/`false`) | ❌ (default `false`) |

## Supabase — setup

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar `supabase/schema.sql` en el SQL Editor (crea todas las tablas, triggers, RLS y storage)
3. En Authentication → Providers: habilitar Google si se quiere OAuth
4. Deployar la Edge Function `invite-admin`:

```bash
supabase functions deploy invite-admin --project-ref <TU_REF>
```

La función requiere las variables de entorno `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` y `APP_URL` en los secrets de la Edge Function.

## Migraciones

Las migraciones incrementales viven en `supabase/migrations/`. Aplicarlas en orden si se parte de un esquema existente:

| Archivo | Descripción |
|---|---|
| `20240001_google_oauth_trigger.sql` | Soporte para perfiles creados via Google OAuth |
| `20240002_fix_invited_at_trigger.sql` | Fix bug en alta de admins (invited_at correcto) |

## Estructura de archivos relevante

```
src/
├── components/        # Componentes reutilizables
├── context/           # AuthContext, TenantContext
├── pages/
│   ├── admin/         # Panel admin (Dashboard, Canchas, Reservas, Estadísticas…)
│   └── superadmin/    # Panel superadmin (invitar admins)
├── services/          # Capa de acceso a Supabase (adminService, reservaService…)
└── types/             # Tipos TypeScript alineados con schema.sql
supabase/
├── functions/
│   └── invite-admin/  # Edge Function para invitar admins
├── migrations/        # Migraciones incrementales
└── schema.sql         # Schema completo (fuente de verdad)
```

## Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run lint     # ESLint
npm run preview  # Preview del build
```

## Pagos (pendiente)

La integración con MercadoPago está diseñada pero no implementada. El botón de pago aparecerá en el modal de reserva cuando se setee `VITE_MP_ENABLED=true` y se implementen las Edge Functions correspondientes.
