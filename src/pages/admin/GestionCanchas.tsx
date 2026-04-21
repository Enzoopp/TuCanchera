// SRP: CRUD de canchas + horarios semanales.
// - Lista canchas con toggle activa/inactiva y edición inline de nombre/precio
// - Formulario para crear nueva cancha con horarios por día

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import {
  fetchCanchasByComplejo,
  fetchHorariosByCancha,
} from '@/services/complejoService'
import {
  crearCancha,
  updateCancha,
  deleteCancha,
  replaceHorarios,
} from '@/services/adminService'
import { tipoCanchaLabels } from '@/utils/canchaLabels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Cancha, HorarioCancha, TipoCancha } from '@/types'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function GestionCanchas() {
  const queryClient = useQueryClient()
  const { data: complejo } = useMiComplejo()

  const { data: canchas, isLoading } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  const [mostrarNueva, setMostrarNueva] = useState(false)

  async function invalidar() {
    await queryClient.invalidateQueries({ queryKey: ['admin-canchas-todas'] })
  }

  async function toggleActiva(c: Cancha) {
    try {
      await updateCancha(c.id, { activa: !c.activa })
      await invalidar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  async function eliminar(c: Cancha) {
    if (!confirm(`¿Eliminar la cancha "${c.nombre}"? Esto también borra su historial.`)) return
    try {
      await deleteCancha(c.id)
      toast.success('Cancha eliminada')
      await invalidar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Canchas</h1>
          <p className="text-sm text-neutral-500">
            Tipo, precio, duración y horarios de cada cancha.
          </p>
        </div>
        <Button onClick={() => setMostrarNueva((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva cancha
        </Button>
      </div>

      {mostrarNueva && complejo && (
        <NuevaCanchaForm
          complejoId={complejo.id}
          onClose={() => setMostrarNueva(false)}
          onCreated={invalidar}
        />
      )}

      {!canchas || canchas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          Todavía no tenés canchas cargadas.
        </div>
      ) : (
        <ul className="space-y-3">
          {canchas.map((c) => (
            <CanchaCard
              key={c.id}
              cancha={c}
              onToggle={() => toggleActiva(c)}
              onDelete={() => eliminar(c)}
              onInvalidate={invalidar}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function CanchaCard({
  cancha,
  onToggle,
  onDelete,
  onInvalidate,
}: {
  cancha: Cancha
  onToggle: () => void
  onDelete: () => void
  onInvalidate: () => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [nombre, setNombre] = useState(cancha.nombre)
  const [precio, setPrecio] = useState(String(cancha.precio))
  const [dirty, setDirty] = useState(false)

  async function guardar() {
    try {
      await updateCancha(cancha.id, {
        nombre,
        precio: Number(precio),
      })
      toast.success('Cancha actualizada')
      setDirty(false)
      await onInvalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <li className="rounded-xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <Badge variant="secondary">{tipoCanchaLabels[cancha.tipo]}</Badge>
        <Input
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setDirty(true)
          }}
          className="max-w-xs"
        />
        <div className="flex items-center gap-1">
          <span className="text-sm text-neutral-500">$</span>
          <Input
            type="number"
            value={precio}
            onChange={(e) => {
              setPrecio(e.target.value)
              setDirty(true)
            }}
            className="w-28"
          />
        </div>
        <span className="text-xs text-neutral-500">
          {cancha.duracion_min} min
        </span>

        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cancha.activa}
            onChange={onToggle}
            className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span>Activa</span>
        </label>

        {dirty && (
          <Button size="sm" onClick={guardar}>
            Guardar
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      {expanded && <HorariosEditor canchaId={cancha.id} />}
    </li>
  )
}

function HorariosEditor({ canchaId }: { canchaId: string }) {
  const { data: iniciales, isLoading } = useQuery({
    queryKey: ['horarios', canchaId],
    queryFn: () => fetchHorariosByCancha(canchaId),
  })

  // Estado local: un Map<diaSemana, {inicio, fin, habilitado}>
  const [horarios, setHorariosState] = useState<
    Record<number, { inicio: string; fin: string; habilitado: boolean }>
  >({})

  useEffect(() => {
    if (!iniciales) return
    const map: Record<number, { inicio: string; fin: string; habilitado: boolean }> = {}
    for (let i = 0; i < 7; i++) {
      const h = iniciales.find((x) => x.dia_semana === i)
      map[i] = h
        ? {
            inicio: h.hora_inicio.slice(0, 5),
            fin: h.hora_fin.slice(0, 5),
            habilitado: true,
          }
        : { inicio: '09:00', fin: '23:00', habilitado: false }
    }
    setHorariosState(map)
  }, [iniciales])

  const [guardando, setGuardando] = useState(false)
  const queryClient = useQueryClient()

  async function guardar() {
    setGuardando(true)
    try {
      const payload: Array<Omit<HorarioCancha, 'id' | 'cancha_id'>> = Object.entries(
        horarios
      )
        .filter(([, h]) => h.habilitado)
        .map(([dia, h]) => ({
          dia_semana: Number(dia),
          hora_inicio: h.inicio,
          hora_fin: h.fin,
        }))
      await replaceHorarios(canchaId, payload)
      await queryClient.invalidateQueries({ queryKey: ['horarios', canchaId] })
      toast.success('Horarios actualizados')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  if (isLoading) return <div className="p-4"><Skeleton className="h-40" /></div>

  return (
    <div className="border-t border-neutral-200 p-4">
      <h4 className="mb-3 text-sm font-semibold text-neutral-700">
        Horarios de funcionamiento
      </h4>
      <div className="space-y-2">
        {DIAS.map((label, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <label className="flex w-24 items-center gap-2">
              <input
                type="checkbox"
                checked={horarios[i]?.habilitado ?? false}
                onChange={(e) =>
                  setHorariosState((prev) => ({
                    ...prev,
                    [i]: { ...prev[i], habilitado: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-neutral-300 text-primary-600"
              />
              {label}
            </label>
            <Input
              type="time"
              value={horarios[i]?.inicio ?? '09:00'}
              onChange={(e) =>
                setHorariosState((prev) => ({
                  ...prev,
                  [i]: { ...prev[i], inicio: e.target.value },
                }))
              }
              disabled={!horarios[i]?.habilitado}
              className="w-32"
            />
            <span className="text-neutral-400">—</span>
            <Input
              type="time"
              value={horarios[i]?.fin ?? '23:00'}
              onChange={(e) =>
                setHorariosState((prev) => ({
                  ...prev,
                  [i]: { ...prev[i], fin: e.target.value },
                }))
              }
              disabled={!horarios[i]?.habilitado}
              className="w-32"
            />
          </div>
        ))}
      </div>
      <Button className="mt-4" size="sm" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar horarios'}
      </Button>
    </div>
  )
}

function NuevaCanchaForm({
  complejoId,
  onClose,
  onCreated,
}: {
  complejoId: string
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const [tipo, setTipo] = useState<TipoCancha>('futbol5')
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [duracion, setDuracion] = useState<60 | 90>(60)
  const [creando, setCreando] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setCreando(true)
    try {
      // Por defecto: 09-23 todos los días
      const horarios = Array.from({ length: 7 }, (_, i) => ({
        dia_semana: i,
        hora_inicio: '09:00',
        hora_fin: '23:00',
      }))
      await crearCancha({
        complejoId,
        tipo,
        nombre,
        precio: Number(precio),
        duracion_min: duracion,
        horarios,
      })
      toast.success('Cancha creada')
      await onCreated()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear')
    } finally {
      setCreando(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-neutral-200 bg-white p-6"
    >
      <h2 className="mb-4 font-semibold text-neutral-900">Nueva cancha</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="tipo">Tipo</Label>
          <select
            id="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCancha)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="futbol5">Fútbol 5</option>
            <option value="futbol7">Fútbol 7</option>
            <option value="padel">Pádel</option>
          </select>
        </div>
        <div>
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="precio">Precio ($)</Label>
          <Input
            id="precio"
            type="number"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="duracion">Duración</Label>
          <select
            id="duracion"
            value={duracion}
            onChange={(e) => setDuracion(Number(e.target.value) as 60 | 90)}
            className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value={60}>60 minutos</option>
            <option value={90}>90 minutos</option>
          </select>
        </div>
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Se crea con horario por defecto 09:00 a 23:00 todos los días. Podés
        ajustarlo después.
      </p>
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={creando}>
          {creando ? 'Creando…' : 'Crear cancha'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
