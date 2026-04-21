// PATRÓN: Service Layer (DIP - Dependency Inversion Principle)
// Este servicio abstrae la comunicación con Supabase para datos del complejo.
// Si en el futuro se cambia el backend, solo se modifica esta capa.

import { supabase } from '@/lib/supabase'
import type { Cancha, Complejo, FotoComplejo, HorarioCancha, Bloqueo, Reserva } from '@/types'

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
): Promise<Reserva[]> {
  const { data, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('cancha_id', canchaId)
    .eq('fecha', fecha)
    .in('estado', ['confirmada', 'pendiente_pago'])

  if (error) throw error
  return data as Reserva[]
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
