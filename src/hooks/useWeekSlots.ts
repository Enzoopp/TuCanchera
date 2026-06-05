// Hook que obtiene los slots de una semana completa en 3 fetches (en vez de 7×3=21).
// Usa get_disponibilidad_semana RPC para reservas, más una query de bloqueos por rango.
// Mantiene Realtime: un solo canal por semana (en vez de 7) que invalida toda la semana.

import { useEffect, useId } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  fetchHorariosByCancha,
  fetchReservasSemana,
  fetchBloqueosRango,
} from '@/services/complejoService'
import { generarSlots } from '@/utils/slots'
import type { FranjaPrecio, Slot } from '@/types'

interface UseWeekSlotsParams {
  canchaId: string | undefined
  weekDates: Date[]           // array de 7 fechas (lunes → domingo)
  duracionMin: number | undefined
  precioBase?: number
  franjas?: FranjaPrecio[] | null
}

/** Resultado: un Slot[] por fecha ISO ("YYYY-MM-DD") */
export type WeekSlotsMap = Record<string, Slot[]>

export function useWeekSlots({
  canchaId,
  weekDates,
  duracionMin,
  precioBase,
  franjas,
}: UseWeekSlotsParams) {
  const queryClient = useQueryClient()
  // ID único y estable por instancia del hook (useId) para el nombre del canal Realtime.
  const instanceId = useId()

  const desde = weekDates[0]
    ? `${weekDates[0].getFullYear()}-${String(weekDates[0].getMonth() + 1).padStart(2, '0')}-${String(weekDates[0].getDate()).padStart(2, '0')}`
    : ''
  const hasta = weekDates[6]
    ? `${weekDates[6].getFullYear()}-${String(weekDates[6].getMonth() + 1).padStart(2, '0')}-${String(weekDates[6].getDate()).padStart(2, '0')}`
    : ''

  const query = useQuery<WeekSlotsMap>({
    queryKey: ['week-slots', canchaId, desde, hasta],
    queryFn: async () => {
      if (!canchaId || !desde || !hasta || !duracionMin) return {}

      // 3 fetches en paralelo en vez de 7×3 = 21
      const [horarios, reservasSemana, bloqueosSemana] = await Promise.all([
        fetchHorariosByCancha(canchaId),
        fetchReservasSemana(canchaId, desde, hasta),
        fetchBloqueosRango(canchaId, desde, hasta),
      ])

      const result: WeekSlotsMap = {}

      for (const date of weekDates) {
        const fechaISO = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        const diaSemana = date.getDay() // 0=dom … 6=sab

        const horariosDelDia = horarios.filter((h) => h.dia_semana === diaSemana)
        const reservasDelDia = reservasSemana.filter((r) => r.fecha === fechaISO)
        const bloqueosDelDia = bloqueosSemana.filter((b) => b.fecha === fechaISO)

        result[fechaISO] = generarSlots(
          horariosDelDia,
          reservasDelDia,
          bloqueosDelDia,
          duracionMin,
          precioBase,
          franjas
        )
      }

      return result
    },
    enabled: !!canchaId && !!desde && !!hasta && !!duracionMin,
  })

  // Un solo canal Realtime para toda la semana
  useEffect(() => {
    if (!canchaId || !desde) return
    const channelName = `week-slots-${canchaId}-${desde}-${instanceId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas', filter: `cancha_id=eq.${canchaId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown>
          const fecha = row?.fecha as string | undefined
          // Solo invalida si el cambio cae dentro de la semana visible
          if (!fecha || (fecha >= desde && fecha <= hasta)) {
            queryClient.invalidateQueries({ queryKey: ['week-slots', canchaId, desde, hasta] })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bloqueos', filter: `cancha_id=eq.${canchaId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown>
          const fecha = row?.fecha as string | undefined
          if (!fecha || (fecha >= desde && fecha <= hasta)) {
            queryClient.invalidateQueries({ queryKey: ['week-slots', canchaId, desde, hasta] })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [canchaId, desde, hasta, queryClient, instanceId])

  return query
}
