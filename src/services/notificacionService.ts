// PATRÓN: Service Layer
// Abstrae las llamadas manuales a n8n desde el frontend.
// Los triggers de Supabase ya notifican automáticamente los cambios de estado,
// pero este servicio permite disparar notificaciones puntuales si es necesario.
//
// IMPORTANTE: la mayoría de las notificaciones se disparan automáticamente
// desde los triggers de DB (notificar_cambio_reserva). Este servicio es
// para casos donde el frontend necesita notificar algo que no pasa por la DB.

const n8nWebhookBase = import.meta.env.VITE_N8N_WEBHOOK_BASE_URL ?? ''

// Tipos de eventos que puede manejar n8n
export type EventoN8n =
  | 'reserva_creada'
  | 'reserva_confirmada'
  | 'reserva_cancelada'
  | 'pago_aprobado'
  | 'pago_rechazado'
  | 'recordatorio_turno'

interface PayloadNotificacion {
  evento: EventoN8n
  reservaId?: string
  clienteId?: string
  complejoNombre?: string
  canchaName?: string
  fecha?: string
  horaInicio?: string
  metodoPago?: string
  mpPaymentId?: string
  [key: string]: unknown
}

/**
 * Envía un evento a n8n para que procese la notificación correspondiente.
 * Falla silenciosamente si n8n no está configurado (no bloquea el flujo principal).
 */
export async function notificarN8n(payload: PayloadNotificacion): Promise<void> {
  if (!n8nWebhookBase) {
    // n8n no configurado — ignorar silenciosamente en desarrollo
    console.info('[n8n] Webhook no configurado. Saltando notificación:', payload.evento)
    return
  }

  try {
    const url = `${n8nWebhookBase}/webhook/tucanchera-eventos`
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    // No propagar el error — las notificaciones son best-effort
    console.warn('[n8n] Error al enviar notificación:', err)
  }
}

// ─── Helpers por evento ────────────────────────────────────────────────────

export async function notificarPagoAprobado(params: {
  reservaId: string
  mpPaymentId: string
  clienteId: string
  complejoNombre: string
  canchaName: string
  fecha: string
  horaInicio: string
}) {
  await notificarN8n({
    evento: 'pago_aprobado',
    ...params,
  })
}

export async function notificarPagoRechazado(params: {
  reservaId: string
  mpPaymentId: string
  clienteId: string
}) {
  await notificarN8n({
    evento: 'pago_rechazado',
    ...params,
  })
}
