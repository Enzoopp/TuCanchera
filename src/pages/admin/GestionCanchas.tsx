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
import { Plus, Trash2, ChevronDown, ChevronUp, LandPlot, Clock, DollarSign, Save } from 'lucide-react'
import type { Cancha, HorarioCancha, TipoCancha } from '@/types'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const selectClass =
  'mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-neutral-900">Canchas</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            Tipo, precio, duración y horarios de cada cancha.
          </p>
        </div>
        <Button
          onClick={() => setMostrarNueva((v) => !v)}
          className="flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
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
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center shadow-sm">
          <LandPlot className="mx-auto h-8 w-8 text-neutral-300" />
          <p className="mt-3 text-sm font-medium text-neutral-500">
            Todavía no tenés canchas cargadas.
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Hacé click en "Nueva cancha" para empezar.
          </p>
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
    <li className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        {/* Badge tipo */}
        <Badge variant="secondary" className="shrink-0">
          {tipoCanchaLabels[cancha.tipo]}
        </Badge>

        {/* Nombre editable */}
        <Input
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setDirty(true)
          }}
          className="max-w-xs rounded-lg"
        />

        {/* Precio editable */}
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-neutral-400" />
          <Input
            type="number"
            value={precio}
            onChange={(e) => {
              setPrecio(e.target.value)
              setDirty(true)
            }}
            className="w-28 rounded-lg"
          />
        </div>

        {/* Duración */}
        <div className="flex items-center gap-1 text-xs text-neutral-500">
          <Clock className="h-3.5 w-3.5" />
          {cancha.duracion_min} min
        </div>

        {/* Toggle activa */}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
          <div
            className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors ${
              cancha.activa ? 'bg-primary-600' : 'bg-neutral-200'
            }`}
            onClick={onToggle}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                cancha.activa ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </div>
          <span className={`text-xs font-medium ${cancha.activa ? 'text-emerald-600' : 'text-neutral-400'}`}>
            {cancha.activa ? 'Activa' : 'Inactiva'}
          </span>
        </label>

        {/* Guardar si hay cambios */}
        {dirty && (
          <Button size="sm" onClick={guardar} className="flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Guardar
          </Button>
        )}

        {/* Expandir horarios */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Ocultar
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Horarios
            </>
          )}
        </button>

        {/* Eliminar */}
        <button
          type="button"
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Eliminar cancha"
        >
          <Trash2 className="h-4 w-4" />
        </button>
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

  if (isLoading) {
    return (
      <div className="border-t border-neutral-100 p-5">
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Horarios de funcionamiento
      </h4>
      <div className="space-y-2">
        {DIAS.map((label, i) => (
          <div key={i} className="flex items-center gap-3">
            <label className="flex w-20 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={horarios[i]?.habilitado ?? false}
                onChange={(e) =>
                  setHorariosState((prev) => ({
                    ...prev,
                    [i]: { ...prev[i], habilitado: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              <span className={`text-sm ${horarios[i]?.habilitado ? 'font-medium text-neutral-900' : 'text-neutral-400'}`}>
                {label}
              </span>
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
              className="w-28 rounded-lg disabled:opacity-40"
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
              className="w-28 rounded-lg disabled:opacity-40"
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
      className="overflow-hidden rounded-2xl border border-primary-200 bg-white shadow-sm"
    >
      <div className="flex items-center gap-2.5 border-b border-neutral-100 bg-primary-50 px-5 py-4">
        <Plus className="h-4 w-4 text-primary-600" />
        <h2 className="text-sm font-semibold text-primary-700">Nueva cancha</h2>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="tipo" className="text-xs font-semibold text-neutral-600">Tipo</Label>
          <select
            id="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCancha)}
            className={selectClass}
          >
            <option value="futbol5">Fútbol 5</option>
            <option value="futbol7">Fútbol 7</option>
            <option value="padel">Pádel</option>
          </select>
        </div>
        <div>
          <Label htmlFor="nombre-nueva" className="text-xs font-semibold text-neutral-600">Nombre</Label>
          <Input
            id="nombre-nueva"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="mt-1 rounded-lg"
            placeholder="Ej: Cancha 1"
          />
        </div>
        <div>
          <Label htmlFor="precio-nueva" className="text-xs font-semibold text-neutral-600">Precio ($)</Label>
          <Input
            id="precio-nueva"
            type="number"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            required
            className="mt-1 rounded-lg"
            placeholder="5000"
          />
        </div>
        <div>
          <Label htmlFor="duracion-nueva" className="text-xs font-semibold text-neutral-600">Duración del turno</Label>
          <select
            id="duracion-nueva"
            value={duracion}
            onChange={(e) => setDuracion(Number(e.target.value) as 60 | 90)}
            className={selectClass}
          >
            <option value={60}>60 minutos</option>
            <option value={90}>90 minutos</option>
          </select>
        </div>
      </div>

      <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-3">
        <p className="mb-3 text-xs text-neutral-500">
          Se crea con horario por defecto 09:00–23:00 todos los días. Podés ajustarlo después.
        </p>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={creando}>
            {creando ? 'Creando…' : 'Crear cancha'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  )
}
