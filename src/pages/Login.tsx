// SRP: Gestiona el formulario de inicio de sesión.
// Usa un useEffect para redirigir cuando AuthContext confirma el login.
// El loading local siempre se resetea en el finally del signIn.

import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, Zap, MailCheck } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, user, rol, loading: authLoading } = useAuth()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname
  const successMessage = (location.state as { message?: string })?.message

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Redirigir cuando AuthContext termina de cargar el perfil post-login
  useEffect(() => {
    if (!submitted) return       // Solo actuar si el usuario intentó hacer login
    if (authLoading) return      // Esperar que AuthContext termine de cargar
    if (!user) return            // Si no hay usuario, algo salió mal

    if (from) {
      navigate(from, { replace: true })
    } else if (rol === 'admin') {
      navigate('/admin/dashboard', { replace: true })
    } else {
      navigate('/explorar', { replace: true })
    }
  }, [submitted, authLoading, user, rol, from, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitted(false)

    try {
      const { error: signInError } = await signIn(email, password)
      if (signInError) {
        setError(translateAuthError(signInError.message))
      } else {
        // Marcar que se envió OK → el useEffect navegará cuando AuthContext lo confirme
        setSubmitted(true)
      }
    } catch {
      setError('Ocurrió un error inesperado. Intentá de nuevo.')
    }
  }

  const isLoading = submitted && (authLoading || !!user)

  const tagline = 'Reservá tu cancha al instante'
  const bullets = [
    'Disponibilidad en tiempo real',
    'Pago online seguro',
    'Confirmación instantánea'
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
          <h1 className="text-2xl font-black text-neutral-900">Bienvenido</h1>
          <p className="mt-1 text-sm text-neutral-500">Iniciá sesión para continuar</p>

          {successMessage && (
            <p className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                disabled={isLoading}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary-600 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLoading}
                className="rounded-lg"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full rounded-lg"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-neutral-500">
            <p>
              ¿No tenés cuenta?{' '}
              <Link to="/register" className="font-medium text-primary-600 hover:underline">
                Registrate
              </Link>
            </p>
            <p className="mt-2">
              ¿Sos administrador?{' '}
              <Link to="/register-admin" className="font-medium text-primary-600 hover:underline">
                Registrate como admin
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Necesitás confirmar tu email antes de iniciar sesión. Revisá tu bandeja de entrada.'
  }
  if (message.includes('Too many requests')) {
    return 'Demasiados intentos. Esperá un momento e intentá de nuevo.'
  }
  return 'Ocurrió un error al iniciar sesión. Intentá de nuevo.'
}
