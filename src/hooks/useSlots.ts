// SRP: Hook que combina horarios, reservas y bloqueos para calcular slots.
// Delega a generarSlots() la lógica pura de cálculo.
// Realtime: se suscribe a cambios en reservas y bloqueos para invalidar
// la query automáticamente sin recargar la página.

import { useEffect, useId } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  fetchHorariosByCancha,
  fetchReservasConfirmadas,
  fetchBloqueosByCancha,
} from '@/services/complejoService'
import { generarSlots } from '@/utils/slots'
import type { FranjaPrecio, Slot } from '@/types'

interface UseSlotsParams {
  canchaId: string | undefined
  fecha: string | undefined // "YYYY-MM-DD"
  duracionMin: number | undefined
  precioBase?: number
  franjas?: FranjaPrecio[] | null
}

export function useSlots({ canchaId, fecha, duracionMin, precioBase, franjas }: UseSlotsParams) {
  const queryClient = useQueryClient()
  // ID único y estable por instancia del hook (useId): evita colisión de nombres
  // de canal cuando WeekGrid y MobileDayGrid usan useSlots con el mismo canchaId+fecha
  // (ambos están montados simultáneamente, solo uno visible vía CSS).
  const instanceId = useId()

  const query = useQuery<Slot[]>({
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
      return generarSlots(horariosDelDia, reservas, bloqueos, duracionMin, precioBase, franjas)
    },
    enabled: !!canchaId && !!fecha && !!duracionMin,
  })

  // Realtime: invalida la query cuando cambian reservas o bloqueos
  // para esta cancha+fecha específica, sin recargar toda la página.
  // IMPORTANTE: el channelName incluye instanceId para evitar que múltiples
  // instancias del hook con el mismo canchaId+fecha colisionen en Supabase Realtime
  // (WeekGrid y MobileDayGrid se montan simultáneamente y compartirían el mismo canal).
  useEffect(() => {
    if (!canchaId || !fecha) return

    const channelName = `slots-${canchaId}-${fecha}-${instanceId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservas',
          filter: `cancha_id=eq.${canchaId}`,
        },
        (payload) => {
          // Solo invalida si el cambio es para la fecha que estamos viendo
          const row = (payload.new ?? payload.old) as Record<string, unknown>
          if (row?.fecha === fecha || !row?.fecha) {
            queryClient.invalidateQueries({ queryKey: ['slots', canchaId, fecha] })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bloqueos',
          filter: `cancha_id=eq.${canchaId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Record<string, unknown>
          if (row?.fecha === fecha || !row?.fecha) {
            queryClient.invalidateQueries({ queryKey: ['slots', canchaId, fecha] })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [canchaId, fecha, queryClient, instanceId])

  return query
}
