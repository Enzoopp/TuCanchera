// Panel de superadmin: única función disponible es invitar nuevos admins.
// Al enviar, Supabase manda un email con link de activación (24hs de validez).

import { useState, type FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { invitarAdmin } from '@/services/superadminService'
import { Zap, Send, CheckCircle2, Users, LogOut } from 'lucide-react'

export default function InvitarAdmin() {
  const { profile, signOut } = useAuth()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviado(null)
    setLoading(true)
    try {
      await invitarAdmin(email.trim(), nombre.trim())
      setEnviado(email.trim())
      setNombre('')
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar la invitación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">TuCanchera</span>
            <span className="rounded-full bg-primary-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-400">
              Superadmin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">{profile?.email}</span>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 items-start justify-center px-4 pt-16">
        <div className="w-full max-w-xl">

          {/* Título */}
          <div className="mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-800">
              <Users className="h-6 w-6 text-neutral-300" />
            </div>
            <h1 className="mt-4 text-2xl font-black text-white">Invitar nuevo complejo</h1>
            <p className="mt-1.5 text-sm text-neutral-400">
              Le llegará un email con un link de activación válido por 24hs.
              Al activarlo, puede crear su complejo y gestionar sus canchas.
            </p>
          </div>

          {/* Formulario */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="nombre" className="text-xs font-semibold text-neutral-400">
                  Nombre del responsable
                </label>
                <input
                  id="nombre"
                  type="text"
                  placeholder="Juan García"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-neutral-400">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="juan@complejo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-400">{error}</p>
              )}

              {enviado && (
                <div className="flex items-center gap-2.5 rounded-lg bg-emerald-950 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <p className="text-sm text-emerald-300">
                    Invitación enviada a <strong>{enviado}</strong>. Tiene 24hs para activar.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !nombre.trim() || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-400 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {loading ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </form>
          </div>

          {/* Info */}
          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3">
            <p className="text-xs text-neutral-500">
              <strong className="text-neutral-400">¿Cómo funciona?</strong>{' '}
              El nuevo admin recibe un email de TuCanchera. Al hacer click en el link,
              elige su contraseña y queda listo para crear su complejo. Sin códigos, sin
              páginas públicas.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
