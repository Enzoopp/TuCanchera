// SRP: Vista general del día para el admin (diseño Claude AdminDashboard.jsx).
// - Header con saludo + complejo + fecha
// - 4 metric cards (reservas hoy, confirmadas, pendientes, ingresos)
// - Lista de reservas del día con filtro por cancha
// - Quick actions + mini calendar (sidebar derecha)
// Preserva la lógica de asistencia + invalidación de queries.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import {
  fetchReservasDelComplejo,
  registrarAsistencia,
  type ReservaAdmin,
} from '@/services/adminService'
import { fetchCanchasByComplejo, fetchBloqueosByCancha } from '@/services/complejoService'
import { formatearFechaISO } from '@/utils/fechas'
import { supabase } from '@/lib/supabase'
import SportIcon, { sportPalette, sportLabel } from '@/components/brand/SportIcon'
import {
  Calendar,
  Check,
  Clock,
  CircleDollarSign,
  Ban,
  BarChart3,
  Plus,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
} from 'lucide-react'
import type { TipoCancha } from '@/types'

const DAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS_LONG = [
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
const DAYS_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function saludoActual(d: Date): string {
  const h = d.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function primerNombre(n: string | null | undefined): string {
  if (!n) return ''
  return n.trim().split(/\s+/)[0]
}

export default function Dashboard() {
  const { profile } = useAuth()
  const { data: complejo, isLoading: loadingCx } = useMiComplejo()
  const queryClient = useQueryClient()
  const hoy = formatearFechaISO(new Date())

  // Realtime: actualiza el dashboard al instante cuando cambian reservas
  useEffect(() => {
    if (!complejo) return
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservas' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['admin-dashboard-reservas'] })
        }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [complejo, queryClient])

  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { data: reservas, isLoading: loadingR } = useQuery({
    queryKey: ['admin-dashboard-reservas', complejo?.id, hoy],
    queryFn: () => fetchReservasDelComplejo(complejo!.id, { fecha: hoy }),
    enabled: !!complejo,
  })

  const { data: canchas } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  const { data: bloqueos } = useQuery({
    queryKey: ['admin-bloqueos-hoy', complejo?.id, hoy, canchas?.length],
    queryFn: async () => {
      if (!canchas) return []
      const arrs = await Promise.all(canchas.map((c) => fetchBloqueosByCancha(c.id, hoy)))
      return arrs.flat()
    },
    enabled: !!canchas && canchas.length > 0,
  })

  const [canchaFilter, setCanchaFilter] = useState<string>('todas')

  function turnoPasado(fecha: string, horaFin: string): boolean {
    const fin = new Date(`${fecha}T${horaFin.slice(0, 5)}:00`)
    return fin < ahora
  }

  async function handleAsistencia(id: string, valor: boolean) {
    try {
      await registrarAsistencia(id, valor)
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-reservas'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
      toast.success(valor ? 'Marcado como presente ✓' : 'Marcado como ausente')
    } catch {
      toast.error('Error al registrar asistencia')
    }
  }

  const lista = useMemo(() => {
    const items = reservas ?? []
    return items
      .filter((r) => r.estado !== 'cancelada_admin')
      .filter((r) => canchaFilter === 'todas' || r.cancha_id === canchaFilter)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
  }, [reservas, canchaFilter])

  const confirmadas = (reservas ?? []).filter((r) => r.estado === 'confirmada')
  const pendientes = (reservas ?? []).filter((r) => r.estado === 'pendiente_pago')
  const bloqueadasCount = bloqueos?.length ?? 0
  const ingresosDia = confirmadas.reduce((acc, r) => acc + ((r as unknown as { precio?: number }).precio ?? (r as unknown as { canchas?: { precio?: number } }).canchas?.precio ?? 0), 0)

  const fechaDisplay = `${DAYS_LONG[ahora.getDay()]}, ${ahora.getDate()} de ${MONTHS_LONG[ahora.getMonth()]} de ${ahora.getFullYear()}`

  if (loadingCx) {
    return (
      <div style={{ padding: 32, fontFamily: "'DM Sans', sans-serif", color: '#64748b' }}>
        Cargando complejo…
      </div>
    )
  }

  return (
    <div
      style={{
        padding: 'clamp(20px, 4vw, 32px)',
        paddingBottom: 60,
        maxWidth: 1400,
        margin: '0 auto',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(1.5rem, 3vw, 1.9rem)',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.03em',
            margin: '0 0 6px',
          }}
        >
          {saludoActual(ahora)}
          {profile?.nombre ? `, ${primerNombre(profile.nombre)}` : ''}{' '}
          <span style={{ display: 'inline-block', animation: 'wave 2s ease infinite' }}>👋</span>
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>
          {fechaDisplay}
          {complejo?.nombre && (
            <>
              {' · '}
              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                Complejo {complejo.nombre}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Metric cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <MetricCard
          label="Reservas hoy"
          value={loadingR ? '—' : reservas?.length ?? 0}
          icon={<Calendar size={18} />}
          accent="#2563eb"
          accentBg="#eff6ff"
        />
        <MetricCard
          label="Confirmadas"
          value={loadingR ? '—' : confirmadas.length}
          icon={<Check size={18} />}
          accent="#16a34a"
          accentBg="#dcfce7"
        />
        <MetricCard
          label="Pendientes"
          value={loadingR ? '—' : pendientes.length}
          icon={<Clock size={18} />}
          accent="#d97706"
          accentBg="#fef3c7"
        />
        <MetricCard
          label="Ingresos hoy"
          value={loadingR ? '—' : `$${(ingresosDia / 1000).toFixed(1)}k`}
          icon={<CircleDollarSign size={18} />}
          accent="#1e3a8a"
          accentBg="#dbeafe"
        />
      </div>

      {/* Main grid */}
      <div
        className="dashboard-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
          gap: 24,
        }}
      >
        {/* Left: reservations list */}
        <div
          style={{
            background: 'white',
            borderRadius: 16,
            border: '1px solid #f1f5f9',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Reservas de hoy
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {lista.length} reserva{lista.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Court filter chips */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 2,
                scrollbarWidth: 'thin',
              }}
            >
              <FilterChip
                active={canchaFilter === 'todas'}
                onClick={() => setCanchaFilter('todas')}
              >
                Todas
              </FilterChip>
              {(canchas ?? []).map((c) => (
                <FilterChip
                  key={c.id}
                  active={canchaFilter === c.id}
                  onClick={() => setCanchaFilter(c.id)}
                >
                  {c.nombre}
                </FilterChip>
              ))}
            </div>
          </div>

          {loadingR ? (
            <div style={{ padding: '40px 30px', textAlign: 'center', color: '#64748b' }}>
              Cargando reservas…
            </div>
          ) : lista.length === 0 ? (
            <EmptyReservas />
          ) : (
            <div>
              {lista.map((r, i) => (
                <ReservaRow
                  key={r.id}
                  reserva={r}
                  isLast={i === lista.length - 1}
                  pasado={turnoPasado(r.fecha, r.hora_fin)}
                  onAsistencia={handleAsistencia}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: quick actions + mini calendar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <QuickActionsCard />
          <MiniCalendar
            ahora={ahora}
            reservasCount={reservas?.length ?? 0}
            bloqueosCount={bloqueadasCount}
          />
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .dashboard-main-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .dashboard-main-grid {
            gap: 16px !important;
          }
        }
      `}</style>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Sub-components                              */
/* -------------------------------------------------------------------------- */

function MetricCard({
  label,
  value,
  icon,
  accent,
  accentBg,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  accent: string
  accentBg: string
}) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        padding: '20px 22px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        border: '1px solid #f1f5f9',
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: '0.78rem',
            color: '#64748b',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
          }}
        >
          {icon}
        </div>
      </div>
      <div
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '2rem',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function FilterChip({
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
      onClick={onClick}
      style={{
        padding: '5px 12px',
        borderRadius: 99,
        border: '1.5px solid',
        borderColor: active ? '#2563eb' : '#e2e8f0',
        background: active ? '#2563eb' : 'white',
        color: active ? 'white' : '#475569',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.76rem',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  confirmada: { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmada' },
  pendiente_pago: { bg: '#fef3c7', color: '#92400e', label: 'Pendiente' },
  cancelada_admin: { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelada' },
}

function ReservaRow({
  reserva: r,
  isLast,
  pasado,
  onAsistencia,
}: {
  reserva: ReservaAdmin
  isLast: boolean
  pasado: boolean
  onAsistencia: (id: string, valor: boolean) => void
}) {
  const cancha = (r as unknown as { canchas?: { nombre?: string; tipo?: TipoCancha } }).canchas ?? null
  const cliente = (r as unknown as { profiles?: { nombre?: string; telefono?: string | null } }).profiles ?? null
  const tipoSport = cancha?.tipo ? sportLabel(cancha.tipo as TipoCancha) : 'Fútbol 5'
  const palette = sportPalette(tipoSport)
  const status = STATUS_BADGE[r.estado] ?? STATUS_BADGE.pendiente_pago
  const esEnLugar = r.metodo_pago === 'en_lugar'
  const necesitaAsistencia =
    esEnLugar && pasado && r.estado === 'confirmada' && r.asistio === null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 22px',
        borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
        transition: 'background 0.15s',
        opacity: pasado ? 0.85 : 1,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Time */}
      <div
        style={{
          width: 56,
          flexShrink: 0,
          textAlign: 'center',
          padding: '8px 4px',
          borderRadius: 10,
          background: pasado ? '#e2e8f0' : '#f1f5f9',
        }}
      >
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.95rem',
            fontWeight: 800,
            color: pasado ? '#64748b' : '#0f172a',
            letterSpacing: '-0.02em',
          }}
        >
          {r.hora_inicio.slice(0, 5)}
        </div>
      </div>

      {/* Sport tile */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          flexShrink: 0,
          background: palette.bg,
          color: palette.text,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <SportIcon sport={tipoSport} size={16} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.88rem',
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {cliente?.nombre ?? 'Cliente'}
        </div>
        <div
          style={{
            fontSize: '0.76rem',
            color: '#64748b',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            marginTop: 2,
            flexWrap: 'wrap',
          }}
        >
          <span>{cancha?.nombre ?? '—'}</span>
          {cliente?.telefono && (
            <>
              <span>•</span>
              <span>{cliente.telefono}</span>
            </>
          )}
        </div>
      </div>

      {/* Asistencia o badge */}
      {necesitaAsistencia ? (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onAsistencia(r.id, true)}
            title="Sí vino"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #bbf7d0',
              background: '#dcfce7',
              color: '#15803d',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <UserCheck size={13} />
            Sí
          </button>
          <button
            onClick={() => onAsistencia(r.id, false)}
            title="No se presentó"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #fecaca',
              background: '#fee2e2',
              color: '#b91c1c',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <UserX size={13} />
            No
          </button>
        </div>
      ) : r.asistio !== null ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 10px',
            borderRadius: 99,
            background: r.asistio ? '#dcfce7' : '#fee2e2',
            color: r.asistio ? '#15803d' : '#b91c1c',
            fontSize: '0.74rem',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {r.asistio ? <UserCheck size={12} /> : <UserX size={12} />}
          {r.asistio ? 'Asistió' : 'No vino'}
        </span>
      ) : (
        <span
          style={{
            display: 'inline-flex',
            padding: '5px 10px',
            borderRadius: 99,
            background: status.bg,
            color: status.color,
            fontSize: '0.74rem',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {status.label}
        </span>
      )}
    </div>
  )
}

function EmptyReservas() {
  return (
    <div style={{ padding: '60px 30px', textAlign: 'center' }}>
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        style={{ margin: '0 auto 16px', opacity: 0.4 }}
      >
        <rect x="10" y="15" width="60" height="50" rx="6" fill="none" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="10" y1="28" x2="70" y2="28" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx="25" cy="20" r="2" fill="#cbd5e1" />
        <circle cx="55" cy="20" r="2" fill="#cbd5e1" />
      </svg>
      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
        No hay reservas para mostrar.
      </p>
      <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: '4px 0 0' }}>
        Las reservas aparecerán acá cuando los clientes reserven.
      </p>
    </div>
  )
}

function QuickActionsCard() {
  const actions = [
    {
      to: '/admin/bloqueos',
      icon: <Ban size={17} />,
      label: 'Bloquear turno',
      desc: 'Marcar horario no disponible',
      accent: '#dc2626',
      bg: '#fef2f2',
    },
    {
      to: '/admin/estadisticas',
      icon: <BarChart3 size={17} />,
      label: 'Ver estadísticas',
      desc: 'Ingresos, ocupación y más',
      accent: '#7c3aed',
      bg: '#f5f3ff',
    },
    {
      to: '/admin/canchas',
      icon: <Plus size={17} />,
      label: 'Agregar cancha',
      desc: 'Sumar una cancha al complejo',
      accent: '#2563eb',
      bg: '#eff6ff',
    },
  ] as const

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        padding: 20,
        border: '1px solid #f1f5f9',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <h3
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1rem',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.02em',
          margin: '0 0 14px',
        }}
      >
        Acciones rápidas
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid #f1f5f9',
              background: 'white',
              fontFamily: "'DM Sans', sans-serif",
              textAlign: 'left',
              transition: 'all 0.15s',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = a.bg
              e.currentTarget.style.borderColor = a.accent
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white'
              e.currentTarget.style.borderColor = '#f1f5f9'
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: a.bg,
                color: a.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {a.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', marginBottom: 1 }}>
                {a.label}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{a.desc}</div>
            </div>
            <ChevronRight size={15} color="#cbd5e1" />
          </Link>
        ))}
      </div>
    </div>
  )
}

function MiniCalendar({
  ahora,
  reservasCount,
  bloqueosCount,
}: {
  ahora: Date
  reservasCount: number
  bloqueosCount: number
}) {
  const [offset, setOffset] = useState(0)
  const monthBase = new Date(ahora.getFullYear(), ahora.getMonth() + offset, 1)
  const year = monthBase.getFullYear()
  const month = monthBase.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const dayOffset = firstDay === 0 ? 6 : firstDay - 1 // Mon-start
  const todayD =
    ahora.getFullYear() === year && ahora.getMonth() === month ? ahora.getDate() : -1

  const cells: (number | null)[] = []
  for (let i = 0; i < dayOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        padding: 20,
        border: '1px solid #f1f5f9',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <h4
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.95rem',
            fontWeight: 700,
            color: '#0f172a',
            margin: 0,
            letterSpacing: '-0.01em',
            textTransform: 'capitalize',
          }}
        >
          {MONTHS_LONG[month]} {year}
        </h4>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setOffset(offset - 1)} style={miniCalBtn}>
            <ChevronLeft size={14} color="#64748b" />
          </button>
          <button onClick={() => setOffset(offset + 1)} style={miniCalBtn}>
            <ChevronRight size={14} color="#64748b" />
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 4,
          marginBottom: 6,
        }}
      >
        {DAY_INITIALS.map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontSize: '0.68rem',
              color: '#94a3b8',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />
          const isToday = d === todayD
          const hasDot = isToday && reservasCount > 0
          return (
            <div
              key={i}
              style={{
                aspectRatio: '1',
                borderRadius: 6,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: isToday ? 800 : 500,
                color: isToday ? 'white' : '#374151',
                background: isToday ? '#2563eb' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isToday) e.currentTarget.style.background = '#f1f5f9'
              }}
              onMouseLeave={(e) => {
                if (!isToday) e.currentTarget.style.background = 'transparent'
              }}
            >
              {d}
              {hasDot && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: 3,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: 99,
                    background: 'white',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          gap: 14,
          fontSize: '0.72rem',
          color: '#64748b',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: 99, background: '#2563eb' }} />
          Hoy
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Calendar size={12} color="#64748b" />
          {reservasCount} reservas
        </div>
        {bloqueosCount > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Ban size={12} color="#64748b" />
            {bloqueosCount} bloqueos
          </div>
        )}
      </div>
    </div>
  )
}

const miniCalBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: '1px solid #e2e8f0',
  background: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

