// ============================================================
// ADMIN / GESTIONCOMPLEJO.TSX  (ruta: /admin/complejo)
// Página para editar los datos del complejo: nombre, dirección,
// descripción, logo y galería de fotos.
//
// Si el complejo aún no fue creado (primer acceso del admin),
// en lugar de esta pantalla se muestra el OnboardingWizard.
//
// Funcionalidades:
//   - Formulario de datos básicos (nombre, dirección, descripción)
//   - Upload de logo (Supabase Storage bucket 'logos')
//   - Galería de fotos: agregar, eliminar y reordenar
//     (Supabase Storage bucket 'fotos-complejos')
// ============================================================

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchFotosByComplejo } from '@/services/complejoService'
import {
  updateComplejo,       // actualiza nombre, dirección, descripción, logo_url
  uploadLogo,           // sube imagen al bucket 'logos' y devuelve la URL pública
  uploadFotoComplejo,   // sube imagen al bucket 'fotos-complejos'
  deleteFotoComplejo,   // elimina una foto por ID
  reordenarFotos,       // actualiza el campo 'orden' de múltiples fotos a la vez
} from '@/services/adminService'
import OnboardingWizard from '@/components/OnboardingWizard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageIcon, Trash2, ArrowUp, ArrowDown, Upload } from 'lucide-react'

export default function GestionComplejo() {
  const queryClient = useQueryClient()
  const { data: complejo, isLoading } = useMiComplejo()

  // ── Estados del formulario de datos ─────────────────────────
  // Se inicializan vacíos y se llenan en el useEffect cuando llega el complejo
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [direccion, setDireccion] = useState('')

  // ── Estados de carga de operaciones ─────────────────────────
  const [guardando, setGuardando] = useState(false)       // guardando datos del form
  const [subiendoLogo, setSubiendoLogo] = useState(false) // subiendo logo
  const [subiendoFoto, setSubiendoFoto] = useState(false) // subiendo foto a galería

  // ── Sincronizar el form cuando llega el complejo ─────────────
  // useEffect: cuando 'complejo' se carga (viene de Supabase), rellena los campos
  // Sin esto, el form quedaría vacío aunque el complejo ya tenga datos
  useEffect(() => {
    if (complejo) {
      setNombre(complejo.nombre)
      setDescripcion(complejo.descripcion ?? '')  // ?? '' porque puede ser null en la BD
      setDireccion(complejo.direccion ?? '')
    }
  }, [complejo])

  // ── Query: fotos de la galería ───────────────────────────────
  const { data: fotos } = useQuery({
    queryKey: ['fotos', complejo?.id],
    queryFn: () => fetchFotosByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  // ── Guardar datos básicos ────────────────────────────────────
  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!complejo) return
    setGuardando(true)
    try {
      await updateComplejo(complejo.id, { nombre, descripcion, direccion })
      // Invalidar la cache del complejo para que el header y otras partes se actualicen
      await queryClient.invalidateQueries({ queryKey: ['mi-complejo'] })
      toast.success('Datos guardados')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // ── Subir logo ───────────────────────────────────────────────
  // Se activa cuando el usuario selecciona un archivo en el input oculto
  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !complejo) return
    setSubiendoLogo(true)
    try {
      // 1) Subir el archivo al bucket de Supabase → obtener URL pública
      const url = await uploadLogo(complejo.id, file)
      // 2) Guardar esa URL en el campo logo_url del complejo
      await updateComplejo(complejo.id, { logo_url: url })
      await queryClient.invalidateQueries({ queryKey: ['mi-complejo'] })
      toast.success('Logo actualizado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir logo')
    } finally {
      setSubiendoLogo(false)
      e.target.value = ''  // limpiar el input para poder subir el mismo archivo dos veces
    }
  }

  // ── Subir foto a la galería ──────────────────────────────────
  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !complejo) return
    setSubiendoFoto(true)
    try {
      // El orden de la nueva foto = cantidad de fotos actuales + 1
      const orden = (fotos?.length ?? 0) + 1
      await uploadFotoComplejo(complejo.id, file, orden)
      await queryClient.invalidateQueries({ queryKey: ['fotos', complejo.id] })
      toast.success('Foto agregada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir foto')
    } finally {
      setSubiendoFoto(false)
      e.target.value = ''
    }
  }

  // ── Eliminar foto de la galería ──────────────────────────────
  async function handleEliminarFoto(id: string) {
    if (!complejo) return
    try {
      await deleteFotoComplejo(id)
      await queryClient.invalidateQueries({ queryKey: ['fotos', complejo.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  // ── Mover foto (reordenar) ───────────────────────────────────
  // dir = -1 (mover arriba / a la izquierda) o 1 (mover abajo / a la derecha)
  async function handleMover(idx: number, dir: -1 | 1) {
    if (!fotos || !complejo) return
    const nuevo = [...fotos]           // copia del array para no mutar el original
    const target = idx + dir
    if (target < 0 || target >= nuevo.length) return  // no salir de los límites

    // Intercambiar posiciones con desestructuración de array
    ;[nuevo[idx], nuevo[target]] = [nuevo[target], nuevo[idx]]

    // Generar los nuevos valores de 'orden' (1-indexed)
    const updates = nuevo.map((f, i) => ({ id: f.id, orden: i + 1 }))
    try {
      await reordenarFotos(updates)
      await queryClient.invalidateQueries({ queryKey: ['fotos', complejo.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al reordenar')
    }
  }

  // ── Pantalla de carga ────────────────────────────────────────
  if (isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  // ── Sin complejo: primer acceso del admin ────────────────────
  // Si el admin nunca creó su complejo, mostramos el wizard de configuración inicial
  if (!complejo) {
    return <OnboardingWizard />
  }

  return (
    <div className="space-y-8">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Mi complejo</h1>
        <p className="text-sm text-neutral-500">
          Información visible para tus clientes.
        </p>
      </div>

      {/* ── Sección 1: Datos básicos ── */}
      <form
        onSubmit={handleGuardar}
        className="rounded-xl border border-neutral-200 bg-white p-6"
      >
        <h2 className="mb-4 font-semibold text-neutral-900">Datos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Nombre — ocupa las 2 columnas en desktop */}
          <div className="sm:col-span-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          {/* Dirección */}
          <div className="sm:col-span-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>
          {/* Descripción — textarea nativo (no shadcn/ui) */}
          <div className="sm:col-span-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <textarea
              id="descripcion"
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </form>

      {/* ── Sección 2: Logo ── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-neutral-900">Logo</h2>
        <div className="flex items-center gap-4">
          {/* Preview del logo actual (o ícono placeholder si no hay) */}
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            {complejo.logo_url ? (
              <img
                src={complejo.logo_url}
                alt="Logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="h-8 w-8 text-neutral-300" />
            )}
          </div>
          {/* Botón de upload: label visible que envuelve un input hidden */}
          {/* Este patrón permite estilizar el botón de file input libremente */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"     // el input real queda invisible
              onChange={handleLogo}
              disabled={subiendoLogo}
            />
            {/* Texto visible que actúa como el "botón" */}
            <span className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50">
              <Upload className="h-4 w-4" />
              {subiendoLogo ? 'Subiendo…' : 'Cambiar logo'}
            </span>
          </label>
        </div>
      </div>

      {/* ── Sección 3: Galería de fotos ── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Galería de fotos</h2>
          {/* Botón para agregar foto — mismo patrón de label+input hidden */}
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFoto}
              disabled={subiendoFoto}
            />
            <span className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50">
              <Upload className="h-4 w-4" />
              {subiendoFoto ? 'Subiendo…' : 'Agregar foto'}
            </span>
          </label>
        </div>

        {!fotos || fotos.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">
            Todavía no agregaste fotos.
          </p>
        ) : (
          // Grid de miniaturas — 2 cols mobile, 3 tablet, 4 desktop
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {fotos.map((f, idx) => (
              <li
                key={f.id}
                className="group relative overflow-hidden rounded-lg border border-neutral-200"
              >
                {/* Imagen cuadrada con object-cover */}
                <img
                  src={f.url}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
                {/* Controles: aparecen al hacer hover (opacity-0 → opacity-100) */}
                {/* Degradado negro abajo para que los botones sean legibles */}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {/* Mover hacia atrás (izquierda en el grid) */}
                  <button
                    type="button"
                    onClick={() => handleMover(idx, -1)}
                    disabled={idx === 0}  // primer elemento: no puede ir más atrás
                    className="rounded bg-white/90 p-1 text-neutral-700 hover:bg-white disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  {/* Mover hacia adelante (derecha en el grid) */}
                  <button
                    type="button"
                    onClick={() => handleMover(idx, 1)}
                    disabled={idx === fotos.length - 1}  // último: no puede avanzar
                    className="rounded bg-white/90 p-1 text-neutral-700 hover:bg-white disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  {/* Eliminar foto */}
                  <button
                    type="button"
                    onClick={() => handleEliminarFoto(f.id)}
                    className="rounded bg-red-500 p-1 text-white hover:bg-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
