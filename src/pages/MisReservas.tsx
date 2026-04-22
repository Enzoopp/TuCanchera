// SRP: Lista las reservas del cliente autenticado.
// Agrupa por estado y fecha. Usa fetchMisReservas (con joins anidados a canchas y complejos).

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { fetchMisReservas } from '@/services/reservaService'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { tipoCanchaLabels } from '@/utils/canchaLabels'
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  LogOut,
  Zap,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import type { TipoCancha, EstadoReserva } from '@/types'

const estadoConfig: Record<
  EstadoReserva,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ComponentType<{ className?: string }>
    bg: string
    border: string
    iconColor: string
  }
> = {
  confirmada: {
    label: 'Confirmada',
    variant: 'default',
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-500',
  },
  pendiente_pago: {
    label: 'Pendiente de pago',
    variant: 'secondary',
    icon: AlertCircle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-500',
  },
  cancelada_admin: {
    label: 'Cancelada',
    variant: 'destructive',
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-400',
  },
}

export default function MisReservas() {
  const { profile, signOut } = useAuth()

  const { data: reservas, isLoading } = useQuery({
    queryKey: ['mis-reservas', profile?.id],
    queryFn: () => fetchMisReservas(profile!.id),
    enabled: !!profile,
  })

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white shadow-sm">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/explorar"
              className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Explorar
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-neutral-900 text-sm">TuCanchera</span>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-neutral-900">Mis reservas</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Tu historial y próximas reservas.
          </p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : !reservas || reservas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
              <CalendarDays className="h-7 w-7 text-neutral-400" />
            </div>
            <h3 className="font-bold text-neutral-900">Todavía no tenés reservas</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Elegí un complejo y reservá tu primer turno.
            </p>
            <Link
              to="/explorar"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-500 transition-colors"
            >
              Ver complejos
              <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {reservas.map((r) => {
              const cfg = estadoConfig[r.estado]
              const StatusIcon = cfg.icon
              const complejo = r.canchas?.complejos
              return (
                <li
                  key={r.id}
                  className={`overflow-hidden rounded-2xl border ${cfg.border} bg-white shadow-sm transition-shadow hover:shadow-md`}
                >
                  {/* Status bar */}
                  <div className={`flex items-center gap-2 ${cfg.bg} px-4 py-2.5 border-b ${cfg.border}`}>
                    <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.iconColor}`} />
                    <span className={`text-xs font-semibold ${cfg.iconColor}`}>
                      {cfg.label}
                    </span>
                    {r.metodo_pago && (
                      <span className="ml-auto text-xs text-neutral-500">
                        {r.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'Paga en el lugar'}
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-neutral-900">
                          {r.canchas?.nombre ?? 'Cancha'}
                        </h2>
                        {r.canchas?.tipo && (
                          <Badge variant="secondary" className="mt-1 text-[10px]">
                            {tipoCanchaLabels[r.canchas.tipo as TipoCancha]}
                          </Badge>
                        )}
                      </div>
                      {complejo && (
                        <Link
                          to={`/${complejo.slug}`}
                          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-500 transition-colors"
                        >
                          <MapPin className="h-3 w-3 shrink-0" />
                          {complejo.nombre}
                        </Link>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-neutral-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-neutral-400" />
                        <span className="font-medium">{r.fecha}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-neutral-400" />
                        <span className="font-medium">
                          {r.hora_inicio.slice(0, 5)} — {r.hora_fin.slice(0, 5)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/explorar"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Buscar otro complejo
          </Link>
        </div>
      </div>
    </div>
  )
}
