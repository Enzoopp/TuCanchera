// SRP: Vista general del día para el admin.
// Contadores rápidos, reservas del día agrupadas por cancha, accesos directos.

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchReservasDelComplejo } from '@/services/adminService'
import { fetchCanchasByComplejo, fetchBloqueosByCancha } from '@/services/complejoService'
import { formatearFechaISO } from '@/utils/fechas'
import { tipoCanchaLabels } from '@/utils/canchaLabels'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2,
  Clock,
  Ban,
  CalendarX,
  BarChart3,
  ArrowRight,
  DollarSign,
} from 'lucide-react'

export default function Dashboard() {
  const { data: complejo, isLoading: loadingCx } = useMiComplejo()
  const hoy = formatearFechaISO(new Date())

  const { data: reservas, isLoading: loadingR } = useQuery({
    queryKey: ['admin-dashboard-reservas', complejo?.id, hoy],
    queryFn: () => fetchReservasDelComplejo(complejo!.id, { fecha: hoy }),
    enabled: !!complejo,
  })

  const { data: canchas } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  const { data: bloqueos } = useQuery({
    queryKey: ['admin-bloqueos-hoy', complejo?.id, hoy, canchas?.length],
    queryFn: async () => {
      if (!canchas) return []
      const arrs = await Promise.all(
        canchas.map((c) => fetchBloqueosByCancha(c.id, hoy))
      )
      return arrs.flat()
    },
    enabled: !!canchas && canchas.length > 0,
  })

  if (loadingCx || loadingR) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  const confirmadas = reservas?.filter((r) => r.estado === 'confirmada') ?? []
  const pendientes = reservas?.filter((r) => r.estado === 'pendiente_pago') ?? []
  const bloqueadasCount = bloqueos?.length ?? 0

  // Ingresos del día (solo confirmadas)
  const ingresosDia = confirmadas.reduce((acc, r) => {
    return acc + (r.canchas?.precio ?? 0)
  }, 0)

  // Agrupar reservas confirmadas + pendientes por cancha
  const porCancha = new Map<string, typeof reservas>()
  for (const r of [...(confirmadas ?? []), ...(pendientes ?? [])]) {
    const key = r.cancha_id
    if (!porCancha.has(key)) porCancha.set(key, [])
    porCancha.get(key)!.push(r)
  }

  const fechaDisplay = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-neutral-500 capitalize">{fechaDisplay}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/bloqueos"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
          >
            <CalendarX className="h-4 w-4" />
            <span className="hidden sm:inline">Bloquear turno</span>
          </Link>
          <Link
            to="/admin/estadisticas"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Estadísticas</span>
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Confirmadas"
          value={confirmadas.length}
          icon={CheckCircle2}
          color="text-emerald-600"
          bg="bg-emerald-50"
          border="border-emerald-200"
        />
        <StatCard
          label="Pendientes"
          value={pendientes.length}
          icon={Clock}
          color="text-amber-600"
          bg="bg-amber-50"
          border="border-amber-200"
        />
        <StatCard
          label="Bloqueos"
          value={bloqueadasCount}
          icon={Ban}
          color="text-neutral-600"
          bg="bg-neutral-100"
          border="border-neutral-200"
        />
        <StatCard
          label="Ingresos hoy"
          value={`$${ingresosDia.toLocaleString('es-AR')}`}
          icon={DollarSign}
          color="text-primary-600"
          bg="bg-primary-50"
          border="border-primary-200"
          isString
        />
      </div>

      {/* Reservas del día */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Reservas de hoy</h2>
          <Link
            to="/admin/reservas"
            className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors"
          >
            Ver todas
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {confirmadas.length === 0 && pendientes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-neutral-500">No hay reservas para hoy.</p>
            <p className="mt-1 text-xs text-neutral-400">Las reservas aparecerán acá cuando los clientes reserven.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {canchas?.map((c) => {
              const lista = porCancha.get(c.id) ?? []
              if (lista.length === 0) return null
              return (
                <div
                  key={c.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
                >
                  {/* Cancha header */}
                  <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-bold text-neutral-900">{c.nombre}</h3>
                      <p className="text-xs text-neutral-500">{tipoCanchaLabels[c.tipo]}</p>
                    </div>
                    <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                      {lista.length} {lista.length === 1 ? 'turno' : 'turnos'}
                    </span>
                  </div>

                  {/* Reservas */}
                  <ul className="divide-y divide-neutral-100">
                    {lista
                      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
                      .map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-14 items-center justify-center rounded-lg bg-neutral-100 text-sm font-black text-neutral-900">
                              {r.hora_inicio.slice(0, 5)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-neutral-900">
                                {r.profiles?.nombre ?? 'Cliente'}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {r.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'Paga en el lugar'}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={r.estado === 'confirmada' ? 'default' : 'secondary'}
                            className="shrink-0"
                          >
                            {r.estado === 'confirmada' ? 'Confirmada' : 'Pendiente'}
                          </Badge>
                        </li>
                      ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </section>
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
  isString = false,
}: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  isString?: boolean
}) {
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 shadow-sm`}>
      <div className={`inline-flex rounded-lg p-2 ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className={`mt-2 ${isString ? 'text-xl' : 'text-3xl'} font-black text-neutral-900`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-neutral-500">{label}</p>
    </div>
  )
}
