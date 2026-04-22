// SRP: Wizard para que un admin nuevo cree su complejo.
// Se muestra cuando el admin no tiene complejo todavía.
// Valida nombre, slug (único y formato), y permite editar el slug sugerido.

import { useEffect, useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { crearComplejo, slugify, slugDisponible } from '@/services/adminService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Building2, Sparkles, CheckCircle2, MapPin, FileText, Link2 } from 'lucide-react'

const textareaClass =
  'mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

export default function OnboardingWizard() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const [nombre, setNombre] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEditadoManual, setSlugEditadoManual] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [direccion, setDireccion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!slugEditadoManual) {
      setSlug(slugify(nombre))
    }
  }, [nombre, slugEditadoManual])

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugEditadoManual(true)
    setSlug(slugify(e.target.value))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!profile) {
      setError('No se pudo identificar al usuario. Volvé a iniciar sesión.')
      return
    }

    if (slug.length < 3) {
      setError('El identificador (URL) debe tener al menos 3 caracteres.')
      return
    }

    setLoading(true)
    try {
      const disponible = await slugDisponible(slug)
      if (!disponible) {
        setError(
          'Esa URL ya está en uso. Probá con otra (ej: agregale tu ciudad o un número).'
        )
        setLoading(false)
        return
      }

      await crearComplejo({
        adminId: profile.id,
        nombre: nombre.trim(),
        slug,
        descripcion: descripcion.trim() || undefined,
        direccion: direccion.trim() || undefined,
      })

      await queryClient.invalidateQueries({ queryKey: ['mi-complejo'] })
      toast.success('¡Complejo creado! Ahora podés cargar tus canchas.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al crear el complejo.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Hero */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-sm">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-black text-neutral-900">
          ¡Bienvenido a TuCanchera!
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Para empezar, contanos sobre tu complejo deportivo. Después vas a poder
          cargar tus canchas, horarios y empezar a recibir reservas en minutos.
        </p>

        {/* Pasos visuales */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {[
            { icon: Building2, label: 'Complejo' },
            { icon: CheckCircle2, label: 'Canchas' },
            { icon: CheckCircle2, label: 'Listo' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  i === 0
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-200 text-neutral-500'
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs font-medium ${
                  i === 0 ? 'text-primary-700' : 'text-neutral-400'
                }`}
              >
                {step.label}
              </span>
              {i < 2 && <div className="h-px w-6 bg-neutral-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {/* Section header */}
        <div className="flex items-center gap-2.5 border-b border-neutral-100 bg-neutral-50 px-5 py-4">
          <Building2 className="h-4 w-4 text-neutral-500" />
          <h2 className="text-sm font-semibold text-neutral-800">Datos del complejo</h2>
        </div>

        <div className="space-y-5 p-5">
          {/* Nombre */}
          <div>
            <Label htmlFor="nombre" className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
              <Building2 className="h-3.5 w-3.5" />
              Nombre del complejo <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nombre"
              placeholder="Ej: Club Deportivo Central"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              minLength={3}
              className="mt-1 rounded-lg"
            />
          </div>

          {/* URL pública */}
          <div>
            <Label htmlFor="slug" className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
              <Link2 className="h-3.5 w-3.5" />
              URL pública <span className="text-red-500">*</span>
            </Label>
            <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
              <span className="flex items-center border-r border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-400 select-none">
                tucanchera.com/
              </span>
              <input
                id="slug"
                value={slug}
                onChange={handleSlugChange}
                required
                minLength={3}
                placeholder="mi-complejo"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm font-medium text-neutral-900 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Esta será tu URL pública. Solo letras minúsculas, números y guiones.
            </p>
          </div>

          {/* Dirección */}
          <div>
            <Label htmlFor="direccion" className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
              <MapPin className="h-3.5 w-3.5" />
              Dirección <span className="text-neutral-400 font-normal">(opcional)</span>
            </Label>
            <Input
              id="direccion"
              placeholder="Av. Siempre Viva 742, CABA"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="mt-1 rounded-lg"
            />
          </div>

          {/* Descripción */}
          <div>
            <Label htmlFor="descripcion" className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
              <FileText className="h-3.5 w-3.5" />
              Descripción <span className="text-neutral-400 font-normal">(opcional)</span>
            </Label>
            <textarea
              id="descripcion"
              rows={3}
              placeholder="Contá qué tipo de canchas tenés, servicios, ambiente…"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className={textareaClass}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-4">
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || nombre.length < 3 || slug.length < 3}
          >
            {loading ? 'Creando complejo…' : 'Crear complejo y continuar →'}
          </Button>
          <p className="mt-2 text-center text-xs text-neutral-500">
            Después podrás editar toda esta información cuando quieras.
          </p>
        </div>
      </form>
    </div>
  )
}
