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
import { Lock, Unlock, Ban } from 'lucide-react'

const selectClass =
  'mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

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
      const bloqueo = bloqueos?.find((b) => b.hora_inicio.slice(0, 5) === horaInicio)
      if (!bloqueo) return
      try {
        await eliminarBloqueo(bloqueo.id)
        toast.success('Turno desbloqueado')
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
      toast.success('Turno bloqueado')
      await invalidar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  const libresCount = slots?.filter((s) => s.estado === 'libre').length ?? 0
  const bloqueadosCount = slots?.filter((s) => s.estado === 'bloqueado').length ?? 0
  const ocupadosCount = slots?.filter((s) => s.estado === 'ocupado').length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-neutral-900">Bloqueos de turnos</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Bloqueá turnos específicos para mantenimiento, eventos u otros motivos.
        </p>
      </div>

      {/* Selectores */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="cancha" className="text-xs font-semibold text-neutral-600">
              Cancha
            </Label>
            <select
              id="cancha"
              value={canchaId}
              onChange={(e) => setCanchaId(e.target.value)}
              className={selectClass}
            >
              {canchas?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} — {tipoCanchaLabels[c.tipo]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="fecha" className="text-xs font-semibold text-neutral-600">
              Fecha
            </Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-1 rounded-lg"
            />
          </div>
        </div>

        {/* Counters */}
        {slots && slots.length > 0 && (
          <div className="flex gap-4 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
            <div className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary-400" />
              {libresCount} libre{libresCount !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-neutral-300" />
              {bloqueadosCount} bloqueado{bloqueadosCount !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-neutral-600">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-neutral-200" />
              {ocupadosCount} reservado{ocupadosCount !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      {/* Grid de slots */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {loadingSlots ? (
          <div className="grid grid-cols-4 gap-2 p-5 sm:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : !slots || slots.length === 0 ? (
          <div className="py-12 text-center">
            <Ban className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm font-medium text-neutral-500">
              Sin horarios para este día.
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              Verificá que la cancha tenga horario configurado para este día de la semana.
            </p>
          </div>
        ) : (
          <div className="p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Turnos del día — click para bloquear / desbloquear
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {slots.map((s) => {
                const b = bloqueos?.find((x) => x.hora_inicio.slice(0, 5) === s.horaInicio)

                if (s.estado === 'ocupado') {
                  return (
                    <div
                      key={s.horaInicio}
                      title="Reservado — no se puede bloquear"
                      className="flex flex-col items-center justify-center rounded-xl bg-neutral-100 px-2 py-2.5 cursor-not-allowed"
                    >
                      <span className="text-sm font-semibold text-neutral-400">{s.horaInicio}</span>
                      <span className="mt-0.5 text-[9px] font-medium uppercase text-neutral-400">Reservado</span>
                    </div>
                  )
                }

                if (s.estado === 'bloqueado') {
                  return (
                    <button
                      key={s.horaInicio}
                      type="button"
                      title={b?.motivo ? `Bloqueado: ${b.motivo} · Click para desbloquear` : 'Click para desbloquear'}
                      onClick={() => handleSlotClick(s.horaInicio, s.estado)}
                      className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-2 py-2.5 transition-colors hover:bg-amber-100"
                    >
                      <Lock className="h-3 w-3 text-amber-500" />
                      <span className="mt-0.5 text-sm font-semibold text-amber-700">{s.horaInicio}</span>
                      {b?.motivo && (
                        <span className="mt-0.5 max-w-full truncate text-[9px] font-medium text-amber-500">
                          {b.motivo}
                        </span>
                      )}
                    </button>
                  )
                }

                // Libre
                return (
                  <button
                    key={s.horaInicio}
                    type="button"
                    title="Click para bloquear"
                    onClick={() => handleSlotClick(s.horaInicio, s.estado)}
                    className="flex flex-col items-center justify-center rounded-xl border border-primary-200 bg-primary-50 px-2 py-2.5 transition-colors hover:bg-neutral-100"
                  >
                    <Unlock className="h-3 w-3 text-primary-400" />
                    <span className="mt-0.5 text-sm font-semibold text-primary-700">{s.horaInicio}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-600 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary-400" />
          Libre — click para bloquear
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-300" />
          Bloqueado — click para desbloquear
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-neutral-300" />
          Reservado — no modificable
        </div>
      </div>
    </div>
  )
}
