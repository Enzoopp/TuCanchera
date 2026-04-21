// SRP: El admin bloquea/desbloquea slots puntuales.
// Selecciona cancha + fecha, ve los slots del día y clickea para bloquear
// (o clickea un bloqueado para desbloquear).

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchCanchasByComplejo, fetchBloqueosByCancha } from '@/services/complejoService'
import { useSlots } from '@/hooks/useSlots'
import { crearBloqueo, eliminarBloqueo } from '@/services/adminService'
import { formatearFechaISO } from '@/utils/fechas'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { tipoCanchaLabels } from '@/utils/canchaLabels'

export default function Bloqueos() {
  const { data: complejo } = useMiComplejo()
  const queryClient = useQueryClient()

  const { data: canchas } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  const [canchaId, setCanchaId] = useState<string>('')
  const [fecha, setFecha] = useState(formatearFechaISO(new Date()))

  // Seleccionar primera cancha por defecto
  if (!canchaId && canchas && canchas.length > 0) {
    setCanchaId(canchas[0].id)
  }

  const canchaSel = canchas?.find((c) => c.id === canchaId)

  const { data: slots, isLoading: loadingSlots } = useSlots({
    canchaId: canchaId || undefined,
    fecha,
    duracionMin: canchaSel?.duracion_min,
  })

  const { data: bloqueos } = useQuery({
    queryKey: ['bloqueos', canchaId, fecha],
    queryFn: () => fetchBloqueosByCancha(canchaId, fecha),
    enabled: !!canchaId && !!fecha,
  })

  async function invalidar() {
    await queryClient.invalidateQueries({ queryKey: ['slots', canchaId, fecha] })
    await queryClient.invalidateQueries({ queryKey: ['bloqueos', canchaId, fecha] })
  }

  async function handleSlotClick(horaInicio: string, estado: string) {
    if (estado === 'ocupado') {
      toast.error('No se puede bloquear un slot reservado')
      return
    }

    if (estado === 'bloqueado') {
      // Desbloquear
      const bloqueo = bloqueos?.find((b) => b.hora_inicio.slice(0, 5) === horaInicio)
      if (!bloqueo) return
      try {
        await eliminarBloqueo(bloqueo.id)
        toast.success('Desbloqueado')
        await invalidar()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error')
      }
      return
    }

    // Libre → bloquear
    const motivo = prompt('Motivo del bloqueo (opcional):') ?? null
    try {
      await crearBloqueo({
        canchaId,
        fecha,
        horaInicio,
        motivo: motivo || null,
      })
      toast.success('Slot bloqueado')
      await invalidar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Bloqueos de turnos</h1>
        <p className="text-sm text-neutral-500">
          Bloqueá turnos específicos (mantenimiento, eventos, etc.).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cancha">Cancha</Label>
          <select
            id="cancha"
            value={canchaId}
            onChange={(e) => setCanchaId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {canchas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} — {tipoCanchaLabels[c.tipo]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        {loadingSlots ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !slots || slots.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            Sin horarios para este día.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((s) => {
              const b =
                bloqueos?.find((x) => x.hora_inicio.slice(0, 5) === s.horaInicio)

              let cls = 'bg-green-100 text-green-700 hover:bg-green-200'
              let titulo = 'Click para bloquear'
              if (s.estado === 'ocupado') {
                cls = 'bg-red-100 text-red-700 cursor-not-allowed'
                titulo = 'Reservado'
              } else if (s.estado === 'bloqueado') {
                cls = 'bg-neutral-300 text-neutral-700 hover:bg-neutral-400'
                titulo = b?.motivo
                  ? `Bloqueado: ${b.motivo}. Click para desbloquear.`
                  : 'Click para desbloquear'
              }

              return (
                <button
                  key={s.horaInicio}
                  type="button"
                  title={titulo}
                  disabled={s.estado === 'ocupado'}
                  onClick={() => handleSlotClick(s.horaInicio, s.estado)}
                  className={`rounded-md px-2 py-2 text-sm font-medium transition-colors ${cls}`}
                >
                  {s.horaInicio}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex gap-4 text-xs text-neutral-500">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-500" /> Libre
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-500" /> Reservado
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-neutral-400" /> Bloqueado
        </div>
      </div>
    </div>
  )
}
