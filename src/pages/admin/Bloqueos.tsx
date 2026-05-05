// ============================================================
// ADMIN / BLOQUEOS.TSX  (ruta: /admin/bloqueos)
// Permite al admin bloquear y desbloquear turnos específicos.
//
// Flujo:
//   1. El admin elige una cancha y una fecha
//   2. Se muestran todos los slots del día con su estado visual
//   3. Click en slot LIBRE → pide motivo → lo bloquea
//   4. Click en slot BLOQUEADO → lo desbloquea
//   5. Click en slot OCUPADO → muestra error (no se puede bloquear)
//
// Colores de slots:
//   - Verde: libre (clickeable para bloquear)
//   - Rojo: reservado (no clickeable)
//   - Gris: bloqueado (clickeable para desbloquear)
// ============================================================

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

  // ── Query: canchas del complejo ──────────────────────────────
  // Para poblar el select de selección de cancha
  const { data: canchas } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  // ── Estados de los selectores ────────────────────────────────
  // canchaId: cancha actualmente seleccionada
  const [canchaId, setCanchaId] = useState<string>('')
  // fecha: día seleccionado, por defecto hoy
  const [fecha, setFecha] = useState(formatearFechaISO(new Date()))

  // Autoseleccionar la primera cancha cuando carguen las canchas
  // (evita que el selector quede vacío al principio)
  if (!canchaId && canchas && canchas.length > 0) {
    setCanchaId(canchas[0].id)
  }

  // Objeto de la cancha seleccionada (para leer su duracion_min)
  const canchaSel = canchas?.find((c) => c.id === canchaId)

  // ── useSlots: slots calculados para la cancha + fecha ────────
  // Devuelve los turnos del día con su estado (libre/ocupado/bloqueado)
  const { data: slots, isLoading: loadingSlots } = useSlots({
    canchaId: canchaId || undefined,
    fecha,
    duracionMin: canchaSel?.duracion_min,
  })

  // ── Query: bloqueos existentes para la cancha+fecha ──────────
  // Se usa para encontrar el ID del bloqueo al desbloquear un slot
  const { data: bloqueos } = useQuery({
    queryKey: ['bloqueos', canchaId, fecha],
    queryFn: () => fetchBloqueosByCancha(canchaId, fecha),
    enabled: !!canchaId && !!fecha,
  })

  // ── Función para refrescar slots y bloqueos ──────────────────
  // Después de crear o eliminar un bloqueo, invalida las caches
  // para que React Query vuelva a buscar los datos actualizados
  async function invalidar() {
    await queryClient.invalidateQueries({ queryKey: ['slots', canchaId, fecha] })
    await queryClient.invalidateQueries({ queryKey: ['bloqueos', canchaId, fecha] })
  }

  // ── Handler: click en un slot ────────────────────────────────
  async function handleSlotClick(horaInicio: string, estado: string) {

    // No se puede bloquear un slot que ya tiene reserva
    if (estado === 'ocupado') {
      toast.error('No se puede bloquear un slot reservado')
      return
    }

    // Slot BLOQUEADO → desbloquear
    if (estado === 'bloqueado') {
      // Buscar el registro de bloqueo por hora de inicio
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

    // Slot LIBRE → bloquear
    // window.prompt nativo: pide el motivo al admin (puede quedar vacío)
    const motivo = prompt('Motivo del bloqueo (opcional):') ?? null
    try {
      await crearBloqueo({
        canchaId,
        fecha,
        horaInicio,
        motivo: motivo || null,  // null si no ingresó nada
      })
      toast.success('Slot bloqueado')
      await invalidar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Bloqueos de turnos</h1>
        <p className="text-sm text-neutral-500">
          Bloqueá turnos específicos (mantenimiento, eventos, etc.).
        </p>
      </div>

      {/* ── Selectores: cancha y fecha ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Select de cancha */}
        <div>
          <Label htmlFor="cancha">Cancha</Label>
          <select
            id="cancha"
            value={canchaId}
            onChange={(e) => setCanchaId(e.target.value)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            {/* Una opción por cada cancha del complejo */}
            {canchas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} — {tipoCanchaLabels[c.tipo]}
              </option>
            ))}
          </select>
        </div>

        {/* Input de fecha */}
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

      {/* ── Grid de slots ── */}
      {/* 4 columnas en mobile, 6 en desktop */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        {loadingSlots ? (
          // Skeletons mientras cargan
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !slots || slots.length === 0 ? (
          // Sin horarios configurados para este día
          <p className="py-8 text-center text-sm text-neutral-500">
            Sin horarios para este día.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {slots.map((s) => {
              // Buscar si este slot tiene un bloqueo registrado (para mostrar el motivo)
              const b =
                bloqueos?.find((x) => x.hora_inicio.slice(0, 5) === s.horaInicio)

              // Determinar clases de color y texto del tooltip según estado
              let cls = 'bg-green-100 text-green-700 hover:bg-green-200'  // libre
              let titulo = 'Click para bloquear'
              if (s.estado === 'ocupado') {
                cls = 'bg-red-100 text-red-700 cursor-not-allowed'
                titulo = 'Reservado'
              } else if (s.estado === 'bloqueado') {
                cls = 'bg-neutral-300 text-neutral-700 hover:bg-neutral-400'
                // Mostrar el motivo del bloqueo en el tooltip (title) si existe
                titulo = b?.motivo
                  ? `Bloqueado: ${b.motivo}. Click para desbloquear.`
                  : 'Click para desbloquear'
              }

              return (
                <button
                  key={s.horaInicio}
                  type="button"
                  title={titulo}           // tooltip al hacer hover
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

      {/* ── Leyenda de colores ── */}
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
