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
import { TrendingUp, DollarSign, CreditCard, MapPin, CalendarDays } from 'lucide-react'

interface CanchaJoin {
  nombre: string
  tipo: string
  precio: number
}

export default function Estadisticas() {
  const { data: complejo } = useMiComplejo()

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
        totalReservas: 0,
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
      totalReservas: reservas.length,
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-neutral-900">Estadísticas</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Recaudación y actividad de tu complejo (reservas confirmadas).
        </p>
      </div>

      {/* Filtro de fechas */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-neutral-100 bg-neutral-50 px-5 py-3">
          <CalendarDays className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-semibold text-neutral-700">Período</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="desde" className="text-xs font-semibold text-neutral-600">Desde</Label>
            <Input
              id="desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="mt-1 rounded-lg"
            />
          </div>
          <div>
            <Label htmlFor="hasta" className="text-xs font-semibold text-neutral-600">Hasta</Label>
            <Input
              id="hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="mt-1 rounded-lg"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total recaudado"
              value={`$${stats.total.toLocaleString('es-AR')}`}
              icon={DollarSign}
              color="text-primary-600"
              bg="bg-primary-50"
              border="border-primary-200"
            />
            <StatCard
              label="Reservas confirmadas"
              value={stats.totalReservas}
              icon={TrendingUp}
              color="text-emerald-600"
              bg="bg-emerald-50"
              border="border-emerald-200"
            />
            <StatCard
              label="MercadoPago"
              value={`$${stats.totalOnline.toLocaleString('es-AR')}`}
              icon={CreditCard}
              color="text-blue-600"
              bg="bg-blue-50"
              border="border-blue-200"
            />
            <StatCard
              label="En el lugar"
              value={`$${stats.totalLocal.toLocaleString('es-AR')}`}
              icon={MapPin}
              color="text-amber-600"
              bg="bg-amber-50"
              border="border-amber-200"
            />
          </div>

          {/* Charts */}
          {stats.totalReservas === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center shadow-sm">
              <TrendingUp className="mx-auto h-8 w-8 text-neutral-300" />
              <p className="mt-2 text-sm font-medium text-neutral-500">
                Sin datos en este período.
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Probá ampliando el rango de fechas.
              </p>
            </div>
          ) : (
            <>
              <ChartCard title="Reservas por semana" icon={TrendingUp}>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={stats.porSemana}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="semana" fontSize={11} tick={{ fill: '#9ca3af' }} />
                    <YAxis fontSize={11} allowDecimals={false} tick={{ fill: '#9ca3af' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="reservas"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      dot={{ fill: '#3b82f6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Reservas por mes" icon={CalendarDays}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.porMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="mes" fontSize={11} tick={{ fill: '#9ca3af' }} />
                    <YAxis fontSize={11} allowDecimals={false} tick={{ fill: '#9ca3af' }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="reservas" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {stats.porCancha.length > 0 && (
                <ChartCard title="Ranking de canchas" icon={TrendingUp}>
                  <ResponsiveContainer width="100%" height={Math.max(200, stats.porCancha.length * 52)}>
                    <BarChart data={stats.porCancha} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis type="number" fontSize={11} allowDecimals={false} tick={{ fill: '#9ca3af' }} />
                      <YAxis
                        type="category"
                        dataKey="cancha"
                        fontSize={11}
                        width={110}
                        tick={{ fill: '#6b7280' }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="reservas" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  border,
}: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
}) {
  const isStr = typeof value === 'string'
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 shadow-sm`}>
      <div className={`inline-flex rounded-lg p-2 ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className={`mt-2 font-black ${isStr ? 'text-xl' : 'text-3xl'} text-neutral-900`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-neutral-500">{label}</p>
    </div>
  )
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <Icon className="h-4 w-4 text-neutral-400" />
        <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
