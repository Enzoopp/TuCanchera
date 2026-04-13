# PROMPT: TuCanchera — Plataforma de Reservas de Canchas Deportivas

## CONTEXTO DEL PROYECTO

Construir una web app llamada **TuCanchera**, una plataforma multi-tenant SaaS de reservas de canchas deportivas (fútbol 5, fútbol 7 y pádel). Cada complejo deportivo tiene su propia URL pública dentro de la plataforma (`tucanchera.com/:slug`). No existe una landing global: la app arranca directamente en la página del complejo.

El proyecto es una SPA (Single Page Application) que debe cumplir con una arquitectura en capas limpia, documentada con comentarios técnicos que expliquen el **porqué** de las decisiones de diseño (patrones SOLID, DRY, RBAC, etc.), siguiendo GitFlow con ramas `main`, `develop` y `feature/`.

---

## STACK TECNOLÓGICO

- **React 18 + Vite** — SPA principal
- **TypeScript** — tipado estricto en todo el proyecto
- **Tailwind CSS + shadcn/ui** — sistema de diseño, paleta azul y blanco, modo claro
- **React Router v6** — enrutamiento con rutas protegidas por rol
- **TanStack Query (React Query v5)** — fetching, caché y sincronización de datos del servidor
- **Supabase** — PostgreSQL + Auth + Storage + emails transaccionales
- **MercadoPago Checkout Pro** — integración de pagos online
- **date-fns** — manipulación de fechas y generación de slots de turnos
- **Vercel** — deploy del frontend

---

## ESTRUCTURA DE CARPETAS

```
src/
├── components/        # Componentes UI reutilizables (dumb/presentacionales)
├── pages/             # Vistas completas con lógica (smart components)
├── hooks/             # Custom hooks: lógica de estado y side effects
├── services/          # Capa de comunicación con Supabase y APIs externas
├── context/           # Contextos globales: AuthContext, TenantContext
├── lib/               # Configuración de clientes: supabase.ts, mercadopago.ts
├── types/             # Tipos e interfaces TypeScript globales
└── utils/             # Funciones puras: generador de slots, formateo de fechas
```

> Comentar en cada archivo el patrón aplicado. Ejemplo: `// SRP: este hook solo gestiona el estado de autenticación, delegando la lógica de negocio a authService`.

---

## BASE DE DATOS — SUPABASE (PostgreSQL)

Crear las siguientes tablas con sus políticas de Row Level Security (RLS):

```sql
-- Códigos de invitación para registro de admins
CREATE TABLE codigos_invitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Perfil extendido del usuario (complementa auth.users de Supabase)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT,
  rol TEXT NOT NULL CHECK (rol IN ('cliente', 'admin')),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Complejo deportivo (entidad principal del negocio)
CREATE TABLE complejos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES profiles(id),
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- generado automáticamente del nombre
  descripcion TEXT,
  direccion TEXT,
  logo_url TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Fotos del complejo (relación 1:N)
CREATE TABLE fotos_complejo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complejo_id UUID REFERENCES complejos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  orden INTEGER DEFAULT 0
);

-- Canchas dentro de un complejo
CREATE TABLE canchas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complejo_id UUID REFERENCES complejos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('futbol5', 'futbol7', 'padel')),
  nombre TEXT NOT NULL,           -- ej: "Cancha 1", "Cancha Principal"
  duracion_min INTEGER NOT NULL CHECK (duracion_min IN (60, 90)),
  precio NUMERIC(10,2) NOT NULL,
  activa BOOLEAN DEFAULT TRUE
);

-- Horarios de funcionamiento de cada cancha por día de la semana
CREATE TABLE horarios_cancha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id UUID REFERENCES canchas(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL
);

-- Bloqueos puntuales de turnos por parte del admin
CREATE TABLE bloqueos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id UUID REFERENCES canchas(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  motivo TEXT,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Reservas de turnos
CREATE TABLE reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id UUID REFERENCES canchas(id),
  cliente_id UUID REFERENCES profiles(id),
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('mercadopago', 'en_lugar')),
  estado TEXT NOT NULL DEFAULT 'pendiente_pago'
    CHECK (estado IN ('pendiente_pago', 'confirmada', 'cancelada_admin')),
  mp_payment_id TEXT,             -- ID del pago en MercadoPago (si aplica)
  creado_en TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS a implementar:**
- `profiles`: el usuario solo puede leer y editar su propio perfil
- `complejos`: lectura pública; escritura solo para el admin dueño
- `canchas` y `horarios_cancha`: lectura pública; escritura solo para admin del complejo
- `bloqueos`: solo el admin del complejo puede crear/ver/borrar
- `reservas`: el cliente solo ve las suyas; el admin ve todas las de su complejo

---

## SISTEMA DE ROLES Y AUTENTICACIÓN

### Registro de cliente
- Email + contraseña vía Supabase Auth
- Al confirmar email se crea automáticamente un `profile` con `rol = 'cliente'` via trigger de Supabase

### Registro de admin
- Ruta especial `/register-admin`
- El usuario ingresa un código de invitación válido + email + contraseña
- Si el código es válido y no fue usado → se crea la cuenta con `rol = 'admin'` y el código se marca como usado
- Al completar registro se redirige al panel para crear su complejo

### Contexto global de Auth
- `AuthContext` expone: `user`, `profile`, `rol`, `loading`, `signIn`, `signOut`
- Las rutas protegidas usan un componente `<ProtectedRoute rol="admin" />` que redirige si el rol no coincide

---

## MULTI-TENANT: SISTEMA DE SLUGS

- Cuando el admin crea su complejo, el slug se genera automáticamente del nombre usando `slugify`:
  - "Canchas Fabi" → `canchas-fabi`
  - "Sporting Club Norte" → `sporting-club-norte`
- Si el slug ya existe, se agrega un sufijo numérico: `canchas-fabi-2`
- `TenantContext` se inicializa al entrar a `/:slug`, resuelve el complejo desde Supabase y lo expone globalmente
- Si el slug no existe → renderizar página `<ComplejoNoEncontrado />` con mensaje claro y diseño cuidado (no una 404 genérica)

---

## RUTAS DE LA APLICACIÓN

```
# Públicas
/:slug                          → Página pública del complejo
/:slug/reservar/:canchaId       → Selección de turno y checkout
/login                          → Login
/register                       → Registro de cliente
/register-admin                 → Registro con código de invitación

# Cliente (requiere rol: 'cliente' o 'admin')
/mis-reservas                   → Historial de reservas del cliente

# Admin (requiere rol: 'admin')
/admin/dashboard                → Reservas del día + resumen rápido
/admin/complejo                 → Editar info del complejo, logo y fotos
/admin/canchas                  → CRUD de canchas
/admin/bloqueos                 → Bloquear turnos puntuales
/admin/reservas                 → Historial completo de reservas con filtros
/admin/estadisticas             → Recaudación por semana/mes
```

---

## LÓGICA DE DISPONIBILIDAD DE TURNOS

Implementar en `src/utils/slots.ts` una función pura `generarSlots()`:

```typescript
// DRY + SRP: función pura que genera slots sin efectos secundarios
function generarSlots(
  horarios: HorarioCancha[],   // horarios del día de la semana
  reservas: Reserva[],         // reservas confirmadas de esa fecha
  bloqueos: Bloqueo[],         // bloqueos del admin para esa fecha
  duracionMin: number          // 60 para fútbol, 90 para pádel
): Slot[]
```

Cada `Slot` tiene: `{ horaInicio, horaFin, estado: 'libre' | 'ocupado' | 'bloqueado' }`.

Lógica:
1. Tomar el rango de `horarios_cancha` para el `dia_semana` de la fecha elegida
2. Dividir el rango en bloques de `duracionMin` minutos
3. Marcar como `'ocupado'` los que coincidan con una reserva confirmada
4. Marcar como `'bloqueado'` los que coincidan con un bloqueo del admin
5. El resto son `'libre'`

---

## FLUJO DE RESERVA (paso a paso)

1. Cliente entra a `/:slug` → ve las canchas del complejo con filtros (tipo, precio, disponibilidad hoy)
2. Hace clic en una cancha → ve el calendario semanal con los slots de esa cancha
3. Selecciona un slot libre → se abre el modal/página de confirmación
4. Elige método de pago:
   - **MercadoPago**: se crea una preferencia de pago vía Edge Function de Supabase → redirige al Checkout Pro de MP → al volver, un webhook actualiza el estado de la reserva a `'confirmada'` → Supabase envía email de confirmación
   - **Pagar en el lugar**: se crea la reserva directamente con estado `'confirmada'` → Supabase envía email de confirmación
5. En ambos casos, el slot queda marcado como ocupado inmediatamente para evitar doble reserva

### Manejo de pago fallido / abandonado (MercadoPago)
- Al iniciar el pago se crea la reserva con estado `'pendiente_pago'` y se guarda el `mp_payment_id`
- Un webhook de MercadoPago actualiza el estado a `'confirmada'` si el pago fue aprobado
- Si el pago fue rechazado o el usuario volvió sin pagar, la reserva queda en `'pendiente_pago'`
- Un cron job en Supabase (pg_cron o Edge Function programada) limpia reservas `pendiente_pago` con más de 15 minutos para liberar el slot

---

## PANEL DE ADMINISTRACIÓN

### Dashboard (`/admin/dashboard`)
- Reservas del día agrupadas por cancha
- Contador: confirmadas / pendientes de pago / bloqueadas
- Accesos rápidos a bloquear turno y ver estadísticas

### Gestión de complejo (`/admin/complejo`)
- Formulario de edición: nombre, descripción, dirección
- Upload de logo (Supabase Storage, bucket `logos`)
- Galería de fotos con drag & drop para reordenar (bucket `fotos-complejos`)

### Gestión de canchas (`/admin/canchas`)
- Listado de canchas con tipo, precio, duración y estado (activa/inactiva)
- Formulario para crear nueva cancha: tipo, nombre, precio, duración, horarios por día
- Toggle para activar/desactivar una cancha
- Edición inline de precio y nombre

### Bloqueos (`/admin/bloqueos`)
- Selector de cancha + fecha → muestra los slots del día
- El admin hace clic en un slot para bloquearlo y escribe un motivo opcional
- Los bloqueos aparecen resaltados en el calendario del cliente

### Historial de reservas (`/admin/reservas`)
- Tabla con filtros: cancha, fecha, estado, método de pago
- Columnas: cliente, cancha, fecha, hora, método de pago, estado
- El admin puede marcar una reserva como `'cancelada_admin'` (equivale a cancelar desde su lado)

### Estadísticas (`/admin/estadisticas`)
- Recaudación total: online (MercadoPago) vs en lugar
- Gráfico de reservas por semana y por mes
- Cancha más reservada del período
- Filtro por rango de fechas

---

## DISEÑO VISUAL

- **Paleta**: Azul primario (`#2563EB`), blanco, grises neutros. Acentos en azul claro para estados activos.
- **Tipografía**: Display con fuente llamativa para títulos del complejo, sans-serif clara para cuerpo y formularios
- **Componentes**: Usar shadcn/ui como base, personalizar con Tailwind para que no se vea genérico
- **Calendario de slots**: Grilla visual semanal, slots coloreados por estado (verde libre, rojo ocupado, gris bloqueado)
- **Responsive**: Mobile-first. La experiencia de reserva debe ser fluida en celular.
- **Micro-interacciones**: Transiciones suaves en modales, skeleton loaders en lugar de spinners, toast notifications para confirmar acciones

---

## COMENTARIOS TÉCNICOS REQUERIDOS EN EL CÓDIGO

En cada archivo importante, agregar comentarios que expliquen decisiones de arquitectura:

```typescript
// PATRÓN: Custom Hook (separación de lógica y presentación - DUMP principle)
// Este hook encapsula toda la lógica de disponibilidad de slots.
// El componente CalendarioCancha es un componente "dumb" que solo renderiza
// los datos que este hook le provee. Esto cumple con SRP de SOLID.

// PATRÓN: Service Layer (DIP - Dependency Inversion Principle)  
// ReservaService abstrae la comunicación con Supabase.
// Si en el futuro se cambia el backend, solo se modifica esta capa,
// sin tocar los componentes ni los hooks de la UI.

// PATRÓN: Context + Provider (Singleton en React)
// TenantContext actúa como un Singleton para los datos del complejo activo.
// Evita prop drilling y centraliza la resolución del slug en un solo lugar.
```

---

## CONSIDERACIONES FINALES

- **No hay cancelación por parte del cliente**: si un cliente quiere cancelar, debe comunicarse directamente con el complejo. No implementar botón de cancelar en el panel del cliente.
- **Slugs únicos y permanentes**: una vez creado el slug del complejo, no se puede cambiar para mantener URLs estables.
- **Imágenes en Supabase Storage**: usar buckets públicos para logos y fotos de complejos. Las URLs se guardan directamente en la base de datos.
- **Email transaccional**: configurar Supabase para enviar email de confirmación automático al cambiar el estado de una reserva a `'confirmada'`, usando los templates de Supabase o un trigger de base de datos + Edge Function.
- **Variables de entorno**: todas las keys de Supabase y MercadoPago deben ir en `.env.local`, nunca hardcodeadas.
- **Idioma**: toda la interfaz, mensajes de error, labels y textos en **español**.
