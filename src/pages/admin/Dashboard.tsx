// SRP: Vista general del día para el admin.
// - Reservas del día agrupadas por cancha
// - Contadores rápidos (confirmadas / pendientes / bloqueadas)
// - Accesos directos

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchReservasDelComplejo } from '@/services/adminService'
import { fetchCanchasByComplejo, fetchBloqueosByCancha } from '@/services/complejoService'
import { formatearFechaISO } from '@/utils/fechas'
import { tipoCanchaLabels } from '@/utils/canchaLabels'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2,
  Clock,
  Ban,
  CalendarX,
  BarChart3,
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
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const confirmadas = reservas?.filter((r) => r.estado === 'confirmada') ?? []
  const pendientes = reservas?.filter((r) => r.estado === 'pendiente_pago') ?? []
  const bloqueadasCount = bloqueos?.length ?? 0

  // Agrupar reservas confirmadas por cancha
  const porCancha = new Map<string, typeof confirmadas>()
  for (const r of confirmadas) {
    const key = r.cancha_id
    if (!porCancha.has(key)) porCancha.set(key, [])
    porCancha.get(key)!.push(r)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500">
          Resumen del día {new Date().toLocaleDateString('es-AR')}
        </p>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Confirmadas"
          value={confirmadas.length}
          icon={CheckCircle2}
          color="text-green-600"
        />
        <StatCard
          label="Pendientes de pago"
          value={pendientes.length}
          icon={Clock}
          color="text-amber-600"
        />
        <StatCard
          label="Bloqueos hoy"
          value={bloqueadasCount}
          icon={Ban}
          color="text-neutral-600"
        />
      </div>

      {/* Accesos rápidos */}
      <div className="flex flex-wrap gap-2">
        <Link to="/admin/bloqueos">
          <Button variant="outline" size="sm">
            <CalendarX className="mr-2 h-4 w-4" /> Bloquear turno
          </Button>
        </Link>
        <Link to="/admin/estadisticas">
          <Button variant="outline" size="sm">
            <BarChart3 className="mr-2 h-4 w-4" /> Ver estadísticas
          </Button>
        </Link>
      </div>

      {/* Reservas del día por cancha */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">
          Reservas de hoy
        </h2>
        {confirmadas.length === 0 && pendientes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            No hay reservas para hoy.
          </div>
        ) : (
          <div className="space-y-4">
            {canchas?.map((c) => {
              const listCanchaConf = porCancha.get(c.id) ?? []
              const listCanchaPend = pendientes.filter(
                (r) => r.cancha_id === c.id
              )
              if (listCanchaConf.length === 0 && listCanchaPend.length === 0)
                return null
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-neutral-900">
                        {c.nombre}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        {tipoCanchaLabels[c.tipo]}
                      </p>
                    </div>
                  </div>
                  <ul className="divide-y divide-neutral-100">
                    {[...listCanchaConf, ...listCanchaPend]
                      .sort((a, b) =>
                        a.hora_inicio.localeCompare(b.hora_inicio)
                      )
                      .map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium text-neutral-900">
                              {r.hora_inicio.slice(0, 5)}
                            </span>
                            <span className="ml-2 text-neutral-500">
                              {r.profiles?.nombre ?? 'Cliente'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-400">
                              {r.metodo_pago === 'mercadopago' ? 'MP' : 'Local'}
                            </span>
                            <Badge
                              variant={
                                r.estado === 'confirmada'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {r.estado === 'confirmada'
                                ? 'Confirmada'
                                : 'Pendiente'}
                            </Badge>
                          </div>
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
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {label}
          </p>
          <p className="mt-1 text-3xl font-bold text-neutral-900">{value}</p>
        </div>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
    </div>
  )
}
