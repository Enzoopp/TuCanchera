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
8. [Pagos — MercadoPago](#8-pagos--mercadopago)
9. [Notificaciones — n8n](#9-notificaciones--n8n)
10. [Email transaccional — Resend](#10-email-transaccional--resend)
11. [Variables de entorno](#11-variables-de-entorno)
12. [Flujos de datos principales](#12-flujos-de-datos-principales)
13. [Deployment](#13-deployment)
14. [Patrones y decisiones de diseño](#14-patrones-y-decisiones-de-diseño)

---

## 1. Visión general

**TuCanchera** es una plataforma SaaS multi-tenant para la reserva de canchas deportivas en Argentina. Cada complejo deportivo tiene su propia URL (`tucanchera.com/:slug`) y su propio panel de administración.

```
┌─────────────────────────────────────────────────────────┐
│                       CLIENTES                          │
│         (explorar complejos → reservar cancha)          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│              FRONTEND (React + Vite)                    │
│                   Vercel CDN                            │
└───┬──────────────────┬──────────────────────┬───────────┘
    │                  │                      │
    │ Supabase JS       │ Edge Functions        │ n8n webhook
    │                  │                      │
┌───▼──────────────┐ ┌─▼────────────────────┐ │
│  Supabase        │ │  crear-preferencia-mp│ │
│  - Auth          │ │  webhook-mp           │ │
│  - PostgreSQL    │ │  limpiar-pendientes   │ │
│  - Storage       │ └──────────┬────────────┘ │
│  - RLS           │            │              │
└──────────────────┘   ┌────────▼──────┐  ┌───▼──────────┐
                       │  MercadoPago  │  │    n8n       │
                       │  Checkout Pro │  │  Workflows   │
                       └───────────────┘  └──────┬───────┘
                                                 │
                                    ┌────────────▼────────┐
                                    │  WhatsApp / Email   │
                                    │  (notificaciones)   │
                                    └─────────────────────┘
```

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + TypeScript + Vite | React 19, Vite 8 |
| Estilos | TailwindCSS v4 + shadcn/ui | — |
| Router | React Router v7 | — |
| Estado servidor | TanStack React Query | v5 |
| Backend-as-a-Service | Supabase | — |
| Base de datos | PostgreSQL (via Supabase) | — |
| Autenticación | Supabase Auth | — |
| Storage | Supabase Storage | — |
| Serverless | Supabase Edge Functions (Deno) | — |
| Pagos | MercadoPago Checkout Pro | — |
| Notificaciones | n8n (self-hosted o cloud) | — |
| Email transaccional | Resend + SMTP personalizado | — |
| Deployment | Vercel | — |
| Íconos | Lucide React | — |
| Toasts | Sonner | — |

---

## 3. Estructura de carpetas

```
src/
├── components/
│   ├── ui/                        # Componentes shadcn/ui (Button, Card, Badge, etc.)
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
│   └── utils.ts                   # cn() helper para clsx + tailwind-merge
│
├── pages/
│   ├── Landing.tsx                # /explorar — lista todos los complejos activos
│   ├── Complejo.tsx               # /:slug — detalle del complejo + canchas
│   ├── Reservar.tsx               # /:slug/reservar/:canchaId — flujo de reserva
│   ├── MisReservas.tsx            # /mis-reservas — historial del cliente
│   ├── Login.tsx
│   ├── Register.tsx               # Registro de clientes
│   ├── RegisterAdmin.tsx          # Registro de admins (requiere código de invitación)
│   ├── ForgotPassword.tsx
│   ├── ResetPassword.tsx
│   ├── AuthCallback.tsx           # Callback de confirmación de email
│   └── admin/
│       ├── Dashboard.tsx          # Resumen con métricas del día
│       ├── GestionComplejo.tsx    # Editar info, logo y fotos del complejo
│       ├── GestionCanchas.tsx     # CRUD de canchas y horarios
│       ├── Bloqueos.tsx           # Gestión de bloqueos de horarios
│       ├── Reservas.tsx           # Historial y gestión de reservas
│       └── Estadisticas.tsx       # Gráficos de ingresos y ocupación
│
├── services/
│   ├── complejoService.ts         # Queries públicas (complejos, canchas, fotos, horarios)
│   ├── reservaService.ts          # Crear reserva, mis reservas, MP preference
│   ├── adminService.ts            # Mutaciones del admin (CRUD + cancelación)
│   └── notificacionService.ts     # Webhooks a n8n (best-effort)
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
├── email-templates/
│   ├── confirmacion.html          # Template de confirmación de cuenta
│   └── reset-password.html        # Template de reset de contraseña
└── functions/
    ├── crear-preferencia-mp/      # Crea preferencia de pago en MercadoPago
    ├── webhook-mp/                # Recibe IPN de MercadoPago y confirma/cancela
    └── limpiar-pendientes/        # Cron: elimina reservas pendientes vencidas
```

---

## 4. Base de datos (Supabase / PostgreSQL)

### Tablas

```
auth.users                         (gestionada por Supabase Auth)
│
profiles                           extiende auth.users
│  id            uuid PK → auth.users.id
│  nombre        text
│  telefono      text
│  rol           'cliente' | 'admin'
│  created_at    timestamptz
│
codigos_invitacion                 controla registro de admins
│  id            uuid PK
│  codigo        text UNIQUE
│  usado         bool
│  creado_en     timestamptz
│
complejos                          entidad principal multi-tenant
│  id            uuid PK
│  admin_id      uuid FK → profiles.id
│  nombre        text
│  slug          text UNIQUE        ← base de la URL /:slug
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
horarios_cancha                    horarios semanales de operación
│  id            uuid PK
│  cancha_id     uuid FK → canchas.id
│  dia_semana    int (0=domingo … 6=sábado)
│  hora_inicio   time
│  hora_fin      time
│
bloqueos                           slots bloqueados por el admin
│  id            uuid PK
│  cancha_id     uuid FK → canchas.id
│  fecha         date
│  hora_inicio   time
│  motivo        text
│
reservas
   id            uuid PK
   cancha_id     uuid FK → canchas.id
   cliente_id    uuid FK → profiles.id
   fecha         date
   hora_inicio   time
   hora_fin      time
   estado        'pendiente_pago' | 'confirmada' | 'cancelada_admin'
   metodo_pago   'mercadopago' | 'en_lugar'
   mp_payment_id text               ← seteado por webhook de MercadoPago
   created_at    timestamptz
```

### Trigger: `handle_new_user`

Se ejecuta `AFTER INSERT ON auth.users`. Crea automáticamente un registro en `profiles` con el nombre, teléfono y rol que vienen en `raw_user_meta_data`.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, nombre, telefono, rol)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nombre',
    NEW.raw_user_meta_data->>'telefono',
    COALESCE(NEW.raw_user_meta_data->>'rol', 'cliente')
  );
  RETURN NEW;
END;
$$;
```

### Función: `get_my_rol()`

Función `SECURITY DEFINER` usada por las políticas RLS para evitar recursión infinita al leer el rol del usuario actual.

```sql
CREATE OR REPLACE FUNCTION get_my_rol()
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT rol FROM profiles WHERE id = auth.uid();
$$;
```

---

## 5. Seguridad y autenticación

### Row Level Security (RLS)

Todas las tablas tienen RLS activado. Resumen de políticas:

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | Propio (`id = auth.uid()`) | — | Propio | — |
| complejos | Público | Admin (rol=admin) | Admin dueño | — |
| canchas | Público | Admin dueño | Admin dueño | Admin dueño |
| horarios_cancha | Público | Admin dueño | Admin dueño | Admin dueño |
| fotos_complejo | Público | Admin dueño | Admin dueño | Admin dueño |
| bloqueos | Admin dueño | Admin dueño | Admin dueño | Admin dueño |
| reservas | Propio + Admin dueño | Autenticado | Admin dueño | — |

**Nota:** Las reservas permiten SELECT a cualquier usuario autenticado si `estado IN ('confirmada', 'pendiente_pago')` para que los slots aparezcan como ocupados para otros clientes.

### Registro de admins controlado

El registro como admin requiere un `codigo_invitacion` válido y no usado. Esto evita que cualquiera se registre como dueño de complejo.

### API Keys

- **Anon key**: pública, segura gracias a RLS
- **Service Role key**: solo en Edge Functions (nunca en el frontend)
- **MP Access Token**: solo en Edge Functions
- **Resend API Key**: solo en Edge Functions / variables de servidor

---

## 6. Frontend — React

### Routing

```
/                         → RootRedirect (login | /admin/dashboard | /explorar)
/login
/register
/register-admin
/forgot-password
/reset-password
/auth/callback            → AuthCallback (maneja confirmación de email)
/explorar                 → Landing (pública)
/mis-reservas             → MisReservas (requiere auth)
/admin/                   → AdminLayout (requiere rol=admin)
  /admin/dashboard
  /admin/complejo
  /admin/canchas
  /admin/bloqueos
  /admin/reservas
  /admin/estadisticas
/:slug                    → Complejo (pública, TenantContext)
/:slug/reservar/:canchaId → Reservar (requiere auth)
```

### Contextos

**AuthContext** — singleton global

Gestiona sesión, perfil y rol. Soluciona el deadlock de Supabase Auth separando el fetch del perfil en un `useEffect([user?.id])` independiente al `onAuthStateChange`.

**TenantContext** — scope de rutas `/:slug/*`

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

---

## 7. Edge Functions (Supabase)

Las Edge Functions corren en Deno sobre la infraestructura de Supabase (cerca de la base de datos). No hay servidor Node propio.

### `crear-preferencia-mp`

**Trigger:** llamada desde el frontend al confirmar una reserva con MercadoPago.

```
Frontend → POST /functions/v1/crear-preferencia-mp
           { canchaId, clienteId, fecha, horaInicio, horaFin }

Pasos:
  1. Verificar JWT del usuario (Supabase Auth)
  2. Leer cancha → obtener precio y nombre
  3. Verificar que el slot no esté ocupado (lock optimista)
  4. INSERT reservas con estado='pendiente_pago'
  5. POST https://api.mercadopago.com/checkout/preferences
       { items, external_reference: reservaId, back_urls, notification_url }
  6. Retornar { url: init_point, reservaId }

Rollback: si MP falla → DELETE la reserva creada
```

### `webhook-mp`

**Trigger:** IPN de MercadoPago (HTTP POST al confirmar/rechazar pago).

```
MercadoPago → POST /functions/v1/webhook-mp
              { type: 'payment', data: { id: paymentId } }

Pasos:
  1. GET https://api.mercadopago.com/v1/payments/:id
  2. Leer external_reference → reservaId
  3. Si status = 'approved'  → UPDATE reservas SET estado='confirmada', mp_payment_id
  4. Si status = 'rejected'  → DELETE reservas (libera slot)
  5. Si status = 'pending'   → no hacer nada (esperar próximo webhook)
  6. Disparar webhook a n8n (best-effort)
```

### `limpiar-pendientes`

**Trigger:** cron cada 5 minutos (Supabase Cron Jobs).

```
Pasos:
  1. SELECT reservas WHERE estado='pendiente_pago'
                       AND created_at < NOW() - INTERVAL '15 minutes'
  2. DELETE esas reservas → libera los slots
  3. Opcional: notificar al cliente por email (Resend, best-effort)
```

---

## 8. Pagos — MercadoPago

### Flujo completo

```
1. Cliente selecciona slot y hace clic en "Pagar con MercadoPago"
   │
2. Frontend llama a Edge Function crear-preferencia-mp
   │  La función crea la reserva (pendiente_pago) y genera una preferencia en MP
   │
3. Frontend redirige al cliente a init_point (Checkout Pro de MP)
   │
4. Cliente completa el pago en la plataforma de MP
   │
5. MercadoPago envía IPN al webhook-mp Edge Function
   │
6a. Pago aprobado → reserva.estado = 'confirmada', mp_payment_id guardado
6b. Pago rechazado → reserva eliminada (slot liberado)
6c. Pago pendiente → sin cambios (el cron limpiará en 15 min si no se confirma)
   │
7. n8n recibe evento y envía notificación al cliente (WhatsApp/email)
```

### Variables necesarias en Edge Functions

```
MP_ACCESS_TOKEN      Token de producción de MercadoPago
MP_NOTIFICATION_URL  URL pública del webhook (https://<proyecto>.supabase.co/functions/v1/webhook-mp)
```

### Configuración en MercadoPago

- Back URLs:
  - success: `https://tucanchera.com/mis-reservas?pago=ok`
  - failure: `https://tucanchera.com/mis-reservas?pago=error`
  - pending: `https://tucanchera.com/mis-reservas?pago=pendiente`
- Notification URL (IPN): `https://<proyecto>.supabase.co/functions/v1/webhook-mp`

---

## 9. Notificaciones — n8n

n8n es el motor de automatización que recibe eventos del sistema y envía mensajes a clientes y admins.

### Arquitectura de notificaciones

```
Frontend / Edge Function
        │
        │ POST (best-effort, falla silenciosa)
        ▼
  n8n Webhook endpoint
        │
        ├── reserva_creada        → WhatsApp al cliente (confirmación)
        ├── reserva_confirmada    → WhatsApp al cliente + email
        ├── pago_aprobado         → WhatsApp al cliente
        ├── pago_rechazado        → WhatsApp al cliente
        ├── cancelacion_admin     → WhatsApp + email al cliente
        └── recordatorio_24hs     → WhatsApp al cliente (cron nocturno)
```

### Integración en el código

```typescript
// src/services/notificacionService.ts
const n8nBase = import.meta.env.VITE_N8N_WEBHOOK_BASE_URL

// adminService.ts — al cancelar una reserva:
await fetch(`${n8nBase}/cancelacion-admin`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    cliente_nombre, cliente_telefono, cliente_email,
    cancha_nombre, complejo_nombre, fecha, hora_inicio, hora_fin,
  }),
})
// Si falla → console.warn, no interrumpe el flujo principal
```

### Workflows n8n sugeridos

| Workflow | Trigger | Canal |
|----------|---------|-------|
| Nueva reserva | Webhook `/reserva-creada` | WhatsApp (Twilio/WaPi) |
| Pago aprobado | Webhook `/pago-aprobado` | WhatsApp + Email |
| Pago rechazado | Webhook `/pago-rechazado` | WhatsApp |
| Cancelación admin | Webhook `/cancelacion-admin` | WhatsApp + Email |
| Recordatorio | Cron 20:00 diario | WhatsApp |

### Variables de entorno para n8n

```
VITE_N8N_WEBHOOK_BASE_URL=https://n8n.tucanchera.com/webhook
```

---

## 10. Email transaccional — Resend

Resend se usa para emails transaccionales (confirmación de cuenta, reset de contraseña, notificaciones opcionales).

### Configuración

- **Servicio SMTP personalizado** en Supabase Auth → `smtp.resend.com:465`
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

## 11. Variables de entorno

### Frontend (`.env.local`)

```bash
# Supabase
VITE_SUPABASE_URL=https://<proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-publica>

# n8n (opcional — sin esta variable las notificaciones se omiten silenciosamente)
VITE_N8N_WEBHOOK_BASE_URL=https://n8n.tucanchera.com/webhook
```

### Edge Functions (Supabase Secrets)

```bash
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # Bypassea RLS
MP_ACCESS_TOKEN=<token-produccion-mp>           # MercadoPago
MP_NOTIFICATION_URL=https://...                 # URL del webhook de MP
RESEND_API_KEY=<api-key>                        # Solo si se usan emails desde Edge Functions
```

### Vercel (variables de producción)

Mismas variables que `.env.local` más cualquier flag de feature.

---

## 12. Flujos de datos principales

### A. Reserva con MercadoPago

```
Cliente
  │ 1. Navega a /:slug/reservar/:canchaId
  │ 2. useSlots() carga disponibilidad
  │    ├── fetchHorariosByCancha(canchaId)
  │    ├── fetchReservasConfirmadas(canchaId, fecha)   ← incluye pendiente_pago
  │    └── fetchBloqueosByCancha(canchaId, fecha)
  │    └── generarSlots() → Slot[]
  │ 3. Selecciona slot libre
  │ 4. Clic "Pagar con MercadoPago"
  │
  ├── POST /functions/v1/crear-preferencia-mp
  │     ├── INSERT reservas (estado=pendiente_pago)
  │     ├── POST api.mercadopago.com/checkout/preferences
  │     └── return { url, reservaId }
  │
  │ 5. Redirect a Checkout Pro (MercadoPago)
  │ 6. Paga
  │
MercadoPago
  ├── POST /functions/v1/webhook-mp
  │     ├── GET api.mercadopago.com/v1/payments/:id
  │     ├── UPDATE reservas SET estado='confirmada'
  │     └── POST n8n /pago-aprobado (best-effort)
  │
n8n
  └── Envía WhatsApp al cliente
```

### B. Reserva en el lugar

```
Cliente
  │ 1-3. Igual que arriba
  │ 4. Selecciona "Pagar en el lugar"
  └── crearReservaEnLugar()
        └── INSERT reservas (estado='confirmada', metodo_pago='en_lugar')
              └── Redirige a /mis-reservas
```

### C. Cancelación por admin

```
Admin en /admin/reservas
  │ 1. Clic "Cancelar"
  │
adminService.cancelarReservaAdmin(id)
  ├── SELECT reserva + joins (profiles, canchas, complejos)
  ├── UPDATE reservas SET estado='cancelada_admin'
  └── POST n8n /cancelacion-admin (best-effort)
        ├── cliente_nombre, cliente_telefono, cliente_email
        └── cancha_nombre, complejo_nombre, fecha, hora_inicio, hora_fin

n8n
  ├── WhatsApp al cliente
  └── Email al cliente (via Resend)
```

### D. Login y resolución de rol

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
                  └── SELECT profiles WHERE id = user.id
                        └── setProfile() + setLoading(false)
                              │
                              RootRedirect (rol)
                                ├── rol='admin'   → /admin/dashboard
                                └── rol='cliente' → /explorar
```

---

## 13. Deployment

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
  ├── Auth (managed)
  ├── Storage (managed)
  └── Edge Functions (deploy via Supabase CLI o GitHub Action)

n8n
  └── Cloud o VPS propio (accesible desde internet para recibir webhooks)
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

# Deploy de Edge Functions
supabase functions deploy crear-preferencia-mp
supabase functions deploy webhook-mp
supabase functions deploy limpiar-pendientes

# Aplicar migración SQL
supabase db push
```

---

## 14. Patrones y decisiones de diseño

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

### Best-effort notifications
Los webhooks a n8n y los disparos a Resend nunca bloquean el flujo principal. Si fallan, se loguea un warning pero la reserva/cancelación se procesa igualmente.

### Evitar deadlock de Supabase Auth
`onAuthStateChange` corre dentro del lock interno de Supabase. Llamar queries de Supabase dentro de ese callback causa un deadlock de ~5s. La solución: setear solo `user` en el callback, y fetchear el `profile` en un `useEffect([user?.id])` separado que corre fuera del lock.

### Multi-tenant por slug
Cada complejo tiene un `slug` único (URL-friendly). Las rutas `/:slug/*` resuelven el complejo via `TenantContext`. No hay subdominios — el slug vive en el path.

### Reservas pendientes como lock optimista
Cuando un cliente inicia el pago, la reserva se crea con `estado='pendiente_pago'`. Esto bloquea el slot para otros usuarios durante el proceso de pago. El cron `limpiar-pendientes` libera slots de reservas pendientes mayores a 15 minutos.
