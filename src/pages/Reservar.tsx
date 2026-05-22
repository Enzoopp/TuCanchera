// SRP: Página de reserva con grid semanal (7 días × slots/hora).
// Diseño replicado de ReservarPage.jsx (pills por slot: libre/ocupado/bloqueado,
// hover "Reservar", modal de confirmación de pago).
// Preserva la lógica existente: useSlots + ConfirmacionReservaModal.

import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { useTenant } from '@/context/TenantContext'
import { useSlots } from '@/hooks/useSlots'
import { useWeekSlots } from '@/hooks/useWeekSlots'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { fetchCanchaById } from '@/services/reservaService'
import Navbar from '@/components/brand/Navbar'
import SportIcon, { sportPalette, sportLabel } from '@/components/brand/SportIcon'
import ConfirmacionReservaModal from '@/components/ConfirmacionReservaModal'
import { Home, ChevronRight, ChevronLeft, Clock } from 'lucide-react'
import { addDays, startOfWeek, isSameDay, differenceInCalendarDays, startOfDay } from 'date-fns'
import type { FranjaPrecio, Slot } from '@/types'

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function formatYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

type SlotWithFecha = { fecha: string; slot: Slot }

export default function Reservar() {
  const { slug, canchaId } = useParams<{ slug: string; canchaId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { complejo } = useTenant()

  const [weekOffset, setWeekOffset] = useState(0)
  const [mobileDay, setMobileDay] = useState(0)
  const [selected, setSelected] = useState<SlotWithFecha | null>(null)

  const { data: cancha, isLoading: loadingCancha } = useQuery({
    queryKey: ['cancha', canchaId],
    queryFn: () => fetchCanchaById(canchaId!),
    enabled: !!canchaId,
  })

  // Calcula el lunes base de la semana mostrada
  const weekDates = useMemo(() => {
    const today = new Date()
    const monday = startOfWeek(today, { weekStartsOn: 1 })
    const shifted = addDays(monday, weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => addDays(shifted, i))
  }, [weekOffset])

  const weekLabel = useMemo(() => {
    const first = weekDates[0]
    const last = weekDates[6]
    return `Semana del ${first.getDate()} al ${last.getDate()} de ${MONTH_NAMES[last.getMonth()]}`
  }, [weekDates])

  function handleSlotClick(fecha: string, slot: Slot) {
    if (slot.estado !== 'libre') return
    if (!user) {
      navigate('/login', {
        state: { from: { pathname: `/${slug}/reservar/${canchaId}` } },
      })
      return
    }
    setSelected({ fecha, slot })
  }

  useDocumentMeta({
    title: cancha && complejo
      ? `Reservar ${cancha.nombre} en ${complejo.nombre} | TuCanchera`
      : 'Reservar cancha | TuCanchera',
    description: cancha && complejo
      ? `Elegí un horario para ${cancha.nombre} en ${complejo.nombre}. Reserva online sin llamadas.`
      : 'Reservá tu cancha de fútbol o pádel online.',
    canonical: window.location.href,
  })

  if (loadingCancha) return <ReservarSkeleton />

  if (!cancha) {
    return (
      <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
        <Navbar />
        <div style={{ maxWidth: 600, margin: '80px auto', padding: 24, textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#0f172a',
              marginBottom: 16,
            }}
          >
            Cancha no encontrada
          </h1>
          <Link
            to={`/${slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 10,
              background: '#2563eb',
              color: 'white',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Volver al complejo
          </Link>
        </div>
      </div>
    )
  }

  const sport = sportLabel(cancha.tipo)
  const pal = sportPalette(sport)

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px' }}>
        {/* Breadcrumb */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 16,
            fontSize: '0.82rem',
            color: '#64748b',
            flexWrap: 'wrap',
          }}
        >
          <Link
            to="/explorar"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: '#64748b',
              textDecoration: 'none',
            }}
          >
            <Home size={14} /> Inicio
          </Link>
          <ChevronRight size={13} color="#cbd5e1" />
          <Link
            to={`/${slug}`}
            style={{
              color: '#64748b',
              textDecoration: 'none',
            }}
          >
            {complejo?.nombre ?? 'Complejo'}
          </Link>
          <ChevronRight size={13} color="#cbd5e1" />
          <span style={{ color: '#0f172a', fontWeight: 600 }}>{cancha.nombre}</span>
        </div>

        {/* Court info card */}
        <div
          className="reservar-info-card"
          style={{
            background: 'white',
            borderRadius: 14,
            padding: '18px 22px',
            borderLeft: '4px solid #2563eb',
            boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexWrap: 'wrap',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: pal.text,
            }}
          >
            <SportIcon sport={sport} size={24} color={pal.text} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#0f172a',
                margin: '0 0 3px',
                letterSpacing: '-0.02em',
              }}
            >
              {cancha.nombre}
            </h1>
            <div
              style={{
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                fontSize: '0.82rem',
                color: '#64748b',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Clock size={13} />
                {cancha.duracion_min} min
              </span>
              <span>•</span>
              <span>{sport}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>por turno</div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#2563eb',
                letterSpacing: '-0.02em',
              }}
            >
              ${cancha.precio.toLocaleString('es-AR')}
            </div>
          </div>
        </div>

        {/* Week nav */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'white',
              borderRadius: 99,
              padding: 4,
              boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o - 1)}
              disabled={weekOffset === 0}
              style={{
                ...navBtnStyle,
                opacity: weekOffset === 0 ? 0.35 : 1,
                cursor: weekOffset === 0 ? 'not-allowed' : 'pointer',
              }}
              aria-label="Semana anterior"
            >
              <ChevronLeft size={17} color="#475569" />
            </button>
            <span
              style={{
                padding: '0 18px',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#0f172a',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {weekLabel}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((o) => o + 1)}
              style={navBtnStyle}
              aria-label="Semana siguiente"
            >
              <ChevronRight size={17} color="#475569" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: '1.5px solid #e2e8f0',
              background: 'white',
              color: '#374151',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Hoy
          </button>
          <div
            style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}
            className="reservar-mobile-nav"
          >
            <button
              type="button"
              onClick={() => setMobileDay((d) => Math.max(0, d - 1))}
              style={{ ...navBtnStyle, background: 'white', border: '1px solid #e2e8f0' }}
              aria-label="Día anterior"
            >
              <ChevronLeft size={15} color="#475569" />
            </button>
            <button
              type="button"
              onClick={() => setMobileDay((d) => Math.min(6, d + 1))}
              style={{ ...navBtnStyle, background: 'white', border: '1px solid #e2e8f0' }}
              aria-label="Día siguiente"
            >
              <ChevronRight size={15} color="#475569" />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          {[
            { label: 'Libre', bg: '#dcfce7', dot: '#16a34a' },
            { label: 'Ocupado', bg: '#fee2e2', dot: '#dc2626' },
            { label: 'Bloqueado', bg: '#f1f5f9', dot: '#94a3b8' },
          ].map((l) => (
            <div
              key={l.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: '0.8rem',
                color: '#64748b',
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 4,
                  background: l.bg,
                  border: `1px solid ${l.dot}`,
                }}
              />
              {l.label}
            </div>
          ))}
        </div>

        {/* Grid card — desktop (7 cols) */}
        <div
          className="reservar-desktop-grid"
          style={{
            background: 'white',
            borderRadius: 16,
            padding: 20,
            boxShadow: '0 1px 10px rgba(0,0,0,0.05)',
            border: '1px solid #f1f5f9',
          }}
        >
          <WeekGrid
            weekDates={weekDates}
            canchaId={cancha.id}
            duracionMin={cancha.duracion_min}
            precioBase={cancha.precio}
            franjas={cancha.franjas_precio}
            onSlotClick={handleSlotClick}
          />
        </div>

        {/* Grid card — mobile (un día) */}
        <div
          className="reservar-mobile-grid"
          style={{
            background: 'white',
            borderRadius: 16,
            padding: 16,
            boxShadow: '0 1px 10px rgba(0,0,0,0.05)',
            border: '1px solid #f1f5f9',
          }}
        >
          <MobileDayGrid
            date={weekDates[mobileDay]}
            dayLabel={DAY_LABELS[mobileDay]}
            canchaId={cancha.id}
            duracionMin={cancha.duracion_min}
            precioBase={cancha.precio}
            franjas={cancha.franjas_precio}
            onSlotClick={handleSlotClick}
          />
        </div>
      </div>

      {/* Modal de confirmación (reutiliza el existente) */}
      {selected && cancha && (
        <ConfirmacionReservaModal
          cancha={cancha}
          fecha={selected.fecha}
          slot={selected.slot}
          onClose={() => setSelected(null)}
        />
      )}

      <style>{`
        .reservar-desktop-grid { display: block; }
        .reservar-mobile-grid { display: none; }
        .reservar-mobile-nav { display: none; }
        @media (max-width: 768px) {
          .reservar-desktop-grid { display: none; }
          .reservar-mobile-grid { display: block; }
          .reservar-mobile-nav { display: flex !important; }
        }
        @media (max-width: 480px) {
          .reservar-info-card {
            padding: 14px 16px !important;
            gap: 12px !important;
          }
        }
      `}</style>
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 99,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s',
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Week grid (desktop) — cada columna es un día, cada fila es una hora        */
/* ─────────────────────────────────────────────────────────────────────────── */
function WeekGrid({
  weekDates,
  canchaId,
  duracionMin,
  precioBase,
  franjas,
  onSlotClick,
}: {
  weekDates: Date[]
  canchaId: string
  duracionMin: number
  precioBase?: number
  franjas?: FranjaPrecio[] | null
  onSlotClick: (fecha: string, slot: Slot) => void
}) {
  // Una sola query para toda la semana (3 fetches) en vez de 7 × 3 = 21
  const { data: weekMap, isError } = useWeekSlots({
    canchaId,
    weekDates,
    duracionMin,
    precioBase,
    franjas,
  })

  const dayStrings = weekDates.map(formatYMD)

  // Recolectamos todas las horas únicas de toda la semana
  const hours = useMemo(() => {
    const set = new Set<string>()
    for (const fecha of dayStrings) {
      for (const s of (weekMap?.[fecha] ?? [])) set.add(s.horaInicio)
    }
    return Array.from(set).sort()
  }, [weekMap, dayStrings])

  const today = startOfDay(new Date())

  if (isError) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#dc2626',
          fontSize: '0.9rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
        <span style={{ fontWeight: 700 }}>No se pudieron cargar los turnos</span>
        <span style={{ color: '#64748b', fontSize: '0.82rem' }}>
          Verificá tu conexión y recargá la página.
        </span>
      </div>
    )
  }

  if (weekMap && hours.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b', fontSize: '0.9rem' }}>
        Esta cancha no tiene horarios configurados esta semana.
      </div>
    )
  }

  return (
    <div>
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: 8, marginBottom: 14 }}>
        <div />
        {weekDates.map((d, i) => {
          const isToday = isSameDay(d, today)
          return (
            <div key={i} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {DAY_LABELS[i]}
              </div>
              <div
                style={{
                  marginTop: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: isToday ? '#2563eb' : 'transparent',
                  color: isToday ? 'white' : '#0f172a',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hours x days */}
      {hours.map((h) => (
        <div
          key={h}
          style={{
            display: 'grid',
            gridTemplateColumns: '60px repeat(7, 1fr)',
            gap: 8,
            marginBottom: 8,
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '0.78rem',
              color: '#94a3b8',
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {h.slice(0, 5)}
          </span>
          {weekDates.map((d, di) => {
            const fecha = dayStrings[di]
            const slots = weekMap?.[fecha] ?? []
            const slot = slots.find((s) => s.horaInicio === h)
            const pastDay = differenceInCalendarDays(d, today) < 0
            const effectiveState = pastDay ? 'ocupado' : slot?.estado
            const effectiveSlot: Slot | undefined = slot
              ? { ...slot, estado: pastDay ? 'ocupado' : slot.estado }
              : undefined

            return (
              <SlotPill
                key={`${fecha}-${h}`}
                state={effectiveState as Slot['estado'] | undefined}
                hour={h.slice(0, 5)}
                precio={slot?.precio}
                onClick={() =>
                  effectiveSlot && onSlotClick(fecha, effectiveSlot)
                }
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Mobile day grid (1 column)                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
function MobileDayGrid({
  date,
  dayLabel,
  canchaId,
  duracionMin,
  precioBase,
  franjas,
  onSlotClick,
}: {
  date: Date
  dayLabel: string
  canchaId: string
  duracionMin: number
  precioBase?: number
  franjas?: FranjaPrecio[] | null
  onSlotClick: (fecha: string, slot: Slot) => void
}) {
  const fechaISO = formatYMD(date)
  const today = startOfDay(new Date())
  const pastDay = differenceInCalendarDays(date, today) < 0
  const isToday = isSameDay(date, today)

  const { data: slots, isError: slotsError } = useSlots({
    canchaId,
    fecha: fechaISO,
    duracionMin,
    precioBase,
    franjas,
  })

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.1rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.01em',
            }}
          >
            {dayLabel}
          </div>
          <div
            style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 10,
              background: isToday ? '#2563eb' : '#f1f5f9',
              color: isToday ? 'white' : '#0f172a',
              fontWeight: 700,
              fontSize: '1.05rem',
            }}
          >
            {date.getDate()}
          </div>
        </div>
      </div>

      {slotsError ? (
        <div
          style={{
            textAlign: 'center',
            padding: 30,
            color: '#dc2626',
            fontSize: '0.88rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>⚠️</span>
          <span style={{ fontWeight: 700 }}>No se pudieron cargar los turnos</span>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
            Verificá tu conexión y recargá la página.
          </span>
        </div>
      ) : !slots || slots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#64748b', fontSize: '0.9rem' }}>
          Sin horarios disponibles este día.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {slots.map((s) => {
            const effective: Slot = { ...s, estado: pastDay ? 'ocupado' : s.estado }
            return (
              <div
                key={s.horaInicio}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: '0.82rem',
                    color: '#64748b',
                    fontWeight: 600,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {s.horaInicio.slice(0, 5)}
                </span>
                <SlotPill
                  state={effective.estado}
                  hour={s.horaInicio.slice(0, 5)}
                  precio={s.precio}
                  large
                  onClick={() => onSlotClick(fechaISO, effective)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* SlotPill — botón por slot (libre/ocupado/bloqueado)                         */
/* ─────────────────────────────────────────────────────────────────────────── */
function SlotPill({
  state,
  hour,
  precio,
  onClick,
  large = false,
}: {
  state: Slot['estado'] | undefined
  hour: string
  precio?: number
  onClick: () => void
  large?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  if (!state) {
    return (
      <div
        style={{
          width: '100%',
          padding: large ? '14px 12px' : '9px 8px',
          borderRadius: 10,
          background: '#f8fafc',
          color: '#cbd5e1',
          fontSize: large ? '0.9rem' : '0.78rem',
          fontWeight: 600,
          textAlign: 'center',
          border: '1px dashed #e2e8f0',
        }}
      >
        —
      </div>
    )
  }

  const cfg =
    state === 'libre'
      ? { bg: '#dcfce7', text: '#16a34a', hoverBg: '#16a34a', hoverText: 'white', label: hour }
      : state === 'ocupado'
        ? { bg: '#fee2e2', text: '#dc2626', hoverBg: '#fee2e2', hoverText: '#dc2626', label: 'Ocupado' }
        : { bg: '#f1f5f9', text: '#94a3b8', hoverBg: '#f1f5f9', hoverText: '#94a3b8', label: '—' }
  const clickable = state === 'libre'

  // Etiqueta del precio (solo en slots libres cuando hay precio diferenciado)
  const precioLabel = clickable && precio != null
    ? `$${precio.toLocaleString('es-AR')}`
    : null

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        padding: large ? '12px 10px' : '7px 8px',
        borderRadius: 10,
        border: 'none',
        background: hovered && clickable ? cfg.hoverBg : cfg.bg,
        color: hovered && clickable ? cfg.hoverText : cfg.text,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: large ? '0.92rem' : '0.78rem',
        fontWeight: 700,
        cursor: clickable ? 'pointer' : 'not-allowed',
        transition: 'all 0.15s ease',
        letterSpacing: '-0.01em',
        boxShadow: hovered && clickable ? '0 4px 12px rgba(22,163,74,0.35)' : 'none',
        transform: hovered && clickable ? 'translateY(-1px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <span>{hovered && clickable ? 'Reservar' : cfg.label}</span>
      {!hovered && precioLabel && (
        <span
          style={{
            fontSize: large ? '0.72rem' : '0.65rem',
            fontWeight: 600,
            opacity: 0.75,
            letterSpacing: 0,
          }}
        >
          {precioLabel}
        </span>
      )}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Skeleton                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */
function ReservarSkeleton() {
  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px 60px' }}>
        <div style={{ height: 90, background: '#f1f5f9', borderRadius: 14, marginBottom: 28 }} />
        <div style={{ height: 40, background: '#f1f5f9', borderRadius: 14, marginBottom: 20, width: 320 }} />
        <div style={{ height: 520, background: '#f1f5f9', borderRadius: 16 }} />
      </div>
    </div>
  )
}
