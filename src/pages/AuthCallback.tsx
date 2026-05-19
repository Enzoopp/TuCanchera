// ============================================================
// AUTHCALLBACK.TSX  (ruta: /auth/callback)
// Página intermedia que maneja el redirect de Supabase después
// de que el usuario hace clic en el link de confirmación de email.
//
// Supabase redirige acá con un token en el hash de la URL (ej: #access_token=...).
// El cliente de Supabase detecta ese token automáticamente y dispara
// el evento onAuthStateChange con SIGNED_IN o USER_UPDATED.
//
// Esta página tiene TRES vistas según el estado:
//   1) 'cargando'  → spinner mientras se procesa el token
//   2) 'confirmado' → cuenta activada, botón para ir al login
//   3) 'error'     → link inválido o expirado
// ============================================================

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// CheckCircle: tilde verde de confirmación | XCircle: cruz roja de error
import { CheckCircle, XCircle } from 'lucide-react'

// Tipo que define los tres estados posibles de la página
type Estado = 'cargando' | 'confirmado' | 'error'

export default function AuthCallback() {
  const navigate = useNavigate()

  // Estado de la UI: empieza en 'cargando' hasta recibir respuesta de Supabase
  const [estado, setEstado] = useState<Estado>('cargando')

  useEffect(() => {
    // Supabase detecta el token del hash de la URL automáticamente al montar el componente.
    // Escuchamos el evento para saber si la confirmación fue exitosa.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // El token es válido → cuenta confirmada
        setEstado('confirmado')
      }
    })

    // Timeout defensivo: si en 5 segundos no llegó ningún evento de Supabase,
    // mostramos error (el link puede haber expirado o ser inválido)
    const timeout = setTimeout(() => {
      setEstado((prev) => prev === 'cargando' ? 'error' : prev)
    }, 5000)

    // Cleanup: cancelar la suscripción y el timeout al desmontar
    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  // ── Vista: cargando ──────────────────────────────────────────
  if (estado === 'cargando') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            {/* Spinner: animación de giro con border-t de color verde */}
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            <CardTitle className="text-xl text-primary-600">Verificando tu cuenta...</CardTitle>
            <CardDescription>Un momento por favor.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // ── Vista: error ─────────────────────────────────────────────
  if (estado === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            {/* Ícono de error en rojo */}
            <XCircle className="mx-auto mb-2 h-12 w-12 text-destructive" />
            <CardTitle className="text-xl">Link inválido o expirado</CardTitle>
            <CardDescription>
              Este link ya fue usado o expiró. Podés solicitar uno nuevo iniciando sesión.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate('/login')}>
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Vista: confirmado (estado === 'confirmado') ───────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          {/* Ícono de tilde verde de confirmación */}
          <CheckCircle className="mx-auto mb-2 h-14 w-14 text-green-500" />
          <CardTitle className="text-2xl font-bold text-primary-600">
            ¡Email confirmado!
          </CardTitle>
          <CardDescription className="text-base">
            Tu cuenta está activa. Ya podés iniciar sesión y reservar canchas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Botón que lleva al login para que el usuario inicie sesión */}
          <Button className="w-full" size="lg" onClick={() => navigate('/login')}>
            Iniciar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
