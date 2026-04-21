// SRP: Estadísticas del complejo con gráficos (recharts).
// - Recaudación total (online vs en lugar)
// - Reservas por semana y por mes
// - Ranking de canchas más reservadas
// Filtro por rango de fechas.

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchReservasConfirmadasRango } from '@/services/adminService'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

interface CanchaJoin {
  nombre: string
  tipo: string
  precio: number
}

export default function Estadisticas() {
  const { data: complejo } = useMiComplejo()

  // Por defecto: últimos 30 días
  const hoy = new Date()
  const haceMes = new Date()
  haceMes.setDate(hoy.getDate() - 30)
  const [desde, setDesde] = useState(format(haceMes, 'yyyy-MM-dd'))
  const [hasta, setHasta] = useState(format(hoy, 'yyyy-MM-dd'))

  const { data: reservas, isLoading } = useQuery({
    queryKey: ['admin-stats', complejo?.id, desde, hasta],
    queryFn: () => fetchReservasConfirmadasRango(complejo!.id, desde, hasta),
    enabled: !!complejo,
  })

  const stats = useMemo(() => {
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
    let totalOnline = 0
    let totalLocal = 0
    const semanas = new Map<string, number>()
    const meses = new Map<string, number>()
    const canchas = new Map<string, number>()

    for (const r of reservas) {
      const cancha = (r as unknown as { canchas: CanchaJoin | null }).canchas
      const precio = cancha?.precio ?? 0

      if (r.metodo_pago === 'mercadopago') totalOnline += precio
      else totalLocal += precio

      const fecha = parseISO(r.fecha)
      const semanaKey = format(
        startOfWeek(fecha, { weekStartsOn: 1 }),
        'dd MMM',
        { locale: es }
      )
      semanas.set(semanaKey, (semanas.get(semanaKey) ?? 0) + 1)

      const mesKey = format(fecha, 'MMM yy', { locale: es })
      meses.set(mesKey, (meses.get(mesKey) ?? 0) + 1)

      const nombreCancha = cancha?.nombre ?? 'Sin nombre'
      canchas.set(nombreCancha, (canchas.get(nombreCancha) ?? 0) + 1)
    }

    return {
      totalOnline,
      totalLocal,
      total: totalOnline + totalLocal,
      porSemana: Array.from(semanas.entries()).map(([semana, reservas]) => ({
        semana,
        reservas,
      })),
      porMes: Array.from(meses.entries()).map(([mes, reservas]) => ({
        mes,
        reservas,
      })),
      porCancha: Array.from(canchas.entries())
        .map(([cancha, reservas]) => ({ cancha, reservas }))
        .sort((a, b) => b.reservas - a.reservas),
    }
  }, [reservas])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Estadísticas</h1>
        <p className="text-sm text-neutral-500">
          Recaudación y ranking de canchas (reservas confirmadas).
        </p>
      </div>

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

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatBox
              label="Total recaudado"
              value={`$${stats.total.toLocaleString('es-AR')}`}
              accent="text-primary-600"
            />
            <StatBox
              label="MercadoPago"
              value={`$${stats.totalOnline.toLocaleString('es-AR')}`}
              accent="text-green-600"
            />
            <StatBox
              label="En el lugar"
              value={`$${stats.totalLocal.toLocaleString('es-AR')}`}
              accent="text-amber-600"
            />
          </div>

          <ChartCard title="Reservas por semana">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.porSemana}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="semana" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="reservas"
                  stroke="#2563EB"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

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

          <ChartCard title="Ranking de canchas">
            {stats.porCancha.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-500">
                Sin datos en este período.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stats.porCancha} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" fontSize={12} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="cancha"
                    fontSize={12}
                    width={100}
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

function StatBox({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  )
}

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
