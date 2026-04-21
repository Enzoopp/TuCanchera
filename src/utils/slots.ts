// PATRÓN: Función pura (Functional Programming + SRP)
// generarSlots() no tiene efectos secundarios: dados los mismos inputs,
// siempre retorna el mismo output. No lee ni escribe de BD, no usa Date.now().
// Esto la hace:
//   - Testeable: fácil de probar con datos de prueba
//   - Predecible: su comportamiento es determinístico
//   - Reutilizable: se puede usar en cliente, servidor o tests
//
// DRY: única fuente de verdad para la lógica de disponibilidad.
// El calendario del cliente y del admin usan esta misma función.

import type { HorarioCancha, Reserva, Bloqueo, Slot } from '@/types'

/**
 * Genera los slots disponibles para una cancha en una fecha específica.
 *
 * @param horarios - Horarios de funcionamiento de la cancha para el día de la semana
 * @param reservas - Reservas (confirmadas o pendientes) de la cancha para esa fecha
 * @param bloqueos - Bloqueos del admin para la cancha en esa fecha
 * @param duracionMin - Duración de cada turno en minutos (60 o 90)
 * @returns Array de slots con { horaInicio, horaFin, estado }
 */
export function generarSlots(
  horarios: HorarioCancha[],
  reservas: Reserva[],
  bloqueos: Bloqueo[],
  duracionMin: number
): Slot[] {
  const slots: Slot[] = []

  for (const horario of horarios) {
    const inicioMin = timeToMinutes(horario.hora_inicio)
    const finMin = timeToMinutes(horario.hora_fin)

    // Dividir el rango en bloques de duracionMin
    for (let t = inicioMin; t + duracionMin <= finMin; t += duracionMin) {
      const horaInicio = minutesToTime(t)
      const horaFin = minutesToTime(t + duracionMin)

      // Verificar si coincide con una reserva
      const reservaConflicto = reservas.find(
        (r) => normalizeTime(r.hora_inicio) === horaInicio
      )
      if (reservaConflicto) {
        slots.push({ horaInicio, horaFin, estado: 'ocupado' })
        continue
      }

      // Verificar si coincide con un bloqueo
      const bloqueoConflicto = bloqueos.find(
        (b) => normalizeTime(b.hora_inicio) === horaInicio
      )
      if (bloqueoConflicto) {
        slots.push({ horaInicio, horaFin, estado: 'bloqueado' })
        continue
      }

      slots.push({ horaInicio, horaFin, estado: 'libre' })
    }
  }

  return slots
}

// Convierte "HH:MM" o "HH:MM:SS" a minutos desde medianoche
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Convierte minutos a formato "HH:MM"
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Normaliza "HH:MM:SS" o "HH:MM" a "HH:MM" para comparar
function normalizeTime(time: string): string {
  return time.slice(0, 5)
}
