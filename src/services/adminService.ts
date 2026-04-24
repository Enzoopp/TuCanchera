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
  canchas: { nombre: string; tipo: string; precio: number } | null
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
      canchas!inner ( nombre, tipo, complejo_id, precio ),
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

export async function registrarAsistencia(id: string, asistio: boolean) {
  const { error } = await supabase
    .from('reservas')
    .update({ asistio })
    .eq('id', id)
  if (error) throw error
}

export async function cancelarReservaAdmin(id: string) {
  const { error } = await supabase
    .from('reservas')
    .update({ estado: 'cancelada_admin' })
    .eq('id', id)
  if (error) throw error
}

// ---------- Cierre mensual ----------
// Al cerrar un mes:
//   1. El frontend genera el PDF (con el detalle completo todavía disponible)
//   2. Se guardan los KPIs en resumen_meses (solo 10 números — ocupa nada)
//   3. Se borran PERMANENTEMENTE las reservas de ese mes
// Resultado: la base de datos queda liviana y el admin tiene el PDF como archivo.

export interface ResumenMes {
  anio: number
  mes: number   // 1–12
  totalReservas: number
  confirmadas: number
  canceladas: number
  asistieron: number
  noAsistieron: number
  ingresos: number
}

/** Trae el detalle de reservas de un mes específico (antes de cerrarlo y borrarlos) */
export async function fetchReservasMes(
  complejoId: string,
  anio: number,
  mes: number
): Promise<ReservaAdmin[]> {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('reservas')
    .select(`
      *,
      canchas!inner ( nombre, tipo, complejo_id, precio ),
      profiles ( nombre, telefono, email )
    `)
    .eq('canchas.complejo_id', complejoId)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true })

  if (error) throw error
  return data as never
}

/** Historial de meses ya cerrados — lee de resumen_meses (solo KPIs, sin reservas) */
export async function fetchResumenesMeses(complejoId: string): Promise<ResumenMes[]> {
  const { data, error } = await supabase
    .from('resumen_meses')
    .select('*')
    .eq('complejo_id', complejoId)
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })

  if (error) throw error

  type RawResumen = {
    anio: number; mes: number; total_reservas: number
    confirmadas: number; canceladas: number
    asistieron: number; no_asistieron: number; ingresos: number
  }
  return (data as RawResumen[] ?? []).map((r) => ({
    anio: r.anio,
    mes: r.mes,
    totalReservas: r.total_reservas,
    confirmadas: r.confirmadas,
    canceladas: r.canceladas,
    asistieron: r.asistieron,
    noAsistieron: r.no_asistieron,
    ingresos: r.ingresos,
  }))
}

/**
 * Cierra un mes:
 *   1. Guarda los KPIs en resumen_meses
 *   2. Borra PERMANENTEMENTE todas las reservas de ese período
 *
 * Llamar DESPUÉS de generar y descargar el PDF.
 */
export async function cerrarMes(
  complejoId: string,
  anio: number,
  mes: number,
  kpis: Omit<ResumenMes, 'anio' | 'mes'>
): Promise<void> {
  const desde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const hasta = new Date(anio, mes, 0).toISOString().slice(0, 10)

  // 1. Guardar KPIs (upsert por si se reintenta)
  const { error: kpiError } = await supabase
    .from('resumen_meses')
    .upsert({
      complejo_id: complejoId,
      anio,
      mes,
      total_reservas: kpis.totalReservas,
      confirmadas: kpis.confirmadas,
      canceladas: kpis.canceladas,
      asistieron: kpis.asistieron,
      no_asistieron: kpis.noAsistieron,
      ingresos: kpis.ingresos,
      cerrado_en: new Date().toISOString(),
    }, { onConflict: 'complejo_id,anio,mes' })

  if (kpiError) throw kpiError

  // 2. Obtener canchas del complejo
  const { data: canchas, error: cErr } = await supabase
    .from('canchas')
    .select('id')
    .eq('complejo_id', complejoId)
  if (cErr) throw cErr

  const canchaIds = (canchas ?? []).map((c: { id: string }) => c.id)
  if (canchaIds.length === 0) return

  // 3. Borrar permanentemente las reservas del mes
  const { error: delError } = await supabase
    .from('reservas')
    .delete()
    .in('cancha_id', canchaIds)
    .gte('fecha', desde)
    .lte('fecha', hasta)

  if (delError) throw delError
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
