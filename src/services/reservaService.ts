// PATRÓN: Service Layer (DIP)
// Abstrae la comunicación con Supabase para operaciones de reservas.

import { supabase } from '@/lib/supabase'
import type { Cancha, Reserva, MetodoPago } from '@/types'

export async function fetchCanchaById(canchaId: string): Promise<Cancha | null> {
  const { data, error } = await supabase
    .from('canchas')
    .select('*')
    .eq('id', canchaId)
    .single()

  if (error) return null
  return data as Cancha
}

interface CrearReservaParams {
  canchaId: string
  clienteId: string
  fecha: string
  horaInicio: string
  horaFin: string
  metodoPago: MetodoPago
}

export async function crearReservaEnLugar(
  params: CrearReservaParams
): Promise<Reserva> {
  const { data, error } = await supabase
    .from('reservas')
    .insert({
      cancha_id: params.canchaId,
      cliente_id: params.clienteId,
      fecha: params.fecha,
      hora_inicio: params.horaInicio,
      hora_fin: params.horaFin,
      metodo_pago: 'en_lugar',
      estado: 'confirmada',
    })
    .select()
    .single()

  if (error) throw error
  return data as Reserva
}

export async function fetchMisReservas(clienteId: string): Promise<
  Array<
    Reserva & {
      canchas: {
        nombre: string
        tipo: string
        complejos: { nombre: string; slug: string } | null
      } | null
    }
  >
> {
  const { data, error } = await supabase
    .from('reservas')
    .select(
      `
      *,
      canchas (
        nombre,
        tipo,
        complejos (
          nombre,
          slug
        )
      )
    `
    )
    .eq('cliente_id', clienteId)
    .order('fecha', { ascending: false })
    .order('hora_inicio', { ascending: false })

  if (error) throw error
  return data as never
}

/**
 * Invoca la Edge Function de Supabase que crea una preferencia de MercadoPago.
 * Retorna la URL del Checkout Pro para redirigir al usuario.
 */
export async function crearPreferenciaMercadoPago(
  params: CrearReservaParams
): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke('crear-preferencia-mp', {
    body: {
      canchaId: params.canchaId,
      clienteId: params.clienteId,
      fecha: params.fecha,
      horaInicio: params.horaInicio,
      horaFin: params.horaFin,
    },
  })

  if (error) throw error
  return data as { url: string }
}
