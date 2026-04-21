// SRP: Página de reserva con calendario semanal.
// - Obtiene la cancha por ID
// - Muestra grid de slots por día de la semana
// - Estados: libre (verde), ocupado (rojo), bloqueado (gris)
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
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
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

  // Handler: click en slot libre → requiere estar logueado
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
    return <ReservarSkeleton />
  }

  if (!cancha) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900">Cancha no encontrada</h1>
          <Link to={`/${slug}`} className="mt-4 inline-block">
            <Button variant="outline">Volver al complejo</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <Link to={`/${slug}`} className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
            <ArrowLeft className="h-4 w-4" />
            Volver a {complejo?.nombre}
          </Link>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">
                {cancha.nombre}
              </h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-neutral-600">
                <Badge variant="secondary">{tipoCanchaLabels[cancha.tipo]}</Badge>
                <span>${cancha.precio.toLocaleString('es-AR')} / {cancha.duracion_min} min</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navegación de semana (desktop) y día (mobile) */}
      <div className="mx-auto max-w-5xl px-4 py-4">
        {/* Desktop: semana */}
        <div className="hidden sm:block">
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSemanaBase((d) => new Date(d.getTime() - 7 * 86400000))}
            >
              <ChevronLeft className="h-4 w-4" /> Semana anterior
            </Button>
            <h2 className="text-sm font-medium text-neutral-700">
              {formatearFechaCorta(dias[0])} — {formatearFechaCorta(dias[6])}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSemanaBase((d) => new Date(d.getTime() + 7 * 86400000))}
            >
              Semana siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-3">
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

        {/* Mobile: un día a la vez */}
        <div className="sm:hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiaMobile((d) => new Date(d.getTime() - 86400000))}
              disabled={esFechaPasada(new Date(diaMobile.getTime() - 86400000)) && !esHoy(new Date(diaMobile.getTime() - 86400000))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="flex-1 text-center text-sm font-medium text-neutral-700">
              {formatearFechaLarga(diaMobile)}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiaMobile((d) => new Date(d.getTime() + 86400000))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <DiaColumna
            dia={diaMobile}
            canchaId={cancha.id}
            duracionMin={cancha.duracion_min}
            onSlotClick={handleSlotClick}
            fullWidth
          />
        </div>

        {/* Leyenda */}
        <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-neutral-600">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-green-500" /> Libre
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-red-500" /> Ocupado
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-neutral-400" /> Bloqueado
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

// Columna de slots para un día específico
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

  return (
    <div className={fullWidth ? 'space-y-2' : ''}>
      {!fullWidth && (
        <div className="text-center">
          <p className="text-xs font-medium uppercase text-neutral-500">
            {formatearDiaSemanaCorto(dia)}
          </p>
          <p className={`mt-0.5 text-lg font-semibold ${esHoy(dia) ? 'text-primary-600' : 'text-neutral-900'}`}>
            {dia.getDate()}
          </p>
        </div>
      )}

      <div className={`space-y-1.5 ${fullWidth ? '' : 'mt-2'}`}>
        {isLoading ? (
          <>
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </>
        ) : !slots || slots.length === 0 ? (
          <p className="py-2 text-center text-xs text-neutral-400">Sin horarios</p>
        ) : (
          slots.map((slot) => (
            <SlotButton
              key={`${fechaISO}-${slot.horaInicio}`}
              slot={slot}
              disabled={pasada}
              onClick={() => onSlotClick(fechaISO, slot)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// Botón individual de slot coloreado por estado
function SlotButton({
  slot,
  disabled,
  onClick,
}: {
  slot: Slot
  disabled: boolean
  onClick: () => void
}) {
  const baseClass = 'w-full rounded-md px-2 py-1.5 text-xs font-medium transition-colors'

  if (disabled) {
    return (
      <div className={`${baseClass} cursor-not-allowed bg-neutral-100 text-neutral-300`}>
        {slot.horaInicio}
      </div>
    )
  }

  if (slot.estado === 'ocupado') {
    return (
      <div className={`${baseClass} cursor-not-allowed bg-red-100 text-red-700`}>
        {slot.horaInicio}
      </div>
    )
  }

  if (slot.estado === 'bloqueado') {
    return (
      <div className={`${baseClass} cursor-not-allowed bg-neutral-200 text-neutral-500`}>
        {slot.horaInicio}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} bg-green-100 text-green-700 hover:bg-green-200`}
    >
      {slot.horaInicio}
    </button>
  )
}

function ReservarSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-8 w-64" />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    </div>
  )
}
