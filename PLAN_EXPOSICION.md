# Plan de Exposición — TuChanchera

## Arquitectura del proyecto (2 capas)

```
┌─────────────────────────────────┐
│   FRONTEND  (React + TypeScript) │  localhost:5173
│   src/pages, src/services,       │
│   src/hooks, src/components      │
└────────────────┬────────────────┘
                 │  Supabase JS Client
                 │  (REST API + RPC + Auth + Realtime)
┌────────────────▼────────────────┐
│   BACKEND  (Supabase)            │  cloud / Supabase Dashboard
│   PostgreSQL + Auth + RLS        │
│   + Edge Functions + Storage     │
└─────────────────────────────────┘
```

> Aplica el punto 5 del enunciado: 2 capas → 7 endpoints desde el front,
> BD relacional (PostgreSQL). El backend es Supabase con lógica propia
> en funciones SQL (SECURITY DEFINER) y Row Level Security.

---

## Los 7 endpoints a demostrar

| # | Nombre | Método | Path | Auth | Qué demuestra |
|---|--------|--------|------|------|---------------|
| 1 | **Login** | POST | `/auth/v1/token?grant_type=password` | ❌ | Autenticación JWT |
| 2 | **Registro** | POST | `/auth/v1/signup` | ❌ | Alta de usuario |
| 3 | **Listar Complejos** | GET | `/rest/v1/complejos` | ❌ | Listado público con filtro |
| 4 | **Listar Canchas** | GET | `/rest/v1/canchas?complejo_id=eq.{id}` | ❌ | Listado relacionado |
| 5 | **Crear Reserva** | POST | `/rest/v1/reservas` | ✅ | Alta con RLS |
| 6 | **Mis Reservas** | GET | `/rest/v1/reservas?cliente_id=eq.{id}` | ✅ | Listado privado (RLS) |
| 7 | **Cancelar Reserva** | POST | `/rest/v1/rpc/cancelar_reserva_cliente` | ✅ | Lógica de negocio en backend |

---

## Flujo de la demo — paso a paso

### Parte 1 — Setup (antes de empezar, 2 min)
- Mostrar los 2 proyectos corriendo:
  - **Front:** `npm run dev` → `localhost:5173`
  - **Backend:** abrir Supabase Dashboard (Table Editor + SQL Editor abiertos)
- Mostrar Postman con la collection cargada
- Mostrar el repo en GitHub con la rama `develop`

---

### Parte 2 — Endpoints en Postman (8-10 min)

**Paso 1 — RLS sin token (antes del login)**
- Ejecutar: `GET /rest/v1/reservas` sin Authorization
- Resultado: `[]` — el backend devuelve vacío, no 401
- Explicar: Row Level Security de PostgreSQL filtra a nivel de BD, no de API

**Paso 2 — Login**
- Ejecutar: `POST /auth/v1/token` con email + password
- Mostrar respuesta: JWT con `access_token`, `user.id`, `expires_in`
- El token se guarda automático en la variable `access_token` de Postman
- Abrir Supabase Dashboard → Auth → Users → mostrar el usuario

**Paso 3 — Registro**
- Ejecutar: `POST /auth/v1/signup` con email nuevo
- Mostrar en Dashboard → Auth → Users que aparece el nuevo registro
- Explicar: Supabase dispara un trigger que crea la fila en `profiles`

**Paso 4 — Listar Complejos**
- Ejecutar: `GET /rest/v1/complejos?activo=eq.true`
- Mostrar respuesta con los complejos activos
- Copiar un `id` a la variable `complejo_id`

**Paso 5 — Listar Canchas**
- Ejecutar: `GET /rest/v1/canchas?complejo_id=eq.{complejo_id}`
- Muestra la relación entre tablas (FK complejo_id)
- Copiar un `id` a la variable `cancha_id`

**Paso 6 — Crear Reserva**
- Ejecutar: `POST /rest/v1/reservas` con Bearer token
- Mostrar la reserva creada en la respuesta (con `id`, `estado: confirmada`)
- Abrir Supabase Dashboard → Table Editor → `reservas` → mostrar la fila insertada
- Explicar: RLS verifica que `cliente_id = auth.uid()` antes de insertar

**Paso 7 — Mis Reservas**
- Ejecutar: `GET /rest/v1/reservas?cliente_id=eq.{user_id}` con Bearer token
- Mostrar que trae la reserva del paso 6 con JOIN a canchas y complejos
- Hacer la misma llamada SIN token → devuelve `[]` (contraste RLS)

**Paso 8 — Cancelar Reserva (RPC)**
- Ejecutar: `POST /rest/v1/rpc/cancelar_reserva_cliente`
- Mostrar respuesta: `{ok: true, code: "CANCELLED"}`
- Ejecutar de nuevo → `{ok: false, code: "WRONG_STATUS"}` (ya cancelada)
- Explicar: la lógica vive en una función PostgreSQL SECURITY DEFINER

---

### Parte 3 — Demo en el Front (5 min)

- Ir a `localhost:5173`
- Hacer login desde la UI → abrir DevTools → Network → mostrar la llamada a `/auth/v1/token`
- Navegar a un complejo → mostrar en Network la llamada a `/rest/v1/canchas`
- Hacer una reserva desde la UI → mostrar en Network el POST a `/rest/v1/reservas`
- Ir a "Mis Reservas" → mostrar que aparece en tiempo real (Realtime de Supabase)
- Cancelar la reserva → mostrar el call a `/rpc/cancelar_reserva_cliente`

---

### Parte 4 — Mostrar el código (criterios de evaluación, 5 min)

#### Claridad de código
Mostrar `src/services/reservaService.ts`:
```
- Comentario en la cabecera: "PATRÓN: Service Layer (DIP)"
- Funciones con nombres descriptivos: fetchMisReservas, crearReservaEnLugar, cancelarReservaCliente
- Tipos explícitos: CancelResult con todos los casos posibles
```

#### Modularidad
Mostrar la separación por capas:
```
src/
├── services/     → comunicación con Supabase (1 responsabilidad por archivo)
├── hooks/        → lógica de estado reutilizable (useSlots, useWeekSlots)
├── pages/        → vistas (sin lógica de datos)
├── components/   → UI reutilizable
├── context/      → estado global (Auth, Tenant)
└── types/        → contratos de datos
```

#### Estructura del proyecto
Mostrar el árbol completo, destacar:
- `supabase/migrations/` → historial de cambios de BD versionado
- `supabase/functions/` → Edge Functions (serverless)
- `public/sw.js` + `manifest.webmanifest` → PWA

#### Herencia y polimorfismo
Mostrar `src/types/index.ts`:
- `ReservaAdmin` extiende `Reserva` con campos extra de admin
- Union types como polimorfismo de datos:
  ```typescript
  estado: 'confirmada' | 'cancelada_admin' | 'cancelada_cliente' | 'pendiente_pago'
  metodo_pago: 'en_lugar' | 'mercadopago'
  ```
- `ProtectedRoute` acepta múltiples roles → comportamiento polimórfico según rol del usuario
- `CancelResult` como tipo discriminado (similar a sealed classes):
  ```typescript
  type CancelResult =
    | { ok: true; code: 'CANCELLED' }
    | { ok: false; code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'WRONG_STATUS' }
    | { ok: false; code: 'TOO_LATE'; horas_restantes: number }
  ```

#### Dominio del código
Saber explicar:
- Por qué RLS y no validaciones solo en el front
- Qué es una RPC de Supabase y por qué `cancelar_reserva_cliente` es SECURITY DEFINER
- Qué hace `useWeekSlots` vs 7 llamadas por día (optimización de N+1)
- Por qué `DisponibilidadSlot` no expone `cliente_id` (privacidad)

---

## Criterios del profe — checklist

| Criterio | Pts | Cómo lo cubrimos |
|----------|-----|-----------------|
| Entrega en GIT rama develop | 4 | Repo en GitHub, rama `develop`, historial de commits |
| Pull Requests aprobados | 1 | Cada integrante tiene PR aprobado por otro en `develop` |
| Claridad de código | 1 | Comentarios de patrones, nombres descriptivos, tipos explícitos |
| Modularidad | 1 | services / hooks / pages / components / context / types |
| Estructura del proyecto | 0.5 | Árbol de carpetas coherente + migrations versionadas |
| Herencia y polimorfismo | 1 | Tipos discriminados, union types, extensión de interfaces, ProtectedRoute por rol |
| Dominio del código | 1 | Cada uno explica su parte, saber el "por qué" de cada decisión |
| Explicación a la clase | 0.5 | Flujo claro, Postman preparado, DevTools abierto |
| **EXTRA** | + | Realtime (WebSockets), PWA, RLS, Edge Functions, migraciones SQL, export CSV |

---

## Reparto sugerido de la explicación

> Adaptar según cuántos integrantes son y quién hizo qué parte.

- **Persona A** — Arquitectura general + Auth (endpoints 1 y 2) + explicar RLS
- **Persona B** — Listados (endpoints 3 y 4) + estructura de carpetas + types
- **Persona C** — Crear reserva (endpoint 5) + Mis Reservas (6) + service layer
- **Persona D** — Cancelar reserva RPC (endpoint 7) + lógica de negocio en BD + demo en front

---

## Puntos para destacar como extras

- **Realtime:** la grilla de reservas y "Mis Reservas" se actualizan sin recargar la página (WebSocket de Supabase)
- **PWA:** la app se puede instalar en el celular como si fuera nativa (`public/manifest.webmanifest` + `sw.js`)
- **Migraciones versionadas:** `supabase/migrations/` tiene el historial completo de cambios de BD, reproducible en cualquier entorno
- **Export CSV:** el admin puede exportar reservas en CSV desde el panel
- **RLS:** seguridad a nivel de base de datos, no solo a nivel de API — un request malicioso nunca ve datos de otro usuario
- **SECURITY DEFINER:** las RPCs se ejecutan con privilegios del creador, no del llamador — permite lógica de negocio segura

---

## Preparación el día de la expo

- [ ] `npm run dev` corriendo en la notebook
- [ ] Postman abierto con la collection, credenciales reales cargadas
- [ ] Supabase Dashboard abierto: Table Editor (reservas) + Auth (Users) + SQL Editor
- [ ] DevTools del navegador abierto en pestaña Network
- [ ] GitHub con el repo abierto en rama `develop`
- [ ] Tener una cuenta de prueba con algunas reservas ya cargadas
- [ ] Tener otra cuenta para mostrar que el RLS aísla datos entre usuarios
- [ ] Saber de memoria el puerto local (`localhost:5173`)
