// ============================================================
// LOGIN.TSX
// Página de inicio de sesión.
// Muestra un formulario con email y contraseña.
// Cuando el login es exitoso, redirige al usuario según su rol.
// ============================================================

import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

// Componentes de UI (tarjeta, inputs, botón) — vienen de shadcn/ui
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
  // useNavigate: permite redirigir al usuario a otra página por código
  const navigate = useNavigate()
  // useLocation: permite leer datos que otras páginas pasaron al redirigir acá
  const location = useLocation()

  // Del AuthContext traemos:
  // - signIn: función para iniciar sesión con email y contraseña
  // - user: el usuario logueado (null si no hay sesión)
  // - rol: 'admin' o 'cliente' (viene del perfil en la base de datos)
  // - authLoading: true mientras Supabase todavía está cargando la sesión
  const { signIn, user, rol, loading: authLoading } = useAuth()

  // Si el usuario fue redirigido al login desde una página protegida,
  // 'from' guarda la ruta original para volver ahí después del login
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname

  // Mensaje que viene del Register cuando se crea la cuenta exitosamente
  // ("Revisá tu email para confirmar el registro")
  const successMessage = (location.state as { message?: string })?.message

  // Estados del formulario
  const [email, setEmail] = useState('')         // valor del campo email
  const [password, setPassword] = useState('')   // valor del campo contraseña
  const [error, setError] = useState<string | null>(null)     // mensaje de error visible
  const [submitted, setSubmitted] = useState(false)           // true cuando el login fue exitoso

  // ── Redirección post-login ──────────────────────────────────
  // No navegamos dentro del handleSubmit porque justo después del signIn,
  // el perfil del usuario todavía no cargó (rol sería null).
  // Este useEffect espera a que AuthContext confirme que todo está listo,
  // y recién ahí decide a dónde mandar al usuario.
  useEffect(() => {
    if (!submitted) return    // Solo actuar si el usuario intentó hacer login
    if (authLoading) return   // Esperar que AuthContext termine de cargar el perfil
    if (!user) return         // Si no hay usuario, algo salió mal

    if (from) {
      // Volver a la página donde estaba antes de ser redirigido al login
      navigate(from, { replace: true })
    } else if (rol === 'admin') {
      // Los admins van al panel de administración
      navigate('/admin/dashboard', { replace: true })
    } else {
      // Los clientes van a explorar canchas
      navigate('/explorar', { replace: true })
    }
  }, [submitted, authLoading, user, rol, from, navigate])

  // ── Envío del formulario ────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()   // Evita que el navegador recargue la página al enviar el form
    setError(null)
    setSubmitted(false)

    try {
      // Llamamos a Supabase a través del AuthContext
      const { error: signInError } = await signIn(email, password)

      if (signInError) {
        // Si hay error, traducimos el mensaje técnico de Supabase al español
        setError(translateAuthError(signInError.message))
      } else {
        // Login exitoso → activamos el useEffect de arriba para que redirija
        setSubmitted(true)
      }
    } catch {
      setError('Ocurrió un error inesperado. Intentá de nuevo.')
    }
  }

  // Mostramos el estado de carga mientras se procesa el login
  const isLoading = submitted && (authLoading || !!user)

  // ── Interfaz visual ─────────────────────────────────────────
  return (
    // Contenedor: fondo gris claro, pantalla completa, centra la card
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">

      {/* Tarjeta blanca centrada con ancho máximo de 448px */}
      <Card className="w-full max-w-md">

        {/* Encabezado: título y subtítulo */}
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary-600">
            TuCanchera
          </CardTitle>
          <CardDescription>Iniciá sesión para reservar tu cancha</CardDescription>
        </CardHeader>

        <CardContent>
          {/* Mensaje de éxito que viene del Register (ej: "Cuenta creada, revisá tu email") */}
          {successMessage && (
            <p className="mb-4 rounded-md bg-primary-50 p-3 text-sm text-primary-700">
              {successMessage}
            </p>
          )}

          {/* Formulario de login */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Campo Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}  // actualiza el estado en tiempo real
                required
                autoComplete="email"
                disabled={isLoading}  // deshabilitado mientras carga
              />
            </div>

            {/* Campo Contraseña + link para recuperar contraseña */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                {/* Link a la página de recuperación de contraseña */}
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

            {/* Mensaje de error (solo se muestra si hay un error) */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Botón de envío — cambia el texto mientras carga */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

          {/* Links de navegación debajo del formulario */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              ¿No tenés cuenta?{' '}
              {/* Link a la página de registro de clientes */}
              <Link to="/register" className="font-medium text-primary-600 hover:underline">
                Registrate
              </Link>
            </p>
            <p className="mt-2">
              ¿Sos administrador?{' '}
              {/* Link a la página de registro de admins (requiere código de invitación) */}
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

// ── Traducción de errores de Supabase ───────────────────────
// Supabase devuelve los errores en inglés.
// Esta función los convierte a mensajes en español para mostrar al usuario.
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
