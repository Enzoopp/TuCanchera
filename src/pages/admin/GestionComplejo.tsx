// SRP: Edición de datos del complejo + logo + galería de fotos.
// Upload a Supabase Storage (buckets 'logos' y 'fotos-complejos').

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchFotosByComplejo } from '@/services/complejoService'
import {
  updateComplejo,
  uploadLogo,
  uploadFotoComplejo,
  deleteFotoComplejo,
  reordenarFotos,
} from '@/services/adminService'
import OnboardingWizard from '@/components/OnboardingWizard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageIcon, Trash2, ArrowUp, ArrowDown, Upload, Building2, Images } from 'lucide-react'

const textareaClass =
  'mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

export default function GestionComplejo() {
  const queryClient = useQueryClient()
  const { data: complejo, isLoading } = useMiComplejo()

  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [direccion, setDireccion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)

  useEffect(() => {
    if (complejo) {
      setNombre(complejo.nombre)
      setDescripcion(complejo.descripcion ?? '')
      setDireccion(complejo.direccion ?? '')
    }
  }, [complejo])

  const { data: fotos } = useQuery({
    queryKey: ['fotos', complejo?.id],
    queryFn: () => fetchFotosByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!complejo) return
    setGuardando(true)
    try {
      await updateComplejo(complejo.id, { nombre, descripcion, direccion })
      await queryClient.invalidateQueries({ queryKey: ['mi-complejo'] })
      toast.success('Datos guardados')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !complejo) return
    setSubiendoLogo(true)
    try {
      const url = await uploadLogo(complejo.id, file)
      await updateComplejo(complejo.id, { logo_url: url })
      await queryClient.invalidateQueries({ queryKey: ['mi-complejo'] })
      toast.success('Logo actualizado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir logo')
    } finally {
      setSubiendoLogo(false)
      e.target.value = ''
    }
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !complejo) return
    setSubiendoFoto(true)
    try {
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

  async function handleEliminarFoto(id: string) {
    if (!complejo) return
    try {
      await deleteFotoComplejo(id)
      await queryClient.invalidateQueries({ queryKey: ['fotos', complejo.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  async function handleMover(idx: number, dir: -1 | 1) {
    if (!fotos || !complejo) return
    const nuevo = [...fotos]
    const target = idx + dir
    if (target < 0 || target >= nuevo.length) return
    ;[nuevo[idx], nuevo[target]] = [nuevo[target], nuevo[idx]]
    const updates = nuevo.map((f, i) => ({ id: f.id, orden: i + 1 }))
    try {
      await reordenarFotos(updates)
      await queryClient.invalidateQueries({ queryKey: ['fotos', complejo.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al reordenar')
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }

  if (!complejo) {
    return <OnboardingWizard />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-neutral-900">Mi complejo</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Información visible para tus clientes.
        </p>
      </div>

      {/* Datos del complejo */}
      <form
        onSubmit={handleGuardar}
        className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
      >
        <div className="flex items-center gap-2.5 border-b border-neutral-100 bg-neutral-50 px-5 py-4">
          <Building2 className="h-4 w-4 text-neutral-500" />
          <h2 className="text-sm font-semibold text-neutral-800">Datos generales</h2>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nombre" className="text-xs font-semibold text-neutral-600">
              Nombre del complejo
            </Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="mt-1 rounded-lg"
              placeholder="Ej: Club Deportivo Central"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="direccion" className="text-xs font-semibold text-neutral-600">
              Dirección
            </Label>
            <Input
              id="direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="mt-1 rounded-lg"
              placeholder="Av. Siempre Viva 742, CABA"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="descripcion" className="text-xs font-semibold text-neutral-600">
              Descripción
            </Label>
            <textarea
              id="descripcion"
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className={textareaClass}
              placeholder="Contá qué tipo de canchas tenés, servicios, ambiente…"
            />
          </div>
        </div>

        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-3">
          <Button type="submit" disabled={guardando} size="sm">
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </form>

      {/* Logo */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-neutral-100 bg-neutral-50 px-5 py-4">
          <ImageIcon className="h-4 w-4 text-neutral-500" />
          <h2 className="text-sm font-semibold text-neutral-800">Logo</h2>
        </div>

        <div className="flex items-center gap-5 p-5">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
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
          <div>
            <p className="text-sm font-medium text-neutral-800">
              {complejo.logo_url ? 'Logo actual' : 'Sin logo'}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Recomendado: 200×200px, formato PNG o JPG
            </p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogo}
                disabled={subiendoLogo}
              />
              <Upload className="h-3.5 w-3.5" />
              {subiendoLogo ? 'Subiendo…' : 'Cambiar logo'}
            </label>
          </div>
        </div>
      </div>

      {/* Galería de fotos */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Images className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-neutral-800">
              Galería de fotos
              {fotos && fotos.length > 0 && (
                <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                  {fotos.length}
                </span>
              )}
            </h2>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFoto}
              disabled={subiendoFoto}
            />
            <Upload className="h-3.5 w-3.5" />
            {subiendoFoto ? 'Subiendo…' : 'Agregar foto'}
          </label>
        </div>

        <div className="p-5">
          {!fotos || fotos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 py-12 text-center">
              <Images className="mx-auto h-8 w-8 text-neutral-300" />
              <p className="mt-2 text-sm font-medium text-neutral-500">Sin fotos todavía</p>
              <p className="mt-1 text-xs text-neutral-400">
                Las fotos se muestran en la página pública de tu complejo.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {fotos.map((f, idx) => (
                <li
                  key={f.id}
                  className="group relative overflow-hidden rounded-xl border border-neutral-200"
                >
                  <img
                    src={f.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleMover(idx, -1)}
                        disabled={idx === 0}
                        className="rounded-lg bg-white/90 p-1.5 text-neutral-700 hover:bg-white disabled:opacity-40 transition-colors"
                        title="Mover arriba"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMover(idx, 1)}
                        disabled={idx === fotos.length - 1}
                        className="rounded-lg bg-white/90 p-1.5 text-neutral-700 hover:bg-white disabled:opacity-40 transition-colors"
                        title="Mover abajo"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEliminarFoto(f.id)}
                      className="rounded-lg bg-red-500 p-1.5 text-white hover:bg-red-600 transition-colors"
                      title="Eliminar foto"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {idx === 0 && (
                    <div className="absolute left-2 top-2 rounded-md bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Portada
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
