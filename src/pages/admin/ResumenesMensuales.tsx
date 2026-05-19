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
  fetchReservasArchivadas,
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
  FileText,
  X,
  RefreshCw,
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
  const [detalleAbierto, setDetalleAbierto] = useState<{ anio: number; mes: number } | null>(null)

  const { data: reservasArchivadas, isLoading: cargandoArchivo } = useQuery({
    queryKey: ['admin-archivadas', complejo?.id, detalleAbierto?.anio, detalleAbierto?.mes],
    queryFn: () =>
      fetchReservasArchivadas(complejo!.id, detalleAbierto!.anio, detalleAbierto!.mes),
    enabled: !!complejo && !!detalleAbierto,
  })

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
      // 1. Obtener el detalle ANTES de cerrar (la función DB lo archiva y borra)
      const reservas = await fetchReservasMes(complejo.id, mesPasado.anio, mesPasado.mes)

      // 2. Cerrar el mes via función DB (archiva + borra + guarda KPIs atómicamente)
      const kpis = await cerrarMes(complejo.id, mesPasado.anio, mesPasado.mes)

      // 3. Generar y descargar PDF con el detalle completo que ya obtuvimos
      await generarPDF(complejo.nombre, mesPasado.anio, mesPasado.mes, kpis, reservas)

      await queryClient.invalidateQueries({ queryKey: ['admin-resumenes-meses'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-reservas'] })

      toast.success(`${MESES[mesPasado.mes]} cerrado — PDF descargado y reservas archivadas`)
      setModalCerrar(false)
    } catch (err) {
      toast.error('Error al cerrar el mes')
      console.error(err)
    } finally {
      setCerrando(false)
    }
  }

  const pageStyle: CSSProperties = {
    maxWidth: 1200,
    fontFamily: "'DM Sans', sans-serif",
  }

  const mesLabel = `${MESES[mesPasado.mes]}${mesPasado.anio !== hoy.getFullYear() ? ` ${mesPasado.anio}` : ''}`

  return (
    <div className="admin-page" style={pageStyle}>
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
          <strong style={{ color: '#78350f' }}>archivan</strong> para liberar espacio en la tabla operativa.
          El detalle queda guardado en el historial por si necesitás consultarlo.
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

                  {/* Acciones */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setDetalleAbierto({ anio: m.anio, mes: m.mes })}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1.5px solid #e2e8f0',
                        background: 'white',
                        color: '#475569',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#2563eb'
                        e.currentTarget.style.color = '#2563eb'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        e.currentTarget.style.color = '#475569'
                      }}
                    >
                      <FileText size={13} />
                      Ver detalle
                    </button>
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

      {/* Drawer de detalle histórico */}
      {detalleAbierto && complejo && (
        <DetalleArchivoDrawer
          complejo={complejo.nombre}
          anio={detalleAbierto.anio}
          mes={detalleAbierto.mes}
          reservas={reservasArchivadas ?? []}
          loading={cargandoArchivo}
          resumen={resumenes?.find(r => r.anio === detalleAbierto.anio && r.mes === detalleAbierto.mes) ?? null}
          onClose={() => setDetalleAbierto(null)}
        />
      )}
    </div>
  )
}

// ─── DetalleArchivoDrawer ─────────────────────────────────────────────────

function DetalleArchivoDrawer({
  complejo,
  anio,
  mes,
  reservas,
  loading,
  resumen,
  onClose,
}: {
  complejo: string
  anio: number
  mes: number
  reservas: ReservaAdmin[]
  loading: boolean
  resumen: ResumenMes | null
  onClose: () => void
}) {
  const [regenerando, setRegenerando] = useState(false)

  async function handleRegenerarPDF() {
    if (!resumen) return
    setRegenerando(true)
    try {
      await generarPDF(complejo, anio, mes, resumen, reservas)
    } catch {
      // PDF generation errors are non-critical; user can retry
    } finally {
      setRegenerando(false)
    }
  }

  const mesLabel = `${MESES[mes]} ${anio}`

  return createPortal(
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.45)',
          zIndex: 900,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(760px, 100vw)',
          background: 'white',
          zIndex: 901,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
          animation: 'slideInRight 0.25s cubic-bezier(0.4,0,0.2,1)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.1rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Historial — {mesLabel}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
              {loading ? 'Cargando…' : `${reservas.length} reservas archivadas`}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {resumen && (
              <button
                type="button"
                onClick={handleRegenerarPDF}
                disabled={regenerando || loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 9,
                  border: 'none',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: 'white',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: regenerando || loading ? 'not-allowed' : 'pointer',
                  opacity: regenerando || loading ? 0.7 : 1,
                  boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                  transition: 'opacity 0.15s',
                }}
              >
                <RefreshCw size={13} style={{ animation: regenerando ? 'spin 0.8s linear infinite' : 'none' }} />
                {regenerando ? 'Generando…' : 'Regenerar PDF'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1.5px solid #e2e8f0',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* KPIs resumen */}
        {resumen && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '14px 24px',
              borderBottom: '1px solid #f1f5f9',
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            {[
              { label: 'Total', valor: resumen.totalReservas, color: '#0f172a' },
              { label: 'Confirmadas', valor: resumen.confirmadas, color: '#16a34a' },
              { label: 'Canceladas', valor: resumen.canceladas, color: '#dc2626' },
              { label: 'Asistieron', valor: resumen.asistieron, color: '#2563eb' },
              {
                label: 'Ingresos',
                valor: `$${resumen.ingresos.toLocaleString('es-AR')}`,
                color: '#7c3aed',
              },
            ].map((k) => (
              <div
                key={k.label}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  textAlign: 'center',
                  minWidth: 80,
                }}
              >
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '1rem',
                    fontWeight: 800,
                    color: k.color,
                  }}
                >
                  {k.valor}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>
                  {k.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabla */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-block',
                  width: 26,
                  height: 26,
                  border: '3px solid #e2e8f0',
                  borderTop: '3px solid #2563eb',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            </div>
          ) : reservas.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
              No hay reservas archivadas para este mes.
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.82rem',
                marginTop: 16,
              }}
            >
              <thead>
                <tr>
                  {['Fecha', 'Hora', 'Cancha', 'Cliente', 'Pago', 'Estado', 'Asistió'].map(
                    (col) => (
                      <th
                        key={col}
                        style={{
                          padding: '8px 10px',
                          textAlign: 'left',
                          color: '#64748b',
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          borderBottom: '2px solid #f1f5f9',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {reservas.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{ background: i % 2 === 0 ? 'white' : '#fafbfc' }}
                  >
                    <td style={tdStyle}>{r.fecha}</td>
                    <td style={tdStyle}>{r.hora_inicio.slice(0, 5)}</td>
                    <td style={tdStyle}>{r.canchas?.nombre ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                    <td style={tdStyle}>{r.profiles?.nombre ?? <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                    <td style={tdStyle}>
                      {r.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'En lugar'}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 99,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background:
                            r.estado === 'confirmada'
                              ? '#dcfce7'
                              : r.estado === 'cancelada_admin'
                                ? '#fee2e2'
                                : '#fef9c3',
                          color:
                            r.estado === 'confirmada'
                              ? '#16a34a'
                              : r.estado === 'cancelada_admin'
                                ? '#dc2626'
                                : '#ca8a04',
                        }}
                      >
                        {r.estado === 'confirmada'
                          ? 'Conf.'
                          : r.estado === 'cancelada_admin'
                            ? 'Canc.'
                            : 'Pend.'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {r.asistio === true ? '✓' : r.asistio === false ? '✗' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>,
    document.body
  )
}

const tdStyle: CSSProperties = {
  padding: '9px 10px',
  borderBottom: '1px solid #f8fafc',
  color: '#334155',
  verticalAlign: 'middle',
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
            background: '#dbeafe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Archive size={26} color="#2563eb" />
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
          Se va a descargar el PDF con el detalle completo y las reservas de {mesLabel} se{' '}
          <strong style={{ color: '#0f172a' }}>
            archivarán
          </strong>
          {' '}para mantener la tabla operativa liviana. El historial queda guardado.
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
              background: loading ? '#2563eb' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: 'white',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: loading ? 'none' : '0 2px 8px rgba(37,99,235,0.3)',
            }}
          >
            <Archive size={14} />
            {loading ? 'Procesando…' : 'Cerrar y archivar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
