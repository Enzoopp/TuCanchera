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
import { ImageIcon, Trash2, ArrowUp, ArrowDown, Upload } from 'lucide-react'

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
    return <Skeleton className="h-96 w-full" />
  }

  if (!complejo) {
    return <OnboardingWizard />
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Mi complejo</h1>
        <p className="text-sm text-neutral-500">
          Información visible para tus clientes.
        </p>
      </div>

      {/* Datos */}
      <form
        onSubmit={handleGuardar}
        className="rounded-xl border border-neutral-200 bg-white p-6"
      >
        <h2 className="mb-4 font-semibold text-neutral-900">Datos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
            />
          </div>
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

      {/* Logo */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-neutral-900">Logo</h2>
        <div className="flex items-center gap-4">
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
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogo}
              disabled={subiendoLogo}
            />
            <span className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50">
              <Upload className="h-4 w-4" />
              {subiendoLogo ? 'Subiendo…' : 'Cambiar logo'}
            </span>
          </label>
        </div>
      </div>

      {/* Galería */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Galería de fotos</h2>
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
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {fotos.map((f, idx) => (
              <li
                key={f.id}
                className="group relative overflow-hidden rounded-lg border border-neutral-200"
              >
                <img
                  src={f.url}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => handleMover(idx, -1)}
                    disabled={idx === 0}
                    className="rounded bg-white/90 p-1 text-neutral-700 hover:bg-white disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMover(idx, 1)}
                    disabled={idx === fotos.length - 1}
                    className="rounded bg-white/90 p-1 text-neutral-700 hover:bg-white disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
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
