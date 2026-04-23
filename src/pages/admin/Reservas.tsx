// SRP: Historial completo de reservas del complejo del admin, con filtros.
// Usa AdminActionModal para cancelar reservas en lugar de confirm() nativo.

import { useMemo, useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchCanchasByComplejo } from '@/services/complejoService'
import {
  fetchReservasDelComplejo,
  cancelarReservaAdmin,
} from '@/services/adminService'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Phone, Mail, SlidersHorizontal, X, UserCheck, UserX } from 'lucide-react'
import AdminActionModal from '@/components/AdminActionModal'
import { registrarAsistencia } from '@/services/adminService'

export default function Reservas() {
  const { data: complejo } = useMiComplejo()
  const queryClient = useQueryClient()

  const [filtros, setFiltros] = useState({
    canchaId: '',
    fecha: '',
    estado: '',
    metodoPago: '',
  })

  // Tick que se actualiza cada minuto para re-evaluar qué turnos ya pasaron
  // sin necesidad de recargar la página.
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Modal de cancelación
  const [modalCancelar, setModalCancelar] = useState<{
    id: string
    cliente: string
    cancha: string
    fecha: string
    horaInicio: string
    horaFin: string
    loading: boolean
  } | null>(null)

  // Devuelve true si la hora_fin de la reserva ya pasó.
  // Usa `ahora` (state con tick de 1 min) para que React re-evalue automáticamente
  // cuando un turno termina, sin necesidad de recargar la página.
  function turnoPasado(fecha: string, horaFin: string): boolean {
    const fin = new Date(`${fecha}T${horaFin.slice(0, 5)}:00`)
    return fin < ahora
  }

  async function handleAsistencia(id: string, valor: boolean) {
    try {
      await registrarAsistencia(id, valor)
      // Invalida todas las queries que empiezan con 'admin-' para sincronizar
      // el dashboard y la vista de reservas al mismo tiempo.
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-reservas'] })
      toast.success(valor ? 'Marcado como presente ✓' : 'Marcado como ausente')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar asistencia')
    }
  }

  const { data: canchas } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  const filtrosQ = useMemo(
    () => ({
      canchaId: filtros.canchaId || undefined,
      fecha: filtros.fecha || undefined,
      estado: filtros.estado || undefined,
      metodoPago: filtros.metodoPago || undefined,
    }),
    [filtros]
  )

  const hayFiltrosActivos = Object.values(filtros).some(Boolean)

  const { data: reservas, isLoading } = useQuery({
    queryKey: ['admin-reservas', complejo?.id, filtrosQ],
    queryFn: () => fetchReservasDelComplejo(complejo!.id, filtrosQ),
    enabled: !!complejo,
    refetchInterval: 60_000, // sincronizar con el tick de ahora — datos frescos cada minuto
  })

  function abrirModalCancelar(r: {
    id: string
    profiles?: { nombre?: string } | null
    canchas?: { nombre?: string } | null
    fecha: string
    hora_inicio: string
    hora_fin: string
  }) {
    setModalCancelar({
      id: r.id,
      cliente: r.profiles?.nombre ?? 'Cliente',
      cancha: r.canchas?.nombre ?? 'Cancha',
      fecha: r.fecha,
      horaInicio: r.hora_inicio.slice(0, 5),
      horaFin: r.hora_fin.slice(0, 5),
      loading: false,
    })
  }

  async function confirmarCancelacion() {
    if (!modalCancelar) return
    setModalCancelar((m) => m ? { ...m, loading: true } : null)
    try {
      await cancelarReservaAdmin(modalCancelar.id)
      toast.success('Reserva cancelada')
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
      setModalCancelar(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cancelar')
      setModalCancelar((m) => m ? { ...m, loading: false } : null)
    }
  }

  const selectClass =
    'mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-neutral-900">Reservas</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Historial completo con filtros.
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </div>
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={() =>
                setFiltros({ canchaId: '', fecha: '', estado: '', metodoPago: '' })
              }
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="f-cancha" className="text-xs">Cancha</Label>
            <select
              id="f-cancha"
              value={filtros.canchaId}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, canchaId: e.target.value }))
              }
              className={selectClass}
            >
              <option value="">Todas</option>
              {canchas?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="f-fecha" className="text-xs">Fecha</Label>
            <Input
              id="f-fecha"
              type="date"
              value={filtros.fecha}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, fecha: e.target.value }))
              }
              className="mt-1 rounded-lg"
            />
          </div>
          <div>
            <Label htmlFor="f-estado" className="text-xs">Estado</Label>
            <select
              id="f-estado"
              value={filtros.estado}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, estado: e.target.value }))
              }
              className={selectClass}
            >
              <option value="">Todos</option>
              <option value="confirmada">Confirmada</option>
              <option value="pendiente_pago">Pendiente</option>
              <option value="cancelada_admin">Cancelada</option>
            </select>
          </div>
          <div>
            <Label htmlFor="f-pago" className="text-xs">Método de pago</Label>
            <select
              id="f-pago"
              value={filtros.metodoPago}
              onChange={(e) =>
                setFiltros((f) => ({ ...f, metodoPago: e.target.value }))
              }
              className={selectClass}
            >
              <option value="">Todos</option>
              <option value="mercadopago">MercadoPago</option>
              <option value="en_lugar">En el lugar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : !reservas || reservas.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-neutral-500">Sin reservas con estos filtros.</p>
            <p className="mt-1 text-xs text-neutral-400">Probá cambiando o limpiando los filtros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Cancha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Fecha
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Pago
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Estado
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {reservas.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-neutral-900">
                        {r.profiles?.nombre ?? '—'}
                      </p>
                      <div className="mt-0.5 flex flex-col gap-0.5">
                        {r.profiles?.telefono && (
                          <a
                            href={`https://wa.me/${r.profiles.telefono.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            {r.profiles.telefono}
                          </a>
                        )}
                        {r.profiles?.email && (
                          <a
                            href={`mailto:${r.profiles.email}`}
                            className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700"
                          >
                            <Mail className="h-3 w-3" />
                            {r.profiles.email}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-neutral-800">
                        {r.canchas?.nombre ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{r.fecha}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-800">
                        {r.hora_inicio.slice(0, 5)}–{r.hora_fin.slice(0, 5)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {r.metodo_pago === 'mercadopago' ? (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          MercadoPago
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                          En el lugar
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          r.estado === 'confirmada'
                            ? 'default'
                            : r.estado === 'pendiente_pago'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {r.estado === 'confirmada'
                          ? 'Confirmada'
                          : r.estado === 'pendiente_pago'
                            ? 'Pendiente'
                            : 'Cancelada'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Asistencia: solo para "en_lugar" + confirmada + turno pasado */}
                        {r.metodo_pago === 'en_lugar' &&
                          r.estado === 'confirmada' &&
                          turnoPasado(r.fecha, r.hora_fin) && (
                            r.asistio === null ? (
                              <div className="flex items-center gap-1">
                                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                                  ¿Vino?
                                </span>
                                <button
                                  type="button"
                                  title="Sí vino — marcar como pagado"
                                  onClick={() => handleAsistencia(r.id, true)}
                                  className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                  Sí
                                </button>
                                <button
                                  type="button"
                                  title="No se presentó"
                                  onClick={() => handleAsistencia(r.id, false)}
                                  className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                  No
                                </button>
                              </div>
                            ) : (
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
                            )
                        )}

                        {/* Cancelar: solo si no está cancelada Y no se marcó asistencia */}
                        {r.estado !== 'cancelada_admin' && r.asistio === null && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirModalCancelar(r)}
                            className="text-xs text-neutral-500 hover:text-red-600"
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer con count */}
        {reservas && reservas.length > 0 && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-2.5 text-xs text-neutral-500">
            {reservas.length} reserva{reservas.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Modal de cancelación */}
      {modalCancelar && (
        <AdminActionModal
          variant="cancelar"
          slot={{
            cliente: modalCancelar.cliente,
            cancha: modalCancelar.cancha,
            fecha: modalCancelar.fecha,
            horaInicio: modalCancelar.horaInicio,
            horaFin: modalCancelar.horaFin,
          }}
          loading={modalCancelar.loading}
          onConfirm={confirmarCancelacion}
          onClose={() => setModalCancelar(null)}
        />
      )}
    </div>
  )
}
