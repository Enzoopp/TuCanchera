// SRP: Hook que combina horarios, reservas y bloqueos para calcular slots.
// Delega a generarSlots() la lógica pura de cálculo.

import { useQuery } from '@tanstack/react-query'
import {
  fetchHorariosByCancha,
  fetchReservasConfirmadas,
  fetchBloqueosByCancha,
} from '@/services/complejoService'
import { generarSlots } from '@/utils/slots'
import type { Slot } from '@/types'

interface UseSlotsParams {
  canchaId: string | undefined
  fecha: string | undefined // "YYYY-MM-DD"
  duracionMin: number | undefined
}

export function useSlots({ canchaId, fecha, duracionMin }: UseSlotsParams) {
  return useQuery<Slot[]>({
    queryKey: ['slots', canchaId, fecha],
    queryFn: async () => {
      if (!canchaId || !fecha || !duracionMin) return []

      // Día de la semana: 0=domingo, ..., 6=sábado
      const diaSemana = new Date(fecha + 'T00:00:00').getDay()

      const [horarios, reservas, bloqueos] = await Promise.all([
        fetchHorariosByCancha(canchaId),
        fetchReservasConfirmadas(canchaId, fecha),
        fetchBloqueosByCancha(canchaId, fecha),
      ])

      const horariosDelDia = horarios.filter((h) => h.dia_semana === diaSemana)
      return generarSlots(horariosDelDia, reservas, bloqueos, duracionMin)
    },
    enabled: !!canchaId && !!fecha && !!duracionMin,
  })
}
