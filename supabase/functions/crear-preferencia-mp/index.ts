// Edge Function: crear-preferencia-mp
// SRP: crea una reserva en estado "pendiente_pago" y una preferencia de MercadoPago
// Retorna la URL de Checkout Pro al cliente para redirigir.
//
// Flujo:
//   1. Valida JWT del cliente (supabase auth)
//   2. Lee cancha para obtener precio + nombre
//   3. Inserta reserva con estado='pendiente_pago' (se liberará si no paga en 15 min)
//   4. Crea preferencia en MercadoPago con external_reference = reserva.id
//   5. Retorna { url } con init_point
//
// Variables de entorno requeridas:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY (bypass RLS para insertar reservas)
//   - MP_ACCESS_TOKEN (token privado del vendedor)
//   - APP_URL (dominio público para back_urls)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Body {
  canchaId: string
  clienteId: string
  fecha: string
  horaInicio: string
  horaFin: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'No autorizado' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const mpToken = Deno.env.get('MP_ACCESS_TOKEN')!
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173'

    // Cliente con service_role: bypass RLS para insertar
    const supabase = createClient(supabaseUrl, serviceKey)

    // Validar el JWT del usuario llamante
    const jwt = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !userData.user) {
      return json({ error: 'Token inválido' }, 401)
    }

    const body = (await req.json()) as Body

    // Obtener cancha (precio y nombre para la preferencia)
    const { data: cancha, error: canchaError } = await supabase
      .from('canchas')
      .select('id, nombre, precio, complejo_id, complejos(nombre)')
      .eq('id', body.canchaId)
      .single()

    if (canchaError || !cancha) {
      return json({ error: 'Cancha no encontrada' }, 404)
    }

    // Verificar que no exista otra reserva confirmada para ese slot
    const { data: existente } = await supabase
      .from('reservas')
      .select('id, estado')
      .eq('cancha_id', body.canchaId)
      .eq('fecha', body.fecha)
      .eq('hora_inicio', body.horaInicio)
      .in('estado', ['confirmada', 'pendiente_pago'])
      .maybeSingle()

    if (existente) {
      return json({ error: 'El turno ya no está disponible' }, 409)
    }

    // Crear reserva en estado pendiente_pago
    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .insert({
        cancha_id: body.canchaId,
        cliente_id: body.clienteId,
        fecha: body.fecha,
        hora_inicio: body.horaInicio,
        hora_fin: body.horaFin,
        metodo_pago: 'mercadopago',
        estado: 'pendiente_pago',
      })
      .select()
      .single()

    if (reservaError || !reserva) {
      return json({ error: reservaError?.message ?? 'Error al crear reserva' }, 500)
    }

    // Crear preferencia de MercadoPago
    const complejoNombre =
      (cancha as unknown as { complejos: { nombre: string } }).complejos?.nombre ?? 'Complejo'

    const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mpToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            title: `${cancha.nombre} — ${complejoNombre}`,
            description: `Turno ${body.fecha} ${body.horaInicio}`,
            quantity: 1,
            unit_price: Number(cancha.precio),
            currency_id: 'ARS',
          },
        ],
        external_reference: reserva.id,
        back_urls: {
          success: `${appUrl}/mis-reservas`,
          failure: `${appUrl}/mis-reservas`,
          pending: `${appUrl}/mis-reservas`,
        },
        auto_return: 'approved',
        notification_url: `${supabaseUrl}/functions/v1/webhook-mp`,
      }),
    })

    if (!mpResp.ok) {
      // Rollback: eliminar la reserva pendiente
      await supabase.from('reservas').delete().eq('id', reserva.id)
      const errText = await mpResp.text()
      return json({ error: `MercadoPago: ${errText}` }, 502)
    }

    const mpData = (await mpResp.json()) as { init_point: string; id: string }

    return json({ url: mpData.init_point, reservaId: reserva.id }, 200)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return json({ error: msg }, 500)
  }
})

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
