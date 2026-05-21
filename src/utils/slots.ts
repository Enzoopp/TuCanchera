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

import type { FranjaPrecio, HorarioCancha, Bloqueo, Slot } from '@/types'

// Tipo mínimo que generarSlots necesita de una reserva (solo hora_inicio).
// Permite recibir tanto Reserva[] como el resultado de la RPC get_disponibilidad_slots.
type ReservaMinima = { hora_inicio: string }

/**
 * Genera los slots disponibles para una cancha en una fecha específica.
 *
 * @param horarios - Horarios de funcionamiento de la cancha para el día de la semana
 * @param reservas - Reservas (confirmadas o pendientes) de la cancha para esa fecha
 * @param bloqueos - Bloqueos del admin para la cancha en esa fecha
 * @param duracionMin - Duración de cada turno en minutos (60 o 90)
 * @param precioBase - Precio base de la cancha (fallback cuando no hay franja)
 * @param franjas - Franjas de precio diferenciado por horario (opcional)
 * @returns Array de slots con { horaInicio, horaFin, estado, precio }
 */
export function generarSlots(
  horarios: HorarioCancha[],
  reservas: ReservaMinima[],
  bloqueos: Bloqueo[],
  duracionMin: number,
  precioBase?: number,
  franjas?: FranjaPrecio[] | null
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

      // Calcular precio efectivo: busca franja que cubra este horario
      const precio = franjas && franjas.length > 0
        ? getPrecioFranja(t, franjas) ?? precioBase
        : precioBase

      slots.push({ horaInicio, horaFin, estado: 'libre', precio })
    }
  }

  return slots
}

/**
 * Devuelve el precio de la franja que cubre el minuto dado, o null si no aplica.
 */
function getPrecioFranja(minuto: number, franjas: FranjaPrecio[]): number | undefined {
  for (const f of franjas) {
    const desde = timeToMinutes(f.desde)
    const hasta = timeToMinutes(f.hasta)
    if (minuto >= desde && minuto < hasta) {
      return f.precio
    }
  }
  return undefined
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
