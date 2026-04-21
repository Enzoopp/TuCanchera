// SRP: Historial completo de reservas del complejo del admin, con filtros.

import { useMemo, useState } from 'react'
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

export default function Reservas() {
  const { data: complejo } = useMiComplejo()
  const queryClient = useQueryClient()

  const [filtros, setFiltros] = useState({
    canchaId: '',
    fecha: '',
    estado: '',
    metodoPago: '',
  })

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

  const { data: reservas, isLoading } = useQuery({
    queryKey: ['admin-reservas', complejo?.id, filtrosQ],
    queryFn: () => fetchReservasDelComplejo(complejo!.id, filtrosQ),
    enabled: !!complejo,
  })

  async function cancelar(id: string) {
    if (!confirm('¿Cancelar esta reserva?')) return
    try {
      await cancelarReservaAdmin(id)
      toast.success('Reserva cancelada')
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Historial de reservas</h1>
        <p className="text-sm text-neutral-500">
          Todas las reservas del complejo con filtros.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-4">
        <div>
          <Label htmlFor="f-cancha">Cancha</Label>
          <select
            id="f-cancha"
            value={filtros.canchaId}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, canchaId: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
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
          <Label htmlFor="f-fecha">Fecha</Label>
          <Input
            id="f-fecha"
            type="date"
            value={filtros.fecha}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, fecha: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="f-estado">Estado</Label>
          <select
            id="f-estado"
            value={filtros.estado}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, estado: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="confirmada">Confirmada</option>
            <option value="pendiente_pago">Pendiente</option>
            <option value="cancelada_admin">Cancelada</option>
          </select>
        </div>
        <div>
          <Label htmlFor="f-pago">Método de pago</Label>
          <select
            id="f-pago"
            value={filtros.metodoPago}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, metodoPago: e.target.value }))
            }
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="mercadopago">MercadoPago</option>
            <option value="en_lugar">En el lugar</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-40" />
          </div>
        ) : !reservas || reservas.length === 0 ? (
          <p className="p-10 text-center text-sm text-neutral-500">
            Sin reservas con estos filtros.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Cancha</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Hora</th>
                <th className="px-3 py-2 text-left">Pago</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {reservas.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.profiles?.nombre ?? '—'}</div>
                    {r.profiles?.telefono && (
                      <a
                        href={`https://wa.me/${r.profiles.telefono.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-600 hover:underline"
                      >
                        📱 {r.profiles.telefono}
                      </a>
                    )}
                    {r.profiles?.email && (
                      <a
                        href={`mailto:${r.profiles.email}`}
                        className="block text-xs text-neutral-500 hover:underline"
                      >
                        ✉️ {r.profiles.email}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.canchas?.nombre ?? '—'}</td>
                  <td className="px-3 py-2">{r.fecha}</td>
                  <td className="px-3 py-2">
                    {r.hora_inicio.slice(0, 5)}—{r.hora_fin.slice(0, 5)}
                  </td>
                  <td className="px-3 py-2">
                    {r.metodo_pago === 'mercadopago' ? 'MP' : 'En lugar'}
                  </td>
                  <td className="px-3 py-2">
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
                  <td className="px-3 py-2 text-right">
                    {r.estado !== 'cancelada_admin' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelar(r.id)}
                      >
                        Cancelar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
