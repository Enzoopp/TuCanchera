// ============================================================
// RESETPASSWORD.TSX  (ruta: /reset-password)
// Página para establecer una nueva contraseña después de hacer
// clic en el link de recuperación que envía Supabase por email.
//
// Supabase redirige acá con un access_token en el hash de la URL.
// El cliente de Supabase lo detecta y emite el evento PASSWORD_RECOVERY.
// Mientras no llegue ese evento, se muestra una pantalla de "Verificando link".
// Una vez que llega, se habilita el formulario con los dos campos de contraseña.
// ============================================================

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
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

export default function ResetPassword() {
  const navigate = useNavigate()

  // Estados del formulario
  const [password, setPassword] = useState('')          // nueva contraseña
  const [confirm, setConfirm] = useState('')            // confirmación de la nueva contraseña
  const [loading, setLoading] = useState(false)         // true mientras Supabase procesa
  const [error, setError] = useState<string | null>(null)

  // 'ready' controla si se muestra el formulario o la pantalla de verificación.
  // Empieza en false — se pone en true cuando Supabase valida el token del link.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase lee el access_token del hash de la URL automáticamente.
    // Cuando el token es válido, emite el evento PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)   // habilitamos el formulario
      }
    })

    // Cleanup: cancelar la suscripción al desmontar el componente
    return () => subscription.unsubscribe()
  }, [])

  // ── Envío del formulario ─────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validaciones antes de llamar a Supabase
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    // updateUser: actualiza la contraseña del usuario autenticado con el token
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError('No se pudo actualizar la contraseña. El link puede haber expirado.')
    } else {
      // Contraseña actualizada → redirigir al login con mensaje de éxito
      navigate('/login', {
        state: { message: '¡Contraseña actualizada! Ya podés iniciar sesión con tu nueva contraseña.' },
      })
    }
  }

  // ── Vista: verificando link (ready = false) ──────────────────
  // Se muestra mientras Supabase procesa el token del hash
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-primary-600">
              Verificando link...
            </CardTitle>
            <CardDescription>
              Estamos validando tu link de recuperación.
              <br />
              Si este mensaje persiste, el link puede haber expirado.{' '}
              {/* Link para solicitar un nuevo email de recuperación */}
              <Link to="/forgot-password" className="font-medium text-primary-600 hover:underline">
                Solicitá uno nuevo.
              </Link>
            </CardDescription>
          </CardHeader>
          {/* Spinner de carga */}
          <CardContent className="flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Vista: formulario (ready = true) ────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary-600">
            Nueva contraseña
          </CardTitle>
          <CardDescription>
            Elegí una contraseña nueva y segura para tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Campo nueva contraseña */}
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
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
              />
            </div>

            {/* Campo confirmación — debe coincidir con el anterior */}
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmá la contraseña</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Repetí la contraseña"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            {/* Mensaje de error (validación o error de Supabase) */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Botón de envío */}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
