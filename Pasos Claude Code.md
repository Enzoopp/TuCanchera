# Guía de desarrollo — TuCanchera
## Cómo usar este archivo
Seguí los pasos en orden. Antes de cada paso, copiá el mensaje y mandáselo a Claude Code.
No avances al siguiente paso hasta que el actual funcione correctamente.

---

## MENSAJE DE INICIO (mandá esto primero, con el archivo prompt_tucanchera.md adjunto)

> "Vas a ayudarme a construir una web app llamada TuCanchera. Te paso el archivo `prompt_tucanchera.md` con toda la especificación del proyecto. Leelo completo antes de hacer cualquier cosa y confirmame que lo entendiste resumiendo las partes principales. No escribas código todavía."

---

## FASE 1 — Base del proyecto

### Paso 1 — Estructura + dependencias
> "Creá la estructura de carpetas del proyecto según el prompt. Inicializá con Vite + React + TypeScript. Instalá y configurá Tailwind CSS y shadcn/ui con la paleta azul y blanco definida. Creá los archivos de configuración base: `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`. Dejá las carpetas `components`, `pages`, `hooks`, `services`, `context`, `lib`, `types` y `utils` creadas con un archivo `.gitkeep` cada una."

### Paso 2 — Esquema SQL de Supabase
> "Generá el archivo `supabase/schema.sql` con el esquema SQL completo del proyecto: todas las tablas, constraints, y políticas de Row Level Security (RLS) tal como están definidas en el prompt. Agregá comentarios explicando cada tabla y cada política."

### Paso 3 — Cliente Supabase + contextos globales
> "Configurá el cliente de Supabase en `src/lib/supabase.ts`. Creá `AuthContext` en `src/context/AuthContext.tsx` que exponga: `user`, `profile`, `rol`, `loading`, `signIn`, `signOut`. Creá `TenantContext` en `src/context/TenantContext.tsx` que resuelva el complejo activo a partir del slug de la URL. Agregá comentarios técnicos explicando el patrón Singleton y SRP aplicados."

---

## FASE 2 — Autenticación

### Paso 4 — Página de Login
> "Creá la página de Login en `src/pages/Login.tsx`. Formulario con email y contraseña usando shadcn/ui. Al hacer login exitoso redirigir según el rol: admin va a `/admin/dashboard`, cliente va a `/`. Mostrar mensajes de error claros en español. Incluir link a Register."

### Paso 5 — Página de Register (cliente)
> "Creá la página de Register en `src/pages/Register.tsx`. Formulario con nombre, teléfono, email y contraseña. Al registrarse exitosamente se crea el perfil con `rol = 'cliente'` y se redirige al Login con mensaje de confirmación. Incluir link a Login."

### Paso 6 — Página de Register Admin
> "Creá la página de Register Admin en `src/pages/RegisterAdmin.tsx`. Formulario con: código de invitación, nombre, teléfono, email y contraseña. Validar el código contra la tabla `codigos_invitacion` antes de crear la cuenta. Si el código es válido, crear el perfil con `rol = 'admin'` y marcar el código como usado. Redirigir al panel admin para que cree su complejo."

### Paso 7 — Rutas protegidas
> "Creá el componente `src/components/ProtectedRoute.tsx` que reciba una prop `rol` y redirija al Login si el usuario no está autenticado, o a `/` si no tiene el rol requerido. Aplicá este componente a todas las rutas de `/admin/*` y a `/mis-reservas`. Agregá comentarios explicando el patrón de HOC y DIP aplicados."

---

## FASE 3 — Página pública del complejo

### Paso 8 — Página del complejo (`/:slug`)
> "Creá la página pública del complejo en `src/pages/Complejo.tsx`. Debe usar `TenantContext` para obtener los datos del complejo activo. Mostrar: logo, nombre, descripción, dirección, galería de fotos y listado de canchas. El diseño debe ser atractivo, azul y blanco, responsive y mobile-first. Usar skeleton loaders mientras cargan los datos."

### Paso 9 — Filtros de canchas
> "Agregá filtros a la página del complejo para filtrar las canchas por: tipo (fútbol 5, fútbol 7, pádel), precio (menor a mayor) y disponibilidad hoy (mostrar solo canchas con al menos un slot libre hoy). Los filtros deben ser visuales, intuitivos y funcionar sin recargar la página."

### Paso 10 — Página 404 complejo no encontrado
> "Creá la página `src/pages/ComplejoNoEncontrado.tsx` que se muestre cuando el slug no existe en la base de datos. Diseño cuidado con mensaje claro en español, ícono o ilustración y sin links rotos. Esta página reemplaza el 404 genérico del browser."

---

## FASE 4 — Flujo de reserva

### Paso 11 — Calendario de slots (`/:slug/reservar/:canchaId`)
> "Creá la página de reserva en `src/pages/Reservar.tsx`. Mostrar un calendario semanal con los slots de la cancha seleccionada. Cada slot debe tener un color según su estado: verde para libre, rojo para ocupado, gris para bloqueado. El usuario puede navegar entre semanas. En mobile mostrar un día a la vez con flechas para navegar."

### Paso 12 — Lógica de generación de slots
> "Creá `src/utils/slots.ts` con la función pura `generarSlots()` que recibe: horarios de la cancha para ese día de la semana, reservas confirmadas de esa fecha, bloqueos del admin para esa fecha, y duración del turno en minutos. Retorna un array de slots con `{ horaInicio, horaFin, estado }`. Agregá comentarios explicando SRP y por qué es una función pura (sin efectos secundarios)."

### Paso 13 — Modal de confirmación de turno
> "Al hacer clic en un slot libre, mostrar un modal de confirmación con: nombre de la cancha, fecha, horario, duración y precio. El modal debe tener dos botones: 'Pagar con MercadoPago' y 'Pagar en el lugar'. Si el usuario no está logueado, redirigir al Login antes de mostrar el modal."

### Paso 14 — Opción pagar en el lugar
> "Implementar el flujo de 'Pagar en el lugar': al confirmar, crear la reserva en Supabase con `metodo_pago = 'en_lugar'` y `estado = 'confirmada'`. Mostrar pantalla de éxito con el resumen de la reserva. El slot debe quedar marcado como ocupado inmediatamente."

### Paso 15 — Edge Function: crear preferencia MercadoPago
> "Creá la Edge Function de Supabase `supabase/functions/crear-preferencia-mp/index.ts`. Recibe: `canchaId`, `fecha`, `horaInicio`, `horaFin`, `clienteId`. Crea la reserva con `estado = 'pendiente_pago'`, luego llama a la API de MercadoPago para crear una preferencia de pago con los datos del turno. Retorna la URL del Checkout Pro de MercadoPago. Las credenciales de MP van en variables de entorno de Supabase."

### Paso 16 — Webhook MercadoPago
> "Creá la Edge Function `supabase/functions/webhook-mp/index.ts`. Recibe las notificaciones de MercadoPago. Si el pago fue aprobado, actualiza la reserva correspondiente a `estado = 'confirmada'`. Si fue rechazado o expiró, deja la reserva en `pendiente_pago` para que el cron job la limpie después. Validar la firma del webhook de MercadoPago."

### Paso 17 — Limpieza de reservas pendientes + email de confirmación
> "Creá la Edge Function `supabase/functions/limpiar-pendientes/index.ts` que elimine reservas con `estado = 'pendiente_pago'` y más de 15 minutos de antigüedad, liberando el slot. Configurá también el trigger de Supabase que envía un email de confirmación automático al cliente cuando una reserva pasa a `estado = 'confirmada'`."

### Paso 18 — Página Mis Reservas
> "Creá la página `src/pages/MisReservas.tsx` (ruta `/mis-reservas`). Mostrar el historial de reservas del cliente autenticado ordenado por fecha descendente. Para cada reserva mostrar: complejo, cancha, tipo, fecha, hora, método de pago y estado. Separar visualmente las reservas futuras de las pasadas."

---

## FASE 5 — Panel de administración

### Paso 19 — Dashboard del admin
> "Creá el dashboard del admin en `src/pages/admin/Dashboard.tsx` (ruta `/admin/dashboard`). Mostrar: reservas del día agrupadas por cancha con su estado, contadores rápidos (confirmadas / pendientes / bloqueadas) y accesos directos a bloquear turno y ver estadísticas. Diseño limpio tipo panel de gestión, azul y blanco."

### Paso 20 — Gestión del complejo
> "Creá la página `src/pages/admin/GestionComplejo.tsx` (ruta `/admin/complejo`). Formulario para editar: nombre, descripción y dirección del complejo. Upload de logo con preview (Supabase Storage, bucket `logos`). Galería de fotos con opción de agregar nuevas y reordenar arrastrando (bucket `fotos-complejos`). Guardado con feedback visual."

### Paso 21 — Gestión de canchas (CRUD)
> "Creá la página `src/pages/admin/GestionCanchas.tsx` (ruta `/admin/canchas`). Listado de canchas con: tipo, nombre, precio, duración y toggle activa/inactiva. Formulario para crear nueva cancha: tipo, nombre, precio, duración y horarios de funcionamiento por cada día de la semana. Posibilidad de editar precio y nombre inline."

### Paso 22 — Bloqueos de turnos
> "Creá la página `src/pages/admin/Bloqueos.tsx` (ruta `/admin/bloqueos`). El admin selecciona una cancha y una fecha, ve los slots de ese día y puede hacer clic en cualquier slot libre para bloquearlo ingresando un motivo opcional. Los slots ya bloqueados se muestran en gris con opción de desbloquear."

### Paso 23 — Historial de reservas del admin
> "Creá la página `src/pages/admin/Reservas.tsx` (ruta `/admin/reservas`). Tabla con todas las reservas del complejo del admin. Filtros: cancha, fecha, estado y método de pago. Columnas: cliente, cancha, fecha, hora, método de pago, estado. El admin puede cancelar una reserva cambiando su estado a `cancelada_admin`."

### Paso 24 — Estadísticas
> "Creá la página `src/pages/admin/Estadisticas.tsx` (ruta `/admin/estadisticas`). Mostrar: recaudación total del período, desglosada en online (MercadoPago) vs en lugar. Gráfico de reservas por semana y por mes. Ranking de canchas más reservadas. Filtro por rango de fechas. Usar recharts para los gráficos."

---

## NOTAS IMPORTANTES

- **Probá cada fase antes de pasar a la siguiente.** Si el paso 3 no funciona, no arranques el paso 4.
- **Si Claude Code se traba en algo**, preguntale específicamente sobre ese punto en lugar de repetirle todo el prompt.
- **Para la Fase 4 (pagos)** necesitás tener credenciales de MercadoPago en modo sandbox antes de arrancar el paso 15. Creá una cuenta en developers.mercadopago.com.
- **Para las Edge Functions** necesitás tener instalado Supabase CLI localmente.
- **Variables de entorno necesarias:**
  ```
  VITE_SUPABASE_URL=
  VITE_SUPABASE_ANON_KEY=
  MP_ACCESS_TOKEN=          (solo en Edge Functions, nunca en el frontend)
  MP_WEBHOOK_SECRET=        (para validar notificaciones de MP)
  ```
