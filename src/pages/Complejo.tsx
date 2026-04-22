// SRP: Página pública del complejo con Gantt de disponibilidad.
// Desktop: Vista Gantt horizontal (todas las canchas × todos los horarios del día).
// Mobile: Cards por cancha con link a Reservar.tsx.
// Al hacer clic en un slot libre del Gantt se abre ConfirmacionReservaModal.

import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTenant } from '@/context/TenantContext'
import { useAuth } from '@/context/AuthContext'
import { useCanchas } from '@/hooks/useCanchas'
import { useFotos } from '@/hooks/useFotos'
import { useSlots } from '@/hooks/useSlots'
import ComplejoNoEncontrado from '@/pages/ComplejoNoEncontrado'
import ConfirmacionReservaModal from '@/components/ConfirmacionReservaModal'
import MapaComplejo from '@/components/MapaComplejo'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MapPin,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Info,
  ArrowRight,
} from 'lucide-react'
import { tipoCanchaLabels } from '@/utils/canchaLabels'
import { formatearFechaISO, formatearDiaSemanaCorto, formatearFechaCorta } from '@/utils/fechas'
import { addDays, startOfToday } from 'date-fns'
import type { Cancha, Slot, TipoCancha } from '@/types'

// ─── Constantes del Gantt ───────────────────────────────────────────────────
const GANTT_START_HOUR = 6   // 06:00
const GANTT_END_HOUR = 23    // 23:00
const PX_PER_MIN = 1.5       // 90px por hora
const GANTT_TOTAL_MIN = (GANTT_END_HOUR - GANTT_START_HOUR) * 60
const GANTT_TOTAL_WIDTH = GANTT_TOTAL_MIN * PX_PER_MIN  // 1530px

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function slotPosition(horaInicio: string, horaFin: string) {
  const startMin = timeToMinutes(horaInicio)
  const endMin = timeToMinutes(horaFin)
  const left = (startMin - GANTT_START_HOUR * 60) * PX_PER_MIN
  const width = (endMin - startMin) * PX_PER_MIN
  return { left, width }
}

// ─── Tipos ─────────────────────────────────────────────────────────────────
type FiltroTipo = TipoCancha | 'todos'

interface SlotSeleccionado {
  cancha: Cancha
  slot: Slot
}

// ─── Página principal ───────────────────────────────────────────────────────
export default function Complejo() {
  const { complejo, loading: loadingComplejo, error } = useTenant()
  const { data: canchas, isLoading: loadingCanchas } = useCanchas(complejo?.id)
  const { data: fotos, isLoading: loadingFotos } = useFotos(complejo?.id)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [offsetDias, setOffsetDias] = useState(0)
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [slotSeleccionado, setSlotSeleccionado] = useState<SlotSeleccionado | null>(null)

  // Fecha seleccionada: hoy + offset
  const fechaBase = useMemo(() => {
    const d = startOfToday()
    return addDays(d, offsetDias)
  }, [offsetDias])
  const fechaISO = formatearFechaISO(fechaBase)

  // Strip de 7 días
  const diasStrip = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(startOfToday(), i)),
    []
  )

  // Canchas filtradas por tipo
  const canchasFiltradas = useMemo(() => {
    if (!canchas) return []
    if (filtroTipo === 'todos') return canchas
    return canchas.filter((c) => c.tipo === filtroTipo)
  }, [canchas, filtroTipo])

  // Tipos únicos disponibles para el filtro
  const tiposDisponibles = useMemo((): TipoCancha[] => {
    if (!canchas) return []
    return [...new Set(canchas.map((c) => c.tipo))]
  }, [canchas])

  function handleSlotClick(cancha: Cancha, slot: Slot) {
    if (slot.estado !== 'libre') return
    if (!user) {
      navigate('/login', {
        state: { from: { pathname: `/${complejo?.slug}` } },
      })
      return
    }
    setSlotSeleccionado({ cancha, slot })
  }

  if (loadingComplejo) return <ComplejoSkeleton />
  if (error || !complejo) return <ComplejoNoEncontrado />

  // Primera foto para el hero
  const heroFoto = fotos && fotos.length > 0 ? fotos[0].url : null

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative h-64 sm:h-80 overflow-hidden bg-neutral-900">
        {heroFoto ? (
          <img
            src={heroFoto}
            alt={complejo.nombre}
            className="h-full w-full object-cover opacity-60"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-800 to-neutral-900">
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)',
                backgroundSize: '12px 12px',
              }}
            />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/90 via-neutral-900/30 to-transparent" />

        {/* Navbar mínimo */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-4">
          <Link
            to="/explorar"
            className="flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Inicio
          </Link>
          {user && (
            <Link
              to="/mis-reservas"
              className="rounded-full bg-black/30 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
            >
              Mis reservas
            </Link>
          )}
        </div>

        {/* Info del complejo en el hero */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-5 sm:px-8">
          <div className="flex items-end gap-4">
            {complejo.logo_url && (
              <img
                src={complejo.logo_url}
                alt={`Logo ${complejo.nombre}`}
                className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-lg ring-2 ring-white/30"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-white sm:text-3xl leading-tight">
                {complejo.nombre}
              </h1>
              {complejo.direccion && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {complejo.direccion}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Galería adicional de fotos (si hay más de 1) ─────────────────── */}
      {!loadingFotos && fotos && fotos.length > 1 && (
        <div className="bg-neutral-900 px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-thin">
            {fotos.slice(1).map((foto) => (
              <img
                key={foto.id}
                src={foto.url}
                alt={`Foto ${complejo.nombre}`}
                className="h-16 w-24 shrink-0 rounded-lg object-cover opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Descripción ──────────────────────────────────────────────────── */}
      {complejo.descripcion && (
        <div className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-5xl px-4 py-4">
            <p className="text-sm text-neutral-600">{complejo.descripcion}</p>
          </div>
        </div>
      )}

      {/* ── Sección "Elegí tu turno" ──────────────────────────────────────── */}
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">

        {/* Título */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-neutral-900">Elegí tu turno</h2>
          {canchas && canchas.length > 0 && (
            <span className="text-sm text-neutral-500">
              {canchasFiltradas.length}{' '}
              {canchasFiltradas.length === 1 ? 'cancha' : 'canchas'}
            </span>
          )}
        </div>

        {/* Filtro por tipo de deporte */}
        {tiposDisponibles.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <SportFilterBtn
              active={filtroTipo === 'todos'}
              onClick={() => setFiltroTipo('todos')}
            >
              Todos
            </SportFilterBtn>
            {tiposDisponibles.map((tipo) => (
              <SportFilterBtn
                key={tipo}
                active={filtroTipo === tipo}
                onClick={() => setFiltroTipo(tipo)}
              >
                {tipoCanchaLabels[tipo]}
              </SportFilterBtn>
            ))}
          </div>
        )}

        {/* Strip de 7 días */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOffsetDias((o) => Math.max(0, o - 1))}
            disabled={offsetDias === 0}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-none">
            {diasStrip.map((dia, i) => {
              const iso = formatearFechaISO(dia)
              const isSelected = iso === fechaISO
              const isToday = i === 0
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setOffsetDias(i)}
                  className={`flex min-w-[56px] shrink-0 flex-col items-center rounded-xl px-2 py-2 text-center transition-colors ${
                    isSelected
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    {isToday ? 'Hoy' : formatearDiaSemanaCorto(dia)}
                  </span>
                  <span className={`text-lg font-black ${isSelected ? 'text-white' : 'text-neutral-900'}`}>
                    {dia.getDate()}
                  </span>
                  <span className="text-[10px] opacity-70">
                    {formatearFechaCorta(dia).split(' ')[2]}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setOffsetDias((o) => Math.min(6, o + 1))}
            disabled={offsetDias === 6}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* ── GANTT (desktop ≥ md) ─────────────────────────────────────── */}
        {loadingCanchas ? (
          <div className="hidden md:block space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : canchasFiltradas.length === 0 ? (
          <div className="hidden md:flex rounded-xl bg-white p-10 text-center justify-center border border-neutral-200 shadow-sm">
            <p className="text-neutral-500 text-sm">
              {canchas?.length === 0
                ? 'Este complejo aún no tiene canchas cargadas.'
                : 'No hay canchas que coincidan con el filtro seleccionado.'}
            </p>
          </div>
        ) : (
          <div className="hidden md:block rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            {/* Leyenda */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Info className="h-3.5 w-3.5" />
                Hacé clic en un turno disponible para reservar
              </div>
              <div className="flex items-center gap-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-neutral-200 ring-1 ring-neutral-300" />
                  No disponible
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm bg-primary-100 ring-1 ring-primary-300" />
                  Disponible
                </span>
              </div>
            </div>

            {/* Gantt container */}
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-200 scrollbar-track-transparent">
              <div style={{ minWidth: `${GANTT_TOTAL_WIDTH + 200}px` }}>

                {/* Time axis header */}
                <div className="flex border-b border-neutral-100">
                  {/* Left label column */}
                  <div className="w-48 shrink-0 border-r border-neutral-100 bg-neutral-50" />
                  {/* Hour labels */}
                  <div className="relative flex-1">
                    <div
                      className="relative h-8"
                      style={{ width: `${GANTT_TOTAL_WIDTH}px` }}
                    >
                      {Array.from(
                        { length: GANTT_END_HOUR - GANTT_START_HOUR },
                        (_, i) => {
                          const hour = GANTT_START_HOUR + i
                          const left = i * 60 * PX_PER_MIN
                          return (
                            <span
                              key={hour}
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[11px] font-medium text-neutral-400"
                              style={{ left: `${left}px` }}
                            >
                              {String(hour).padStart(2, '0')}hs
                            </span>
                          )
                        }
                      )}
                    </div>
                  </div>
                </div>

                {/* Cancha rows */}
                {canchasFiltradas.map((cancha, idx) => (
                  <GanttCanchaRow
                    key={cancha.id}
                    cancha={cancha}
                    fecha={fechaISO}
                    isLast={idx === canchasFiltradas.length - 1}
                    onSlotClick={(slot) => handleSlotClick(cancha, slot)}
                  />
                ))}
              </div>
            </div>

            {/* Footer info */}
            <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-2.5">
              <p className="text-xs text-neutral-400">
                Las reservas pueden realizarse con hasta 6 días de anticipación. Los turnos en gris ya están reservados o bloqueados.
              </p>
            </div>
          </div>
        )}

        {/* ── CARDS (mobile < md) ──────────────────────────────────────── */}
        {loadingCanchas ? (
          <div className="md:hidden grid gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : canchasFiltradas.length === 0 ? (
          <div className="md:hidden rounded-xl bg-white p-10 text-center border border-neutral-200">
            <p className="text-neutral-500 text-sm">Sin canchas disponibles.</p>
          </div>
        ) : (
          <div className="md:hidden grid gap-3">
            {canchasFiltradas.map((cancha) => (
              <CanchaCardMobile
                key={cancha.id}
                cancha={cancha}
                slug={complejo.slug}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Ubicación ────────────────────────────────────────────────────── */}
      {complejo.direccion && (
        <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
          <MapaComplejo direccion={complejo.direccion} nombre={complejo.nombre} />
        </section>
      )}

      {/* ── Modal de confirmación ─────────────────────────────────────────── */}
      {slotSeleccionado && (
        <ConfirmacionReservaModal
          cancha={slotSeleccionado.cancha}
          fecha={fechaISO}
          slot={slotSeleccionado.slot}
          onClose={() => setSlotSeleccionado(null)}
        />
      )}
    </div>
  )
}

// ─── Fila del Gantt por cancha ──────────────────────────────────────────────
function GanttCanchaRow({
  cancha,
  fecha,
  isLast,
  onSlotClick,
}: {
  cancha: Cancha
  fecha: string
  isLast: boolean
  onSlotClick: (slot: Slot) => void
}) {
  const { data: slots, isLoading } = useSlots({
    canchaId: cancha.id,
    fecha,
    duracionMin: cancha.duracion_min,
  })

  return (
    <div
      className={`flex ${!isLast ? 'border-b border-neutral-100' : ''} hover:bg-neutral-50/50 transition-colors`}
    >
      {/* Cancha info */}
      <div className="w-48 shrink-0 border-r border-neutral-100 px-4 py-3">
        <p className="text-sm font-bold text-neutral-900 leading-tight">
          {cancha.nombre}
        </p>
        <Badge variant="secondary" className="mt-1 text-[10px]">
          {tipoCanchaLabels[cancha.tipo]}
        </Badge>
        <p className="mt-1.5 text-xs text-neutral-500">
          ${cancha.precio.toLocaleString('es-AR')} · {cancha.duracion_min}min
        </p>
      </div>

      {/* Timeline de slots */}
      <div className="flex-1 relative py-3 px-1">
        {isLoading ? (
          <div className="flex h-full items-center">
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        ) : !slots || slots.length === 0 ? (
          <div className="flex h-10 items-center">
            <p className="text-xs text-neutral-400 pl-2">Sin horarios este día</p>
          </div>
        ) : (
          <div
            className="relative h-10"
            style={{ width: `${GANTT_TOTAL_WIDTH}px` }}
          >
            {/* Grid de horas (líneas verticales) */}
            {Array.from(
              { length: GANTT_END_HOUR - GANTT_START_HOUR + 1 },
              (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-neutral-100"
                  style={{ left: `${i * 60 * PX_PER_MIN}px` }}
                />
              )
            )}

            {/* Slots */}
            {slots.map((slot) => {
              const { left, width } = slotPosition(slot.horaInicio, slot.horaFin)

              if (slot.estado === 'libre') {
                return (
                  <button
                    key={slot.horaInicio}
                    type="button"
                    onClick={() => onSlotClick(slot)}
                    title={`Reservar ${slot.horaInicio} - ${slot.horaFin}`}
                    className="absolute top-1 bottom-1 rounded-md bg-primary-50 ring-1 ring-primary-200 hover:bg-primary-100 hover:ring-primary-400 transition-all group cursor-pointer flex items-center justify-center overflow-hidden"
                    style={{ left: `${left}px`, width: `${width - 2}px` }}
                  >
                    <span className="text-[10px] font-semibold text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-1">
                      {slot.horaInicio}
                    </span>
                  </button>
                )
              }

              if (slot.estado === 'ocupado') {
                return (
                  <div
                    key={slot.horaInicio}
                    title="No disponible"
                    className="absolute top-1 bottom-1 rounded-md bg-neutral-200 ring-1 ring-neutral-300 cursor-not-allowed"
                    style={{ left: `${left}px`, width: `${width - 2}px` }}
                  />
                )
              }

              if (slot.estado === 'bloqueado') {
                return (
                  <div
                    key={slot.horaInicio}
                    title="Bloqueado"
                    className="absolute top-1 bottom-1 rounded-md bg-neutral-300 ring-1 ring-neutral-400 cursor-not-allowed"
                    style={{ left: `${left}px`, width: `${width - 2}px` }}
                  />
                )
              }

              return null
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Card mobile por cancha ─────────────────────────────────────────────────
function CanchaCardMobile({ cancha, slug }: { cancha: Cancha; slug: string }) {
  return (
    <Link
      to={`/${slug}/reservar/${cancha.id}`}
      className="group flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-primary-300 hover:shadow-md"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-neutral-900 group-hover:text-primary-700 transition-colors truncate">
            {cancha.nombre}
          </h3>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {tipoCanchaLabels[cancha.tipo]}
          </Badge>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            ${cancha.precio.toLocaleString('es-AR')} / turno
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {cancha.duracion_min} min
          </span>
        </div>
      </div>
      <div className="ml-3 flex items-center gap-1 shrink-0 text-sm font-semibold text-primary-600">
        Ver turnos
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

// ─── Botón filtro deporte ───────────────────────────────────────────────────
function SportFilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors border ${
        active
          ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
          : 'bg-white text-neutral-600 border-neutral-200 hover:border-primary-300 hover:text-primary-600'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────
function ComplejoSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Skeleton className="h-64 sm:h-80 w-full rounded-none" />
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-16 w-14 rounded-xl shrink-0" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  )
}
