// ResumenesMensuales: historial de meses archivados.
// Permite descargar el PDF de cualquier mes archivado
// y cerrar el mes actual para archivarlo.

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import {
  fetchMesesArchivados,
  fetchReservasMes,
  archivarMes,
  type ResumenMes,
  type ReservaAdmin,
} from '@/services/adminService'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Archive,
  Download,
  CalendarDays,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import AdminActionModal from '@/components/AdminActionModal'

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// ─── PDF via jspdf + jspdf-autotable ────────────────────────────────────────

async function generarPDF(
  complejo: string,
  anio: number,
  mes: number,
  resumen: ResumenMes,
  reservas: ReservaAdmin[]
) {
  // Importación dinámica para no aumentar el bundle inicial
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()

  // ── Encabezado ──
  doc.setFillColor(22, 101, 52) // verde oscuro
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
    doc.setTextColor(22, 101, 52)
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
    r.estado === 'confirmada' ? 'Confirmada'
      : r.estado === 'cancelada_admin' ? 'Cancelada' : 'Pendiente',
    r.asistio === true ? 'Sí' : r.asistio === false ? 'No' : '—',
  ])

  autoTable(doc, {
    startY: 87,
    head: [['Fecha', 'Hora', 'Cancha', 'Cliente', 'Pago', 'Estado', 'Asistió']],
    body: filas,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold' },
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

  // ── Pie de página ──
  const paginas = (doc as any).internal.getNumberOfPages()
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

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ResumenesMensuales() {
  const { data: complejo } = useMiComplejo()
  const queryClient = useQueryClient()
  const [descargando, setDescargando] = useState<string | null>(null)
  const [cerrando, setCerrando] = useState(false)
  const [modalCerrar, setModalCerrar] = useState(false)

  const hoy = new Date()
  const mesActual = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 }
  const mesPasado = hoy.getMonth() === 0
    ? { anio: hoy.getFullYear() - 1, mes: 12 }
    : { anio: hoy.getFullYear(), mes: hoy.getMonth() }

  const { data: meses, isLoading } = useQuery({
    queryKey: ['admin-meses-archivados', complejo?.id],
    queryFn: () => fetchMesesArchivados(complejo!.id),
    enabled: !!complejo,
  })

  async function handleDescargar(anio: number, mes: number) {
    if (!complejo) return
    const key = `${anio}-${mes}`
    setDescargando(key)
    try {
      const reservas = await fetchReservasMes(complejo.id, anio, mes)
      const resumen = meses?.find((m) => m.anio === anio && m.mes === mes)
      if (!resumen) throw new Error('Resumen no encontrado')
      await generarPDF(complejo.nombre, anio, mes, resumen, reservas)
    } catch (err) {
      toast.error('No se pudo generar el PDF')
      console.error(err)
    } finally {
      setDescargando(null)
    }
  }

  async function handleCerrarMes() {
    if (!complejo) return
    setCerrando(true)
    try {
      // Generar PDF del mes a cerrar
      const reservas = await fetchReservasMes(complejo.id, mesPasado.anio, mesPasado.mes)
      const total = reservas.length
      const confirmadas = reservas.filter((r) => r.estado === 'confirmada').length
      const canceladas = reservas.filter((r) => r.estado === 'cancelada_admin').length
      const asistieron = reservas.filter((r) => r.asistio === true).length
      const noAsistieron = reservas.filter((r) => r.asistio === false).length
      const ingresos = reservas
        .filter((r) => r.estado === 'confirmada')
        .reduce((acc, r) => acc + ((r.canchas as any)?.precio ?? 0), 0)

      const resumen: ResumenMes = {
        anio: mesPasado.anio,
        mes: mesPasado.mes,
        totalReservas: total,
        confirmadas,
        canceladas,
        asistieron,
        noAsistieron,
        ingresos,
      }

      await generarPDF(complejo.nombre, mesPasado.anio, mesPasado.mes, resumen, reservas)
      await archivarMes(complejo.id, mesPasado.anio, mesPasado.mes)

      await queryClient.invalidateQueries({ queryKey: ['admin-meses-archivados'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-reservas'] })

      toast.success(`Mes de ${MESES[mesPasado.mes]} archivado y PDF descargado`)
      setModalCerrar(false)
    } catch (err) {
      toast.error('Error al cerrar el mes')
      console.error(err)
    } finally {
      setCerrando(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-900">Resúmenes mensuales</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Archivá los meses cerrados y descargá el PDF con el detalle completo.
          </p>
        </div>

        {/* Botón cerrar mes */}
        <button
          type="button"
          onClick={() => setModalCerrar(true)}
          className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-700"
        >
          <Archive className="h-4 w-4" />
          Cerrar {MESES[mesPasado.mes]} {mesPasado.anio !== mesActual.anio ? mesPasado.anio : ''}
        </button>
      </div>

      {/* Info de qué significa cerrar un mes */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-sm text-amber-800">
          Cerrar un mes descarga el PDF automáticamente y archiva las reservas de ese período.
          Las reservas archivadas <strong>no se borran</strong> — dejan de aparecer en la vista
          principal pero quedan guardadas acá.
        </p>
      </div>

      {/* Lista de meses archivados */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-700">Historial archivado</h2>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : !meses || meses.length === 0 ? (
          <div className="py-14 text-center">
            <Archive className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm font-medium text-neutral-500">Todavía no cerraste ningún mes.</p>
            <p className="mt-1 text-xs text-neutral-400">
              Cuando cierres un mes, el resumen aparecerá acá.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {meses.map((m) => {
              const key = `${m.anio}-${m.mes}`
              const tasaAsistencia = m.confirmadas > 0
                ? Math.round((m.asistieron / m.confirmadas) * 100)
                : null

              return (
                <li key={key} className="flex items-center justify-between gap-4 px-5 py-4">
                  {/* Mes y año */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                      <CalendarDays className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-neutral-900">
                        {MESES[m.mes]} {m.anio}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {m.totalReservas} reservas · {m.confirmadas} confirmadas
                      </p>
                    </div>
                  </div>

                  {/* KPIs rápidos */}
                  <div className="hidden items-center gap-6 sm:flex">
                    <KpiChip
                      icon={TrendingUp}
                      label="Ingresos"
                      valor={`$${m.ingresos.toLocaleString('es-AR')}`}
                      color="text-primary-700"
                    />
                    <KpiChip
                      icon={CheckCircle2}
                      label="Asistieron"
                      valor={tasaAsistencia !== null ? `${tasaAsistencia}%` : '—'}
                      color="text-emerald-600"
                    />
                    <KpiChip
                      icon={XCircle}
                      label="Canceladas"
                      valor={String(m.canceladas)}
                      color="text-red-500"
                    />
                  </div>

                  {/* Descargar PDF */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={descargando === key}
                    onClick={() => handleDescargar(m.anio, m.mes)}
                    className="shrink-0 gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {descargando === key ? 'Generando…' : 'PDF'}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Modal confirmación de cierre de mes */}
      {modalCerrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 mx-auto">
              <Archive className="h-7 w-7 text-neutral-700" />
            </div>

            <h3 className="mt-4 text-center text-xl font-black text-neutral-900">
              Cerrar {MESES[mesPasado.mes]} {mesPasado.anio !== mesActual.anio ? mesPasado.anio : ''}
            </h3>
            <p className="mt-2 text-center text-sm text-neutral-500">
              Se va a generar y descargar el PDF del mes, y todas las reservas
              de {MESES[mesPasado.mes]} quedarán archivadas.
            </p>

            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setModalCerrar(false)}
                disabled={cerrando}
              >
                Cancelar
              </Button>
              <button
                type="button"
                onClick={handleCerrarMes}
                disabled={cerrando}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:opacity-60"
              >
                <Archive className="h-4 w-4" />
                {cerrando ? 'Procesando…' : 'Cerrar mes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiChip({
  icon: Icon,
  label,
  valor,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  valor: string
  color: string
}) {
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center gap-1 text-sm font-bold ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {valor}
      </div>
      <p className="text-[10px] text-neutral-400">{label}</p>
    </div>
  )
}
