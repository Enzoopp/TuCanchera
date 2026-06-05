// PATRÓN: Service Layer (DIP)
// Abstrae la comunicación con Supabase para operaciones de reservas.

import { supabase } from '@/lib/supabase'
import { bffGet, bffPost } from '@/lib/bffClient'
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
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')

  return bffPost<Reserva>('/api/reservas', {
    canchaId:   params.canchaId,
    fecha:      params.fecha,
    horaInicio: params.horaInicio,
    horaFin:    params.horaFin,
    metodoPago: params.metodoPago,
    precio:     params.precio,
  }, session.access_token)
}

export async function fetchMisReservas(_clienteId: string): Promise<
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
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')

  return bffGet('/api/reservas', session.access_token)
}

// Tipos de respuesta para cancelación
export type CancelResult =
  | { ok: true; code: 'CANCELLED' }
  | { ok: false; code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'WRONG_STATUS' }
  | { ok: false; code: 'TOO_LATE'; horas_restantes: number }

export async function cancelarReservaCliente(reservaId: string): Promise<CancelResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa')

  return bffPost<CancelResult>(`/api/reservas/${reservaId}/cancelar`, {}, session.access_token)
}
