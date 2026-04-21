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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md">
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
            <div className="space-y-2">
              <Label htmlFor="codigo">Código de invitación</Label>
              <Input
                id="codigo"
                type="text"
                placeholder="Ingresá tu código"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                required
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
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Registrarme como admin'}
            </Button>
          </form>

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
