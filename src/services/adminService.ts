// PATRÓN: Service Layer (DIP)
// Agrupa mutaciones y queries que usa el panel admin.
// Mantener cada función con SRP: una sola responsabilidad.

import { supabase } from '@/lib/supabase'
import type {
  Bloqueo,
  Cancha,
  Complejo,
  HorarioCancha,
  Reserva,
  TipoCancha,
} from '@/types'

// ---------- Complejo ----------

interface CrearComplejoParams {
  adminId: string
  nombre: string
  slug: string
  descripcion?: string
  direccion?: string
}

export async function crearComplejo(params: CrearComplejoParams): Promise<Complejo> {
  const { data, error } = await supabase
    .from('complejos')
    .insert({
      admin_id: params.adminId,
      nombre: params.nombre,
      slug: params.slug,
      descripcion: params.descripcion ?? null,
      direccion: params.direccion ?? null,
      activo: true,
    })
    .select()
    .single()
  if (error) throw error
  return data as Complejo
}

// Genera un slug URL-friendly a partir de un nombre.
export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9\s-]/g, '') // solo letras, números, espacios y guiones
    .trim()
    .replace(/\s+/g, '-') // espacios → guiones
    .replace(/-+/g, '-') // múltiples guiones → uno
    .slice(0, 60)
}

// Chequea si un slug ya existe (para validación en el wizard).
export async function slugDisponible(slug: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('complejos')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data === null
}

export async function updateComplejo(
  id: string,
  patch: Partial<Pick<Complejo, 'nombre' | 'descripcion' | 'direccion' | 'logo_url'>>
): Promise<Complejo> {
  const { data, error } = await supabase
    .from('complejos')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Complejo
}

export async function uploadLogo(complejoId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${complejoId}/logo-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('logos').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  })
  if (error) throw error
  const { data } = supabase.storage.from('logos').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFotoComplejo(
  complejoId: string,
  file: File,
  orden: number
) {
  const ext = file.name.split('.').pop()
  const path = `${complejoId}/foto-${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('fotos-complejos')
    .upload(path, file)
  if (upErr) throw upErr
  const { data } = supabase.storage.from('fotos-complejos').getPublicUrl(path)
  const { data: foto, error } = await supabase
    .from('fotos_complejo')
    .insert({ complejo_id: complejoId, url: data.publicUrl, orden })
    .select()
    .single()
  if (error) throw error
  return foto
}

export async function deleteFotoComplejo(id: string) {
  const { error } = await supabase.from('fotos_complejo').delete().eq('id', id)
  if (error) throw error
}

export async function reordenarFotos(fotos: { id: string; orden: number }[]) {
  // Actualiza orden en batch (una query por foto — OK para <50 fotos)
  await Promise.all(
    fotos.map((f) =>
      supabase.from('fotos_complejo').update({ orden: f.orden }).eq('id', f.id)
    )
  )
}

// ---------- Canchas ----------

interface CrearCanchaParams {
  complejoId: string
  tipo: TipoCancha
  nombre: string
  precio: number
  duracion_min: 60 | 90
  horarios: Array<Omit<HorarioCancha, 'id' | 'cancha_id'>>
}

export async function crearCancha(params: CrearCanchaParams): Promise<Cancha> {
  const { data: cancha, error } = await supabase
    .from('canchas')
    .insert({
      complejo_id: params.complejoId,
      tipo: params.tipo,
      nombre: params.nombre,
      precio: params.precio,
      duracion_min: params.duracion_min,
      activa: true,
    })
    .select()
    .single()
  if (error) throw error

  if (params.horarios.length > 0) {
    const { error: hErr } = await supabase.from('horarios_cancha').insert(
      params.horarios.map((h) => ({ ...h, cancha_id: cancha.id }))
    )
    if (hErr) throw hErr
  }

  return cancha as Cancha
}

export async function updateCancha(
  id: string,
  patch: Partial<Pick<Cancha, 'nombre' | 'precio' | 'duracion_min' | 'activa'>>
): Promise<Cancha> {
  const { data, error } = await supabase
    .from('canchas')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Cancha
}

export async function deleteCancha(id: string) {
  const { error } = await supabase.from('canchas').delete().eq('id', id)
  if (error) throw error
}

export async function replaceHorarios(
  canchaId: string,
  horarios: Array<Omit<HorarioCancha, 'id' | 'cancha_id'>>
) {
  await supabase.from('horarios_cancha').delete().eq('cancha_id', canchaId)
  if (horarios.length > 0) {
    const { error } = await supabase
      .from('horarios_cancha')
      .insert(horarios.map((h) => ({ ...h, cancha_id: canchaId })))
    if (error) throw error
  }
}

// ---------- Bloqueos ----------

export async function crearBloqueo(params: {
  canchaId: string
  fecha: string
  horaInicio: string
  motivo: string | null
}): Promise<Bloqueo> {
  const { data, error } = await supabase
    .from('bloqueos')
    .insert({
      cancha_id: params.canchaId,
      fecha: params.fecha,
      hora_inicio: params.horaInicio,
      motivo: params.motivo,
    })
    .select()
    .single()
  if (error) throw error
  return data as Bloqueo
}

export async function eliminarBloqueo(id: string) {
  const { error } = await supabase.from('bloqueos').delete().eq('id', id)
  if (error) throw error
}

// ---------- Reservas (admin) ----------

export interface ReservaAdmin extends Reserva {
  canchas: { nombre: string; tipo: string } | null
  profiles: { nombre: string; telefono: string | null; email: string | null } | null
}

export async function fetchReservasDelComplejo(
  complejoId: string,
  filtros?: {
    canchaId?: string
    fecha?: string
    estado?: string
    metodoPago?: string
  }
): Promise<ReservaAdmin[]> {
  let q = supabase
    .from('reservas')
    .select(
      `
      *,
      canchas!inner ( nombre, tipo, complejo_id ),
      profiles ( nombre, telefono, email )
      `
    )
    .eq('canchas.complejo_id', complejoId)
    .order('fecha', { ascending: false })
    .order('hora_inicio', { ascending: false })

  if (filtros?.canchaId) q = q.eq('cancha_id', filtros.canchaId)
  if (filtros?.fecha) q = q.eq('fecha', filtros.fecha)
  if (filtros?.estado) q = q.eq('estado', filtros.estado)
  if (filtros?.metodoPago) q = q.eq('metodo_pago', filtros.metodoPago)

  const { data, error } = await q
  if (error) throw error
  return data as never
}

export async function cancelarReservaAdmin(id: string) {
  // 1. Obtener datos de la reserva antes de cancelar (para notificación)
  const { data: reserva, error: fetchError } = await supabase
    .from('reservas')
    .select(`
      *,
      canchas ( nombre, tipo, complejos ( nombre ) ),
      profiles ( nombre, telefono, email )
    `)
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  // 2. Cancelar la reserva
  const { error } = await supabase
    .from('reservas')
    .update({ estado: 'cancelada_admin' })
    .eq('id', id)
  if (error) throw error

  // 3. Disparar notificación via n8n (cuando esté configurado)
  // El webhook URL se configura en .env.local como VITE_N8N_WEBHOOK_BASE_URL
  const n8nBase = import.meta.env.VITE_N8N_WEBHOOK_BASE_URL
  if (n8nBase && reserva) {
    try {
      await fetch(`${n8nBase}/cancelacion-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nombre: (reserva as any).profiles?.nombre,
          cliente_telefono: (reserva as any).profiles?.telefono,
          cliente_email: (reserva as any).profiles?.email,
          cancha_nombre: (reserva as any).canchas?.nombre,
          complejo_nombre: (reserva as any).canchas?.complejos?.nombre,
          fecha: reserva.fecha,
          hora_inicio: reserva.hora_inicio,
          hora_fin: reserva.hora_fin,
        }),
      })
    } catch {
      // Si falla el webhook no interrumpimos la cancelación
      console.warn('No se pudo enviar notificación de cancelación')
    }
  }
}

// ---------- Estadísticas ----------

export async function fetchReservasConfirmadasRango(
  complejoId: string,
  desde: string,
  hasta: string
): Promise<ReservaAdmin[]> {
  const { data, error } = await supabase
    .from('reservas')
    .select(
      `
      *,
      canchas!inner ( nombre, tipo, complejo_id, precio ),
      profiles ( nombre )
      `
    )
    .eq('canchas.complejo_id', complejoId)
    .eq('estado', 'confirmada')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
  if (error) throw error
  return data as never
}
