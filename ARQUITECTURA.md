# Arquitectura de TuCanchera

TuCanchera es una plataforma web para reservar canchas deportivas (fútbol 5,
fútbol 7 y pádel). Conecta a **clientes** que reservan turnos con
**administradores** de complejos que gestionan sus canchas.

Este documento explica cómo está organizado el proyecto y cómo viaja una
petición de punta a punta.

---

## Las 2 capas

El proyecto está dividido en **dos proyectos separados** (cada uno con su
propio repositorio en Git):

```
┌─────────────────┐        HTTP         ┌─────────────────┐      SQL      ┌──────────────┐
│     FRONT       │  ───────────────▶   │      BFF        │  ─────────▶   │   SUPABASE   │
│ React + Vite    │   fetch /api/...    │ Node + Express  │   supabase-js │  PostgreSQL  │
│ (navegador)     │  ◀───────────────   │  (TypeScript)   │  ◀─────────   │   + Auth     │
└─────────────────┘      JSON           └─────────────────┘     filas     └──────────────┘
```

1. **Front** (`TuChanchera`): la interfaz que ve el usuario. Hecho en React 19
   + TypeScript + Vite. Corre en `http://localhost:5173`.
2. **BFF** (`TuChanchera-BFF`): *Backend For Frontend*. Una API intermedia en
   Node + Express + TypeScript que recibe las peticiones del front y habla con
   la base de datos. Corre en `http://localhost:3001`.
3. **Supabase**: provee la base de datos PostgreSQL y la autenticación.

> **¿Por qué un BFF en el medio?** El front no le habla directo a la base de
> datos. El BFF centraliza la lógica, valida los permisos (JWT) y decide qué
> datos devolver. Si mañana cambia la base, solo se toca el BFF.

---

## Los 7 endpoints del BFF

Todas las rutas viven bajo `/api`. Las marcadas con 🔒 requieren un token JWT
válido (el usuario tiene que estar logueado).

| # | Método | Ruta | Qué hace |
|---|--------|------|----------|
| 1 | POST | `/api/auth/login` | Inicia sesión, devuelve el token |
| 2 | POST | `/api/auth/signup` | Registra un cliente nuevo |
| 3 | GET | `/api/complejos` | Lista los complejos activos |
| 4 | GET | `/api/canchas/:complejoId` | Lista las canchas de un complejo |
| 5 | GET | `/api/reservas` 🔒 | Devuelve las reservas del usuario logueado |
| 6 | POST | `/api/reservas` 🔒 | Crea una reserva nueva |
| 7 | POST | `/api/reservas/:id/cancelar` 🔒 | Cancela una reserva |

Además hay un endpoint `GET /health` para verificar que el BFF está vivo.

---

## Cómo viaja una petición (ejemplo: crear una reserva)

Cuando un cliente reserva un turno, pasa esto paso a paso:

1. **Front** — El usuario confirma la reserva. La página llama a la función
   `crearReservaEnLugar()` en [src/services/reservaService.ts](src/services/reservaService.ts).
2. **Front** — Esa función obtiene el token de la sesión de Supabase y llama a
   `bffPost('/api/reservas', datos, token)` de [src/lib/bffClient.ts](src/lib/bffClient.ts).
3. **bffClient** — Hace un `fetch` HTTP al BFF (`http://localhost:3001/api/reservas`)
   con el token en el header `Authorization: Bearer <token>`.
4. **BFF** — La ruta `POST /api/reservas` primero pasa por el middleware
   `requireAuth`, que valida el token y averigua el `profileId` del usuario.
5. **BFF** — Si el token es válido, inserta la reserva en la tabla `reservas`
   de Supabase usando el id del usuario autenticado.
6. **BFF** — Devuelve la reserva creada como JSON con estado `201 Created`.
7. **Front** — `bffClient` recibe el JSON y la página muestra la confirmación.

```
Usuario → reservaService → bffClient → [HTTP] → BFF (requireAuth → insert) → Supabase
                                                                 │
Usuario ← reservaService ← bffClient ← [JSON] ←─────────────────┘
```

---

## Estructura del Front

```
src/
├── main.tsx              Punto de entrada (monta React)
├── App.tsx               Rutas y providers globales
├── pages/                Cada pantalla (Login, Reservar, admin/, etc.)
├── components/           Componentes reutilizables (UI, modales, layout)
├── context/              Estado global (AuthContext, TenantContext)
├── hooks/                Lógica reutilizable (useCanchas, useSlots, etc.)
├── services/             Funciones que llaman a la API / Supabase
├── lib/                  bffClient (llamadas al BFF) y supabase (cliente)
├── utils/                Helpers puros (fechas, slots)
└── types/                Tipos TypeScript compartidos
```

**Qué llama al BFF y qué a Supabase directo:**

- Al **BFF** (los 7 endpoints): login, registro, listar complejos, listar
  canchas, y crear / listar / cancelar reservas.
- A **Supabase directo**: el resto (fotos, horarios, bloqueos, panel de
  administración, estadísticas, storage de imágenes).

---

## Estructura del BFF

```
src/
├── index.ts                    Servidor Express + registro de rutas
├── config/supabase.ts          Cliente de Supabase
├── middleware/auth.middleware.ts  Valida el JWT (requireAuth)
└── routes/
    ├── auth.routes.ts          Login y registro
    ├── complejos.routes.ts     Listado de complejos
    ├── canchas.routes.ts       Listado de canchas
    └── reservas.routes.ts      Crear / listar / cancelar reservas
```

Cada archivo de `routes/` agrupa los endpoints de una entidad (separación de
responsabilidades). El middleware `requireAuth` se reutiliza en todas las rutas
que necesitan usuario logueado.

---

## Cómo correr el proyecto

Hay que levantar **los dos proyectos** a la vez, cada uno en su terminal:

**BFF** (carpeta `TuChanchera-BFF`):
```bash
npm install
npm run dev      # queda en http://localhost:3001
```

**Front** (carpeta `TuChanchera`):
```bash
npm install
npm run dev      # queda en http://localhost:5173
```

Cada proyecto necesita su archivo de variables de entorno (`.env.local` en el
front, `.env` en el BFF) con las claves de Supabase. Ver el `.env.example` de
cada repo.

---

## Stack tecnológico

| Capa | Tecnologías |
|------|-------------|
| Front | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router |
| BFF | Node.js, Express, TypeScript |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth (tokens JWT) |
