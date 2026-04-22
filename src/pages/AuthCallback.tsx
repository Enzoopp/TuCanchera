// Página de callback post-autenticación.
// Maneja dos flujos distintos:
//   1. Confirmación de email (type=signup en el hash) → muestra pantalla "Email confirmado"
//   2. OAuth (Google, etc.) → redirige automáticamente según rol

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CheckCircle, XCircle, Zap } from 'lucide-react'

type Estado = 'cargando' | 'email_confirmado' | 'error'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<Estado>('cargando')

  useEffect(() => {
    // Detectar si es confirmación de email (hash contiene type=signup o type=email_change)
    const hash = window.location.hash
    const isEmailConfirmation =
      hash.includes('type=signup') || hash.includes('type=email_change')

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          if (isEmailConfirmation) {
            // Flujo de confirmación de email: mostrar pantalla de éxito
            setEstado('email_confirmado')
          } else {
            // Flujo OAuth (Google, etc.): redirigir automáticamente según rol
            if (session?.user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('rol')
                .eq('user_id', session.user.id)
                .single()

              if (profile?.rol === 'admin') {
                navigate('/admin/dashboard', { replace: true })
              } else {
                navigate('/explorar', { replace: true })
              }
            } else {
              navigate('/explorar', { replace: true })
            }
          }
        }
      }
    )

    // Timeout: si en 8s no hubo evento, mostrar error
    const timeout = setTimeout(() => {
      setEstado((prev) => (prev === 'cargando' ? 'error' : prev))
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  if (estado === 'cargando') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
          <p className="mt-4 text-sm font-medium text-neutral-600">Verificando tu cuenta…</p>
          <p className="mt-1 text-xs text-neutral-400">Un momento por favor.</p>
        </div>
      </div>
    )
  }

  if (estado === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100">
        <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-black text-neutral-900">Link inválido o expirado</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Este link ya fue usado o expiró. Podés solicitar uno nuevo iniciando sesión.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 transition-colors"
          >
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  // estado === 'email_confirmado'
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-black text-neutral-900">¡Email confirmado!</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Tu cuenta está activa. Ya podés iniciar sesión y reservar canchas.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="mt-6 w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-500 transition-colors"
        >
          Iniciar sesión
        </button>
      </div>
    </div>
  )
}
