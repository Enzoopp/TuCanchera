// ============================================================
// REGISTER.TSX
// Página de registro para clientes nuevos.
// Muestra un formulario con nombre, teléfono, email y contraseña.
// Al registrarse, Supabase crea el usuario y un trigger de la base
// de datos crea automáticamente el perfil con rol='cliente'.
// ============================================================

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

export default function Register() {
  // useNavigate: permite redirigir al usuario a otra página por código
  const navigate = useNavigate()

  // Del AuthContext traemos solo signUp: la función para crear una cuenta nueva
  const { signUp } = useAuth()

  // Estados del formulario — uno por cada campo
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')   // campo opcional
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)   // mensaje de error visible
  const [loading, setLoading] = useState(false)             // true mientras se procesa el registro

  // ── Envío del formulario ────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()   // Evita que el navegador recargue la página al enviar el form
    setError(null)

    // Validación manual de la contraseña antes de llamar a Supabase
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)

    // Llamamos a signUp del AuthContext, que internamente llama a Supabase.
    // Pasamos los metadatos (nombre, telefono, rol) para que el trigger
    // de la base de datos los use al crear el perfil automáticamente.
    const { error } = await signUp(email, password, {
      nombre,
      telefono: telefono || undefined,  // si el campo está vacío, no se envía
      rol: 'cliente',                   // los registros normales siempre son clientes
    }, `${window.location.origin}/auth/callback`)  // URL a la que redirige Supabase al confirmar email

    setLoading(false)

    if (error) {
      // Traducimos el error técnico de Supabase al español
      setError(translateRegisterError(error.message))
      return
    }

    // Registro exitoso → redirigimos al login con un mensaje informativo
    navigate('/login', {
      state: { message: 'Cuenta creada. Revisá tu email para confirmar el registro.' },
    })
  }

  // ── Interfaz visual ─────────────────────────────────────────
  return (
    // Contenedor: fondo gris claro, pantalla completa, centra la card
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">

      {/* Tarjeta blanca centrada con ancho máximo de 448px */}
      <Card className="w-full max-w-md">

        {/* Encabezado: título y subtítulo */}
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary-600">
            Crear cuenta
          </CardTitle>
          <CardDescription>Registrate para reservar canchas</CardDescription>
        </CardHeader>

        <CardContent>
          {/* Formulario de registro */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Campo Nombre completo — obligatorio */}
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}  // actualiza el estado en tiempo real
                required
              />
            </div>

            {/* Campo Teléfono — opcional, por eso no tiene 'required' */}
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono (opcional)</Label>
              <Input
                id="telefono"
                type="tel"
                placeholder="11 1234-5678"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
            </div>

            {/* Campo Email */}
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
              />
            </div>

            {/* Campo Contraseña — mínimo 6 caracteres (validado en handleSubmit) */}
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
              />
            </div>

            {/* Mensaje de error (solo se muestra si hay un error) */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Botón de envío — cambia el texto mientras carga */}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </Button>
          </form>

          {/* Link de navegación para usuarios que ya tienen cuenta */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              ¿Ya tenés cuenta?{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:underline">
                Iniciá sesión
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
