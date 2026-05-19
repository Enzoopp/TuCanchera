# TuCanchera — Arquitectura del Proyecto

> Documento técnico de referencia para el equipo de desarrollo.  
> Última actualización: abril 2026

---

## Índice

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Estructura de carpetas](#3-estructura-de-carpetas)
4. [Base de datos (Supabase / PostgreSQL)](#4-base-de-datos-supabase--postgresql)
5. [Seguridad y autenticación](#5-seguridad-y-autenticación)
6. [Frontend — React](#6-frontend--react)
7. [Edge Functions (Supabase)](#7-edge-functions-supabase)
8. [Email transaccional — Resend](#8-email-transaccional--resend)
9. [Variables de entorno](#9-variables-de-entorno)
10. [Flujos de datos principales](#10-flujos-de-datos-principales)
11. [Deployment](#11-deployment)
12. [Patrones y decisiones de diseño](#12-patrones-y-decisiones-de-diseño)
13. [Integraciones pendientes](#13-integraciones-pendientes)

---

## 1. Visión general

**TuCanchera** es una plataforma SaaS multi-tenant para la reserva de canchas deportivas en Argentina. Cada complejo deportivo tiene su propia URL (`tucanchera.com/c/:slug`) y su propio panel de administración.

```
┌─────────────────────────────────────────────────────┐
│                     CLIENTES                        │
│       (explorar complejos → reservar cancha)        │
└────────────────────────┬────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────┐
│            FRONTEND (React + Vite)                  │
│                  Vercel CDN                         │
└──────┬─────────────────────────────┬────────────────┘
       │                             │
       │ Supabase JS                 │ Edge Functions
       │                             │
┌──────▼──────────────┐  ┌──────────▼─────────────────┐
│  Supabase           │  │  invite-admin               │
│  - Auth             │  │  (solo superadmins)         │
│  - PostgreSQL       │  └────────────────────────────┘
│  - Storage          │
│  - RLS              │
└─────────────────────┘
```

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + TypeScript + Vite | React 19, Vite 8 |
| Estilos | CSS-in-JS inline + Space Grotesk / DM Sans | — |
| Router | React Router v6 | — |
| Estado servidor | TanStack React Query | v5 |
| Backend-as-a-Service | Supabase | — |
| Base de datos | PostgreSQL (via Supabase) | — |
| Autenticación | Supabase Auth (email + Google OAuth) | — |
| Storage | Supabase Storage | — |
| Serverless | Supabase Edge Functions (Deno) | — |
| Email transaccional | Resend (SMTP en Supabase Auth) | — |
| Deployment | Vercel | — |
| Íconos | Lucide React | — |
| Toasts | Sonner | — |

---

## 3. Estructura de carpetas

```
src/
├── components/
│   ├── ui/                        # Componentes base (Button, Card, Badge)
│   ├── brand/                     # Componentes de marca (Navbar, SportIcon)
│   ├── AdminLayout.tsx            # Layout del panel admin (sidebar + outlet)
│   ├── ConfirmacionReservaModal.tsx
│   ├── OnboardingWizard.tsx       # Wizard para que el admin cree su complejo
│   └── ProtectedRoute.tsx         # HOC: verifica auth + rol
│
├── context/
│   ├── AuthContext.tsx            # Sesión, perfil y rol del usuario
│   └── TenantContext.tsx          # Complejo resuelto por slug (/:slug/*)
│
├── hooks/
│   ├── useCanchas.ts              # Canchas activas de un complejo
│   ├── useFotos.ts                # Galería de fotos de un complejo
│   ├── useMiComplejo.ts           # Complejo del admin autenticado
│   └── useSlots.ts                # Slots de disponibilidad (horarios - reservas - bloqueos)
│
├── lib/
│   ├── supabase.ts                # Cliente Supabase (singleton)
│   └── utils.ts                   # Helpers (cn, etc.)
│
├── pages/
│   ├── Landing.tsx                # /explorar — lista todos los complejos activos
│   ├── Complejo.tsx               # /c/:slug — detalle del complejo + canchas
│   ├── Reservar.tsx               # /c/:slug/reservar/:canchaId — flujo de reserva
│   ├── MisReservas.tsx            # /mis-reservas — historial del cliente
│   ├── Login.tsx
│   ├── Register.tsx               # Registro público de clientes
│   ├── ForgotPassword.tsx
│   ├── ResetPassword.tsx
│   ├── AuthCallback.tsx           # Callback de OAuth y confirmación de email
│   ├── superadmin/
│   │   └── InvitarAdmin.tsx       # Panel superadmin — invitar nuevos admins
│   └── admin/
│       ├── Dashboard.tsx          # Resumen con métricas del día
│       ├── GestionComplejo.tsx    # Editar info, logo y fotos del complejo
│       ├── GestionCanchas.tsx     # CRUD de canchas y horarios
│       ├── Bloqueos.tsx           # Gestión de bloqueos de horarios
│       ├── Reservas.tsx           # Historial y gestión de reservas
│       ├── Estadisticas.tsx       # Gráficos de ingresos y ocupación
│       └── ResumenesMensuales.tsx # Cierre mensual + PDF de resumen
│
├── services/
│   ├── complejoService.ts         # Queries públicas (complejos, canchas, fotos, horarios)
│   ├── reservaService.ts          # Crear reserva, mis reservas
│   ├── adminService.ts            # Mutaciones del admin (CRUD, cancelación, cierre de mes)
│   ├── profileService.ts          # Gestión de perfil de usuario
│   └── superadminService.ts       # Invitar admins via Edge Function
│
├── types/
│   └── index.ts                   # Todos los tipos TypeScript del dominio
│
├── utils/
│   ├── slots.ts                   # generarSlots() — función pura de disponibilidad
│   ├── fechas.ts                  # Formateo de fechas en español
│   └── canchaLabels.ts            # Enum TipoCancha → labels en español
│
├── App.tsx                        # Definición de rutas (React Router)
└── main.tsx                       # Entry point

supabase/
├── schema.sql                     # Schema completo, RLS, triggers, funciones
├── migrations/                    # Migraciones incrementales ordenadas por fecha
├── email-templates/
│   ├── confirmacion.html          # Template de confirmación de cuenta
│   └── reset-password.html        # Template de reset de contraseña
└── functions/
    └── invite-admin/              # Edge Function: invita admins (solo superadmin)
```

---

## 4. Base de datos (Supabase / PostgreSQL)

### Tablas

```
auth.users                          (gestionada por Supabase Auth)
│
profiles                            extiende auth.users
│  id            uuid PK
│  user_id       uuid FK → auth.users.id (UNIQUE)
│  nombre        text
│  telefono      text
│  email         text               ← espejo de auth.users.email para queries rápidas
│  rol           'cliente' | 'admin' | 'superadmin'
│  creado_en     timestamptz
│
complejos                           entidad principal multi-tenant
│  id            uuid PK
│  admin_id      uuid FK → profiles.id
│  nombre        text
│  slug          text UNIQUE        ← base de la URL /c/:slug
│  descripcion   text
│  direccion     text
│  logo_url      text
│  activo        bool
│
fotos_complejo
│  id            uuid PK
│  complejo_id   uuid FK → complejos.id
│  url           text
│  orden         int
│
canchas
│  id            uuid PK
│  complejo_id   uuid FK → complejos.id
│  tipo          'futbol5' | 'futbol7' | 'padel'
│  nombre        text
│  precio        numeric
│  duracion_min  60 | 90
│  activa        bool
│
horarios_cancha                     horarios semanales de operación
│  id            uuid PK
│  cancha_id     uuid FK → canchas.id
│  dia_semana    int (0=domingo … 6=sábado)
│  hora_inicio   time
│  hora_fin      time
│
bloqueos                            slots bloqueados por el admin
│  id            uuid PK
│  cancha_id     uuid FK → canchas.id
│  fecha         date
│  hora_inicio   time
│  motivo        text
│
reservas
│  id            uuid PK
│  cancha_id     uuid FK → canchas.id
│  cliente_id    uuid FK → profiles.id
│  fecha         date
│  hora_inicio   time
│  hora_fin      time
│  estado        'confirmada' | 'cancelada_admin'
│  metodo_pago   'en_lugar'         ← 'mercadopago' reservado para futura integración
│  mp_payment_id text               ← reservado para futura integración MP
│  asistio       bool | null        ← null=sin registrar, true=asistió, false=no
│  creado_en     timestamptz
│
│  UNIQUE INDEX (cancha_id, fecha, hora_inicio) WHERE estado != 'cancelada_admin'
│  └── previene double-booking (race condition safe)
│
resumen_meses                       KPIs mensuales (se crea al cerrar un mes)
   id            uuid PK
   complejo_id   uuid FK → complejos.id
   anio          int
   mes           int (1–12)
   total_reservas int
   confirmadas   int
   canceladas    int
   asistieron    int
   no_asistieron int
   ingresos      numeric
   cerrado_en    timestamptz
   UNIQUE (complejo_id, anio, mes)
```

### Función: `get_my_rol()`

Función `SECURITY DEFINER` usada por las políticas RLS para leer el rol del usuario actual sin causar recursión infinita (las políticas que consultan `profiles` necesitan esta función para evitar que RLS se aplique sobre sí mismo).

```sql
CREATE OR REPLACE FUNCTION get_my_rol()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT rol FROM profiles WHERE user_id = auth.uid();
$$;
```

### Trigger: `handle_new_user`

Se ejecuta `AFTER INSERT ON auth.users`. Crea automáticamente un perfil en la tabla `profiles`.

**Seguridad anti-privilege-escalation:** el rol del metadata solo se respeta si el usuario fue invitado formalmente (la columna nativa `auth.users.invited_at` viene seteada por `inviteUserByEmail()`). Un signup normal siempre obtiene `rol='cliente'` sin importar lo que pase en el metadata.

```sql
IF NEW.invited_at IS NOT NULL THEN
  v_rol := COALESCE(NEW.raw_user_meta_data->>'rol', 'cliente');
ELSE
  v_rol := 'cliente';   -- nunca confiar en metadata de signup público
END IF;
```

### Limpieza automática (pg_cron)

Un job semanal (lunes 03:00 UTC) borra reservas con más de 60 días de antigüedad. El admin puede adelantarse usando el **cierre de mes**: genera el PDF, guarda KPIs en `resumen_meses`, y elimina las reservas del período seleccionado de forma permanente.

---

## 5. Seguridad y autenticación

### Row Level Security (RLS)

Todas las tablas tienen RLS activado. Resumen de políticas:

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | Propio + superadmin | Trigger | Propio | — |
| complejos | Público | Admin dueño | Admin dueño | — |
| canchas | Público | Admin dueño | Admin dueño | Admin dueño |
| horarios_cancha | Público | Admin dueño | Admin dueño | Admin dueño |
| fotos_complejo | Público | Admin dueño | Admin dueño | Admin dueño |
| bloqueos | Admin dueño | Admin dueño | — | Admin dueño |
| reservas | Público (solo estado)\* + Propio + Admin dueño | Cliente autenticado | Admin dueño | Admin dueño |
| resumen_meses | Admin dueño + superadmin | Admin dueño | Admin dueño | — |

\* `reservas` tiene una política pública de SELECT restringida a `estado IN ('confirmada', 'pendiente_pago')` para que los slots aparezcan como ocupados sin exponer datos del cliente.

### Alta de admins — flujo de invitación

Los admins son invitados exclusivamente por el superadmin desde el panel `/superadmin`. El flujo:

```
Superadmin → invita email desde panel
  │
superadminService → supabase.functions.invoke('invite-admin', { email, nombre })
  │
Edge Function invite-admin
  ├── verifica JWT del caller (debe ser superadmin en profiles)
  ├── adminClient.auth.admin.inviteUserByEmail(email, { data: { nombre, rol: 'admin' } })
  │     └── Supabase setea auth.users.invited_at (columna nativa)
  │
  └── Email de invitación → usuario acepta → trigger handle_new_user
        └── invited_at IS NOT NULL → rol='admin' aceptado
```

No hay signup público de admins. No hay códigos de invitación.

### API Keys

- **Anon key**: pública, segura gracias a RLS
- **Service Role key**: solo en Edge Functions (nunca en el frontend)

---

## 6. Frontend — React

### Routing

```
/                          → RootRedirect (según rol: cliente→/explorar, admin→/admin/dashboard, superadmin→/superadmin)
/login
/register                  → solo clientes
/forgot-password
/reset-password
/auth/callback             → AuthCallback (OAuth + confirmación de email)
/explorar                  → Landing (pública)
/mis-reservas              → MisReservas (requiere auth, rol=cliente)
/superadmin                → InvitarAdmin (requiere rol=superadmin)
/admin/                    → AdminLayout (requiere rol=admin)
  /admin/dashboard
  /admin/complejo
  /admin/canchas
  /admin/bloqueos
  /admin/reservas
  /admin/estadisticas
  /admin/resumenes-mensuales
/c/:slug                   → Complejo (pública, TenantContext)
/c/:slug/reservar/:canchaId → Reservar (requiere auth, rol=cliente)
```

### Contextos

**AuthContext** — singleton global

Gestiona sesión, perfil y rol. Soluciona el deadlock de Supabase Auth separando el fetch del perfil en un `useEffect([user?.id])` independiente al `onAuthStateChange`.

**TenantContext** — scope de rutas `/c/:slug/*`

Resuelve el complejo a partir del slug en la URL y lo provee a las páginas de reserva.

### Cálculo de slots (lógica pura)

```typescript
// src/utils/slots.ts
generarSlots(horarios, reservas, bloqueos, duracionMin): Slot[]
```

Función pura y determinista: toma los horarios de operación de la semana, divide el rango del día elegido en bloques de `duracionMin` minutos y marca cada uno como `libre`, `ocupado` o `bloqueado`.

No tiene efectos secundarios — es completamente testeable en aislamiento.

### Service Layer

Todas las llamadas a Supabase están encapsuladas en `src/services/`. Los componentes y hooks nunca importan `supabase` directamente; solo llaman funciones del service layer. Esto facilita el testing y el cambio de proveedor.

### Cierre mensual

El admin cierra un mes en tres pasos dentro de la UI:
1. `fetchReservasMes()` — carga el detalle del mes
2. Generación del PDF en el frontend (jsPDF) con el detalle completo
3. `cerrarMes()` — guarda KPIs en `resumen_meses` + DELETE permanente de las reservas

Después del paso 3 los datos individuales ya no existen; solo quedan los 10 números de KPI.

---

## 7. Edge Functions (Supabase)

Las Edge Functions corren en Deno sobre la infraestructura de Supabase. Solo hay una función activa:

### `invite-admin`

**Trigger:** llamada desde el panel superadmin al invitar un nuevo admin.

```
Superadmin → POST /functions/v1/invite-admin
             { email, nombre }

Pasos:
  1. Verificar JWT del caller (auth.getUser())
  2. Leer profiles → comprobar rol = 'superadmin'
  3. adminClient.auth.admin.inviteUserByEmail(email, { data: { nombre, rol: 'admin' } })
     └── Supabase envía email de invitación y setea invited_at en auth.users
  4. Retornar { ok: true, userId }
```

---

## 8. Email transaccional — Resend

Resend se usa para emails transaccionales (confirmación de cuenta, reset de contraseña).

### Configuración

- **SMTP personalizado** en Supabase Auth → `smtp.resend.com:465`
- **Usuario SMTP:** `resend`
- **Password:** API Key de Resend
- **Remitente:** `noreply@tucanchera.com` (dominio verificado en Resend)

### Templates personalizados

Los templates HTML están en `supabase/email-templates/`:
- `confirmacion.html` — Email de confirmación de cuenta nueva
- `reset-password.html` — Email de reseteo de contraseña

### Límites

- Plan gratuito de Resend: **3.000 emails/mes**, 100/día
- Para escalar: plan Starter USD 20/mes → 50.000 emails/mes

---

## 9. Variables de entorno

### Frontend (`.env.local`)

```bash
# Supabase (obligatorias)
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-publica>

# Feature flags (opcionales)
VITE_MP_ENABLED=false   # Habilita botón MercadoPago cuando se implemente
```

### Edge Functions (Supabase Secrets)

```bash
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # Bypassea RLS
SUPABASE_ANON_KEY=<anon-key>
APP_URL=https://tucanchera.vercel.app          # Usada en redirectTo del invite
```

### Vercel (variables de producción)

Mismas variables VITE_* que `.env.local` configuradas en el Dashboard de Vercel.

---

## 10. Flujos de datos principales

### A. Reserva en el lugar

```
Cliente
  │ 1. Navega a /c/:slug/reservar/:canchaId
  │ 2. useSlots() carga disponibilidad
  │    ├── fetchHorariosByCancha(canchaId)
  │    ├── fetchReservasConfirmadas(canchaId, fecha)
  │    └── fetchBloqueosByCancha(canchaId, fecha)
  │    └── generarSlots() → Slot[]
  │ 3. Selecciona slot libre → abre ConfirmacionReservaModal
  │ 4. Clic "Reservar y pagar en el lugar"
  │
crearReservaEnLugar()
  └── INSERT reservas (estado='confirmada', metodo_pago='en_lugar')
        └── Confirmación en modal → opción de ver mis reservas
```

### B. Cancelación por admin

```
Admin en /admin/reservas
  │ 1. Clic "Cancelar"
  │
cancelarReservaAdmin(id)
  └── UPDATE reservas SET estado='cancelada_admin'
```

### C. Login y resolución de rol

```
Usuario ingresa credenciales en /login
  │
AuthContext.signIn()
  └── supabase.auth.signInWithPassword()
        │
        onAuthStateChange → setUser()
          │
          useEffect([user?.id])
            └── fetchProfile(user.id)   ← FUERA del auth lock
                  └── SELECT profiles WHERE user_id = user.id
                        └── setProfile() + setLoading(false)
                              │
                              RootRedirect (rol)
                                ├── rol='superadmin' → /superadmin
                                ├── rol='admin'      → /admin/dashboard
                                └── rol='cliente'    → /explorar
```

### D. Alta de admin

```
Superadmin en /superadmin
  │
superadminService.invitarAdmin({ email, nombre })
  │
  Edge Function invite-admin
    └── inviteUserByEmail() → email al nuevo admin
          │
          Admin acepta invite → setea password
            │
            Trigger handle_new_user
              └── invited_at IS NOT NULL → perfil con rol='admin'
                    │
                    Login → /admin/dashboard → OnboardingWizard
```

---

## 11. Deployment

### Infraestructura

```
Repositorio GitHub (main + develop)
        │
        │ Push a main
        ▼
    Vercel CI/CD
        │ vite build
        ▼
    Vercel CDN (frontend estático)
        │
        ├── Variables de entorno configuradas en Vercel Dashboard
        └── Dominio: tucanchera.com (DNS → Vercel)

Supabase (BaaS)
  ├── Base de datos PostgreSQL (managed)
  ├── Auth (managed) + Google OAuth
  ├── Storage (managed)
  └── Edge Functions (deploy via Supabase CLI)
```

### Ramas de trabajo

```
main        producción (Vercel auto-deploy)
develop     integración (Vercel preview)
feature/*   ramas de funcionalidades → PR a develop
hotfix/*    correcciones urgentes → PR directo a main + cherry-pick a develop
```

### Comandos útiles

```bash
# Desarrollo local
npm run dev

# Build de producción
npm run build

# Lint + tipo check
npm run lint
npx tsc --noEmit

# Deploy de Edge Functions
supabase functions deploy invite-admin --project-ref <TU_REF>

# Aplicar migración SQL
supabase db push
```

---

## 12. Patrones y decisiones de diseño

### Singleton Pattern
`supabase.ts`, `AuthContext`, `TenantContext` — una sola instancia compartida en toda la app.

### Dependency Inversion (Service Layer)
Los componentes y hooks no importan `supabase` directamente. Solo llaman funciones de `services/`. Esto permite cambiar el backend sin tocar la UI.

### Single Responsibility (SRP)
- Cada hook tiene una sola responsabilidad
- Cada función de servicio hace una sola cosa
- Las utilidades son funciones puras sin efectos secundarios

### React Query como cache
Toda la data remota pasa por React Query. Los `queryKey` están diseñados para invalidación precisa (e.g., `['admin-reservas', complejoId, filtros]`).

### RLS como segunda línea de defensa
Aunque el frontend protege rutas por rol, la base de datos tiene sus propias políticas RLS. Un token comprometido no puede leer datos de otro complejo.

### Evitar deadlock de Supabase Auth
`onAuthStateChange` corre dentro del lock interno de Supabase. Llamar queries de Supabase dentro de ese callback causa un deadlock de ~5s. La solución: setear solo `user` en el callback, y fetchear el `profile` en un `useEffect([user?.id])` separado que corre fuera del lock.

### Multi-tenant por slug
Cada complejo tiene un `slug` único (URL-friendly). Las rutas `/c/:slug/*` resuelven el complejo via `TenantContext`. No hay subdominios — el slug vive en el path.

### Hard delete + resumen mensual
En lugar de soft-delete con `archivada=true`, el sistema hace hard DELETE de reservas al cerrar el mes. Los KPIs se preservan en `resumen_meses` (10 números por mes). Esto mantiene la base de datos liviana sin perder el histórico de negocio.

### Anti privilege-escalation en trigger
El trigger `handle_new_user` ignora el `rol` del metadata a menos que `auth.users.invited_at IS NOT NULL` (seteado por `inviteUserByEmail`). Un atacante que haga `signUp({ data: { rol: 'admin' } })` siempre obtiene `'cliente'`.

---

## 13. Integraciones pendientes

Las siguientes integraciones están diseñadas en la arquitectura pero no implementadas todavía:

### Pagos — MercadoPago

El modal de reserva (`ConfirmacionReservaModal`) ya tiene la estructura para mostrar el botón "Pagar con MercadoPago" cuando `VITE_MP_ENABLED=true`. Cuando se implemente se necesitará:

- Edge Function `crear-preferencia-mp`: crea la preferencia en la API de MP y reserva el slot en estado `pendiente_pago`
- Edge Function `webhook-mp`: recibe IPN de MP, confirma o libera el slot
- Edge Function `limpiar-pendientes` (o pg_cron): limpia slots `pendiente_pago` expirados

Variables de entorno adicionales: `MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL`.

### Notificaciones

No hay sistema de notificaciones activo. Cuando se implemente, las opciones naturales son:
- WhatsApp via Twilio o WaPi.io
- Email transaccional via Resend (ya configurado para auth, extensible)
- Automatización con n8n o similar
