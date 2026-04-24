// SRP: Página de bloqueos (diseño Claude / AdminBlocks.jsx).
// - Header con título + descripción
// - Selection panel: cancha (select con icono de deporte) + fecha + botón "Ver turnos"
// - Slot grid: tarjetas grandes 180px+ con tres estados (libre verde, bloqueado oscuro, reservado azul)
//   con hover overlay para "Bloquear" / "Desbloquear" y tooltip para reservados
// - Sidebar con donut chart (libres/bloqueados/reservados) + tip card
// - Modal "Bloquear turno" con motivo y chips de sugerencia

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchCanchasByComplejo, fetchBloqueosByCancha } from '@/services/complejoService'
import { useSlots } from '@/hooks/useSlots'
import { crearBloqueo, eliminarBloqueo } from '@/services/adminService'
import { formatearFechaISO } from '@/utils/fechas'
import SportIcon, { sportLabel } from '@/components/brand/SportIcon'
import { Calendar, ChevronDown, Search, Ban, Check, X } from 'lucide-react'
import type { Slot } from '@/types'

// ---------- Helpers ----------

function fmtFechaLarga(d: string): string {
  const dt = new Date(d + 'T12:00:00')
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${days[dt.getDay()]} ${dt.getDate()} de ${months[dt.getMonth()]}`
}

function hourFromString(hhmm: string): number {
  return parseInt(hhmm.slice(0, 2), 10)
}

// ---------- Página ----------

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
  const [hoveredHour, setHoveredHour] = useState<string | null>(null)
  const [reservedTooltip, setReservedTooltip] = useState<string | null>(null)
  const [modalSlot, setModalSlot] = useState<Slot | null>(null)
  const [confirmUnblock, setConfirmUnblock] = useState<{ slot: Slot; bloqueoId: string } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Seleccionar primera cancha por defecto
  useEffect(() => {
    if (!canchaId && canchas && canchas.length > 0) {
      setCanchaId(canchas[0].id)
    }
  }, [canchas, canchaId])

  const canchaSel = canchas?.find((c) => c.id === canchaId)

  const { data: slots } = useSlots({
    canchaId: canchaId || undefined,
    fecha,
    duracionMin: canchaSel?.duracion_min,
  })

  const { data: bloqueos } = useQuery({
    queryKey: ['bloqueos', canchaId, fecha],
    queryFn: () => fetchBloqueosByCancha(canchaId, fecha),
    enabled: !!canchaId && !!fecha,
  })

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  async function invalidar() {
    await queryClient.invalidateQueries({ queryKey: ['slots', canchaId, fecha] })
    await queryClient.invalidateQueries({ queryKey: ['bloqueos', canchaId, fecha] })
  }

  async function handleBlock(motivo: string) {
    if (!modalSlot || !canchaId) return
    try {
      await crearBloqueo({
        canchaId,
        fecha,
        horaInicio: modalSlot.horaInicio,
        motivo: motivo.trim() || null,
      })
      await invalidar()
      setModalSlot(null)
      showToast('Turno bloqueado')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al bloquear')
    }
  }

  async function handleUnblock() {
    if (!confirmUnblock) return
    try {
      await eliminarBloqueo(confirmUnblock.bloqueoId)
      await invalidar()
      setConfirmUnblock(null)
      showToast('Turno desbloqueado')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error')
    }
  }

  const counts = useMemo(() => {
    if (!slots) return { free: 0, blocked: 0, reserved: 0 }
    return {
      free: slots.filter((s) => s.estado === 'libre').length,
      blocked: slots.filter((s) => s.estado === 'bloqueado').length,
      reserved: slots.filter((s) => s.estado === 'ocupado').length,
    }
  }, [slots])

  return (
    <div
      style={{
        padding: '32px 32px 60px',
        maxWidth: 1400,
        margin: '0 auto',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1.9rem',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.03em',
            margin: '0 0 6px',
          }}
        >
          Bloqueos
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>
          Bloqueá horarios para mantenimiento o eventos especiales.
        </p>
      </div>

      {/* Selection panel */}
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          border: '1px solid #f1f5f9',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: 14,
          alignItems: 'flex-end',
        }}
      >
        <div>
          <label
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#374151',
              display: 'block',
              marginBottom: 6,
            }}
          >
            Cancha
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={canchaId}
              onChange={(e) => setCanchaId(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 38px 11px 42px',
                appearance: 'none',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.9rem',
                fontWeight: 600,
                border: '1.5px solid #e2e8f0',
                borderRadius: 12,
                background: '#fafafa',
                color: '#111827',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {canchas?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} — {sportLabel(c.tipo)}
                </option>
              ))}
            </select>
            {canchaSel && (
              <div
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#2563eb',
                  pointerEvents: 'none',
                }}
              >
                <SportIcon sport={canchaSel.tipo} size={18} />
              </div>
            )}
            <ChevronDown
              size={16}
              color="#94a3b8"
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
        <div>
          <label
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#374151',
              display: 'block',
              marginBottom: 6,
            }}
          >
            Fecha
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '11px 14px 11px 42px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.9rem',
                fontWeight: 600,
                border: '1.5px solid #e2e8f0',
                borderRadius: 12,
                background: '#fafafa',
                color: '#111827',
                outline: 'none',
              }}
            />
            <Calendar
              size={17}
              color="#2563eb"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
        <button
          onClick={() => invalidar()}
          style={{
            padding: '11px 18px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: 'white',
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Search size={15} />
          Ver turnos
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 280px',
          gap: 24,
        }}
      >
        {/* Slot grid */}
        <div
          style={{
            background: 'white',
            borderRadius: 16,
            padding: 22,
            border: '1px solid #f1f5f9',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  margin: '0 0 2px',
                }}
              >
                Turnos del día
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
                {fmtFechaLarga(fecha)}
              </p>
            </div>
            <Legend />
          </div>

          {!slots || slots.length === 0 ? (
            <EmptyState />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              {slots.map((slot) => {
                const isFree = slot.estado === 'libre'
                const isBlocked = slot.estado === 'bloqueado'
                const isReserved = slot.estado === 'ocupado'
                const hovered = hoveredHour === slot.horaInicio
                const bloqueo = bloqueos?.find(
                  (b) => b.hora_inicio.slice(0, 5) === slot.horaInicio
                )

                return (
                  <div
                    key={slot.horaInicio}
                    onMouseEnter={() => {
                      setHoveredHour(slot.horaInicio)
                      if (isReserved) setReservedTooltip(slot.horaInicio)
                    }}
                    onMouseLeave={() => {
                      setHoveredHour(null)
                      setReservedTooltip(null)
                    }}
                    style={{
                      position: 'relative',
                      minHeight: 72,
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1.5px solid',
                      background: isFree
                        ? '#f0fdf4'
                        : isBlocked
                        ? '#1e293b'
                        : '#eff6ff',
                      borderColor: isFree
                        ? '#bbf7d0'
                        : isBlocked
                        ? '#0f172a'
                        : '#bfdbfe',
                      color: isBlocked ? 'white' : '#0f172a',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      cursor: isReserved ? 'not-allowed' : 'default',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      transform: hovered && !isReserved ? 'translateY(-2px)' : 'none',
                      boxShadow:
                        hovered && !isReserved ? '0 6px 16px rgba(0,0,0,0.1)' : 'none',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isBlocked && <Ban size={14} color="#f87171" />}
                      <span
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontSize: '1rem',
                          fontWeight: 800,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {hourFromString(slot.horaInicio)}:00 - {hourFromString(slot.horaFin)}:00
                      </span>
                    </div>
                    {isFree && (
                      <div style={{ fontSize: '0.76rem', color: '#15803d', fontWeight: 600 }}>
                        Disponible
                      </div>
                    )}
                    {isBlocked && (
                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: '#fca5a5',
                          fontWeight: 500,
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {bloqueo?.motivo || 'Bloqueado'}
                      </div>
                    )}
                    {isReserved && (
                      <div
                        style={{
                          fontSize: '0.76rem',
                          color: '#1d4ed8',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Reservado
                      </div>
                    )}

                    {hovered && isFree && (
                      <button
                        onClick={() => setModalSlot(slot)}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 10,
                          background: 'rgba(15,23,42,0.88)',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 7,
                          animation: 'fadeIn 0.15s ease',
                        }}
                      >
                        <Ban size={14} /> Bloquear
                      </button>
                    )}
                    {hovered && isBlocked && bloqueo && (
                      <button
                        onClick={() => setConfirmUnblock({ slot, bloqueoId: bloqueo.id })}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 10,
                          background: '#dc2626',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 7,
                          animation: 'fadeIn 0.15s ease',
                        }}
                      >
                        <Check size={14} /> Desbloquear
                      </button>
                    )}
                    {reservedTooltip === slot.horaInicio && isReserved && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 'calc(100% + 6px)',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#0f172a',
                          color: 'white',
                          padding: '6px 10px',
                          borderRadius: 7,
                          fontSize: '0.72rem',
                          whiteSpace: 'nowrap',
                          zIndex: 20,
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 500,
                        }}
                      >
                        No se puede bloquear: reserva activa
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'flex-start' }}>
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 20,
              border: '1px solid #f1f5f9',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 14,
              }}
            >
              Resumen del día
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <Donut free={counts.free} blocked={counts.blocked} reserved={counts.reserved} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { color: '#22c55e', label: 'Libres', value: counts.free },
                { color: '#64748b', label: 'Bloqueados', value: counts.blocked },
                { color: '#3b82f6', label: 'Reservados', value: counts.reserved },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 9,
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 99,
                        background: s.color,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.82rem',
                        color: '#475569',
                        fontWeight: 600,
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  >
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
              borderRadius: 14,
              padding: 16,
              border: '1px solid #bfdbfe',
            }}
          >
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#1e40af',
                marginBottom: 6,
              }}
            >
              Tip
            </div>
            <p style={{ fontSize: '0.8rem', color: '#1e3a8a', margin: 0, lineHeight: 1.5 }}>
              Los clientes con reservas confirmadas no pueden ser afectados. Para cancelar una
              reserva, andá a la sección Reservas.
            </p>
          </div>
        </div>
      </div>

      {/* Modal bloquear */}
      {modalSlot && canchaSel && (
        <BlockModal
          slot={modalSlot}
          courtName={canchaSel.nombre}
          onClose={() => setModalSlot(null)}
          onConfirm={handleBlock}
        />
      )}

      {/* Confirm desbloquear */}
      {confirmUnblock && (
        <ConfirmUnblockModal
          slot={confirmUnblock.slot}
          onCancel={() => setConfirmUnblock(null)}
          onConfirm={handleUnblock}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} />}
    </div>
  )
}

// ---------- Sub-componentes ----------

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: '0.74rem', color: '#64748b' }}>
      <LegendItem color="#dcfce7" border="#86efac" label="Libre" />
      <LegendItem color="#1e293b" label="Bloqueado" />
      <LegendItem color="#dbeafe" border="#60a5fa" label="Reservado" />
    </div>
  )
}

function LegendItem({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: color,
          border: border ? `1.5px solid ${border}` : 'none',
        }}
      />
      {label}
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '40px 16px',
        textAlign: 'center',
        background: '#f8fafc',
        borderRadius: 12,
        border: '1px dashed #cbd5e1',
      }}
    >
      <Ban size={28} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
      <p style={{ fontSize: '0.92rem', fontWeight: 700, color: '#475569', margin: '0 0 4px' }}>
        Sin horarios para este día
      </p>
      <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
        Verificá que la cancha tenga horario configurado para este día de la semana.
      </p>
    </div>
  )
}

function Donut({
  free,
  blocked,
  reserved,
}: {
  free: number
  blocked: number
  reserved: number
}) {
  const total = free + blocked + reserved
  if (total === 0) {
    return (
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx="55" cy="55" r="44" fill="none" stroke="#f1f5f9" strokeWidth="12" />
        <text
          x="55"
          y="52"
          textAnchor="middle"
          fontFamily="Space Grotesk"
          fontSize="20"
          fontWeight="800"
          fill="#0f172a"
        >
          0
        </text>
        <text
          x="55"
          y="68"
          textAnchor="middle"
          fontFamily="DM Sans"
          fontSize="9"
          fill="#64748b"
          fontWeight="600"
        >
          TURNOS
        </text>
      </svg>
    )
  }
  const r = 44
  const c = 2 * Math.PI * r
  const freeLen = (free / total) * c
  const blockedLen = (blocked / total) * c
  const reservedLen = (reserved / total) * c
  return (
    <svg width={110} height={110} viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
      <circle
        cx="55"
        cy="55"
        r={r}
        fill="none"
        stroke="#22c55e"
        strokeWidth="12"
        strokeDasharray={`${freeLen} ${c}`}
        strokeDashoffset="0"
        transform="rotate(-90 55 55)"
        strokeLinecap="round"
      />
      <circle
        cx="55"
        cy="55"
        r={r}
        fill="none"
        stroke="#64748b"
        strokeWidth="12"
        strokeDasharray={`${blockedLen} ${c}`}
        strokeDashoffset={-freeLen}
        transform="rotate(-90 55 55)"
        strokeLinecap="round"
      />
      <circle
        cx="55"
        cy="55"
        r={r}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="12"
        strokeDasharray={`${reservedLen} ${c}`}
        strokeDashoffset={-(freeLen + blockedLen)}
        transform="rotate(-90 55 55)"
        strokeLinecap="round"
      />
      <text
        x="55"
        y="52"
        textAnchor="middle"
        fontFamily="Space Grotesk"
        fontSize="20"
        fontWeight="800"
        fill="#0f172a"
      >
        {total}
      </text>
      <text
        x="55"
        y="68"
        textAnchor="middle"
        fontFamily="DM Sans"
        fontSize="9"
        fill="#64748b"
        fontWeight="600"
      >
        TURNOS
      </text>
    </svg>
  )
}

// ---------- Modales ----------

function BlockModal({
  slot,
  courtName,
  onClose,
  onConfirm,
}: {
  slot: Slot
  courtName: string
  onClose: () => void
  onConfirm: (motivo: string) => void
}) {
  const [reason, setReason] = useState('')
  const suggestions = ['Mantenimiento', 'Evento privado', 'Limpieza', 'Otro']

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.55)',
          zIndex: 300,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          borderRadius: 18,
          padding: 28,
          zIndex: 301,
          width: 'min(440px, calc(100vw - 32px))',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Ban size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.2rem',
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Bloquear turno
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0' }}>
              {courtName} · {hourFromString(slot.horaInicio)}:00 - {hourFromString(slot.horaFin)}:00
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 10,
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={14} color="#64748b" />
          </button>
        </div>

        <label
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#374151',
            display: 'block',
            marginBottom: 8,
          }}
        >
          Motivo (opcional)
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {suggestions.map((s) => {
            const sel = reason === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setReason(s)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 99,
                  border: `1.5px solid ${sel ? '#2563eb' : '#e2e8f0'}`,
                  background: sel ? '#eff6ff' : 'white',
                  color: sel ? '#1d4ed8' : '#475569',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.15s',
                }}
              >
                {s}
              </button>
            )
          })}
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Escribí un motivo..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 14px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.9rem',
            border: '1.5px solid #e2e8f0',
            borderRadius: 10,
            background: '#fafafa',
            outline: 'none',
            color: '#111827',
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px 18px',
              borderRadius: 12,
              border: '1.5px solid #e2e8f0',
              background: 'white',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(reason)}
            style={{
              flex: 1,
              padding: '11px 18px',
              borderRadius: 12,
              border: 'none',
              background: '#dc2626',
              color: 'white',
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '0.92rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#b91c1c')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#dc2626')}
          >
            <Ban size={15} /> Confirmar bloqueo
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

function ConfirmUnblockModal({
  slot,
  onCancel,
  onConfirm,
}: {
  slot: Slot
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return createPortal(
    <>
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.55)',
          zIndex: 300,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          borderRadius: 16,
          padding: 24,
          zIndex: 301,
          width: 'min(380px, calc(100vw - 32px))',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 99,
            background: '#dcfce7',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
          }}
        >
          <Check size={22} />
        </div>
        <h3
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1.1rem',
            fontWeight: 800,
            color: '#0f172a',
            textAlign: 'center',
            margin: '0 0 6px',
          }}
        >
          Desbloquear turno
        </h3>
        <p
          style={{
            color: '#64748b',
            fontSize: '0.86rem',
            textAlign: 'center',
            margin: '0 0 18px',
          }}
        >
          ¿Liberar el turno de las {hourFromString(slot.horaInicio)}:00?
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: 12,
              border: '1.5px solid #e2e8f0',
              background: 'white',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: 12,
              border: 'none',
              background: '#16a34a',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Desbloquear
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

function Toast({ message }: { message: string }) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: 'white',
        borderRadius: 14,
        padding: '14px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        border: '1px solid #bbf7d0',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 99,
          background: '#dcfce7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Check size={15} color="#16a34a" />
      </div>
      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{message}</span>
    </div>,
    document.body
  )
}
