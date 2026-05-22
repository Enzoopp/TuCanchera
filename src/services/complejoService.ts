// PATRÓN: Service Layer (DIP - Dependency Inversion Principle)
// Este servicio abstrae la comunicación con Supabase para datos del complejo.
// Si en el futuro se cambia el backend, solo se modifica esta capa.

import { supabase } from '@/lib/supabase'
import type { Cancha, Complejo, FotoComplejo, HorarioCancha, Bloqueo } from '@/types'

// Tipo mínimo devuelto por la RPC get_disponibilidad_slots.
// No expone PII del cliente (sin cliente_id ni mp_payment_id).
export type DisponibilidadSlot = {
  cancha_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
}

export async function fetchComplejosActivos(): Promise<Complejo[]> {
  const { data, error } = await supabase
    .from('complejos')
    .select('*')
    .eq('activo', true)
    .order('creado_en', { ascending: false })

  if (error) throw error
  return data as Complejo[]
}

export async function fetchCanchasByComplejo(complejoId: string): Promise<Cancha[]> {
  const { data, error } = await supabase
    .from('canchas')
    .select('*')
    .eq('complejo_id', complejoId)
    .eq('activa', true)
    .order('nombre')

  if (error) throw error
  return data as Cancha[]
}

export async function fetchFotosByComplejo(complejoId: string): Promise<FotoComplejo[]> {
  const { data, error } = await supabase
    .from('fotos_complejo')
    .select('*')
    .eq('complejo_id', complejoId)
    .order('orden')

  if (error) throw error
  return data as FotoComplejo[]
}

export async function fetchHorariosByCancha(canchaId: string): Promise<HorarioCancha[]> {
  const { data, error } = await supabase
    .from('horarios_cancha')
    .select('*')
    .eq('cancha_id', canchaId)

  if (error) throw error
  return data as HorarioCancha[]
}

export async function fetchReservasConfirmadas(
  canchaId: string,
  fecha: string
): Promise<DisponibilidadSlot[]> {
  // Usa la RPC en lugar de query directa a la tabla reservas.
  // Esto evita exponer PII (cliente_id, mp_payment_id) al rol anon/authenticated
  // que solo necesita saber qué slots están ocupados.
  const { data, error } = await supabase.rpc('get_disponibilidad_slots', {
    p_cancha_id: canchaId,
    p_fecha: fecha,
  })
  if (error) throw error
  return (data ?? []) as DisponibilidadSlot[]
}

/**
 * Devuelve todos los slots ocupados/pendientes de una semana completa en una
 * sola llamada RPC (en lugar de 7 llamadas paralelas por día).
 */
export async function fetchReservasSemana(
  canchaId: string,
  desde: string,
  hasta: string
): Promise<DisponibilidadSlot[]> {
  const { data, error } = await supabase.rpc('get_disponibilidad_semana', {
    p_cancha_id: canchaId,
    p_desde: desde,
    p_hasta: hasta,
  })
  if (error) throw error
  return (data ?? []) as DisponibilidadSlot[]
}

export async function fetchBloqueosByCancha(
  canchaId: string,
  fecha: string
): Promise<Bloqueo[]> {
  const { data, error } = await supabase
    .from('bloqueos')
    .select('*')
    .eq('cancha_id', canchaId)
    .eq('fecha', fecha)

  if (error) throw error
  return data as Bloqueo[]
}

/** Devuelve todos los bloqueos de una cancha en un rango de fechas (una sola query). */
export async function fetchBloqueosRango(
  canchaId: string,
  desde: string,
  hasta: string
): Promise<Bloqueo[]> {
  const { data, error } = await supabase
    .from('bloqueos')
    .select('*')
    .eq('cancha_id', canchaId)
    .gte('fecha', desde)
    .lte('fecha', hasta)

  if (error) throw error
  return data as Bloqueo[]
}
