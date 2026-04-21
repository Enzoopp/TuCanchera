# TuCanchera — Workflows de n8n

Guía para configurar los workflows de automatización en n8n.

---

## Arquitectura general

```
Supabase DB (trigger pg_net)
    └─► n8n Webhook: /webhook/tucanchera-eventos
            ├─► estado = "confirmada"  → Workflow 1: Confirmación de reserva
            ├─► estado = "cancelada_admin" → Workflow 2: Cancelación
            └─► INSERT nuevo           → Workflow 3: Nueva reserva (aviso al admin)

MercadoPago (webhook pago)
    └─► n8n Webhook: /webhook/mercadopago
            ├─► status = "approved"    → Actualiza Supabase + Workflow 1
            └─► status = "rejected"    → Workflow 4: Pago rechazado

n8n Schedule (cada 15 min)
    └─► Workflow 5: Limpieza de reservas pendientes expiradas

n8n Schedule (1h antes del turno)
    └─► Workflow 6: Recordatorio de turno
```

---

## Configuración inicial de n8n

1. Crear cuenta en [n8n.cloud](https://n8n.cloud) o auto-hostearlo en Railway/Render
2. Copiar la URL base (ej: `https://tucanchera.app.n8n.cloud`)
3. Pegar en `.env.local`: `VITE_N8N_WEBHOOK_BASE_URL=https://tucanchera.app.n8n.cloud`
4. Configurar credenciales en n8n:
   - **Supabase**: URL + Service Role Key (desde Supabase Dashboard > Settings > API)
   - **WhatsApp Business API**: token de Meta Business (o Twilio para WhatsApp)
   - **MercadoPago**: Access Token de producción/sandbox

---

## Configurar la URL del webhook en Supabase

Una vez que tengas la URL de n8n, configurar en Supabase:

```sql
-- Ejecutar en Supabase SQL Editor
ALTER DATABASE postgres
  SET app.n8n_webhook_reservas = 'https://TU-INSTANCIA.n8n.cloud/webhook/tucanchera-eventos';
```

---

## Workflow 1 — Confirmación de reserva

**Trigger:** Webhook POST `/webhook/tucanchera-eventos`
**Condición:** `estado == "confirmada"`

**Nodos:**
1. **Webhook** — recibe el payload de Supabase
2. **IF** — filtra solo eventos donde `estado == "confirmada"`
3. **Supabase** (HTTP Request) — obtiene datos completos:
   ```
   GET /rest/v1/reservas?id=eq.{{$json.reserva_id}}&select=*,canchas(nombre,tipo,complejos(nombre,direccion)),profiles(nombre,telefono)
   ```
4. **WhatsApp Business** — envía al cliente:
   ```
   ✅ ¡Tu reserva está confirmada!
   
   🏟️ Complejo: {{complejos.nombre}}
   ⚽ Cancha: {{canchas.nombre}}
   📅 Fecha: {{fecha}}
   🕐 Horario: {{hora_inicio}} - {{hora_fin}}
   📍 Dirección: {{complejos.direccion}}
   
   ¡Te esperamos!
   ```
5. **WhatsApp Business** — envía al admin del complejo:
   ```
   🆕 Nueva reserva confirmada
   
   Cliente: {{profiles.nombre}}
   Cancha: {{canchas.nombre}}
   Fecha: {{fecha}} {{hora_inicio}}
   Pago: {{metodo_pago}}
   ```

---

## Workflow 2 — Cancelación por admin

**Trigger:** Webhook POST `/webhook/tucanchera-eventos`
**Condición:** `estado == "cancelada_admin"`

**Nodos:**
1. **Webhook** — recibe el payload
2. **IF** — filtra `estado == "cancelada_admin"`
3. **Supabase** — obtiene datos del cliente y la reserva
4. **WhatsApp Business** — envía al cliente:
   ```
   ❌ Tu reserva fue cancelada
   
   Lamentablemente tu reserva del {{fecha}} a las {{hora_inicio}}
   en {{complejos.nombre}} fue cancelada por el administrador.
   
   Podés hacer una nueva reserva cuando quieras.
   ```

---

## Workflow 3 — Nueva reserva pendiente de pago (aviso al admin)

**Trigger:** Webhook POST `/webhook/tucanchera-eventos`
**Condición:** `evento == "INSERT"` y `metodo_pago == "en_lugar"`

**Nodos:**
1. **Webhook** — recibe el payload
2. **IF** — filtra inserts con `metodo_pago == "en_lugar"`
3. **Supabase** — obtiene datos
4. **WhatsApp al admin:**
   ```
   📋 Nueva reserva (pago en el lugar)
   
   Cliente: {{profiles.nombre}} — {{profiles.telefono}}
   Cancha: {{canchas.nombre}}
   Fecha: {{fecha}} {{hora_inicio}}
   
   Recordá confirmar la reserva cuando el cliente pague.
   ```

---

## Workflow 4 — Pago aprobado por MercadoPago

**Trigger:** Webhook POST `/webhook/mercadopago`

**Nodos:**
1. **Webhook** — recibe el webhook de MP
2. **IF** — filtra `status == "approved"`
3. **HTTP Request** — valida el pago con la API de MP:
   ```
   GET https://api.mercadopago.com/v1/payments/{{payment_id}}
   Headers: Authorization: Bearer {{MP_ACCESS_TOKEN}}
   ```
4. **Supabase** — actualiza la reserva:
   ```sql
   UPDATE reservas
   SET estado = 'confirmada', mp_payment_id = '{{payment_id}}'
   WHERE id = '{{reserva_id}}'
   ```
5. **Ejecutar Workflow 1** — dispara la notificación de confirmación

---

## Workflow 5 — Limpieza de reservas expiradas

**Trigger:** Schedule — cada 15 minutos

**Nodos:**
1. **Schedule Trigger**
2. **Supabase** (HTTP Request) — cancela reservas pendientes vencidas:
   ```
   PATCH /rest/v1/reservas?estado=eq.pendiente_pago&creado_en=lt.{{ahora - 30min}}
   Body: { "estado": "cancelada_admin" }
   ```
   > Las reservas de MercadoPago se consideran expiradas después de 30 minutos sin confirmar.

---

## Workflow 6 — Recordatorio 1 hora antes del turno

**Trigger:** Schedule — cada hora, en punto (ej: 8:00, 9:00, 10:00...)

**Nodos:**
1. **Schedule Trigger**
2. **Supabase** — busca reservas que empiezan en ~1 hora:
   ```
   GET /rest/v1/reservas?estado=eq.confirmada&fecha=eq.{{hoy}}&hora_inicio=eq.{{hora+1h}}
   &select=*,canchas(nombre,complejos(nombre,direccion)),profiles(nombre,telefono)
   ```
3. **Loop** — por cada reserva encontrada:
4. **WhatsApp al cliente:**
   ```
   ⏰ Recordatorio de turno
   
   En 1 hora tenés tu turno en {{complejos.nombre}}
   ⚽ {{canchas.nombre}} — {{hora_inicio}}
   📍 {{complejos.direccion}}
   
   ¡Nos vemos pronto!
   ```

---

## Variables de entorno necesarias en n8n

| Variable | Dónde obtenerla |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard > Settings > API |
| `MP_ACCESS_TOKEN` | MercadoPago > Tus integraciones > Credenciales |
| `WHATSAPP_TOKEN` | Meta Business > WhatsApp > API |
| `WHATSAPP_PHONE_ID` | Meta Business > WhatsApp > API |
