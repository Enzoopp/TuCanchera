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
import { Building2, Sparkles } from 'lucide-react'

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

  // Auto-generar slug desde nombre mientras no lo edite el usuario
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
      // Validar que el slug esté disponible
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
      <div className="mb-8 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
          <Sparkles className="h-7 w-7 text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">
          ¡Bienvenido a TuCanchera!
        </h1>
        <p className="mt-2 text-neutral-600">
          Para empezar, contanos sobre tu complejo deportivo. Después vas a poder
          cargar tus canchas, horarios y empezar a recibir reservas.
        </p>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-4">
          <Building2 className="h-5 w-5 text-primary-600" />
          <h2 className="font-semibold text-neutral-900">Datos del complejo</h2>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nombre">
            Nombre del complejo <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nombre"
            placeholder="Ej: Club Deportivo Central"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={3}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug">
            URL pública <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center rounded-md border border-neutral-300 bg-neutral-50 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500">
            <span className="select-none border-r border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-500">
              tucanchera.com/
            </span>
            <input
              id="slug"
              value={slug}
              onChange={handleSlugChange}
              required
              minLength={3}
              placeholder="mi-complejo"
              className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <p className="text-xs text-neutral-500">
            Esta va a ser tu URL pública. Solo letras, números y guiones.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="direccion">Dirección (opcional)</Label>
          <Input
            id="direccion"
            placeholder="Av. Siempre Viva 742, CABA"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="descripcion">Descripción (opcional)</Label>
          <textarea
            id="descripcion"
            rows={3}
            placeholder="Contanos qué tipo de canchas tenés, servicios, horarios generales…"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading || nombre.length < 3 || slug.length < 3}
        >
          {loading ? 'Creando complejo…' : 'Crear complejo y continuar'}
        </Button>

        <p className="text-center text-xs text-neutral-500">
          Después podrás editar toda esta información cuando quieras.
        </p>
      </form>
    </div>
  )
}
