// SRP: Lista las reservas del cliente autenticado.
// Diseño replicado de MisReservasPage.jsx (tabs Próximas/Historial +
// cards con stripe de color + sport icon tile + payment badge).

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { fetchMisReservas, cancelarReservaCliente } from '@/services/reservaService'
import Navbar from '@/components/brand/Navbar'
import SportIcon, { sportLabel, sportPalette } from '@/components/brand/SportIcon'
import { Calendar, Clock, Search, X } from 'lucide-react'
import { parseISO, isBefore, startOfDay } from 'date-fns'
import type { EstadoReserva, Reserva, TipoCancha } from '@/types'

type ReservaConJoins = Reserva & {
  canchas: {
    nombre: string
    tipo: string
    complejos: { nombre: string; slug: string } | null
  } | null
}

const STATUS_CONFIG: Record<
  EstadoReserva | 'pasada',
  { color: string; bg: string; text: string; label: string }
> = {
  confirmada: { color: '#2563eb', bg: '#eff6ff', text: '#1d4ed8', label: 'Confirmada' },
  pendiente_pago: { color: '#f59e0b', bg: '#fefce8', text: '#a16207', label: 'Pendiente de pago' },
  cancelada_admin: { color: '#dc2626', bg: '#fef2f2', text: '#dc2626', label: 'Cancelada por admin' },
  cancelada_cliente: { color: '#dc2626', bg: '#fef2f2', text: '#dc2626', label: 'Cancelada' },
  pasada: { color: '#94a3b8', bg: '#f1f5f9', text: '#475569', label: 'Pasada' },
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fmtDate(iso: string) {
  const d = parseISO(iso)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}
function fmtTime(hhmmss: string) {
  return `${hhmmss.slice(0, 5)} hs`
}

type Tab = 'proximas' | 'historial'

export default function MisReservas() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('proximas')

  const { data: reservas, isLoading } = useQuery({
    queryKey: ['mis-reservas', profile?.id],
    queryFn: () => fetchMisReservas(profile!.id),
    enabled: !!profile,
  })

  const { proximas, historial } = useMemo(() => {
    const today = startOfDay(new Date())
    const up: ReservaConJoins[] = []
    const past: ReservaConJoins[] = []
    for (const r of (reservas || []) as ReservaConJoins[]) {
      const d = parseISO(r.fecha)
      const isPast = isBefore(d, today)
      // Cancelada o pasada → historial
      if (r.estado === 'cancelada_admin' || r.estado === 'cancelada_cliente' || isPast) past.push(r)
      else up.push(r)
    }
    return { proximas: up, historial: past }
  }, [reservas])

  const active = tab === 'proximas' ? proximas : historial
  const isHistorialView = tab === 'historial'

  // Avatar initials
  const initials = useMemo(() => {
    const name = profile?.nombre || ''
    return name
      .split(' ')
      .map((p) => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('') || '?'
  }, [profile])

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />

      <div className="page-enter" style={{ maxWidth: 1000, margin: '0 auto', padding: '36px 20px 60px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 28,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '2rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.03em',
                margin: '0 0 4px',
              }}
            >
              Mis reservas
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.92rem' }}>
              Gestioná tus turnos y revisá tu historial.
            </p>
          </div>
          {profile && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                background: 'white',
                padding: '8px 14px',
                borderRadius: 99,
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 99,
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {initials}
              </div>
              <div style={{ fontSize: '0.85rem', minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#0f172a', lineHeight: 1.2 }}>
                  {profile.nombre || '—'}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 220,
                  }}
                >
                  {profile.email || ''}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            gap: 4,
            marginBottom: 24,
            borderBottom: '2px solid #f1f5f9',
          }}
        >
          {(
            [
              { key: 'proximas' as Tab, label: 'Próximas', count: proximas.length },
              { key: 'historial' as Tab, label: 'Historial', count: historial.length },
            ] as const
          ).map((t) => {
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  position: 'relative',
                  background: 'none',
                  border: 'none',
                  padding: '12px 18px',
                  cursor: 'pointer',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: isActive ? '#2563eb' : '#64748b',
                  transition: 'color 0.15s',
                  letterSpacing: '-0.01em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {t.label}
                <span
                  style={{
                    background: isActive ? '#dbeafe' : '#f1f5f9',
                    color: isActive ? '#1d4ed8' : '#64748b',
                    padding: '2px 9px',
                    borderRadius: 99,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {t.count}
                </span>
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      left: 0,
                      right: 0,
                      height: 3,
                      background: '#2563eb',
                      borderRadius: '3px 3px 0 0',
                      animation: 'slideIn 0.25s ease',
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: 'white',
                  borderRadius: 16,
                  border: '1px solid #f1f5f9',
                  height: 128,
                }}
              />
            ))}
          </div>
        ) : active.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {active.map((r) => (
              <ReservationCard key={r.id} r={r} past={isHistorialView} profileId={profile?.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */

function ReservationCard({
  r,
  past,
  profileId,
}: {
  r: ReservaConJoins
  past: boolean
  profileId?: string
}) {
  const queryClient = useQueryClient()
  const [hovered, setHovered] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Estado efectivo: si es pasada y estaba confirmada/pendiente → mostrar como "pasada"
  const isCancelled = r.estado === 'cancelada_admin' || r.estado === 'cancelada_cliente'
  const effectiveStatus: keyof typeof STATUS_CONFIG =
    past && !isCancelled ? 'pasada' : r.estado
  const cfg = STATUS_CONFIG[effectiveStatus]

  // Mostrar botón cancelar solo si: no es pasado, no cancelado, es confirmada o pendiente
  const canCancel =
    !past &&
    !isCancelled &&
    (r.estado === 'confirmada' || r.estado === 'pendiente_pago')

  async function handleCancel() {
    if (!confirmCancel) {
      setConfirmCancel(true)
      return
    }
    setCancelling(true)
    setCancelError(null)
    try {
      const result = await cancelarReservaCliente(r.id)
      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: ['mis-reservas', profileId] })
      } else if (result.code === 'TOO_LATE') {
        const h = Math.ceil(result.horas_restantes)
        setCancelError(`No se puede cancelar: faltan menos de 24 hs (${h}h restantes).`)
        setConfirmCancel(false)
      } else {
        setCancelError('No se pudo cancelar. Intentá de nuevo.')
        setConfirmCancel(false)
      }
    } catch {
      setCancelError('Error de conexión. Intentá de nuevo.')
      setConfirmCancel(false)
    } finally {
      setCancelling(false)
    }
  }

  const tipo = (r.canchas?.tipo || 'futbol5') as TipoCancha
  const sport = sportLabel(tipo)
  const pal = sportPalette(sport)

  const complejoNombre = r.canchas?.complejos?.nombre || 'Complejo'
  const canchaNombre = r.canchas?.nombre || 'Cancha'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: hovered && !past ? '0 8px 28px rgba(0,0,0,0.08)' : '0 1px 6px rgba(0,0,0,0.05)',
        border: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'stretch',
        transition: 'all 0.2s ease',
        opacity: past ? 0.75 : 1,
        transform: hovered && !past ? 'translateY(-2px)' : 'none',
      }}
      className="reserva-card"
    >
      {/* Accent stripe */}
      <div style={{ width: 6, background: cfg.color, flexShrink: 0 }} />

      {/* Sport icon tile */}
      <div
        style={{
          padding: 20,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 14,
            background: pal.bg,
            color: pal.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SportIcon sport={sport} size={28} color={pal.text} />
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          padding: '18px 20px 18px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#0f172a',
                margin: '0 0 3px',
                letterSpacing: '-0.015em',
              }}
            >
              {complejoNombre}
            </h3>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{canchaNombre}</div>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: cfg.bg,
              color: cfg.text,
              padding: '5px 12px',
              borderRadius: 99,
              fontSize: '0.78rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {cfg.label}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            flexWrap: 'wrap',
            marginTop: 2,
          }}
          className="reserva-card-bottom"
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Calendar size={16} color="#475569" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                }}
              >
                Fecha
              </div>
              <div
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  textTransform: 'capitalize',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {fmtDate(r.fecha)}
              </div>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={16} color="#475569" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                }}
              >
                Hora
              </div>
              <div
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {fmtTime(r.hora_inicio)}
              </div>
            </div>
          </div>

          <div
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <PaymentBadge method={r.metodo_pago} />
            {r.canchas?.complejos?.slug && (
              <Link
                to={`/${r.canchas.complejos.slug}`}
                style={{
                  fontSize: '0.82rem',
                  color: '#2563eb',
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Ver complejo →
              </Link>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: confirmCancel ? '1.5px solid #dc2626' : '1.5px solid #e2e8f0',
                  background: confirmCancel ? '#fef2f2' : 'white',
                  color: confirmCancel ? '#dc2626' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  opacity: cancelling ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                <X size={13} />
                {cancelling ? 'Cancelando…' : confirmCancel ? '¿Confirmar cancelación?' : 'Cancelar'}
              </button>
            )}
          </div>
        </div>

        {/* Error de cancelación */}
        {cancelError && (
          <div
            style={{
              margin: '0 0 12px',
              padding: '8px 14px',
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            {cancelError}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .reserva-card { flex-direction: row; }
          .reserva-card-bottom { gap: 10px !important; }
        }
      `}</style>
    </div>
  )
}

function PaymentBadge({ method }: { method: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.8rem',
        color: '#64748b',
      }}
    >
      {method === 'mercadopago' ? (
        <>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 99,
              background: '#009ee3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path
                d="M8 11c.5-1.5 2-2.5 4-2.5s3.5 1 4 2.5c-1 1-2.5 1.5-4 1.5s-3-.5-4-1.5z"
                fill="white"
              />
            </svg>
          </div>
          MercadoPago
        </>
      ) : (
        <>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 99,
              background: '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16a34a',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            $
          </div>
          Efectivo
        </>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 20,
        padding: '60px 30px',
        textAlign: 'center',
        border: '1px dashed #cbd5e1',
      }}
    >
      <svg
        width="140"
        height="90"
        viewBox="0 0 140 90"
        style={{ margin: '0 auto 20px', display: 'block' }}
      >
        <rect x="10" y="15" width="120" height="65" rx="6" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5" />
        <line x1="70" y1="15" x2="70" y2="80" stroke="#86efac" strokeWidth="1.5" />
        <circle cx="70" cy="47" r="10" fill="none" stroke="#86efac" strokeWidth="1.5" />
        <rect x="10" y="32" width="18" height="30" fill="none" stroke="#86efac" strokeWidth="1.5" />
        <rect x="112" y="32" width="18" height="30" fill="none" stroke="#86efac" strokeWidth="1.5" />
        <circle cx="50" cy="47" r="3" fill="#2563eb" />
      </svg>
      <h3
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.2rem',
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 8px',
          letterSpacing: '-0.02em',
        }}
      >
        Todavía no reservaste ninguna cancha
      </h3>
      <p
        style={{
          color: '#64748b',
          fontSize: '0.9rem',
          maxWidth: 380,
          margin: '0 auto 24px',
          lineHeight: 1.6,
        }}
      >
        Explorá los complejos cerca tuyo y armá tu primer partido en menos de un minuto.
      </p>
      <Link
        to="/explorar"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          borderRadius: 12,
          background: '#2563eb',
          color: 'white',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.9rem',
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
        }}
      >
        <Search size={15} />
        Explorar complejos
      </Link>
    </div>
  )
}
