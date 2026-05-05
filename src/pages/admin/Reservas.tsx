// ============================================================
// ADMIN / RESERVAS.TSX  (ruta: /admin/reservas)
// Historial completo de reservas del complejo.
// El admin puede filtrar por: cancha, fecha, estado y método de pago.
// También puede cancelar reservas individuales desde esta vista.
// ============================================================

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'  // notificaciones visuales (toast de éxito/error)
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

  // ── Estado de los filtros ────────────────────────────────────
  // Un solo objeto 'filtros' para manejar los 4 filtros juntos
  const [filtros, setFiltros] = useState({
    canchaId: '',    // '' = todas las canchas
    fecha: '',       // '' = cualquier fecha
    estado: '',      // '' = todos los estados
    metodoPago: '',  // '' = todos los métodos
  })

  // ── Query: canchas del complejo ──────────────────────────────
  // Para poblar el select de "Cancha" en los filtros
  const { data: canchas } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  // ── Preparar filtros para la query ───────────────────────────
  // useMemo: convierte los strings vacíos a undefined para que el
  // servicio no incluya esos filtros en la consulta a Supabase
  const filtrosQ = useMemo(
    () => ({
      canchaId:   filtros.canchaId   || undefined,
      fecha:      filtros.fecha      || undefined,
      estado:     filtros.estado     || undefined,
      metodoPago: filtros.metodoPago || undefined,
    }),
    [filtros]
  )

  // ── Query: reservas filtradas ────────────────────────────────
  // Reacadena automáticamente cada vez que cambia 'filtrosQ'
  // porque está en el queryKey
  const { data: reservas, isLoading } = useQuery({
    queryKey: ['admin-reservas', complejo?.id, filtrosQ],
    queryFn: () => fetchReservasDelComplejo(complejo!.id, filtrosQ),
    enabled: !!complejo,
  })

  // ── Cancelar una reserva ─────────────────────────────────────
  async function cancelar(id: string) {
    // Confirmación antes de cancelar (window.confirm nativo del browser)
    if (!confirm('¿Cancelar esta reserva?')) return
    try {
      await cancelarReservaAdmin(id)
      toast.success('Reserva cancelada')
      // Invalidar la cache para que la tabla se refresque
      await queryClient.invalidateQueries({ queryKey: ['admin-reservas'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Historial de reservas</h1>
        <p className="text-sm text-neutral-500">
          Todas las reservas del complejo con filtros.
        </p>
      </div>

      {/* ── Panel de filtros ── */}
      {/* Grid de 4 columnas en desktop, 1 en mobile */}
      <div className="grid gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-4">

        {/* Filtro por cancha — select con opciones dinámicas */}
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
            {/* Una opción por cada cancha del complejo */}
            {canchas?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por fecha — input type="date" nativo */}
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

        {/* Filtro por estado */}
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

        {/* Filtro por método de pago */}
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

      {/* ── Tabla de reservas ── */}
      {/* overflow-x-auto permite scroll horizontal en mobile si la tabla es ancha */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        {isLoading ? (
          <div className="p-4">
            <Skeleton className="h-40" />
          </div>
        ) : !reservas || reservas.length === 0 ? (
          // Estado vacío con los filtros aplicados
          <p className="p-10 text-center text-sm text-neutral-500">
            Sin reservas con estos filtros.
          </p>
        ) : (
          // Tabla HTML con encabezados y filas
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Cancha</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Hora</th>
                <th className="px-3 py-2 text-left">Pago</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2" />   {/* columna para el botón Cancelar */}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {reservas.map((r) => (
                <tr key={r.id}>
                  {/* Columna cliente: nombre + teléfono (link a WhatsApp) + email */}
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.profiles?.nombre ?? '—'}</div>
                    {/* Si tiene teléfono: link directo a WhatsApp */}
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
                    {/* Si tiene email: link mailto */}
                    {r.profiles?.email && (
                      <a
                        href={`mailto:${r.profiles.email}`}
                        className="block text-xs text-neutral-500 hover:underline"
                      >
                        ✉️ {r.profiles.email}
                      </a>
                    )}
                  </td>
                  {/* Nombre de la cancha (join desde canchas) */}
                  <td className="px-3 py-2">{r.canchas?.nombre ?? '—'}</td>
                  {/* Fecha en formato YYYY-MM-DD */}
                  <td className="px-3 py-2">{r.fecha}</td>
                  {/* Hora: slice(0,5) para mostrar solo "HH:MM" */}
                  <td className="px-3 py-2">
                    {r.hora_inicio.slice(0, 5)}—{r.hora_fin.slice(0, 5)}
                  </td>
                  {/* Método de pago abreviado */}
                  <td className="px-3 py-2">
                    {r.metodo_pago === 'mercadopago' ? 'MP' : 'En lugar'}
                  </td>
                  {/* Estado con Badge colorado:
                      - 'default' (verde) = confirmada
                      - 'secondary' (gris) = pendiente
                      - 'destructive' (rojo) = cancelada */}
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
                  {/* Botón Cancelar — no aparece si ya está cancelada */}
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
