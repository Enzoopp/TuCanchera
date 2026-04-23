// SRP: Vista general del día para el admin.
// Contadores rápidos, reservas del día agrupadas por cancha, accesos directos.
// Los turnos pasados se muestran diferenciados con opción de marcar asistencia.

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchReservasDelComplejo, registrarAsistencia } from '@/services/adminService'
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
  UserCheck,
  UserX,
} from 'lucide-react'

export default function Dashboard() {
  const { data: complejo, isLoading: loadingCx } = useMiComplejo()
  const queryClient = useQueryClient()
  const hoy = formatearFechaISO(new Date())

  // Tick de 1 minuto para re-evaluar qué turnos ya pasaron
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const { data: reservas, isLoading: loadingR } = useQuery({
    queryKey: ['admin-dashboard-reservas', complejo?.id, hoy],
    queryFn: () => fetchReservasDelComplejo(complejo!.id, { fecha: hoy }),
    enabled: !!complejo,
    refetchInterval: 60_000,
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

  function turnoPasado(fecha: string, horaFin: string): boolean {
    const fin = new Date(`${fecha}T${horaFin.slice(0, 5)}:00`)
    return fin < ahora
  }

  async function handleAsistencia(id: string, valor: boolean) {
    try {
      await registrarAsistencia(id, valor)
      // Invalida ambas caches para que Dashboard y Reservas queden sincronizados
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-reservas'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
      toast.success(valor ? 'Marcado como presente ✓' : 'Marcado como ausente')
    } catch {
      toast.error('Error al registrar asistencia')
    }
  }

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
  const ingresosDia = confirmadas.reduce((acc, r) => acc + (r.canchas?.precio ?? 0), 0)

  // Separar reservas en próximas vs finalizadas
  const activas = [...confirmadas, ...pendientes]

  // Agrupar por cancha
  function agruparPorCancha(lista: typeof activas) {
    const map = new Map<string, typeof activas>()
    for (const r of lista) {
      if (!map.has(r.cancha_id)) map.set(r.cancha_id, [])
      map.get(r.cancha_id)!.push(r)
    }
    return map
  }

  const proximas = activas.filter((r) => !turnoPasado(r.fecha, r.hora_fin))
  const finalizadas = activas.filter((r) => turnoPasado(r.fecha, r.hora_fin))

  const porCanchaProximas = agruparPorCancha(proximas)
  const porCanchaFinalizadas = agruparPorCancha(finalizadas)

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

      {/* Próximos turnos */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Próximos turnos</h2>
          <Link
            to="/admin/reservas"
            className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors"
          >
            Ver todas
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {proximas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-neutral-500">No hay turnos próximos para hoy.</p>
            <p className="mt-1 text-xs text-neutral-400">
              {finalizadas.length > 0
                ? 'Todos los turnos del día ya finalizaron.'
                : 'Las reservas aparecerán acá cuando los clientes reserven.'}
            </p>
          </div>
        ) : (
          <GruposCanchas
            canchas={canchas ?? []}
            porCancha={porCanchaProximas}
            turnoPasado={turnoPasado}
            onAsistencia={handleAsistencia}
          />
        )}
      </section>

      {/* Turnos finalizados (solo si hay) */}
      {finalizadas.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold text-neutral-900">
            Turnos finalizados
            <span className="ml-2 text-sm font-normal text-neutral-400">— registrá la asistencia</span>
          </h2>
          <GruposCanchas
            canchas={canchas ?? []}
            porCancha={porCanchaFinalizadas}
            turnoPasado={turnoPasado}
            onAsistencia={handleAsistencia}
            pasados
          />
        </section>
      )}
    </div>
  )
}

// ─── Sub-componente: lista de canchas con sus reservas ────────────────────────

import type { ReservaAdmin } from '@/services/adminService'
import type { Cancha } from '@/types'

function GruposCanchas({
  canchas,
  porCancha,
  turnoPasado,
  onAsistencia,
  pasados = false,
}: {
  canchas: Cancha[]
  porCancha: Map<string, ReservaAdmin[]>
  turnoPasado: (fecha: string, horaFin: string) => boolean
  onAsistencia: (id: string, valor: boolean) => void
  pasados?: boolean
}) {
  return (
    <div className="space-y-3">
      {canchas.map((c) => {
        const lista = (porCancha.get(c.id) ?? []).sort((a, b) =>
          a.hora_inicio.localeCompare(b.hora_inicio)
        )
        if (lista.length === 0) return null

        return (
          <div
            key={c.id}
            className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
              pasados ? 'border-neutral-200 opacity-90' : 'border-neutral-200'
            }`}
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

            <ul className="divide-y divide-neutral-100">
              {lista.map((r) => {
                const esEnLugar = r.metodo_pago === 'en_lugar'
                const pasado = turnoPasado(r.fecha, r.hora_fin)
                const necesitaAsistencia = esEnLugar && pasado && r.estado === 'confirmada' && r.asistio === null

                return (
                  <li
                    key={r.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${
                      pasado ? 'bg-neutral-50/60' : ''
                    }`}
                  >
                    {/* Hora */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-14 shrink-0 items-center justify-center rounded-lg text-sm font-black ${
                          pasado
                            ? 'bg-neutral-200 text-neutral-500'
                            : 'bg-neutral-100 text-neutral-900'
                        }`}
                      >
                        {r.hora_inicio.slice(0, 5)}
                      </div>
                      <div className="min-w-0">
                        <p className={`truncate text-sm font-medium ${pasado ? 'text-neutral-500' : 'text-neutral-900'}`}>
                          {r.profiles?.nombre ?? 'Cliente'}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {r.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'Paga en el lugar'}
                          {' · '}
                          {r.hora_inicio.slice(0, 5)}–{r.hora_fin.slice(0, 5)}
                        </p>
                      </div>
                    </div>

                    {/* Derecha: asistencia o badge de estado */}
                    <div className="flex shrink-0 items-center gap-2">
                      {necesitaAsistencia ? (
                        <>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                            ¿Vino?
                          </span>
                          <button
                            type="button"
                            onClick={() => onAsistencia(r.id, true)}
                            title="Sí vino"
                            className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => onAsistencia(r.id, false)}
                            title="No se presentó"
                            className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                          >
                            <UserX className="h-3.5 w-3.5" />
                            No
                          </button>
                        </>
                      ) : r.asistio !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            r.asistio
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {r.asistio ? (
                            <><UserCheck className="h-3 w-3" /> Asistió</>
                          ) : (
                            <><UserX className="h-3 w-3" /> No asistió</>
                          )}
                        </span>
                      ) : (
                        <Badge
                          variant={r.estado === 'confirmada' ? 'default' : 'secondary'}
                          className="shrink-0"
                        >
                          {r.estado === 'confirmada' ? 'Confirmada' : 'Pendiente'}
                        </Badge>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

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
      <p className={`mt-3 ${isString ? 'text-xl' : 'text-3xl'} font-black text-neutral-900`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
    </div>
  )
}
