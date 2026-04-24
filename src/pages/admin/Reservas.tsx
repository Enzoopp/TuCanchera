// SRP: Historial de reservas del complejo (diseño Claude / AdminBookings.jsx).
// - Header con conteo total + ingresos del periodo filtrado
// - Filter bar: cancha select + estado select + fecha desde/hasta + método pago + botón limpiar
// - Tabla con avatar gradient + cliente/teléfono, sport badge + cancha, fecha + hora, payment badge,
//   status badge, y acciones (asistencia + cancelar)
// - Paginación con botones numerados al pie
// - Modal createPortal para confirmar cancelación

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchCanchasByComplejo } from '@/services/complejoService'
import {
  fetchReservasDelComplejo,
  cancelarReservaAdmin,
  registrarAsistencia,
  type ReservaAdmin,
} from '@/services/adminService'
import { sportPalette, sportLabel } from '@/components/brand/SportIcon'
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Search,
  UserCheck,
  UserX,
  Phone,
  AlertTriangle,
  DollarSign,
} from 'lucide-react'
import type { TipoCancha } from '@/types'

const PER_PAGE = 8

// ---------- Helpers ----------

function fmtFechaCorta(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

function getInitial(nombre: string | null | undefined): string {
  if (!nombre) return '?'
  return nombre.trim().charAt(0).toUpperCase()
}

// ---------- Página ----------

export default function Reservas() {
  const { data: complejo } = useMiComplejo()
  const queryClient = useQueryClient()

  const [filtros, setFiltros] = useState({
    canchaId: '',
    estado: '',
    metodoPago: '',
    desde: '',
    hasta: '',
  })
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<ReservaAdmin | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  // Tick que se actualiza cada minuto para re-evaluar qué turnos ya pasaron
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  function turnoPasado(fecha: string, horaFin: string): boolean {
    const fin = new Date(`${fecha}T${horaFin.slice(0, 5)}:00`)
    return fin < ahora
  }

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  const { data: canchas } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  const filtrosQ = useMemo(
    () => ({
      canchaId: filtros.canchaId || undefined,
      estado: filtros.estado || undefined,
      metodoPago: filtros.metodoPago || undefined,
    }),
    [filtros.canchaId, filtros.estado, filtros.metodoPago]
  )

  const { data: reservasRaw, isLoading } = useQuery({
    queryKey: ['admin-reservas', complejo?.id, filtrosQ],
    queryFn: () => fetchReservasDelComplejo(complejo!.id, filtrosQ),
    enabled: !!complejo,
    refetchInterval: 60_000,
  })

  // Filtrado por rango de fechas (cliente)
  const reservas = useMemo(() => {
    if (!reservasRaw) return []
    return reservasRaw.filter((r) => {
      if (filtros.desde && r.fecha < filtros.desde) return false
      if (filtros.hasta && r.fecha > filtros.hasta) return false
      return true
    })
  }, [reservasRaw, filtros.desde, filtros.hasta])

  const totalIngresos = useMemo(() => {
    return reservas
      .filter((r) => r.estado === 'confirmada')
      .reduce((sum, r) => sum + (r.canchas?.precio ?? 0), 0)
  }, [reservas])

  const totalPages = Math.max(1, Math.ceil(reservas.length / PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const current = reservas.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  const hayFiltros =
    !!filtros.canchaId ||
    !!filtros.estado ||
    !!filtros.metodoPago ||
    !!filtros.desde ||
    !!filtros.hasta

  function clearFilters() {
    setFiltros({ canchaId: '', estado: '', metodoPago: '', desde: '', hasta: '' })
    setPage(1)
  }

  async function handleAsistencia(id: string, valor: boolean) {
    try {
      await registrarAsistencia(id, valor)
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-reservas'] })
      showToast(valor ? 'Marcado como presente' : 'Marcado como ausente')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error')
    }
  }

  async function handleConfirmCancel() {
    if (!confirmCancel) return
    setCancelLoading(true)
    try {
      await cancelarReservaAdmin(confirmCancel.id)
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
      setConfirmCancel(null)
      showToast('Reserva cancelada')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al cancelar')
    } finally {
      setCancelLoading(false)
    }
  }

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
          Reservas
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>
          <strong style={{ color: '#0f172a' }}>
            {reservas.length} reserva{reservas.length !== 1 ? 's' : ''}
          </strong>
          {' '}·{' '}
          <strong style={{ color: '#16a34a' }}>
            ${totalIngresos.toLocaleString('es-AR')}
          </strong>{' '}
          recaudado{totalIngresos !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          background: 'white',
          borderRadius: 14,
          padding: 16,
          marginBottom: 18,
          border: '1px solid #f1f5f9',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <FilterSelect
          value={filtros.canchaId}
          onChange={(v) => {
            setFiltros((f) => ({ ...f, canchaId: v }))
            setPage(1)
          }}
        >
          <option value="">Todas las canchas</option>
          {canchas?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          value={filtros.estado}
          onChange={(v) => {
            setFiltros((f) => ({ ...f, estado: v }))
            setPage(1)
          }}
        >
          <option value="">Todos los estados</option>
          <option value="confirmada">Confirmada</option>
          <option value="pendiente_pago">Pendiente</option>
          <option value="cancelada_admin">Cancelada</option>
        </FilterSelect>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={filtros.desde}
            onChange={(e) => {
              setFiltros((f) => ({ ...f, desde: e.target.value }))
              setPage(1)
            }}
            style={dateInputStyle}
          />
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>→</span>
          <input
            type="date"
            value={filtros.hasta}
            onChange={(e) => {
              setFiltros((f) => ({ ...f, hasta: e.target.value }))
              setPage(1)
            }}
            style={dateInputStyle}
          />
        </div>

        <FilterSelect
          value={filtros.metodoPago}
          onChange={(v) => {
            setFiltros((f) => ({ ...f, metodoPago: v }))
            setPage(1)
          }}
        >
          <option value="">Todos los métodos</option>
          <option value="mercadopago">MercadoPago</option>
          <option value="en_lugar">En el lugar</option>
        </FilterSelect>

        <button
          onClick={clearFilters}
          disabled={!hayFiltros}
          style={{
            padding: '9px 14px',
            borderRadius: 10,
            border: '1.5px solid #e2e8f0',
            background: 'white',
            color: hayFiltros ? '#475569' : '#cbd5e1',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.83rem',
            fontWeight: 600,
            cursor: hayFiltros ? 'pointer' : 'not-allowed',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            transition: 'all 0.15s',
            marginLeft: 'auto',
          }}
        >
          <X size={13} /> Limpiar filtros
        </button>
      </div>

      {/* Table or empty / loading */}
      {isLoading ? (
        <SkeletonTable />
      ) : reservas.length === 0 ? (
        <EmptyState onClear={clearFilters} hasFilters={hayFiltros} />
      ) : (
        <div
          style={{
            background: 'white',
            borderRadius: 16,
            border: '1px solid #f1f5f9',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                  {['Cliente', 'Cancha', 'Fecha y hora', 'Pago', 'Estado', ''].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '14px 18px',
                        textAlign: 'left',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.map((r, i) => (
                  <ReservaRow
                    key={r.id}
                    reserva={r}
                    rowIndex={i}
                    isLast={i === current.length - 1}
                    turnoPasado={turnoPasado}
                    onAsistencia={handleAsistencia}
                    onCancelar={() => setConfirmCancel(r)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div
            style={{
              padding: '14px 18px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Mostrando{' '}
              <strong style={{ color: '#0f172a' }}>
                {(currentPage - 1) * PER_PAGE + 1}-
                {Math.min(currentPage * PER_PAGE, reservas.length)}
              </strong>{' '}
              de <strong style={{ color: '#0f172a' }}>{reservas.length}</strong> reservas
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <PagerButton
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={14} /> Anterior
              </PagerButton>
              {Array.from({ length: totalPages }).map((_, i) => (
                <PagerButton
                  key={i}
                  active={currentPage === i + 1}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </PagerButton>
              ))}
              <PagerButton
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Siguiente <ChevronRight size={14} />
              </PagerButton>
            </div>
          </div>
        </div>
      )}

      {/* Confirm cancel */}
      {confirmCancel && (
        <CancelModal
          reserva={confirmCancel}
          loading={cancelLoading}
          onCancel={() => setConfirmCancel(null)}
          onConfirm={handleConfirmCancel}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} />}
    </div>
  )
}

// ---------- Sub-componentes ----------

const dateInputStyle: React.CSSProperties = {
  padding: '9px 12px',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.85rem',
  fontWeight: 600,
  border: '1.5px solid #e2e8f0',
  borderRadius: 10,
  background: '#fafafa',
  color: '#111827',
  outline: 'none',
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '9px 34px 9px 12px',
          appearance: 'none',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.85rem',
          fontWeight: 600,
          border: '1.5px solid #e2e8f0',
          borderRadius: 10,
          background: '#fafafa',
          color: '#111827',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        color="#94a3b8"
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

function ReservaRow({
  reserva,
  rowIndex,
  isLast,
  turnoPasado,
  onAsistencia,
  onCancelar,
}: {
  reserva: ReservaAdmin
  rowIndex: number
  isLast: boolean
  turnoPasado: (fecha: string, horaFin: string) => boolean
  onAsistencia: (id: string, valor: boolean) => void
  onCancelar: () => void
}) {
  const tipo = (reserva.canchas?.tipo ?? 'futbol5') as TipoCancha
  const palette = sportPalette(tipo)
  const initial = getInitial(reserva.profiles?.nombre)
  const status = reserva.estado
  const statusCfg =
    status === 'confirmada'
      ? { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', label: 'Confirmada' }
      : status === 'pendiente_pago'
      ? { bg: '#fefce8', text: '#a16207', border: '#fde68a', label: 'Pendiente' }
      : { bg: '#fef2f2', text: '#dc2626', border: '#fecaca', label: 'Cancelada' }

  const baseBg = rowIndex % 2 === 1 ? '#fafbfc' : 'white'

  return (
    <tr
      style={{
        borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
        background: baseBg,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
      onMouseLeave={(e) => (e.currentTarget.style.background = baseBg)}
    >
      <td style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 99,
              flexShrink: 0,
              background: `linear-gradient(135deg, ${palette.text}, ${palette.text}dd)`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 800,
              fontSize: '0.9rem',
            }}
          >
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.2,
              }}
            >
              {reserva.profiles?.nombre ?? '—'}
            </div>
            {reserva.profiles?.telefono && (
              <div
                style={{
                  fontSize: '0.74rem',
                  color: '#94a3b8',
                  lineHeight: 1.2,
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Phone size={10} />
                {reserva.profiles.telefono}
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: 99,
              background: palette.bg,
              color: palette.text,
              border: `1px solid ${palette.text}33`,
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            {sportLabel(tipo)}
          </span>
          <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
            {reserva.canchas?.nombre ?? '—'}
          </span>
        </div>
      </td>
      <td style={{ padding: '14px 18px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: '0.84rem',
            color: '#0f172a',
          }}
        >
          <Calendar size={13} color="#64748b" />
          <span style={{ fontWeight: 600 }}>{fmtFechaCorta(reserva.fecha)}</span>
          <span style={{ color: '#94a3b8' }}>·</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
            {reserva.hora_inicio.slice(0, 5)}-{reserva.hora_fin.slice(0, 5)}
          </span>
        </div>
      </td>
      <td style={{ padding: '14px 18px' }}>
        <PaymentBadge metodo={reserva.metodo_pago} />
      </td>
      <td style={{ padding: '14px 18px' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 99,
            background: statusCfg.bg,
            color: statusCfg.text,
            border: `1px solid ${statusCfg.border}`,
            fontSize: '0.74rem',
            fontWeight: 700,
          }}
        >
          {statusCfg.label}
        </span>
      </td>
      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {/* Asistencia */}
          {reserva.metodo_pago === 'en_lugar' &&
            reserva.estado === 'confirmada' &&
            turnoPasado(reserva.fecha, reserva.hora_fin) &&
            (reserva.asistio === null ? (
              <>
                <button
                  type="button"
                  title="Sí vino"
                  onClick={() => onAsistencia(reserva.id, true)}
                  style={asistenciaBtnStyle('si')}
                >
                  <UserCheck size={12} /> Sí
                </button>
                <button
                  type="button"
                  title="No se presentó"
                  onClick={() => onAsistencia(reserva.id, false)}
                  style={asistenciaBtnStyle('no')}
                >
                  <UserX size={12} /> No
                </button>
              </>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 99,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: reserva.asistio ? '#dcfce7' : '#fef2f2',
                  color: reserva.asistio ? '#16a34a' : '#dc2626',
                }}
              >
                {reserva.asistio ? <UserCheck size={11} /> : <UserX size={11} />}
                {reserva.asistio ? 'Asistió' : 'No vino'}
              </span>
            ))}

          {/* Cancelar */}
          {reserva.estado !== 'cancelada_admin' && reserva.asistio === null ? (
            <button
              onClick={onCancelar}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1.5px solid #fee2e2',
                background: 'white',
                color: '#dc2626',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fef2f2'
                e.currentTarget.style.borderColor = '#fca5a5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white'
                e.currentTarget.style.borderColor = '#fee2e2'
              }}
            >
              Cancelar
            </button>
          ) : reserva.estado === 'cancelada_admin' ? (
            <span style={{ fontSize: '0.76rem', color: '#cbd5e1', fontStyle: 'italic' }}>—</span>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

function asistenciaBtnStyle(kind: 'si' | 'no'): React.CSSProperties {
  const isSi = kind === 'si'
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 10px',
    borderRadius: 8,
    border: `1.5px solid ${isSi ? '#bbf7d0' : '#fecaca'}`,
    background: isSi ? '#f0fdf4' : '#fef2f2',
    color: isSi ? '#15803d' : '#dc2626',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '0.74rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }
}

function PaymentBadge({ metodo }: { metodo: string }) {
  if (metodo === 'mercadopago') {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 99,
          background: '#eff6ff',
          color: '#1d4ed8',
          fontSize: '0.74rem',
          fontWeight: 700,
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 99,
            background: '#00b1ea',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '0.55rem',
            fontWeight: 800,
          }}
        >
          MP
        </span>
        MercadoPago
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 99,
        background: '#f0fdf4',
        color: '#15803d',
        fontSize: '0.74rem',
        fontWeight: 700,
      }}
    >
      <DollarSign size={11} /> En el lugar
    </div>
  )
}

function PagerButton({
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 12px',
        borderRadius: 8,
        border: `1.5px solid ${active ? '#2563eb' : '#e2e8f0'}`,
        background: active ? '#2563eb' : 'white',
        color: active ? 'white' : disabled ? '#cbd5e1' : '#475569',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '0.8rem',
        fontWeight: active ? 700 : 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        transition: 'all 0.15s',
        minWidth: active ? 32 : undefined,
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}

function SkeletonTable() {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        border: '1px solid #f1f5f9',
        padding: 20,
      }}
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 0',
            borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none',
            opacity: 0.6,
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 99, background: '#f1f5f9' }} />
          <div style={{ flex: 1, height: 16, background: '#f1f5f9', borderRadius: 6 }} />
          <div style={{ width: 100, height: 16, background: '#f1f5f9', borderRadius: 6 }} />
          <div style={{ width: 100, height: 24, background: '#eff6ff', borderRadius: 99 }} />
          <div style={{ width: 90, height: 24, background: '#f0fdf4', borderRadius: 99 }} />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onClear, hasFilters }: { onClear: () => void; hasFilters: boolean }) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        padding: '60px 30px',
        border: '1px solid #f1f5f9',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        textAlign: 'center',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: '#f1f5f9',
          margin: '0 auto 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Search size={32} color="#94a3b8" />
      </div>
      <h3
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.15rem',
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 6px',
        }}
      >
        {hasFilters ? 'No encontramos reservas con esos filtros' : 'Todavía no hay reservas'}
      </h3>
      <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: 18 }}>
        {hasFilters
          ? 'Probá cambiar los filtros o limpiarlos para ver todas las reservas.'
          : 'Cuando los clientes reserven, las verás acá.'}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          style={{
            padding: '11px 18px',
            borderRadius: 12,
            border: '1.5px solid #e2e8f0',
            background: 'white',
            color: '#475569',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

// ---------- Modal cancelar ----------

function CancelModal({
  reserva,
  loading,
  onCancel,
  onConfirm,
}: {
  reserva: ReservaAdmin
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onCancel, loading])

  return createPortal(
    <>
      <div
        onClick={loading ? undefined : onCancel}
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
            marginBottom: 16,
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
            <AlertTriangle size={22} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.15rem',
                fontWeight: 800,
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Cancelar reserva
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '2px 0 0' }}>
              Esta acción no se puede deshacer.
            </p>
          </div>
        </div>

        <div
          style={{
            background: '#f8fafc',
            borderRadius: 12,
            padding: 14,
            marginBottom: 18,
            border: '1px solid #f1f5f9',
            fontSize: '0.85rem',
            color: '#475569',
            lineHeight: 1.6,
          }}
        >
          <div>
            <strong style={{ color: '#0f172a' }}>Cliente:</strong>{' '}
            {reserva.profiles?.nombre ?? '—'}
          </div>
          <div>
            <strong style={{ color: '#0f172a' }}>Cancha:</strong>{' '}
            {reserva.canchas?.nombre ?? '—'}
          </div>
          <div>
            <strong style={{ color: '#0f172a' }}>Fecha:</strong>{' '}
            {fmtFechaCorta(reserva.fecha)} · {reserva.hora_inicio.slice(0, 5)}-
            {reserva.hora_fin.slice(0, 5)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: '11px 18px',
              borderRadius: 12,
              border: '1.5px solid #e2e8f0',
              background: 'white',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Volver
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '11px 18px',
              borderRadius: 12,
              border: 'none',
              background: '#dc2626',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '0.92rem',
              fontWeight: 700,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Cancelando…' : 'Sí, cancelar'}
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
