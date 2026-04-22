// SRP: Solo gestiona el formulario para solicitar reseteo de contraseña.
// Llama a supabase.auth.resetPasswordForEmail y muestra feedback al usuario.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MailCheck, Check, Zap } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError('No pudimos enviar el email. Verificá que la dirección sea correcta.')
    } else {
      setSent(true)
    }
  }

  const tagline = 'Reservá tu cancha al instante'
  const bullets = [
    'Disponibilidad en tiempo real',
    'Pago online seguro',
    'Confirmación instantánea'
  ]

  if (sent) {
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
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
              <MailCheck className="h-7 w-7 text-primary-600" />
            </div>

            <h1 className="text-2xl font-black text-neutral-900">
              Revisá tu email
            </h1>
            <p className="mt-2 text-sm text-neutral-500">
              Te enviamos un link para restablecer tu contraseña a{' '}
              <span className="font-medium text-neutral-700">{email}</span>.
              <br />
              Si no lo ves, revisá la carpeta de spam.
            </p>

            <div className="mt-6">
              <Link
                to="/login"
                className="text-sm font-medium text-primary-600 hover:underline"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
          <h1 className="text-2xl font-black text-neutral-900">Olvidé mi contraseña</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Ingresá tu email y te mandamos un link para restablecerla.
          </p>

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
                disabled={loading}
                className="rounded-lg"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <Button type="submit" className="w-full rounded-lg" size="lg" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link de recuperación'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-neutral-500">
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:underline"
            >
              ← Volver al inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
