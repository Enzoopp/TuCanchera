// Edge Function: webhook-mp
// SRP: recibe notificaciones IPN/webhook de MercadoPago y actualiza el estado de la reserva.
//
// MercadoPago envía POST con { type, data: { id } }.
// Consultamos el pago via API para confirmar status y external_reference (reserva.id).
//
// Estados MP → reserva:
//   - approved   → confirmada + mp_payment_id
//   - rejected   → cancelada_admin (o eliminar)
//   - pending/in_process → no hacer nada (se espera otro webhook)
//
// Variables de entorno requeridas:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - MP_ACCESS_TOKEN

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const topic = body.type ?? body.topic
    const paymentId = body?.data?.id ?? body?.resource

    // Solo nos interesan notificaciones de pago
    if (topic !== 'payment' || !paymentId) {
      return new Response('ignored', { status: 200 })
    }

    const mpToken = Deno.env.get('MP_ACCESS_TOKEN')!
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Consultar detalles del pago
    const mpResp = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${mpToken}` } }
    )

    if (!mpResp.ok) {
      return new Response(`MP error ${mpResp.status}`, { status: 502 })
    }

    const payment = (await mpResp.json()) as {
      id: number
      status: 'approved' | 'rejected' | 'pending' | 'in_process' | 'cancelled'
      external_reference: string
    }

    const reservaId = payment.external_reference
    if (!reservaId) {
      return new Response('sin external_reference', { status: 200 })
    }

    if (payment.status === 'approved') {
      await supabase
        .from('reservas')
        .update({
          estado: 'confirmada',
          mp_payment_id: String(payment.id),
        })
        .eq('id', reservaId)
        .eq('estado', 'pendiente_pago')
    } else if (
      payment.status === 'rejected' ||
      payment.status === 'cancelled'
    ) {
      // Liberar el turno
      await supabase
        .from('reservas')
        .delete()
        .eq('id', reservaId)
        .eq('estado', 'pendiente_pago')
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error'
    return new Response(msg, { status: 500 })
  }
})
