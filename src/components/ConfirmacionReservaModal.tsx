// SRP: Modal de confirmación de reserva.
// - "Pagar en el lugar": inserta reserva directamente (único método activo).
// - "Pagar con MercadoPago": pendiente de implementación (gateado por VITE_MP_ENABLED=true).
// La lógica de persistencia se delega a reservaService.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useTenant } from '@/context/TenantContext'
import { crearReservaEnLugar } from '@/services/reservaService'
import SportIcon, { sportPalette, sportLabel } from '@/components/brand/SportIcon'
import { X, MapPin, Calendar, Clock, CreditCard, Building2, Check } from 'lucide-react'
import type { Cancha, Slot } from '@/types'

const MP_HABILITADO = import.meta.env.VITE_MP_ENABLED === 'true'

const DAYS_LONG = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]
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

function formatFechaLarga(iso: string): string {
  // iso = "YYYY-MM-DD"
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${DAYS_LONG[date.getDay()]} ${date.getDate()} de ${MONTHS_LONG[date.getMonth()]} de ${date.getFullYear()}`
}

function formatHora(hora: string): string {
  // "HH:MM:SS" → "HH:MM"
  return hora.slice(0, 5)
}

interface Props {
  cancha: Cancha
  fecha: string
  slot: Slot
  onClose: () => void
}

export default function ConfirmacionReservaModal({
  cancha,
  fecha,
  slot,
  onClose,
}: Props) {
  const { user, profile } = useAuth()
  const { complejo } = useTenant()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [procesando, setProcesando] = useState<'mp' | 'lugar' | null>(null)
  const [confirmada, setConfirmada] = useState(false)
  const [metodoConfirmado, setMetodoConfirmado] = useState<'mp' | 'lugar' | null>(null)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 540)

  const palette = sportPalette(sportLabel(cancha.tipo))

  // Detect mobile for bottom-sheet layout
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 540px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    setIsMobile(mq.matches)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Lock body scroll + Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procesando])

  async function handlePagarEnLugar() {
    if (!user || !profile) {
      toast.error('Debes iniciar sesión')
      return
    }
    setProcesando('lugar')
    try {
      await crearReservaEnLugar({
        canchaId: cancha.id,
        clienteId: profile.id,
        fecha,
        horaInicio: slot.horaInicio,
        horaFin: slot.horaFin,
        metodoPago: 'en_lugar',
        precio: slot.precio ?? cancha.precio,
      })
      await queryClient.invalidateQueries({ queryKey: ['slots', cancha.id, fecha] })
      setMetodoConfirmado('lugar')
      setConfirmada(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al reservar'
      toast.error(msg)
      setProcesando(null)
    }
  }

  // TODO: implementar cuando se integre MercadoPago
  function handlePagarMP() {
    toast.info('El pago con MercadoPago estará disponible próximamente.')
  }

  function handleClose() {
    if (procesando) return
    onClose()
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 16,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: isMobile ? '100%' : 500,
          maxHeight: isMobile ? '92dvh' : 'calc(100vh - 32px)',
          overflowY: 'auto',
          background: 'white',
          borderRadius: isMobile ? '20px 20px 0 0' : 20,
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)',
          border: '1px solid #e2e8f0',
          animation: isMobile ? 'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)' : 'popIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : undefined,
        }}
      >
        {confirmada ? (
          <ConfirmadaView
            cancha={cancha}
            complejoNombre={complejo?.nombre ?? null}
            complejoDireccion={complejo?.direccion ?? null}
            fecha={fecha}
            slot={slot}
            metodo={metodoConfirmado}
            palette={palette}
            onClose={onClose}
            onVerReservas={() => {
              onClose()
              navigate('/mis-reservas')
            }}
          />
        ) : (
          <FormView
            cancha={cancha}
            complejoNombre={complejo?.nombre ?? null}
            fecha={fecha}
            slot={slot}
            palette={palette}
            procesando={procesando}
            onPagarMP={handlePagarMP}
            onPagarLugar={handlePagarEnLugar}
            onClose={handleClose}
          />
        )}
      </div>
    </div>,
    document.body
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Form view                                  */
/* -------------------------------------------------------------------------- */

interface FormViewProps {
  cancha: Cancha
  complejoNombre: string | null
  fecha: string
  slot: Slot
  palette: ReturnType<typeof sportPalette>
  procesando: 'mp' | 'lugar' | null
  onPagarMP: () => void
  onPagarLugar: () => void
  onClose: () => void
}

function FormView({
  cancha,
  complejoNombre,
  fecha,
  slot,
  palette,
  procesando,
  onPagarMP,
  onPagarLugar,
  onClose,
}: FormViewProps) {
  return (
    <>
      {/* Header */}
      <div
        style={{
          padding: '22px 24px 18px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.35rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Confirmar reserva
          </h2>
          <p
            style={{
              fontSize: '0.88rem',
              color: '#64748b',
              margin: '4px 0 0',
            }}
          >
            Revisá los detalles y elegí cómo pagar.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={procesando !== null}
          aria-label="Cerrar"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: '#f8fafc',
            color: '#64748b',
            cursor: procesando !== null ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Summary */}
      <div style={{ padding: '20px 24px 0' }}>
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '14px 16px',
          }}
        >
          <SummaryRow
            icon={
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: palette.bg,
                  color: palette.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SportIcon sport={sportLabel(cancha.tipo)} size={18} />
              </div>
            }
            label="Cancha"
            value={cancha.nombre}
            sub={sportLabel(cancha.tipo)}
          />
          {complejoNombre && (
            <SummaryRow
              icon={
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building2 size={18} />
                </div>
              }
              label="Complejo"
              value={complejoNombre}
            />
          )}
          <SummaryRow
            icon={
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#f5f3ff',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Calendar size={17} />
              </div>
            }
            label="Fecha"
            value={formatFechaLarga(fecha)}
          />
          <SummaryRow
            last
            icon={
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={17} />
              </div>
            }
            label="Horario"
            value={`${formatHora(slot.horaInicio)} - ${formatHora(slot.horaFin)}`}
            sub={`${cancha.duracion_min} minutos`}
          />
        </div>

        {/* Total */}
        <div
          style={{
            marginTop: 14,
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
            border: '1px solid #bfdbfe',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#1e40af',
              letterSpacing: '-0.01em',
            }}
          >
            Total a pagar
          </span>
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            ${(slot.precio ?? cancha.precio).toLocaleString('es-AR')}
          </span>
        </div>
      </div>

      {/* Payment options */}
      <div style={{ padding: '18px 24px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MP_HABILITADO && (
          <button
            type="button"
            onClick={onPagarMP}
            disabled={procesando !== null}
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: 14,
              border: 'none',
              background: '#2563eb',
              color: 'white',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '0.98rem',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              cursor: procesando !== null ? 'wait' : 'pointer',
              opacity: procesando !== null && procesando !== 'mp' ? 0.6 : 1,
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            <CreditCard size={18} />
            {procesando === 'mp' ? 'Redirigiendo…' : 'Pagar con MercadoPago'}
          </button>
        )}
        <button
          type="button"
          onClick={onPagarLugar}
          disabled={procesando !== null}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: 14,
            border: '1.5px solid #16a34a',
            background: MP_HABILITADO ? 'white' : '#16a34a',
            color: MP_HABILITADO ? '#16a34a' : 'white',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.98rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: procesando !== null ? 'wait' : 'pointer',
            opacity: procesando !== null && procesando !== 'lugar' ? 0.6 : 1,
            boxShadow: MP_HABILITADO ? 'none' : '0 4px 14px rgba(22,163,74,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
        >
          <MapPin size={18} />
          {procesando === 'lugar' ? 'Reservando…' : 'Reservar y pagar en el lugar'}
        </button>

        <p
          style={{
            textAlign: 'center',
            fontSize: '0.78rem',
            color: '#94a3b8',
            margin: '4px 0 0',
          }}
        >
          {MP_HABILITADO
            ? 'Al pagar en el lugar la reserva queda confirmada de inmediato.'
            : 'La reserva queda registrada. Abonás cuando llegués al complejo.'}
        </p>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*                              Confirmada view                               */
/* -------------------------------------------------------------------------- */

interface ConfirmadaViewProps {
  cancha: Cancha
  complejoNombre: string | null
  complejoDireccion: string | null
  fecha: string
  slot: Slot
  metodo: 'mp' | 'lugar' | null
  palette: ReturnType<typeof sportPalette>
  onClose: () => void
  onVerReservas: () => void
}

function ConfirmadaView({
  cancha,
  complejoNombre,
  complejoDireccion,
  fecha,
  slot,
  metodo,
  palette,
  onClose,
  onVerReservas,
}: ConfirmadaViewProps) {
  return (
    <div style={{ padding: '36px 24px 28px', position: 'relative' }}>
      {/* Check pop */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 10px rgba(22,163,74,0.15), 0 8px 28px rgba(22,163,74,0.35)',
            animation: 'popCheck 0.5s cubic-bezier(0.34,1.56,0.64,1)',
            position: 'relative',
          }}
        >
          <svg
            width="46"
            height="46"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ strokeDasharray: 25, animation: 'drawCheck 0.6s ease 0.3s backwards' }}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: -14,
              borderRadius: '50%',
              border: '2px solid #bbf7d0',
              animation: 'pulseRing 2s ease-out infinite',
            }}
          />
        </div>
      </div>

      <h1
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.6rem',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.03em',
          margin: '0 0 6px',
          textAlign: 'center',
        }}
      >
        ¡Reserva confirmada!
      </h1>
      <p
        style={{
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.92rem',
          marginBottom: 22,
        }}
      >
        Guardate los detalles por las dudas.
      </p>

      {/* Summary card with dashed divider */}
      <div
        style={{
          background: '#f8fafc',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            padding: '14px 18px 12px',
            borderBottom: '1px dashed #cbd5e1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.68rem',
                color: '#94a3b8',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 2,
              }}
            >
              Estado
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '0.98rem',
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              {metodo === 'mp' ? 'Pago confirmado' : 'Reserva activa'}
            </div>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: '#dcfce7',
              color: '#15803d',
              padding: '6px 12px',
              borderRadius: 99,
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
          >
            <Check size={12} strokeWidth={3} /> Confirmada
          </span>
        </div>

        <div style={{ padding: '4px 18px 16px' }}>
          {complejoNombre && (
            <SummaryRow
              icon={
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MapPin size={17} />
                </div>
              }
              label="Complejo"
              value={complejoNombre}
              sub={complejoDireccion ?? undefined}
            />
          )}
          <SummaryRow
            icon={
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: palette.bg,
                  color: palette.text,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <SportIcon sport={sportLabel(cancha.tipo)} size={17} />
              </div>
            }
            label="Cancha"
            value={cancha.nombre}
            sub={sportLabel(cancha.tipo)}
          />
          <SummaryRow
            icon={
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: '#f5f3ff',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Calendar size={16} />
              </div>
            }
            label="Fecha"
            value={formatFechaLarga(fecha)}
          />
          <SummaryRow
            icon={
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={16} />
              </div>
            }
            label="Horario"
            value={`${formatHora(slot.horaInicio)} - ${formatHora(slot.horaFin)}`}
            sub={`${cancha.duracion_min} minutos`}
          />
          <SummaryRow
            last
            icon={
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: metodo === 'mp' ? '#eff6ff' : '#dcfce7',
                  color: metodo === 'mp' ? '#1d4ed8' : '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                }}
              >
                {metodo === 'mp' ? 'MP' : '$'}
              </div>
            }
            label="Método de pago"
            value={metodo === 'mp' ? 'MercadoPago' : 'Pago en el lugar'}
          />
        </div>
      </div>

      {/* Info note */}
      <div
        style={{
          marginTop: 14,
          padding: '10px 14px',
          borderRadius: 12,
          background: 'rgba(22,163,74,0.08)',
          border: '1px solid rgba(22,163,74,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '0.83rem',
          color: '#15803d',
          lineHeight: 1.4,
        }}
      >
        <span style={{ fontSize: '1.05rem' }}>✓</span>
        <span>
          {metodo === 'mp'
            ? 'Tu pago fue procesado y la reserva quedó confirmada.'
            : 'Recordá llegar con tiempo y abonar al llegar al complejo.'}
        </span>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 12,
            border: '1.5px solid #e2e8f0',
            background: 'white',
            color: '#0f172a',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Cerrar
        </button>
        <button
          type="button"
          onClick={onVerReservas}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 12,
            border: 'none',
            background: '#2563eb',
            color: 'white',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.92rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
          }}
        >
          Ver mis reservas
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                Summary row                                 */
/* -------------------------------------------------------------------------- */

interface SummaryRowProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  last?: boolean
}

function SummaryRow({ icon, label, value, sub, last }: SummaryRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px solid #f1f5f9',
      }}
    >
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.7rem',
            color: '#94a3b8',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.94rem',
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
            wordBreak: 'break-word',
          }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}
