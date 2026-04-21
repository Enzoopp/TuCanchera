// Utilidades puras para manejo de fechas y horarios.
// SRP: solo formateo y cálculo de fechas, sin efectos secundarios.

import { addDays, format, startOfWeek, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Genera los 7 días de la semana a partir de una fecha base.
 * La semana empieza el lunes (ISO).
 */
export function generarDiasSemana(fechaBase: Date): Date[] {
  const inicio = startOfWeek(fechaBase, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(inicio, i))
}

export function formatearFechaCorta(fecha: Date): string {
  return format(fecha, "d 'de' MMM", { locale: es })
}

export function formatearFechaLarga(fecha: Date): string {
  return format(fecha, "EEEE d 'de' MMMM, yyyy", { locale: es })
}

export function formatearDiaSemanaCorto(fecha: Date): string {
  return format(fecha, 'EEE', { locale: es }).replace('.', '')
}

export function formatearFechaISO(fecha: Date): string {
  return format(fecha, 'yyyy-MM-dd')
}

export function esFechaPasada(fecha: Date): boolean {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(fecha)
  f.setHours(0, 0, 0, 0)
  return f < hoy
}

export function esHoy(fecha: Date): boolean {
  return isSameDay(fecha, new Date())
}
