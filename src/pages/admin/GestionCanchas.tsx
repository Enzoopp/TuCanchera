// ============================================================
// ADMIN / GESTIONCANCHAS.TSX  (ruta: /admin/canchas)
// CRUD completo de canchas del complejo.
//
// Funcionalidades:
//   - Listar todas las canchas (activas e inactivas)
//   - Editar nombre y precio directamente desde la lista (inline)
//   - Toggle activa/inactiva (checkbox)
//   - Eliminar cancha (con confirmación)
//   - Expandir cada cancha para editar sus horarios semanales
//   - Crear nueva cancha con formulario (tipo, nombre, precio, duración)
//
// Sub-componentes:
//   - CanchaCard: tarjeta de una cancha con edición inline
//   - HorariosEditor: editor de horarios por día de la semana
//   - NuevaCanchaForm: formulario de creación
// ============================================================

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import {
  fetchCanchasByComplejo,
  fetchHorariosByCancha,
} from '@/services/complejoService'
import {
  crearCancha,     // crea cancha + horarios en Supabase
  updateCancha,    // actualiza campos de una cancha
  deleteCancha,    // elimina cancha y su historial
  replaceHorarios, // reemplaza TODOS los horarios de una cancha
} from '@/services/adminService'
import { tipoCanchaLabels } from '@/utils/canchaLabels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Cancha, HorarioCancha, TipoCancha } from '@/types'

// Nombres cortos de los días de la semana (índice 0 = Domingo, 6 = Sábado)
// Coincide con el estándar JavaScript Date.getDay()
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function GestionCanchas() {
  const queryClient = useQueryClient()
  const { data: complejo } = useMiComplejo()

  // ── Query: canchas del complejo ──────────────────────────────
  const { data: canchas, isLoading } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  // Controla si se muestra el formulario de nueva cancha
  const [mostrarNueva, setMostrarNueva] = useState(false)

  // ── Invalidar cache de canchas ───────────────────────────────
  // Función compartida entre sub-componentes para refrescar la lista
  async function invalidar() {
    await queryClient.invalidateQueries({ queryKey: ['admin-canchas-todas'] })
  }

  // ── Toggle activa/inactiva ───────────────────────────────────
  // Invierte el estado 'activa' de la cancha al hacer click en el checkbox
  async function toggleActiva(c: Cancha) {
    try {
      await updateCancha(c.id, { activa: !c.activa })
      await invalidar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  // ── Eliminar cancha ──────────────────────────────────────────
  async function eliminar(c: Cancha) {
    // Confirmación nativa del browser antes de eliminar
    if (!confirm(`¿Eliminar la cancha "${c.nombre}"? Esto también borra su historial.`)) return
    try {
      await deleteCancha(c.id)
      toast.success('Cancha eliminada')
      await invalidar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
    }
  }

  // Skeleton mientras cargan las canchas
  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <div className="space-y-6">
      {/* Encabezado + botón "Nueva cancha" */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Canchas</h1>
          <p className="text-sm text-neutral-500">
            Tipo, precio, duración y horarios de cada cancha.
          </p>
        </div>
        {/* Toggle que muestra/oculta el formulario de creación */}
        <Button onClick={() => setMostrarNueva((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva cancha
        </Button>
      </div>

      {/* Formulario de nueva cancha (se muestra cuando mostrarNueva=true) */}
      {mostrarNueva && complejo && (
        <NuevaCanchaForm
          complejoId={complejo.id}
          onClose={() => setMostrarNueva(false)}
          onCreated={invalidar}
        />
      )}

      {/* Estado vacío o lista de canchas */}
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

// ── CanchaCard ───────────────────────────────────────────────
// Tarjeta de cancha con edición inline de nombre y precio.
// Tiene un chevron para expandir y mostrar el HorariosEditor.
// El botón "Guardar" aparece solo cuando hay cambios sin guardar (dirty=true).
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
  // expanded: controla si se muestra el HorariosEditor abajo de la tarjeta
  const [expanded, setExpanded] = useState(false)
  // nombre y precio: campos editables inline
  const [nombre, setNombre] = useState(cancha.nombre)
  const [precio, setPrecio] = useState(String(cancha.precio))
  // dirty: true cuando el admin modificó algo pero aún no guardó
  const [dirty, setDirty] = useState(false)

  // ── Guardar cambios inline ───────────────────────────────────
  async function guardar() {
    try {
      await updateCancha(cancha.id, {
        nombre,
        precio: Number(precio),  // convertir string → number para la BD
      })
      toast.success('Cancha actualizada')
      setDirty(false)  // resetear el indicador de cambios
      await onInvalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <li className="rounded-xl border border-neutral-200 bg-white">
      {/* ── Fila de controles inline ── */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        {/* Badge del tipo de cancha (Fútbol 5, etc.) — no editable */}
        <Badge variant="secondary">{tipoCanchaLabels[cancha.tipo]}</Badge>

        {/* Campo editable: nombre */}
        <Input
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value)
            setDirty(true)  // marcar como modificado
          }}
          className="max-w-xs"
        />

        {/* Campo editable: precio (con símbolo $ delante) */}
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

        {/* Duración — no editable (se fija al crear) */}
        <span className="text-xs text-neutral-500">
          {cancha.duracion_min} min
        </span>

        {/* Checkbox: activar/desactivar cancha */}
        {/* ml-auto empuja este control hacia la derecha */}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cancha.activa}
            onChange={onToggle}
            className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span>Activa</span>
        </label>

        {/* Botón Guardar — solo aparece cuando hay cambios (dirty=true) */}
        {dirty && (
          <Button size="sm" onClick={guardar}>
            Guardar
          </Button>
        )}

        {/* Chevron: expandir/colapsar los horarios */}
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

        {/* Botón eliminar cancha */}
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      {/* Editor de horarios: visible solo cuando expanded=true */}
      {expanded && <HorariosEditor canchaId={cancha.id} />}
    </li>
  )
}

// ── HorariosEditor ───────────────────────────────────────────
// Editor de horarios semanales de una cancha.
// Para cada día de la semana (0=Dom a 6=Sáb) el admin puede:
//   - Habilitar/deshabilitar el día con un checkbox
//   - Configurar la hora de apertura y cierre (tipo="time")
// Al guardar, se REEMPLAZAN todos los horarios (delete + insert)
// en lugar de hacer updates parciales.
function HorariosEditor({ canchaId }: { canchaId: string }) {
  // Buscar los horarios actuales de esta cancha desde Supabase
  const { data: iniciales, isLoading } = useQuery({
    queryKey: ['horarios', canchaId],
    queryFn: () => fetchHorariosByCancha(canchaId),
  })

  // Estado local: un objeto con clave = dia_semana (0-6)
  // Cada valor: { inicio, fin, habilitado }
  const [horarios, setHorariosState] = useState<
    Record<number, { inicio: string; fin: string; habilitado: boolean }>
  >({})

  // Cuando llegan los horarios iniciales de la BD,
  // los convertimos al formato del estado local
  useEffect(() => {
    if (!iniciales) return
    const map: Record<number, { inicio: string; fin: string; habilitado: boolean }> = {}
    for (let i = 0; i < 7; i++) {
      // Buscar si hay registro para este día
      const h = iniciales.find((x) => x.dia_semana === i)
      map[i] = h
        ? {
            inicio: h.hora_inicio.slice(0, 5),  // "HH:MM:SS" → "HH:MM"
            fin: h.hora_fin.slice(0, 5),
            habilitado: true,  // si existe el registro, el día está habilitado
          }
        : { inicio: '09:00', fin: '23:00', habilitado: false }  // default apagado
    }
    setHorariosState(map)
  }, [iniciales])

  const [guardando, setGuardando] = useState(false)
  const queryClient = useQueryClient()

  // ── Guardar horarios ─────────────────────────────────────────
  async function guardar() {
    setGuardando(true)
    try {
      // Filtrar solo los días habilitados y armar el payload para Supabase
      const payload: Array<Omit<HorarioCancha, 'id' | 'cancha_id'>> = Object.entries(
        horarios
      )
        .filter(([, h]) => h.habilitado)   // solo días activos
        .map(([dia, h]) => ({
          dia_semana: Number(dia),
          hora_inicio: h.inicio,
          hora_fin: h.fin,
        }))
      // replaceHorarios: borra todos los horarios actuales e inserta los nuevos
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
        {/* Una fila por día de la semana */}
        {DIAS.map((label, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            {/* Checkbox de habilitación + nombre del día */}
            <label className="flex w-24 items-center gap-2">
              <input
                type="checkbox"
                checked={horarios[i]?.habilitado ?? false}
                onChange={(e) =>
                  setHorariosState((prev) => ({
                    ...prev,
                    // spread del estado anterior + modificar solo el día i
                    [i]: { ...prev[i], habilitado: e.target.checked },
                  }))
                }
                className="h-4 w-4 rounded border-neutral-300 text-primary-600"
              />
              {label}
            </label>
            {/* Input de hora de apertura */}
            <Input
              type="time"
              value={horarios[i]?.inicio ?? '09:00'}
              onChange={(e) =>
                setHorariosState((prev) => ({
                  ...prev,
                  [i]: { ...prev[i], inicio: e.target.value },
                }))
              }
              disabled={!horarios[i]?.habilitado}  // gris si el día está deshabilitado
              className="w-32"
            />
            <span className="text-neutral-400">—</span>
            {/* Input de hora de cierre */}
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
      {/* Botón para guardar todos los horarios a la vez */}
      <Button className="mt-4" size="sm" onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar horarios'}
      </Button>
    </div>
  )
}

// ── NuevaCanchaForm ──────────────────────────────────────────
// Formulario para crear una nueva cancha.
// Campos: tipo (select), nombre, precio, duración (60 o 90 min).
// Al crear, se asignan horarios por defecto (09:00–23:00 todos los días).
// El admin puede ajustar los horarios después desde el HorariosEditor.
function NuevaCanchaForm({
  complejoId,
  onClose,
  onCreated,
}: {
  complejoId: string
  onClose: () => void      // cierra el formulario
  onCreated: () => Promise<void>  // invalida la cache de canchas
}) {
  // Estado del formulario
  const [tipo, setTipo] = useState<TipoCancha>('futbol5')
  const [nombre, setNombre] = useState('')
  const [precio, setPrecio] = useState('')
  const [duracion, setDuracion] = useState<60 | 90>(60)
  const [creando, setCreando] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setCreando(true)
    try {
      // Generar horarios por defecto: 09:00–23:00 los 7 días
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
      await onCreated()  // refrescar lista
      onClose()          // cerrar el formulario
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
        {/* Select de tipo de cancha */}
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
        {/* Nombre de la cancha */}
        <div>
          <Label htmlFor="nombre">Nombre</Label>
          <Input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        {/* Precio por turno */}
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
        {/* Duración del turno: solo 60 o 90 minutos */}
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
      {/* Aviso sobre el horario por defecto */}
      <p className="mt-3 text-xs text-neutral-500">
        Se crea con horario por defecto 09:00 a 23:00 todos los días. Podés
        ajustarlo después.
      </p>
      {/* Botones de acción */}
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
