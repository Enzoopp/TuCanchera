// SRP: Esta página gestiona el registro de administradores con código de invitación.
// Flujo: 1) Validar código contra tabla codigos_invitacion
//        2) Si es válido y no usado, crear cuenta con rol='admin'
//        3) Marcar código como usado
//        4) Redirigir al panel admin para crear su complejo

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Zap } from 'lucide-react'

export default function RegisterAdmin() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)

    // Paso 1: Validar el código de invitación
    const { data: codigoData, error: codigoError } = await supabase
      .from('codigos_invitacion')
      .select('id, usado')
      .eq('codigo', codigo.trim())
      .single()

    if (codigoError || !codigoData) {
      setError('El código de invitación no es válido.')
      setLoading(false)
      return
    }

    if (codigoData.usado) {
      setError('Este código de invitación ya fue utilizado.')
      setLoading(false)
      return
    }

    // Paso 2: Crear la cuenta con rol='admin'
    const { error: signUpError } = await signUp(email, password, {
      nombre,
      telefono: telefono || undefined,
      rol: 'admin',
    })

    if (signUpError) {
      setError(translateRegisterError(signUpError.message))
      setLoading(false)
      return
    }

    // Paso 3: Marcar el código como usado
    await supabase
      .from('codigos_invitacion')
      .update({ usado: true })
      .eq('id', codigoData.id)

    setLoading(false)

    // Paso 4: Redirigir al panel admin
    navigate('/admin/complejo', {
      state: { message: 'Cuenta de administrador creada. Configurá tu complejo.' },
    })
  }

  const tagline = 'Potenciá tu complejo'
  const bullets = [
    'Panel de gestión completo',
    'Reservas online 24/7',
    'Reportes y estadísticas'
  ]

  return (
    <div className="flex min-h-screen bg-white">
      {/* Panel izquierdo - oculto en mobile */}
      <div className="hidden lg:flex lg:w-[480px] shrink-0 flex-col justify-between bg-neutral-950 px-12 py-12 relative overflow-hidden">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(var(--color-primary-400) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary-400) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />

        {/* Glow */}
        <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-primary-600/20 blur-3xl" />

        <div className="relative">
          <Link to="/explorar" className="flex items-center gap-2 mb-16">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black text-white">TuCanchera</span>
          </Link>

          <h2 className="text-3xl font-black text-white leading-tight">{tagline}</h2>

          <ul className="mt-8 space-y-4">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-center gap-3 text-white/70">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-500/20 text-primary-400">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/30">© {new Date().getFullYear()} TuCanchera</p>
      </div>

      {/* Panel derecho */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-black text-neutral-900">Registro de administrador</h1>
          <p className="mt-1 text-sm text-neutral-500">Ingresá tu código de invitación para registrarte</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código de invitación</Label>
              <Input
                id="codigo"
                type="text"
                placeholder="Ingresá tu código"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
                disabled={loading}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                disabled={loading}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono (opcional)</Label>
              <Input
                id="telefono"
                type="tel"
                placeholder="11 1234-5678"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                disabled={loading}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                disabled={loading}
                className="rounded-lg"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <Button type="submit" className="w-full rounded-lg" size="lg" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Registrarme como admin'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-neutral-500">
            <p>
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:underline">
                Iniciá sesión
              </Link>
            </p>
            <p className="mt-2">
              ¿No sos admin?{' '}
              <Link to="/register" className="font-medium text-primary-600 hover:underline">
                Registrate como cliente
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function translateRegisterError(message: string): string {
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Este email ya está registrado.'
  }
  if (message.includes('valid email')) {
    return 'Ingresá un email válido.'
  }
  if (message.includes('Password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  return 'Ocurrió un error al crear la cuenta. Intentá de nuevo.'
}
