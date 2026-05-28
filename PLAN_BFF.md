# Plan BFF — TuChanchera

## ¿Se puede? ¿Es difícil?

**SÍ se puede, y NO es crítico.** Estimado: 4 a 6 horas de trabajo total.

La razón por la que es fácil es que el front ya tiene un patrón Service Layer:
el comentario en `complejoService.ts` dice literalmente
*"Si en el futuro se cambia el backend, solo se modifica esta capa."*
Eso es exactamente lo que vamos a hacer: cambiar SOLO los services.

**Lo que NO cambia:** páginas, componentes, hooks, contextos, types, UI — nada.
**Lo que SÍ cambia:** 2 archivos de services + agregar un cliente HTTP liviano.

---

## Arquitectura final

```
┌─────────────────────────────────────────┐
│   FRONT  (React + Vite)  :5173           │
│   src/services/ → llama al BFF          │
│   (Auth + Realtime siguen en Supabase)  │
└──────────────┬──────────────────────────┘
               │  HTTP (fetch / axios)
               │  Bearer: JWT de Supabase
┌──────────────▼──────────────────────────┐
│   BFF  (Node.js + Express)  :3001        │  ← NUEVO REPO
│   Verifica JWT, orquesta llamadas       │
│   Lee/escribe en MongoDB                │
└──────┬──────────────────┬───────────────┘
       │  Supabase JS SDK │  Mongoose
┌──────▼──────┐   ┌───────▼───────────────┐
│  SUPABASE   │   │  MONGODB ATLAS (free) │
│  PostgreSQL │   │  colección: complejos │
│  Auth + RLS │   │  (sincronizado)       │
└─────────────┘   └───────────────────────┘
```

---

## Estructura del BFF (nuevo repo: `tuchanchera-bff`)

```
tuchanchera-bff/
├── src/
│   ├── config/
│   │   ├── supabase.ts       ← cliente Supabase con service_role key
│   │   └── mongo.ts          ← conexión Mongoose
│   ├── middleware/
│   │   └── auth.middleware.ts ← verifica JWT de Supabase en cada request
│   ├── models/
│   │   └── Complejo.model.ts  ← schema Mongoose (MongoDB)
│   ├── routes/
│   │   ├── auth.routes.ts     ← POST /api/auth/login + /signup
│   │   ├── complejos.routes.ts← GET /api/complejos (desde MongoDB)
│   │   ├── reservas.routes.ts ← POST /api/reservas + GET /api/reservas
│   │   └── sync.routes.ts     ← POST /api/sync/complejos (Supabase→Mongo)
│   └── index.ts               ← servidor Express
├── .env
├── package.json
└── tsconfig.json
```

---

## Los 4 endpoints del BFF (lo que pide el profe)

| # | Método | Ruta | Auth | Qué hace |
|---|--------|------|------|----------|
| 1 | POST | `/api/auth/login` | ❌ | Llama a Supabase Auth, devuelve JWT |
| 2 | GET | `/api/complejos` | ❌ | Lee desde **MongoDB** (sincronizado) |
| 3 | POST | `/api/reservas` | ✅ JWT | Crea reserva en Supabase vía BFF |
| 4 | POST | `/api/sync/complejos` | ❌ | Copia complejos de Supabase → MongoDB |

> El endpoint 4 es el que el profe pidió:
> *"puede haber un endpoint de sincronización con la BD de backend
> y siempre responder desde MongoDB"*

---

## Qué cambia en el front (MÍNIMO)

### Nuevo archivo: `src/lib/bffClient.ts`
```typescript
// Cliente HTTP liviano para llamar al BFF
const BFF_URL = import.meta.env.VITE_BFF_URL ?? 'http://localhost:3001'

export async function bffGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}

export async function bffPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}
```

### Cambios en `complejoService.ts` (solo 1 función)
```typescript
// ANTES: llamaba a Supabase directamente
export async function fetchComplejosActivos(): Promise<Complejo[]> {
  const { data, error } = await supabase.from('complejos')...

// DESPUÉS: llama al BFF
export async function fetchComplejosActivos(): Promise<Complejo[]> {
  return bffGet<Complejo[]>('/api/complejos')
}
```

### Cambios en `reservaService.ts` (2 funciones)
```typescript
// crearReservaEnLugar → POST /api/reservas (con token)
// fetchMisReservas   → GET  /api/reservas  (con token)
// El resto sigue igual llamando a Supabase
```

### Qué NO cambia
- `AuthContext.tsx` — sigue usando Supabase Auth directamente (Google OAuth, sesión)
- Todos los hooks (`useSlots`, `useWeekSlots`, etc.)
- Todas las páginas y componentes
- El panel admin completo
- Realtime (sigue siendo Supabase WebSockets)

---

## Código del BFF — los archivos clave

### `src/index.ts`
```typescript
import express from 'express'
import cors from 'cors'
import { connectMongo } from './config/mongo'
import authRoutes from './routes/auth.routes'
import complejosRoutes from './routes/complejos.routes'
import reservasRoutes from './routes/reservas.routes'
import syncRoutes from './routes/sync.routes'

const app = express()
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/complejos', complejosRoutes)
app.use('/api/reservas', reservasRoutes)
app.use('/api/sync', syncRoutes)

const PORT = process.env.PORT ?? 3001

connectMongo().then(() => {
  app.listen(PORT, () => console.log(`BFF corriendo en :${PORT}`))
})
```

### `src/middleware/auth.middleware.ts`
```typescript
import { Request, Response, NextFunction } from 'express'
import { supabase } from '../config/supabase'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Sin token' })

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return res.status(401).json({ error: 'Token inválido' })

  req.user = data.user  // disponible en los controllers
  next()
}
```

### `src/routes/auth.routes.ts`
```typescript
import { Router } from 'express'
import { supabase } from '../config/supabase'

const router = Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return res.status(401).json({ error: error.message })
  res.json({ access_token: data.session?.access_token, user: data.user })
})

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password } = req.body
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return res.status(400).json({ error: error.message })
  res.json({ user: data.user })
})

export default router
```

### `src/models/Complejo.model.ts`
```typescript
import { Schema, model } from 'mongoose'

// Modelo MongoDB — espeja la tabla complejos de PostgreSQL
const complejoSchema = new Schema({
  supabase_id: { type: String, required: true, unique: true },
  nombre:      { type: String, required: true },
  slug:        { type: String, required: true },
  ciudad:      String,
  direccion:   String,
  activo:      { type: Boolean, default: true },
  sincronizado_en: { type: Date, default: Date.now },
})

export const Complejo = model('Complejo', complejoSchema)
```

### `src/routes/complejos.routes.ts`
```typescript
import { Router } from 'express'
import { Complejo } from '../models/Complejo.model'

const router = Router()

// GET /api/complejos — siempre responde desde MongoDB
router.get('/', async (_req, res) => {
  const complejos = await Complejo.find({ activo: true }).sort({ sincronizado_en: -1 })
  res.json(complejos)
})

export default router
```

### `src/routes/sync.routes.ts`
```typescript
import { Router } from 'express'
import { supabase } from '../config/supabase'
import { Complejo } from '../models/Complejo.model'

const router = Router()

// POST /api/sync/complejos — copia Supabase → MongoDB
router.post('/complejos', async (_req, res) => {
  const { data, error } = await supabase
    .from('complejos').select('*').eq('activo', true)

  if (error) return res.status(500).json({ error: error.message })

  let sincronizados = 0
  for (const c of data ?? []) {
    await Complejo.findOneAndUpdate(
      { supabase_id: c.id },
      { supabase_id: c.id, nombre: c.nombre, slug: c.slug,
        ciudad: c.ciudad, direccion: c.direccion, activo: c.activo,
        sincronizado_en: new Date() },
      { upsert: true }
    )
    sincronizados++
  }

  res.json({ ok: true, sincronizados })
})

export default router
```

---

## Setup de MongoDB Atlas (10 minutos)

1. Ir a https://mongodb.com/atlas → crear cuenta gratis
2. Crear cluster M0 (gratis)
3. Database Access → crear usuario `bff_user` con password
4. Network Access → agregar `0.0.0.0/0` (para que funcione local)
5. Connect → Drivers → copiar el connection string
6. Pegarlo en `.env` del BFF como `MONGODB_URI`

---

## Variables de entorno del BFF (`.env`)

```env
PORT=3001
SUPABASE_URL=https://ztwtxrsanjehzpdbitxg.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<tu service_role key de Supabase>
MONGODB_URI=mongodb+srv://bff_user:<password>@cluster0.xxxxx.mongodb.net/tuchanchera
```

> ⚠️ La `service_role_key` NUNCA va al front. Solo vive en el BFF.
> Es la key que bypassea RLS — el BFF la usa para leer complejos sin restricciones.

---

## Variables de entorno del Front (`.env.local`)

Agregar una línea:
```env
VITE_BFF_URL=http://localhost:3001
```

---

## Demo en Postman con BFF

| # | Endpoint | Antes | Ahora |
|---|----------|-------|-------|
| 1 | Login | `/auth/v1/token` (Supabase) | `POST :3001/api/auth/login` |
| 2 | Registro | `/auth/v1/signup` (Supabase) | `POST :3001/api/auth/signup` |
| 3 | Listar complejos | `/rest/v1/complejos` (Supabase) | `GET :3001/api/complejos` (MongoDB) |
| 4 | Sincronizar | — | `POST :3001/api/sync/complejos` |
| 5 | Crear reserva | `/rest/v1/reservas` (Supabase) | `POST :3001/api/reservas` |
| 6 | Mis reservas | `/rest/v1/reservas` (Supabase) | `GET :3001/api/reservas` |
| 7 | Cancelar | `/rpc/cancelar_reserva_cliente` | `POST :3001/api/reservas/:id/cancelar` |

---

## Orden de implementación recomendado

### Paso 1 — Crear repo BFF (30 min)
```bash
mkdir tuchanchera-bff && cd tuchanchera-bff
npm init -y
npm install express cors dotenv mongoose @supabase/supabase-js
npm install -D typescript @types/express @types/node ts-node nodemon
npx tsc --init
```

### Paso 2 — Config + Middleware (30 min)
- `src/config/supabase.ts` — cliente con service_role
- `src/config/mongo.ts` — conexión Mongoose
- `src/middleware/auth.middleware.ts` — verifica JWT

### Paso 3 — Endpoints (2 horas)
- Auth (login + signup)
- Complejos (GET desde Mongo + POST sync)
- Reservas (GET + POST + cancelar)

### Paso 4 — Actualizar el front (1 hora)
- Crear `src/lib/bffClient.ts`
- Actualizar `complejoService.ts` (fetchComplejosActivos)
- Actualizar `reservaService.ts` (crearReservaEnLugar + fetchMisReservas)

### Paso 5 — Probar todo (30 min)
- Correr BFF en `:3001` y front en `:5173`
- Probar los 4 endpoints en Postman desde el BFF
- Verificar que el front sigue funcionando igual

---

## Resumen

| Item | Estado |
|------|--------|
| ¿Se puede hacer? | ✅ Sí |
| ¿Es difícil? | 🟡 Medio (no crítico) |
| ¿Se rompe el front? | ✅ No — solo cambian 2 services |
| ¿Cuánto tiempo? | ~4 a 6 horas |
| ¿MongoDB? | ✅ Atlas free tier, 10 min de setup |
| ¿Nuevo repo? | ✅ `tuchanchera-bff` (separado) |
| ¿Muestra código para el profe? | ✅ Express, Mongoose, JWT, patrones OOP |
