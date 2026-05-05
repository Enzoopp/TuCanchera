// ============================================================
// MISRESERVAS.TSX  (ruta: /mis-reservas)
// Página exclusiva para clientes autenticados.
// Lista todas las reservas del usuario logueado, ordenadas
// y con información del complejo, cancha, fecha, hora y estado.
// ============================================================

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { fetchMisReservas } from '@/services/reservaService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'       // Etiqueta de color para el estado
import { Skeleton } from '@/components/ui/skeleton' // Placeholder mientras carga
import { tipoCanchaLabels } from '@/utils/canchaLabels'
import { ArrowLeft, Calendar, Clock, MapPin, LogOut } from 'lucide-react'
import type { TipoCancha, EstadoReserva } from '@/types'

// Mapa de estados → etiqueta en español y color del Badge
// 'default' = verde, 'secondary' = gris, 'destructive' = rojo
const estadoLabels: Record<EstadoReserva, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  confirmada:       { label: 'Confirmada',         variant: 'default' },
  pendiente_pago:   { label: 'Pendiente de pago',  variant: 'secondary' },
  cancelada_admin:  { label: 'Cancelada',           variant: 'destructive' },
}

export default function MisReservas() {
  // Del AuthContext: el perfil del usuario para usar su id como filtro
  const { profile, signOut } = useAuth()

  // useQuery: busca reservas del usuario en Supabase
  // La query solo corre cuando 'profile' ya cargó (enabled: !!profile)
  const { data: reservas, isLoading } = useQuery({
    queryKey: ['mis-reservas', profile?.id],
    queryFn: () => fetchMisReservas(profile!.id),
    enabled: !!profile,  // no buscar si el perfil todavía no cargó
  })

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* ── Header ── */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Link para volver al listado de complejos */}
            <Link to="/explorar" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
              <ArrowLeft className="h-4 w-4" /> Explorar complejos
            </Link>
            {/* Botón cerrar sesión */}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 h-4 w-4" /> Salir
            </Button>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900">Mis reservas</h1>
          <p className="text-sm text-neutral-500">Historial y próximas reservas en complejos.</p>
        </div>
      </header>

      {/* ── Lista de reservas ── */}
      <div className="mx-auto max-w-3xl px-4 py-6">

        {/* Estado cargando: 3 skeletons */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>

        ) : !reservas || reservas.length === 0 ? (
          // Estado vacío: el usuario no tiene reservas aún
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
            <p className="text-neutral-600">Todavía no tenés reservas.</p>
            <p className="mt-1 text-sm text-neutral-400">
              Elegí un complejo y reservá tu primer turno.
            </p>
          </div>

        ) : (
          // Lista de reservas — una por card
          <ul className="space-y-3">
            {reservas.map((r) => {
              const estadoInfo = estadoLabels[r.estado]
              const complejo = r.canchas?.complejos  // datos del complejo (join anidado)

              return (
                <li
                  key={r.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  {/* Fila superior: nombre de cancha + badge de estado */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-neutral-900">
                        {r.canchas?.nombre ?? 'Cancha'}
                      </h2>
                      {/* Tipo de cancha (fútbol 5, pádel, etc.) */}
                      {r.canchas?.tipo && (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {tipoCanchaLabels[r.canchas.tipo as TipoCancha]}
                        </p>
                      )}
                    </div>
                    {/* Badge coloreado según el estado de la reserva */}
                    <Badge variant={estadoInfo.variant}>{estadoInfo.label}</Badge>
                  </div>

                  {/* Fila de datos: fecha, hora, complejo */}
                  <div className="mt-3 grid grid-cols-1 gap-1.5 text-sm text-neutral-700 sm:grid-cols-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-neutral-400" />
                      <span>{r.fecha}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-neutral-400" />
                      {/* hora_inicio y hora_fin vienen como "HH:MM:SS" — slice(0,5) muestra solo "HH:MM" */}
                      <span>{r.hora_inicio.slice(0, 5)} — {r.hora_fin.slice(0, 5)}</span>
                    </div>
                    {/* Link al complejo — solo si el join trajo los datos */}
                    {complejo && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-neutral-400" />
                        <Link to={`/${complejo.slug}`} className="text-primary-600 hover:underline">
                          {complejo.nombre}
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Método de pago */}
                  <p className="mt-2 text-xs text-neutral-500">
                    Pago:{' '}
                    {r.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'En el lugar'}
                  </p>
                </li>
              )
            })}
          </ul>
        )}

        {/* Botón para volver a buscar complejos */}
        <div className="mt-8 text-center">
          <Link to="/">
            <Button variant="outline">Buscar otro complejo</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
