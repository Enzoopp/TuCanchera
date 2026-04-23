// ResumenesMensuales: historial de meses cerrados.
//
// Flujo al cerrar un mes:
//   1. Se obtienen las reservas del mes (todavía en la DB)
//   2. Se calcula el resumen (KPIs)
//   3. Se genera y descarga el PDF con el detalle completo
//   4. Se guarda el resumen en resumen_meses (solo 10 números)
//   5. Se BORRAN PERMANENTEMENTE las reservas de ese mes
//
// El historial muestra los KPIs de cada mes cerrado.
// No hay "re-descargar PDF" — el admin ya lo tiene en su computadora.

import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Archive,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
} from 'lucide-react'

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
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const ancho = doc.internal.pageSize.getWidth()

  // ── Encabezado ──
  doc.setFillColor(22, 101, 52)
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
    { label: 'Confirmadas',    valor: String(resumen.confirmadas) },
    { label: 'Canceladas',     valor: String(resumen.canceladas) },
    { label: 'Asistieron',     valor: String(resumen.asistieron) },
    { label: 'No asistieron',  valor: String(resumen.noAsistieron) },
    { label: 'Ingresos',       valor: `$${resumen.ingresos.toLocaleString('es-AR')}` },
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
  const [cerrando, setCerrando] = useState(false)
  const [modalCerrar, setModalCerrar] = useState(false)

  const hoy = new Date()
  const mesPasado = hoy.getMonth() === 0
    ? { anio: hoy.getFullYear() - 1, mes: 12 }
    : { anio: hoy.getFullYear(), mes: hoy.getMonth() }

  const { data: resumenes, isLoading } = useQuery({
    queryKey: ['admin-resumenes-meses', complejo?.id],
    queryFn: () => fetchResumenesMeses(complejo!.id),
    enabled: !!complejo,
  })

  // ¿Ya está cerrado el mes pasado?
  const mesPasadoCerrado = resumenes?.some(
    (r) => r.anio === mesPasado.anio && r.mes === mesPasado.mes
  ) ?? false

  async function handleCerrarMes() {
    if (!complejo) return
    setCerrando(true)
    try {
      // 1. Traer reservas del mes (todavía están en la DB)
      const reservas = await fetchReservasMes(complejo.id, mesPasado.anio, mesPasado.mes)

      // 2. Calcular KPIs
      const totalReservas = reservas.length
      const confirmadas  = reservas.filter((r) => r.estado === 'confirmada').length
      const canceladas   = reservas.filter((r) => r.estado === 'cancelada_admin').length
      const asistieron   = reservas.filter((r) => r.asistio === true).length
      const noAsistieron = reservas.filter((r) => r.asistio === false).length
      const ingresos     = reservas
        .filter((r) => r.estado === 'confirmada')
        .reduce((acc, r) => acc + ((r.canchas as any)?.precio ?? 0), 0)

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

      // 3. Generar y descargar el PDF (con detalle completo, antes de borrar)
      await generarPDF(complejo.nombre, mesPasado.anio, mesPasado.mes, kpis, reservas)

      // 4. Guardar KPIs + borrar reservas permanentemente
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-900">Resúmenes mensuales</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Cerrá el mes, descargá el PDF y liberá espacio en la base de datos.
          </p>
        </div>

        {/* Botón cerrar mes */}
        {!mesPasadoCerrado && (
          <button
            type="button"
            onClick={() => setModalCerrar(true)}
            className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-700"
          >
            <Archive className="h-4 w-4" />
            Cerrar {MESES[mesPasado.mes]}{mesPasado.anio !== hoy.getFullYear() ? ` ${mesPasado.anio}` : ''}
          </button>
        )}
      </div>

      {/* Aviso: qué pasa al cerrar */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-sm text-amber-800">
          Al cerrar un mes se descarga el PDF automáticamente y las reservas de ese período
          se <strong>eliminan permanentemente</strong> para liberar espacio.
          Guardá bien el PDF — es el único registro que queda.
        </p>
      </div>

      {/* Lista de meses cerrados */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-700">Historial cerrado</h2>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-5">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : !resumenes || resumenes.length === 0 ? (
          <div className="py-14 text-center">
            <Archive className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-3 text-sm font-medium text-neutral-500">Todavía no cerraste ningún mes.</p>
            <p className="mt-1 text-xs text-neutral-400">
              Cuando cierres un mes, el resumen aparecerá acá.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {resumenes.map((m) => {
              const tasaAsistencia = m.confirmadas > 0
                ? Math.round((m.asistieron / m.confirmadas) * 100)
                : null

              return (
                <li key={`${m.anio}-${m.mes}`} className="flex items-center justify-between gap-4 px-5 py-4">
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

                  {/* Badge "cerrado" */}
                  <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500">
                    Cerrado
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Modal confirmación cierre de mes */}
      {modalCerrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 mx-auto">
              <Trash2 className="h-7 w-7 text-red-500" />
            </div>

            <h3 className="mt-4 text-center text-xl font-black text-neutral-900">
              Cerrar {MESES[mesPasado.mes]}{mesPasado.anio !== hoy.getFullYear() ? ` ${mesPasado.anio}` : ''}
            </h3>
            <p className="mt-2 text-center text-sm text-neutral-500">
              Se va a descargar el PDF con el detalle completo y luego
              <strong className="text-neutral-700"> todas las reservas de {MESES[mesPasado.mes]} se eliminarán para siempre</strong>.
              Esta acción no se puede deshacer.
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
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {cerrando ? 'Procesando…' : 'Cerrar y eliminar'}
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
