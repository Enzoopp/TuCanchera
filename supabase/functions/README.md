# Edge Functions — TuCanchera

## Despliegue

Requiere [Supabase CLI](https://supabase.com/docs/guides/cli) instalado y un proyecto linkeado:

```bash
supabase link --project-ref <PROJECT_REF>
```

### Variables de entorno (secrets)

```bash
supabase secrets set \
  MP_ACCESS_TOKEN="APP_USR-..." \
  APP_URL="https://tucanchera.com" \
  RESEND_API_KEY="re_..." \
  EMAIL_FROM="TuCanchera <no-reply@tucanchera.com>"
```

> `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` están disponibles automáticamente en el runtime.

### Deploy de cada función

```bash
supabase functions deploy crear-preferencia-mp
supabase functions deploy webhook-mp --no-verify-jwt
supabase functions deploy limpiar-pendientes --no-verify-jwt
```

- `webhook-mp` debe permitir llamadas sin JWT (MercadoPago no envía uno).
- `limpiar-pendientes` se invoca con cron, sin JWT.

## Cron para limpiar reservas pendientes

Desde el SQL editor de Supabase, habilitar la extensión y agendar:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'limpiar-pendientes-cada-5-min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/limpiar-pendientes',
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
  $$
);
```

## Webhook de MercadoPago

En el panel de MercadoPago → Webhooks, apuntar a:

```
https://<PROJECT_REF>.functions.supabase.co/webhook-mp
```

Eventos a suscribir: `payment`.
