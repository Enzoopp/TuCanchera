// ============================================================
// RESERVAR.TSX  (ruta: /:slug/reservar/:canchaId)
// Página de reserva con un calendario semanal de slots.
// Muestra todos los turnos disponibles de una cancha para la semana
// actual. Cada slot puede estar: libre (verde), ocupado (rojo)
// o bloqueado (gris).
//
// Al clickear un slot libre:
//   - Si el usuario NO está logueado → redirige a /login
//   - Si está logueado → abre el modal de confirmación
//
// Diseño responsive:
//   - Desktop: 7 columnas (una por día de la semana)
//   - Mobile: 1 día a la vez con flechas para navegar
// ============================================================

import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useTenant } from '@/context/TenantContext'
import { useSlots } from '@/hooks/useSlots'
import { fetchCanchaById } from '@/services/reservaService'
import {
  generarDiasSemana,      // genera un array de 7 fechas a partir de una fecha base
  formatearFechaCorta,    // ej: "12 may"
  formatearFechaLarga,    // ej: "lunes 12 de mayo"
  formatearDiaSemanaCorto,// ej: "LUN"
  formatearFechaISO,      // convierte Date → "YYYY-MM-DD"
  esFechaPasada,          // true si la fecha es anterior a hoy
  esHoy,                  // true si la fecha es hoy
} from '@/utils/fechas'
import { tipoCanchaLabels } from '@/utils/canchaLabels'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import ConfirmacionReservaModal from '@/components/ConfirmacionReservaModal'
import type { Slot } from '@/types'

export default function Reservar() {
  // useParams: extrae :slug y :canchaId de la URL
  const { slug, canchaId } = useParams<{ slug: string; canchaId: string }>()
  const navigate = useNavigate()

  // useAuth: para saber si el usuario está logueado antes de abrir el modal
  const { user } = useAuth()

  // useTenant: para mostrar el nombre del complejo en el link "Volver a X"
  const { complejo } = useTenant()

  // ── Estados de la UI ─────────────────────────────────────────
  // semanaBase: fecha de inicio de la semana visible en desktop
  const [semanaBase, setSemanaBase] = useState(() => new Date())
  // diaMobile: día actual en la vista móvil (un día a la vez)
  const [diaMobile, setDiaMobile] = useState(() => new Date())
  // slotSeleccionado: cuando el usuario clickea un slot libre, se guarda
  // acá para pasárselo al modal de confirmación
  const [slotSeleccionado, setSlotSeleccionado] = useState<{
    fecha: string   // formato "YYYY-MM-DD"
    slot: Slot      // objeto con horaInicio, horaFin y estado
  } | null>(null)

  // ── Datos de la cancha ───────────────────────────────────────
  // Se busca la cancha por su ID para mostrar nombre, tipo, precio y duración
  const { data: cancha, isLoading: loadingCancha } = useQuery({
    queryKey: ['cancha', canchaId],
    queryFn: () => fetchCanchaById(canchaId!),
    enabled: !!canchaId,  // no ejecutar si canchaId no está en la URL
  })

  // dias: array de 7 Date objects (lun–dom) de la semana actual
  const dias = generarDiasSemana(semanaBase)

  // ── Handler: click en un slot ────────────────────────────────
  function handleSlotClick(fecha: string, slot: Slot) {
    // Solo actuar si el slot está libre
    if (slot.estado !== 'libre') return

    // Si no está logueado, redirigir al login guardando la ruta actual
    // para volver después de autenticarse
    if (!user) {
      navigate('/login', {
        state: { from: { pathname: `/${slug}/reservar/${canchaId}` } },
      })
      return
    }

    // Si está logueado, guardamos el slot para mostrar el modal
    setSlotSeleccionado({ fecha, slot })
  }

  // ── Pantalla de carga ────────────────────────────────────────
  if (loadingCancha) {
    return <ReservarSkeleton />
  }

  // ── Cancha no encontrada ─────────────────────────────────────
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

      {/* ── Header: nombre de la cancha + info ── */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          {/* Link para volver al complejo */}
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
                {/* Badge del tipo (Fútbol 5, Fútbol 7, Pádel) */}
                <Badge variant="secondary">{tipoCanchaLabels[cancha.tipo]}</Badge>
                {/* Precio y duración del turno */}
                <span>${cancha.precio.toLocaleString('es-AR')} / {cancha.duracion_min} min</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Grid de turnos ── */}
      <div className="mx-auto max-w-5xl px-4 py-4">

        {/* === VISTA DESKTOP: 7 columnas (una por día) === */}
        <div className="hidden sm:block">
          {/* Navegación de semana: botones para ir a la semana anterior/siguiente */}
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSemanaBase((d) => new Date(d.getTime() - 7 * 86400000))}
            >
              <ChevronLeft className="h-4 w-4" /> Semana anterior
            </Button>
            {/* Rango visible: "12 may — 18 may" */}
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

          {/* Grid de 7 columnas: una DiaColumna por día */}
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

        {/* === VISTA MOBILE: un día a la vez con flechas === */}
        <div className="sm:hidden">
          <div className="mb-3 flex items-center justify-between gap-2">
            {/* Flecha izquierda: día anterior */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiaMobile((d) => new Date(d.getTime() - 86400000))}
              // Deshabilitar si el día anterior ya pasó (no tiene sentido navegar hacia atrás del hoy)
              disabled={esFechaPasada(new Date(diaMobile.getTime() - 86400000)) && !esHoy(new Date(diaMobile.getTime() - 86400000))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {/* Nombre del día actual: "lunes 12 de mayo" */}
            <h2 className="flex-1 text-center text-sm font-medium text-neutral-700">
              {formatearFechaLarga(diaMobile)}
            </h2>
            {/* Flecha derecha: día siguiente */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiaMobile((d) => new Date(d.getTime() + 86400000))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {/* Columna única del día seleccionado (fullWidth = true) */}
          <DiaColumna
            dia={diaMobile}
            canchaId={cancha.id}
            duracionMin={cancha.duracion_min}
            onSlotClick={handleSlotClick}
            fullWidth
          />
        </div>

        {/* ── Leyenda de colores ── */}
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

      {/* ── Modal de confirmación ── */}
      {/* Se abre cuando el usuario logueado clickea un slot libre */}
      {slotSeleccionado && cancha && (
        <ConfirmacionReservaModal
          cancha={cancha}
          fecha={slotSeleccionado.fecha}
          slot={slotSeleccionado.slot}
          onClose={() => setSlotSeleccionado(null)}  // cierra el modal
        />
      )}
    </div>
  )
}

// ── DiaColumna ───────────────────────────────────────────────
// Componente que muestra todos los slots de UN día específico.
// Usa el hook useSlots para buscar los turnos disponibles/ocupados/bloqueados
// de esa cancha para esa fecha.
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
  fullWidth?: boolean  // true en mobile para que ocupe todo el ancho
}) {
  const fechaISO = formatearFechaISO(dia)  // "2025-05-12"
  const pasada = esFechaPasada(dia)         // true si el día ya pasó

  // useSlots: calcula los turnos del día basándose en los horarios
  // del complejo, reservas existentes y bloqueos activos
  const { data: slots, isLoading } = useSlots({
    canchaId,
    fecha: fechaISO,
    duracionMin,
  })

  return (
    <div className={fullWidth ? 'space-y-2' : ''}>
      {/* Encabezado del día — solo en desktop (cuando fullWidth=false) */}
      {!fullWidth && (
        <div className="text-center">
          {/* Día de la semana: "LUN", "MAR", etc. */}
          <p className="text-xs font-medium uppercase text-neutral-500">
            {formatearDiaSemanaCorto(dia)}
          </p>
          {/* Número del día — azul si es hoy */}
          <p className={`mt-0.5 text-lg font-semibold ${esHoy(dia) ? 'text-primary-600' : 'text-neutral-900'}`}>
            {dia.getDate()}
          </p>
        </div>
      )}

      {/* Lista de slots del día */}
      <div className={`space-y-1.5 ${fullWidth ? '' : 'mt-2'}`}>
        {isLoading ? (
          // Skeletons mientras carga
          <>
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </>
        ) : !slots || slots.length === 0 ? (
          // Sin horarios configurados para este día
          <p className="py-2 text-center text-xs text-neutral-400">Sin horarios</p>
        ) : (
          // SlotButton por cada turno del día
          slots.map((slot) => (
            <SlotButton
              key={`${fechaISO}-${slot.horaInicio}`}
              slot={slot}
              disabled={pasada}  // si el día pasó, todos los botones quedan deshabilitados
              onClick={() => onSlotClick(fechaISO, slot)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── SlotButton ───────────────────────────────────────────────
// Botón individual que representa un turno.
// El color cambia según el estado:
//   - Fecha pasada: gris claro, cursor-not-allowed
//   - ocupado: rojo, no clickeable
//   - bloqueado: gris, no clickeable
//   - libre: verde, clickeable
function SlotButton({
  slot,
  disabled,  // true cuando la fecha ya pasó
  onClick,
}: {
  slot: Slot
  disabled: boolean
  onClick: () => void
}) {
  const baseClass = 'w-full rounded-md px-2 py-1.5 text-xs font-medium transition-colors'

  // Fecha pasada: gris muy claro
  if (disabled) {
    return (
      <div className={`${baseClass} cursor-not-allowed bg-neutral-100 text-neutral-300`}>
        {slot.horaInicio}
      </div>
    )
  }

  // Slot ocupado: rojo, no clickeable
  if (slot.estado === 'ocupado') {
    return (
      <div className={`${baseClass} cursor-not-allowed bg-red-100 text-red-700`}>
        {slot.horaInicio}
      </div>
    )
  }

  // Slot bloqueado por el admin: gris, no clickeable
  if (slot.estado === 'bloqueado') {
    return (
      <div className={`${baseClass} cursor-not-allowed bg-neutral-200 text-neutral-500`}>
        {slot.horaInicio}
      </div>
    )
  }

  // Slot libre: verde, hover más oscuro, clickeable
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

// ── ReservarSkeleton ─────────────────────────────────────────
// Pantalla de carga mientras se busca la información de la cancha.
// Imita la estructura del header y el grid de 7 columnas.
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
