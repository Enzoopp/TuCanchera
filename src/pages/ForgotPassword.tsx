// ============================================================
// FORGOTPASSWORD.TSX
// Página para recuperar contraseña olvidada.
// El usuario ingresa su email y Supabase le manda un link
// para restablecer su contraseña.
//
// Esta página tiene DOS vistas:
//   1) Formulario: donde el usuario escribe su email
//   2) Confirmación: se muestra DESPUÉS de enviar el email exitosamente
//      (con un ícono de sobre y el mensaje "Revisá tu email")
// ============================================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'  // cliente de Supabase directo

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

// MailCheck: ícono de sobre con tilde — viene de lucide-react (librería de íconos)
// Se muestra en la pantalla de confirmación después de enviar el email
import { MailCheck } from 'lucide-react'

export default function ForgotPassword() {
  // Estados del formulario
  const [email, setEmail] = useState('')                    // valor del campo email
  const [loading, setLoading] = useState(false)             // true mientras Supabase procesa
  const [sent, setSent] = useState(false)                   // true cuando el email fue enviado OK
  const [error, setError] = useState<string | null>(null)   // mensaje de error visible

  // ── Envío del formulario ────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()   // Evita que el navegador recargue la página
    setError(null)
    setLoading(true)

    // Llamamos directamente a Supabase Auth para que envíe el email de recuperación.
    // 'redirectTo' es la URL a la que Supabase redirige al usuario cuando
    // hace click en el link del email — ahí podrá escribir su nueva contraseña.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError('No pudimos enviar el email. Verificá que la dirección sea correcta.')
    } else {
      // Cambiar a la vista de confirmación
      setSent(true)
    }
  }

  // ── Vista de confirmación (aparece cuando sent = true) ─────
  // Esta es una pantalla completamente distinta que reemplaza al formulario.
  // React decide qué renderizar según el valor de 'sent'.
  if (sent) {
    return (
      // Mismo fondo y centrado que el formulario
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            {/* Círculo verde claro con el ícono de sobre — visual de confirmación */}
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
              <MailCheck className="h-7 w-7 text-primary-600" />
            </div>

            <CardTitle className="text-xl font-bold text-primary-600">
              Revisá tu email
            </CardTitle>

            {/* Muestra el email al que se le envió el link */}
            <CardDescription>
              Te enviamos un link para restablecer tu contraseña a{' '}
              <span className="font-medium text-neutral-700">{email}</span>.
              <br />
              Si no lo ves, revisá la carpeta de spam.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Link para volver al login */}
            <Link
              to="/login"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Volver al inicio de sesión
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Vista del formulario (aparece cuando sent = false) ──────
  return (
    // Contenedor: fondo gris claro, pantalla completa, centra la card
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">

      {/* Tarjeta blanca centrada con ancho máximo de 448px */}
      <Card className="w-full max-w-md">

        {/* Encabezado: título y descripción */}
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary-600">
            Olvidé mi contraseña
          </CardTitle>
          <CardDescription>
            Ingresá tu email y te mandamos un link para restablecerla.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Campo Email — el único campo de este formulario */}
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
                disabled={loading}   // deshabilitado mientras carga
              />
            </div>

            {/* Mensaje de error (solo aparece si hay un error) */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Botón de envío — cambia texto mientras carga */}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de recuperación'}
            </Button>
          </form>

          {/* Link para volver al login sin necesidad de recuperar contraseña */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:underline"
            >
              ← Volver al inicio de sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
