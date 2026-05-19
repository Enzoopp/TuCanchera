// ============================================================
// ADMIN / DASHBOARD.TSX  (ruta: /admin/dashboard)
// Vista principal del panel de administrador.
// Muestra un resumen del día actual:
//   - Contadores rápidos: reservas confirmadas, pendientes, bloqueos
//   - Accesos directos a Bloqueos y Estadísticas
//   - Lista de reservas de hoy agrupadas por cancha
// ============================================================

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
  CheckCircle2,   // ícono de tilde (reservas confirmadas)
  Clock,          // ícono de reloj (pendientes de pago)
  Ban,            // ícono de prohibido (bloqueos)
  CalendarX,      // ícono de calendario tachado (ir a Bloqueos)
  BarChart3,      // ícono de gráfico (ir a Estadísticas)
} from 'lucide-react'

export default function Dashboard() {
  // useMiComplejo: obtiene el complejo del admin autenticado
  const { data: complejo, isLoading: loadingCx } = useMiComplejo()

  // hoy: fecha de hoy en formato "YYYY-MM-DD" para filtrar las queries
  const hoy = formatearFechaISO(new Date())

  // ── Query 1: reservas del día ────────────────────────────────
  // Busca todas las reservas del complejo filtradas por la fecha de hoy
  const { data: reservas, isLoading: loadingR } = useQuery({
    queryKey: ['admin-dashboard-reservas', complejo?.id, hoy],
    queryFn: () => fetchReservasDelComplejo(complejo!.id, { fecha: hoy }),
    enabled: !!complejo,
  })

  // ── Query 2: canchas del complejo ────────────────────────────
  // Se usan para agrupar las reservas por cancha en la lista
  const { data: canchas } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  // ── Query 3: bloqueos de hoy ─────────────────────────────────
  // Hace un Promise.all para buscar bloqueos de TODAS las canchas en paralelo
  // y los aplana en un único array (arrs.flat())
  const { data: bloqueos } = useQuery({
    queryKey: ['admin-bloqueos-hoy', complejo?.id, hoy, canchas?.length],
    queryFn: async () => {
      if (!canchas) return []
      const arrs = await Promise.all(
        canchas.map((c) => fetchBloqueosByCancha(c.id, hoy))
      )
      return arrs.flat()  // convierte [[...], [...]] en [...]
    },
    enabled: !!canchas && canchas.length > 0,
  })

  // ── Pantalla de carga ────────────────────────────────────────
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

  // ── Calcular contadores ──────────────────────────────────────
  // Separar reservas por estado
  const confirmadas = reservas?.filter((r) => r.estado === 'confirmada') ?? []
  const pendientes = reservas?.filter((r) => r.estado === 'pendiente_pago') ?? []
  const bloqueadasCount = bloqueos?.length ?? 0

  // ── Agrupar reservas confirmadas por cancha ──────────────────
  // Map<cancha_id, reservas[]> para poder mostrarlas agrupadas
  const porCancha = new Map<string, typeof confirmadas>()
  for (const r of confirmadas) {
    const key = r.cancha_id
    if (!porCancha.has(key)) porCancha.set(key, [])
    porCancha.get(key)!.push(r)
  }

  return (
    <div className="space-y-6">
      {/* Título y subtítulo con la fecha de hoy */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500">
          Resumen del día {new Date().toLocaleDateString('es-AR')}
        </p>
      </div>

      {/* ── Contadores rápidos ── */}
      {/* Tres tarjetas: confirmadas (verde), pendientes (ámbar), bloqueos (gris) */}
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

      {/* ── Accesos rápidos ── */}
      {/* Botones de atajo para las acciones más comunes del admin */}
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

      {/* ── Reservas de hoy agrupadas por cancha ── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">
          Reservas de hoy
        </h2>
        {confirmadas.length === 0 && pendientes.length === 0 ? (
          // Estado vacío: no hay reservas para hoy
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
            No hay reservas para hoy.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Iterar por canchas — saltear las que no tienen reservas hoy */}
            {canchas?.map((c) => {
              const listCanchaConf = porCancha.get(c.id) ?? []
              const listCanchaPend = pendientes.filter(
                (r) => r.cancha_id === c.id
              )
              // Si esta cancha no tiene nada hoy, no renderizar su sección
              if (listCanchaConf.length === 0 && listCanchaPend.length === 0)
                return null
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4"
                >
                  {/* Encabezado de la cancha */}
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
                  {/* Lista de reservas de esta cancha ordenadas por hora */}
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
                            {/* Hora de inicio (slice 0,5 → "HH:MM") */}
                            <span className="font-medium text-neutral-900">
                              {r.hora_inicio.slice(0, 5)}
                            </span>
                            {/* Nombre del cliente (join desde profiles) */}
                            <span className="ml-2 text-neutral-500">
                              {r.profiles?.nombre ?? 'Cliente'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Método de pago abreviado: MP o Local */}
                            <span className="text-xs text-neutral-400">
                              {r.metodo_pago === 'mercadopago' ? 'MP' : 'Local'}
                            </span>
                            {/* Badge de estado: verde=confirmada, gris=pendiente */}
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

// ── StatCard ─────────────────────────────────────────────────
// Tarjeta de contador reutilizable.
// Muestra: label (texto pequeño arriba), número grande, ícono de color.
// Recibe 'icon' como componente de React (no instancia) para poder renderizarlo.
function StatCard({
  label,
  value,
  icon: Icon,  // renombramos como Icon (con mayúscula) para poder usarlo como JSX
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
          {/* Label pequeño en mayúsculas */}
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {label}
          </p>
          {/* Número grande del contador */}
          <p className="mt-1 text-3xl font-bold text-neutral-900">{value}</p>
        </div>
        {/* Ícono con color dinámico (verde, ámbar o gris) */}
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
    </div>
  )
}
