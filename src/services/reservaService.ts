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
  precio: number  // precio efectivo del slot al momento de reservar
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
      precio: params.precio,
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
        precio: number
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
        precio,
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

// Tipos de respuesta para cancelación
export type CancelResult =
  | { ok: true; code: 'CANCELLED' }
  | { ok: false; code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'WRONG_STATUS' }
  | { ok: false; code: 'TOO_LATE'; horas_restantes: number }

export async function cancelarReservaCliente(reservaId: string): Promise<CancelResult> {
  const { data, error } = await supabase.rpc('cancelar_reserva_cliente', {
    p_reserva_id: reservaId,
  })
  if (error) throw error
  return data as CancelResult
}
