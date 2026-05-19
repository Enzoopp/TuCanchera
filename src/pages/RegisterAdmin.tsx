// ============================================================
// REGISTERADMIN.TSX
// Página de registro exclusiva para administradores de complejos.
// A diferencia del registro normal, acá se necesita un CÓDIGO DE INVITACIÓN
// que solo tiene quien va a ser admin. Sin el código, no se puede registrar.
//
// Flujo:
//   1) Validar el código ingresado contra la tabla codigos_invitacion en la BD
//   2) Si el código es válido y no fue usado → crear la cuenta con rol='admin'
//   3) Marcar el código como usado para que nadie más lo use
//   4) Redirigir al panel de admin para que configure su complejo
// ============================================================

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'  // cliente de Supabase directo (para verificar el código)

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

export default function RegisterAdmin() {
  // useNavigate: permite redirigir al usuario a otra página por código
  const navigate = useNavigate()

  // Del AuthContext traemos signUp: la función para crear una cuenta en Supabase
  const { signUp } = useAuth()

  // Estados del formulario — uno por cada campo
  const [codigo, setCodigo] = useState('')      // código de invitación (obligatorio)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')  // opcional
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)   // mensaje de error visible
  const [loading, setLoading] = useState(false)             // true mientras se procesa

  // ── Envío del formulario ────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()   // Evita que el navegador recargue la página
    setError(null)

    // Validación de contraseña antes de hacer nada
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)

    // ── PASO 1: Verificar el código de invitación ──────────────
    // Buscamos en la tabla 'codigos_invitacion' si existe una fila
    // que coincida con el código ingresado por el usuario.
    // .trim() elimina espacios en blanco al inicio y al final del texto.
    const { data: codigoData, error: codigoError } = await supabase
      .from('codigos_invitacion')
      .select('id, usado')        // solo traemos el id y si ya fue usado
      .eq('codigo', codigo.trim()) // filtramos por el código ingresado
      .single()                   // esperamos exactamente un resultado

    // Si no encontró el código → no es válido
    if (codigoError || !codigoData) {
      setError('El código de invitación no es válido.')
      setLoading(false)
      return
    }

    // Si el código ya fue usado por alguien más → rechazar
    if (codigoData.usado) {
      setError('Este código de invitación ya fue utilizado.')
      setLoading(false)
      return
    }

    // ── PASO 2: Crear la cuenta con rol='admin' ────────────────
    // Mismo signUp que el Register normal, pero con rol='admin'
    // El trigger de la BD creará el perfil con ese rol automáticamente
    const { error: signUpError } = await signUp(email, password, {
      nombre,
      telefono: telefono || undefined,  // si está vacío, no se envía
      rol: 'admin',                     // diferencia clave vs Register normal
    })

    if (signUpError) {
      setError(translateRegisterError(signUpError.message))
      setLoading(false)
      return
    }

    // ── PASO 3: Marcar el código como usado ───────────────────
    // Actualizamos la fila en la BD para que este código no pueda
    // ser reutilizado por otro usuario
    await supabase
      .from('codigos_invitacion')
      .update({ usado: true })    // cambiamos 'usado' a true
      .eq('id', codigoData.id)   // solo la fila de este código

    setLoading(false)

    // ── PASO 4: Redirigir al panel admin ──────────────────────
    // El admin va directo a crear/configurar su complejo deportivo
    navigate('/admin/complejo', {
      state: { message: 'Cuenta de administrador creada. Configurá tu complejo.' },
    })
  }

  // ── Interfaz visual ─────────────────────────────────────────
  return (
    // Contenedor: fondo gris claro, pantalla completa, centra la card
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">

      {/* Tarjeta blanca centrada con ancho máximo de 448px */}
      <Card className="w-full max-w-md">

        {/* Encabezado: título y descripción */}
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary-600">
            Registro de Administrador
          </CardTitle>
          <CardDescription>
            Ingresá tu código de invitación para registrarte como administrador de un complejo
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Campo exclusivo de esta página: Código de invitación */}
            <div className="space-y-2">
              <Label htmlFor="codigo">Código de invitación</Label>
              <Input
                id="codigo"
                type="text"
                placeholder="Ingresá tu código"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}  // actualiza el estado en tiempo real
                required
              />
            </div>

            {/* Campo Nombre completo — obligatorio */}
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            {/* Campo Teléfono — opcional */}
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

            {/* Campo Contraseña */}
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

            {/* Mensaje de error (solo aparece si hay un error) */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Botón de envío — cambia texto mientras carga */}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Registrarme como admin'}
            </Button>
          </form>

          {/* Links de navegación alternativos */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
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
