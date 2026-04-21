// SRP: Gestiona el formulario de inicio de sesión.
// Usa un useEffect para redirigir cuando AuthContext confirma el login.
// El loading local siempre se resetea en el finally del signIn.

import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary-600">
            TuCanchera
          </CardTitle>
          <CardDescription>Iniciá sesión para reservar tu cancha</CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <p className="mb-4 rounded-md bg-primary-50 p-3 text-sm text-primary-700">
              {successMessage}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
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
        </CardContent>
      </Card>
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
