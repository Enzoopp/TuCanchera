// ============================================================
// ADMIN / ESTADISTICAS.TSX  (ruta: /admin/estadisticas)
// Panel de estadísticas del complejo para el admin.
//
// Muestra (solo reservas CONFIRMADAS):
//   - Recaudación total, desglosada en MercadoPago vs En el lugar
//   - Gráfico de línea: reservas por semana (LineChart)
//   - Gráfico de barras: reservas por mes (BarChart)
//   - Ranking de canchas más reservadas (BarChart horizontal)
//
// El admin puede filtrar por rango de fechas (desde–hasta).
// Por defecto: últimos 30 días.
//
// Librerías:
//   - recharts: para todos los gráficos
//   - date-fns: para parsear fechas y calcular semanas/meses
// ============================================================

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,          // gráfico de barras
  Bar,               // barra dentro de BarChart
  LineChart,         // gráfico de línea
  Line,              // línea dentro de LineChart
  XAxis,             // eje horizontal
  YAxis,             // eje vertical
  CartesianGrid,     // grilla de fondo
  Tooltip,           // tooltip al hacer hover
  ResponsiveContainer, // hace los gráficos 100% del ancho del contenedor
} from 'recharts'
import { format, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'   // locale español para nombres de meses
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchReservasConfirmadasRango } from '@/services/adminService'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

// ── Tipo auxiliar para el join de canchas ────────────────────
// La query trae el precio y nombre de la cancha en un join anidado
interface CanchaJoin {
  nombre: string
  tipo: string
  precio: number
}

export default function Estadisticas() {
  const { data: complejo } = useMiComplejo()

  // ── Rango de fechas por defecto: últimos 30 días ─────────────
  const hoy = new Date()
  const haceMes = new Date()
  haceMes.setDate(hoy.getDate() - 30)
  // format con 'yyyy-MM-dd' para que los inputs type="date" los acepten
  const [desde, setDesde] = useState(format(haceMes, 'yyyy-MM-dd'))
  const [hasta, setHasta] = useState(format(hoy, 'yyyy-MM-dd'))

  // ── Query: reservas confirmadas en el rango de fechas ────────
  // Se vuelve a ejecutar cada vez que cambia 'desde' o 'hasta'
  const { data: reservas, isLoading } = useQuery({
    queryKey: ['admin-stats', complejo?.id, desde, hasta],
    queryFn: () => fetchReservasConfirmadasRango(complejo!.id, desde, hasta),
    enabled: !!complejo,
  })

  // ── Calcular estadísticas con useMemo ────────────────────────
  // useMemo: solo recalcula cuando cambia 'reservas'
  // Agrupa la data en los formatos que necesita cada gráfico
  const stats = useMemo(() => {
    // Si no hay datos, devolver valores vacíos para los gráficos
    if (!reservas) {
      return {
        totalOnline: 0,
        totalLocal: 0,
        total: 0,
        porSemana: [] as Array<{ semana: string; reservas: number }>,
        porMes: [] as Array<{ mes: string; reservas: number }>,
        porCancha: [] as Array<{ cancha: string; reservas: number }>,
      }
    }

    let totalOnline = 0   // suma de precios pagados por MercadoPago
    let totalLocal = 0    // suma de precios pagados en el lugar
    const semanas = new Map<string, number>()    // semana → cantidad
    const meses = new Map<string, number>()      // mes → cantidad
    const canchas = new Map<string, number>()    // nombre cancha → cantidad

    for (const r of reservas) {
      // Acceder al join de cancha (necesita cast a unknown por TypeScript)
      const cancha = (r as unknown as { canchas: CanchaJoin | null }).canchas
      const precio = cancha?.precio ?? 0

      // Sumar al total según método de pago
      if (r.metodo_pago === 'mercadopago') totalOnline += precio
      else totalLocal += precio

      // Agrupar por semana: usar el lunes de la semana como clave
      const fecha = parseISO(r.fecha)  // parseISO convierte "YYYY-MM-DD" → Date
      const semanaKey = format(
        startOfWeek(fecha, { weekStartsOn: 1 }),  // 1 = lunes
        'dd MMM',
        { locale: es }  // ej: "05 may"
      )
      semanas.set(semanaKey, (semanas.get(semanaKey) ?? 0) + 1)

      // Agrupar por mes: ej: "may 25"
      const mesKey = format(fecha, 'MMM yy', { locale: es })
      meses.set(mesKey, (meses.get(mesKey) ?? 0) + 1)

      // Agrupar por nombre de cancha
      const nombreCancha = cancha?.nombre ?? 'Sin nombre'
      canchas.set(nombreCancha, (canchas.get(nombreCancha) ?? 0) + 1)
    }

    return {
      totalOnline,
      totalLocal,
      total: totalOnline + totalLocal,
      // Convertir Maps a arrays de objetos para recharts
      porSemana: Array.from(semanas.entries()).map(([semana, reservas]) => ({
        semana,
        reservas,
      })),
      porMes: Array.from(meses.entries()).map(([mes, reservas]) => ({
        mes,
        reservas,
      })),
      // Ranking: ordenar de mayor a menor
      porCancha: Array.from(canchas.entries())
        .map(([cancha, reservas]) => ({ cancha, reservas }))
        .sort((a, b) => b.reservas - a.reservas),
    }
  }, [reservas])

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Estadísticas</h1>
        <p className="text-sm text-neutral-500">
          Recaudación y ranking de canchas (reservas confirmadas).
        </p>
      </div>

      {/* ── Selector de rango de fechas ── */}
      <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="desde">Desde</Label>
          <Input
            id="desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="hasta">Hasta</Label>
          <Input
            id="hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
      </div>

      {/* Skeleton mientras cargan las estadísticas */}
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          {/* ── Cajas de totales ── */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Total general */}
            <StatBox
              label="Total recaudado"
              value={`$${stats.total.toLocaleString('es-AR')}`}
              accent="text-primary-600"
            />
            {/* Solo MercadoPago */}
            <StatBox
              label="MercadoPago"
              value={`$${stats.totalOnline.toLocaleString('es-AR')}`}
              accent="text-green-600"
            />
            {/* Solo en el lugar */}
            <StatBox
              label="En el lugar"
              value={`$${stats.totalLocal.toLocaleString('es-AR')}`}
              accent="text-amber-600"
            />
          </div>

          {/* ── Gráfico de línea: reservas por semana ── */}
          {/* LineChart: muestra la evolución semana a semana */}
          <ChartCard title="Reservas por semana">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.porSemana}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="semana" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"    // curva suave entre puntos
                  dataKey="reservas"
                  stroke="#2563EB"   // azul primario
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* ── Gráfico de barras verticales: reservas por mes ── */}
          <ChartCard title="Reservas por mes">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.porMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="reservas" fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* ── Gráfico de barras horizontal: ranking de canchas ── */}
          {/* layout="vertical" rota el BarChart para que las barras sean horizontales */}
          <ChartCard title="Ranking de canchas">
            {stats.porCancha.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">
                Sin datos en este período.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.porCancha} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  {/* En layout vertical: X es el número y Y son las categorías */}
                  <XAxis type="number" fontSize={12} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="cancha"   // nombre de la cancha en el eje Y
                    fontSize={12}
                    width={100}        // espacio para los nombres largos
                  />
                  <Tooltip />
                  <Bar dataKey="reservas" fill="#2563EB" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </>
      )}
    </div>
  )
}

// ── StatBox ──────────────────────────────────────────────────
// Caja de número destacado: label pequeño + valor grande con color
function StatBox({
  label,
  value,
  accent,  // clase de color tailwind: ej "text-green-600"
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      {/* Label en mayúsculas pequeñas */}
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      {/* Valor grande con el color según el tipo de recaudación */}
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  )
}

// ── ChartCard ────────────────────────────────────────────────
// Contenedor blanco con título para envolver cada gráfico de recharts
function ChartCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 font-semibold text-neutral-900">{title}</h3>
      {children}
    </div>
  )
}
