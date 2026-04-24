// Resúmenes mensuales — diseño Claude.
// Flujo al cerrar un mes:
//   1. Se obtienen las reservas del mes (todavía en la DB)
//   2. Se calcula el resumen (KPIs)
//   3. Se genera y descarga el PDF con el detalle completo
//   4. Se guarda el resumen en resumen_meses (solo 10 números)
//   5. Se BORRAN PERMANENTEMENTE las reservas de ese mes

import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import {
  fetchResumenesMeses,
  fetchReservasMes,
  cerrarMes,
  type ResumenMes,
  type ReservaAdmin,
} from '@/services/adminService'
import {
  Archive,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
} from 'lucide-react'

const MESES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

// ─── PDF via jspdf + jspdf-autotable ───────────────────────────────────────

async function generarPDF(
  complejo: string,
  anio: number,
  mes: number,
  resumen: ResumenMes,
  reservas: ReservaAdmin[]
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()

  // ── Encabezado ──
  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, ancho, 32, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('TuCanchera', 14, 13)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Resumen mensual — ${MESES[mes]} ${anio}`, 14, 22)
  doc.text(complejo, ancho - 14, 22, { align: 'right' })

  // ── KPIs ──
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')

  const kpis = [
    { label: 'Total reservas', valor: String(resumen.totalReservas) },
    { label: 'Confirmadas', valor: String(resumen.confirmadas) },
    { label: 'Canceladas', valor: String(resumen.canceladas) },
    { label: 'Asistieron', valor: String(resumen.asistieron) },
    { label: 'No asistieron', valor: String(resumen.noAsistieron) },
    { label: 'Ingresos', valor: `$${resumen.ingresos.toLocaleString('es-AR')}` },
  ]

  const colW = (ancho - 28) / 3
  const rowH = 18
  kpis.forEach((k, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = 14 + col * colW
    const y = 40 + row * rowH
    doc.setFillColor(245, 245, 245)
    doc.roundedRect(x, y, colW - 4, rowH - 2, 2, 2, 'F')
    doc.setFontSize(16)
    doc.setTextColor(37, 99, 235)
    doc.text(k.valor, x + 4, y + 10)
    doc.setFontSize(7.5)
    doc.setTextColor(100, 100, 100)
    doc.text(k.label, x + 4, y + 15)
  })

  // ── Tabla de reservas ──
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Detalle de reservas', 14, 83)

  const filas = reservas.map((r) => [
    r.fecha,
    r.hora_inicio.slice(0, 5),
    r.canchas?.nombre ?? '—',
    r.profiles?.nombre ?? '—',
    r.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'En el lugar',
    r.estado === 'confirmada'
      ? 'Confirmada'
      : r.estado === 'cancelada_admin'
        ? 'Cancelada'
        : 'Pendiente',
    r.asistio === true ? 'Sí' : r.asistio === false ? 'No' : '—',
  ])

  autoTable(doc, {
    startY: 87,
    head: [['Fecha', 'Hora', 'Cancha', 'Cliente', 'Pago', 'Estado', 'Asistió']],
    body: filas,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 248] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 14 },
      2: { cellWidth: 28 },
      3: { cellWidth: 38 },
      4: { cellWidth: 24 },
      5: { cellWidth: 24 },
      6: { cellWidth: 14 },
    },
    margin: { left: 14, right: 14 },
  })

  const paginas = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(
      `Generado por TuCanchera · ${new Date().toLocaleDateString('es-AR')} · Pág ${i}/${paginas}`,
      ancho / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' }
    )
  }

  doc.save(`tucanchera-${MESES[mes].toLowerCase()}-${anio}.pdf`)
}

// ─── Componente ───────────────────────────────────────────────────────────

export default function ResumenesMensuales() {
  const { data: complejo } = useMiComplejo()
  const queryClient = useQueryClient()
  const [cerrando, setCerrando] = useState(false)
  const [modalCerrar, setModalCerrar] = useState(false)

  const hoy = new Date()
  const mesPasado =
    hoy.getMonth() === 0
      ? { anio: hoy.getFullYear() - 1, mes: 12 }
      : { anio: hoy.getFullYear(), mes: hoy.getMonth() }

  const { data: resumenes, isLoading } = useQuery({
    queryKey: ['admin-resumenes-meses', complejo?.id],
    queryFn: () => fetchResumenesMeses(complejo!.id),
    enabled: !!complejo,
  })

  const mesPasadoCerrado =
    resumenes?.some((r) => r.anio === mesPasado.anio && r.mes === mesPasado.mes) ?? false

  async function handleCerrarMes() {
    if (!complejo) return
    setCerrando(true)
    try {
      const reservas = await fetchReservasMes(complejo.id, mesPasado.anio, mesPasado.mes)

      const totalReservas = reservas.length
      const confirmadas = reservas.filter((r) => r.estado === 'confirmada').length
      const canceladas = reservas.filter((r) => r.estado === 'cancelada_admin').length
      const asistieron = reservas.filter((r) => r.asistio === true).length
      const noAsistieron = reservas.filter((r) => r.asistio === false).length
      const ingresos = reservas
        .filter((r) => r.estado === 'confirmada')
        .reduce((acc, r) => acc + ((r.canchas as unknown as { precio?: number } | null)?.precio ?? 0), 0)

      const kpis: ResumenMes = {
        anio: mesPasado.anio,
        mes: mesPasado.mes,
        totalReservas,
        confirmadas,
        canceladas,
        asistieron,
        noAsistieron,
        ingresos,
      }

      await generarPDF(complejo.nombre, mesPasado.anio, mesPasado.mes, kpis, reservas)
      await cerrarMes(complejo.id, mesPasado.anio, mesPasado.mes, kpis)

      await queryClient.invalidateQueries({ queryKey: ['admin-resumenes-meses'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-reservas'] })

      toast.success(`${MESES[mesPasado.mes]} cerrado — PDF descargado y reservas eliminadas`)
      setModalCerrar(false)
    } catch (err) {
      toast.error('Error al cerrar el mes')
      console.error(err)
    } finally {
      setCerrando(false)
    }
  }

  const pageStyle: CSSProperties = {
    padding: '32px 32px 60px',
    maxWidth: 1200,
    fontFamily: "'DM Sans', sans-serif",
  }

  const mesLabel = `${MESES[mesPasado.mes]}${mesPasado.anio !== hoy.getFullYear() ? ` ${mesPasado.anio}` : ''}`

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
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
            Resúmenes mensuales
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>
            Cerrá el mes, descargá el PDF y liberá espacio en la base de datos.
          </p>
        </div>

        {!mesPasadoCerrado && (
          <button
            type="button"
            onClick={() => setModalCerrar(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 18px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: 'white',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.35)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.25)'
            }}
          >
            <Archive size={16} />
            Cerrar {mesLabel}
          </button>
        )}
      </div>

      {/* Aviso */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 18px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
          border: '1px solid #fde68a',
          marginBottom: 24,
        }}
      >
        <AlertTriangle size={18} color="#d97706" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: '0.86rem', color: '#78350f', lineHeight: 1.5 }}>
          Al cerrar un mes se descarga el PDF automáticamente y las reservas de ese período se{' '}
          <strong style={{ color: '#78350f' }}>eliminan permanentemente</strong> para liberar espacio.
          Guardá bien el PDF — es el único registro que queda.
        </div>
      </div>

      {/* Lista */}
      <div
        style={{
          background: 'white',
          borderRadius: 16,
          border: '1px solid #f1f5f9',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.05rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Historial cerrado
          </h2>
          {resumenes && resumenes.length > 0 && (
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
              {resumenes.length} {resumenes.length === 1 ? 'mes cerrado' : 'meses cerrados'}
            </span>
          )}
        </div>

        {isLoading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-block',
                width: 28,
                height: 28,
                border: '3px solid #e2e8f0',
                borderTop: '3px solid #2563eb',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <div style={{ marginTop: 10, fontSize: '0.86rem', color: '#94a3b8' }}>Cargando historial…</div>
          </div>
        ) : !resumenes || resumenes.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 56,
                height: 56,
                borderRadius: 16,
                background: '#f1f5f9',
                marginBottom: 14,
              }}
            >
              <Archive size={26} color="#94a3b8" />
            </div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#334155',
                marginBottom: 4,
              }}
            >
              Todavía no cerraste ningún mes
            </div>
            <div style={{ fontSize: '0.86rem', color: '#94a3b8' }}>
              Cuando cierres un mes, el resumen aparecerá acá.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {resumenes.map((m, idx) => {
              const tasaAsistencia =
                m.confirmadas > 0 ? Math.round((m.asistieron / m.confirmadas) * 100) : null
              return (
                <div
                  key={`${m.anio}-${m.mes}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '18px 22px',
                    borderBottom: idx < resumenes.length - 1 ? '1px solid #f1f5f9' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fafbfc'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Mes y año */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #dbeafe, #eff6ff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        border: '1px solid #bfdbfe',
                      }}
                    >
                      <CalendarDays size={20} color="#2563eb" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: '#0f172a',
                          letterSpacing: '-0.01em',
                          marginBottom: 3,
                        }}
                      >
                        {MESES[m.mes]} {m.anio}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {m.totalReservas} reservas · {m.confirmadas} confirmadas
                      </div>
                    </div>
                  </div>

                  {/* KPIs chips */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 18,
                      flexShrink: 0,
                    }}
                    className="resumen-kpis"
                  >
                    <KpiChip
                      icon={TrendingUp}
                      label="Ingresos"
                      valor={`$${m.ingresos.toLocaleString('es-AR')}`}
                      color="#2563eb"
                    />
                    <KpiChip
                      icon={CheckCircle2}
                      label="Asistieron"
                      valor={tasaAsistencia !== null ? `${tasaAsistencia}%` : '—'}
                      color="#16a34a"
                    />
                    <KpiChip
                      icon={XCircle}
                      label="Canceladas"
                      valor={String(m.canceladas)}
                      color="#dc2626"
                    />
                  </div>

                  {/* Badge cerrado */}
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '5px 11px',
                      borderRadius: 99,
                      background: '#f1f5f9',
                      color: '#64748b',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    Cerrado
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal confirmación */}
      {modalCerrar && <ConfirmCloseModal
        mesLabel={mesLabel}
        loading={cerrando}
        onCancel={() => !cerrando && setModalCerrar(false)}
        onConfirm={handleCerrarMes}
      />}
    </div>
  )
}

// ─── KpiChip ──────────────────────────────────────────────────────────────

function KpiChip({
  icon: Icon,
  label,
  valor,
  color,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>
  label: string
  valor: string
  color: string
}) {
  return (
    <div style={{ textAlign: 'center', minWidth: 70 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '0.92rem',
          fontWeight: 800,
          color,
          lineHeight: 1.1,
        }}
      >
        <Icon size={14} color={color} />
        {valor}
      </div>
      <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 3, fontWeight: 600 }}>
        {label}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────

function ConfirmCloseModal({
  mesLabel,
  loading,
  onCancel,
  onConfirm,
}: {
  mesLabel: string
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 16,
          maxWidth: 440,
          width: '100%',
          padding: '28px 26px 22px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          fontFamily: "'DM Sans', sans-serif",
          animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Trash2 size={26} color="#dc2626" />
        </div>
        <h3
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1.3rem',
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
            textAlign: 'center',
          }}
        >
          Cerrar {mesLabel}
        </h3>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: '0.9rem',
            color: '#475569',
            lineHeight: 1.55,
            textAlign: 'center',
          }}
        >
          Se va a descargar el PDF con el detalle completo y luego{' '}
          <strong style={{ color: '#0f172a' }}>
            todas las reservas de {mesLabel} se eliminarán para siempre
          </strong>
          . Esta acción no se puede deshacer.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: '11px 14px',
              borderRadius: 10,
              border: '1.5px solid #e2e8f0',
              background: 'white',
              color: '#475569',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '11px 14px',
              borderRadius: 10,
              border: 'none',
              background: loading ? '#ef4444' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
              color: 'white',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: loading ? 'none' : '0 2px 8px rgba(220,38,38,0.3)',
            }}
          >
            <Trash2 size={14} />
            {loading ? 'Procesando…' : 'Cerrar y eliminar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
