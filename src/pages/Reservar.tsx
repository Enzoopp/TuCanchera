// SRP: Página de reserva con calendario semanal.
// - Obtiene la cancha por ID
// - Muestra grid de slots por día de la semana
// - Estados: libre (primary), ocupado (neutral), bloqueado (neutral)
// - Al clickear un slot libre, abre ConfirmacionReservaModal
// - Mobile-first: 1 día a la vez con flechas; desktop: 7 días

import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useTenant } from '@/context/TenantContext'
import { useSlots } from '@/hooks/useSlots'
import { fetchCanchaById } from '@/services/reservaService'
import {
  generarDiasSemana,
  formatearFechaCorta,
  formatearFechaLarga,
  formatearDiaSemanaCorto,
  formatearFechaISO,
  esFechaPasada,
  esHoy,
} from '@/utils/fechas'
import { tipoCanchaLabels } from '@/utils/canchaLabels'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, ArrowLeft, Clock, DollarSign } from 'lucide-react'
import ConfirmacionReservaModal from '@/components/ConfirmacionReservaModal'
import type { Slot } from '@/types'

export default function Reservar() {
  const { slug, canchaId } = useParams<{ slug: string; canchaId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { complejo } = useTenant()

  const [semanaBase, setSemanaBase] = useState(() => new Date())
  const [diaMobile, setDiaMobile] = useState(() => new Date())
  const [slotSeleccionado, setSlotSeleccionado] = useState<{
    fecha: string
    slot: Slot
  } | null>(null)

  const { data: cancha, isLoading: loadingCancha } = useQuery({
    queryKey: ['cancha', canchaId],
    queryFn: () => fetchCanchaById(canchaId!),
    enabled: !!canchaId,
  })

  const dias = generarDiasSemana(semanaBase)

  function handleSlotClick(fecha: string, slot: Slot) {
    if (slot.estado !== 'libre') return

    if (!user) {
      navigate('/login', {
        state: { from: { pathname: `/${slug}/reservar/${canchaId}` } },
      })
      return
    }

    setSlotSeleccionado({ fecha, slot })
  }

  if (loadingCancha) {
    return <ReservarSkeleton slug={slug} />
  }

  if (!cancha) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-black text-neutral-900">Cancha no encontrada</h1>
          <Link
            to={`/${slug}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al complejo
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <Link
            to={`/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {complejo?.nombre ?? 'Volver'}
          </Link>

          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-neutral-900">{cancha.nombre}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {tipoCanchaLabels[cancha.tipo]}
                </Badge>
                <span className="flex items-center gap-1 text-sm text-neutral-500">
                  <DollarSign className="h-3.5 w-3.5" />
                  {cancha.precio.toLocaleString('es-AR')}
                </span>
                <span className="flex items-center gap-1 text-sm text-neutral-500">
                  <Clock className="h-3.5 w-3.5" />
                  {cancha.duracion_min} min
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Desktop: semana */}
        <div className="hidden sm:block">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSemanaBase((d) => new Date(d.getTime() - 7 * 86400000))}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>
            <p className="text-sm font-semibold text-neutral-700">
              {formatearFechaCorta(dias[0])} — {formatearFechaCorta(dias[6])}
            </p>
            <button
              type="button"
              onClick={() => setSemanaBase((d) => new Date(d.getTime() + 7 * 86400000))}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {/* Días header */}
            <div className="grid grid-cols-7 border-b border-neutral-100 bg-neutral-50">
              {dias.map((dia) => (
                <div
                  key={dia.toISOString()}
                  className="border-r border-neutral-100 px-2 py-3 text-center last:border-r-0"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    {formatearDiaSemanaCorto(dia)}
                  </p>
                  <p
                    className={`mt-0.5 text-xl font-black ${
                      esHoy(dia) ? 'text-primary-600' : 'text-neutral-800'
                    }`}
                  >
                    {dia.getDate()}
                  </p>
                  {esHoy(dia) && (
                    <div className="mx-auto mt-0.5 h-1 w-1 rounded-full bg-primary-500" />
                  )}
                </div>
              ))}
            </div>

            {/* Slots grid */}
            <div className="grid grid-cols-7">
              {dias.map((dia) => (
                <DiaColumna
                  key={dia.toISOString()}
                  dia={dia}
                  canchaId={cancha.id}
                  duracionMin={cancha.duracion_min}
                  onSlotClick={handleSlotClick}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: un día a la vez */}
        <div className="sm:hidden">
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDiaMobile((d) => new Date(d.getTime() - 86400000))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-neutral-600" />
            </button>
            <div className="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-center shadow-sm">
              <p className="text-sm font-semibold text-neutral-900 capitalize">
                {formatearFechaLarga(diaMobile)}
              </p>
              {esHoy(diaMobile) && (
                <span className="text-xs font-medium text-primary-600">Hoy</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDiaMobile((d) => new Date(d.getTime() + 86400000))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white shadow-sm hover:bg-neutral-50 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-neutral-600" />
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <DiaColumna
              dia={diaMobile}
              canchaId={cancha.id}
              duracionMin={cancha.duracion_min}
              onSlotClick={handleSlotClick}
              fullWidth
            />
          </div>
        </div>

        {/* Leyenda */}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-primary-400" />
            <span className="text-xs text-neutral-600">Libre — hacé click para reservar</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-neutral-300" />
            <span className="text-xs text-neutral-600">Ocupado / Bloqueado</span>
          </div>
        </div>
      </div>

      {/* Modal de confirmación */}
      {slotSeleccionado && cancha && (
        <ConfirmacionReservaModal
          cancha={cancha}
          fecha={slotSeleccionado.fecha}
          slot={slotSeleccionado.slot}
          onClose={() => setSlotSeleccionado(null)}
        />
      )}
    </div>
  )
}

function DiaColumna({
  dia,
  canchaId,
  duracionMin,
  onSlotClick,
  fullWidth = false,
}: {
  dia: Date
  canchaId: string
  duracionMin: number
  onSlotClick: (fecha: string, slot: Slot) => void
  fullWidth?: boolean
}) {
  const fechaISO = formatearFechaISO(dia)
  const pasada = esFechaPasada(dia)

  const { data: slots, isLoading } = useSlots({
    canchaId,
    fecha: fechaISO,
    duracionMin,
  })

  const borderClass = fullWidth ? '' : 'border-r border-neutral-100 last:border-r-0'

  return (
    <div className={`${borderClass} p-2`}>
      {isLoading ? (
        <div className="space-y-1.5 py-1">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      ) : !slots || slots.length === 0 ? (
        <p className="py-6 text-center text-xs text-neutral-400">
          {fullWidth ? 'Sin horarios disponibles.' : '—'}
        </p>
      ) : (
        <div className={`space-y-1.5 py-1 ${fullWidth ? 'grid grid-cols-3 gap-1.5 space-y-0' : ''}`}>
          {slots.map((slot) => (
            <SlotButton
              key={`${fechaISO}-${slot.horaInicio}`}
              slot={slot}
              disabled={pasada}
              fullWidth={fullWidth}
              onClick={() => onSlotClick(fechaISO, slot)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SlotButton({
  slot,
  disabled,
  fullWidth,
  onClick,
}: {
  slot: Slot
  disabled: boolean
  fullWidth: boolean
  onClick: () => void
}) {
  if (disabled || slot.estado !== 'libre') {
    const isOcupado = slot.estado === 'ocupado'
    return (
      <div
        className={`flex items-center justify-center rounded-lg px-2 py-2 text-xs font-semibold ${
          isOcupado
            ? 'bg-neutral-100 text-neutral-400'
            : 'bg-neutral-100 text-neutral-400'
        } cursor-not-allowed ${fullWidth ? '' : 'w-full'}`}
        title={isOcupado ? 'Ocupado' : slot.estado === 'bloqueado' ? 'Bloqueado' : undefined}
      >
        {slot.horaInicio.slice(0, 5)}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-2 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 active:bg-primary-200 ${fullWidth ? '' : 'w-full'}`}
    >
      {slot.horaInicio.slice(0, 5)}
    </button>
  )
}

function ReservarSkeleton({ slug }: { slug?: string }) {
  return (
    <div className="min-h-screen bg-neutral-100">
      <header className="border-b border-neutral-200 bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <Skeleton className="h-4 w-28" />
          <div className="mt-3">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Skeleton className="mb-4 h-10 w-full" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  )
}
