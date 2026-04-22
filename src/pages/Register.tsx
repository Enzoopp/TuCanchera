// SRP: Esta página solo gestiona el formulario de registro de clientes.
// La creación de cuenta se delega al AuthContext (signUp).
// El trigger de Supabase handle_new_user crea automáticamente el profile
// con rol='cliente' usando los datos de raw_user_meta_data.

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Zap } from 'lucide-react'

export default function Register() {
  const navigate = useNavigate()
  const { signUp, signInWithGoogle } = useAuth()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)

    const { error } = await signUp(email, password, {
      nombre,
      telefono: telefono || undefined,
      rol: 'cliente',
    }, `${window.location.origin}/auth/callback`)

    setLoading(false)

    if (error) {
      setError(translateRegisterError(error.message))
      return
    }

    // Redirigir al login con mensaje de éxito
    navigate('/login', {
      state: { message: 'Cuenta creada. Revisá tu email para confirmar el registro.' },
    })
  }

  const tagline = 'Tu próximo partido comienza acá'
  const bullets = [
    'Creá tu cuenta gratis',
    'Reservá en segundos',
    'Sin llamadas ni esperas'
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
          <h1 className="text-2xl font-black text-neutral-900">Crear cuenta</h1>
          <p className="mt-1 text-sm text-neutral-500">Registrate para reservar canchas</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-neutral-400">o registrate con</span>
            </div>
          </div>

          {/* Botón Google */}
          <button
            type="button"
            onClick={async () => {
              setError(null)
              setGoogleLoading(true)
              const { error } = await signInWithGoogle()
              if (error) {
                setError('No se pudo continuar con Google. Intentá de nuevo.')
                setGoogleLoading(false)
              }
            }}
            disabled={loading || googleLoading}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-60"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirigiendo…' : 'Continuar con Google'}
          </button>

          <div className="mt-6 text-center text-sm text-neutral-500">
            <p>
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:underline">
                Iniciá sesión
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
