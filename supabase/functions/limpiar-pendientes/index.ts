// Edge Function: limpiar-pendientes
// SRP: libera reservas en estado 'pendiente_pago' con más de 15 minutos de antigüedad.
//
// Se invoca mediante un cron schedule (pg_cron o Supabase Scheduled Functions) cada 5 min.
// También envía un email al cliente avisando que su reserva expiró (si SMTP configurado).
//
// Variables de entorno requeridas:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - RESEND_API_KEY (opcional, para email vía Resend)
//   - EMAIL_FROM (opcional)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MINUTOS_EXPIRACION = 15

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const limite = new Date(Date.now() - MINUTOS_EXPIRACION * 60 * 1000).toISOString()

    // Seleccionar reservas pendientes expiradas
    const { data: expiradas, error: selectError } = await supabase
      .from('reservas')
      .select(
        `
        id,
        fecha,
        hora_inicio,
        cliente_id,
        canchas ( nombre, complejos ( nombre ) )
        `
      )
      .eq('estado', 'pendiente_pago')
      .lt('creado_en', limite)

    if (selectError) {
      return json({ error: selectError.message }, 500)
    }

    if (!expiradas || expiradas.length === 0) {
      return json({ liberadas: 0 }, 200)
    }

    const ids = expiradas.map((r) => r.id)

    // Eliminar para liberar los slots
    const { error: deleteError } = await supabase
      .from('reservas')
      .delete()
      .in('id', ids)

    if (deleteError) {
      return json({ error: deleteError.message }, 500)
    }

    // Enviar email a cada cliente (best-effort)
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const emailFrom = Deno.env.get('EMAIL_FROM')
    if (resendKey && emailFrom) {
      await Promise.allSettled(
        expiradas.map((r) => notificarExpiracion(supabase, r, resendKey, emailFrom))
      )
    }

    return json({ liberadas: ids.length }, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error'
    return json({ error: msg }, 500)
  }
})

interface ReservaExpirada {
  id: string
  fecha: string
  hora_inicio: string
  cliente_id: string
  canchas: { nombre: string; complejos: { nombre: string } | null } | null
}

async function notificarExpiracion(
  supabase: ReturnType<typeof createClient>,
  reserva: ReservaExpirada,
  resendKey: string,
  emailFrom: string
) {
  // Obtener email del cliente
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, nombre')
    .eq('id', reserva.cliente_id)
    .single()
  if (!profile) return

  const { data: userData } = await supabase.auth.admin.getUserById(
    profile.user_id as string
  )
  const email = userData.user?.email
  if (!email) return

  const canchaNombre = reserva.canchas?.nombre ?? 'tu cancha'
  const complejoNombre = reserva.canchas?.complejos?.nombre ?? 'el complejo'

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: email,
      subject: 'Tu reserva expiró',
      html: `
        <p>Hola ${profile.nombre ?? ''},</p>
        <p>Tu reserva para <strong>${canchaNombre}</strong> en
        <strong>${complejoNombre}</strong> el ${reserva.fecha} a las
        ${reserva.hora_inicio} expiró porque no completaste el pago dentro de
        los ${MINUTOS_EXPIRACION} minutos.</p>
        <p>Podés intentar reservar nuevamente cuando quieras.</p>
      `,
    }),
  })
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
