// Página que maneja el redirect de Supabase después de confirmar el email.
// Supabase redirige acá con el token en el hash de la URL.
// El cliente de Supabase lo detecta automáticamente y dispara onAuthStateChange.

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
import { CheckCircle, XCircle } from 'lucide-react'

type Estado = 'cargando' | 'confirmado' | 'error'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<Estado>('cargando')

  useEffect(() => {
    // Supabase detecta el token del hash automáticamente al montar
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setEstado('confirmado')
      }
    })

    // Timeout: si en 5 segundos no hubo evento, mostrar error
    const timeout = setTimeout(() => {
      setEstado((prev) => prev === 'cargando' ? 'error' : prev)
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  if (estado === 'cargando') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            <CardTitle className="text-xl text-primary-600">Verificando tu cuenta...</CardTitle>
            <CardDescription>Un momento por favor.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (estado === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CheckCircle className="mx-auto mb-2 h-14 w-14 text-green-500" />
          <CardTitle className="text-2xl font-bold text-primary-600">
            ¡Email confirmado!
          </CardTitle>
          <CardDescription className="text-base">
            Tu cuenta está activa. Ya podés iniciar sesión y reservar canchas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" size="lg" onClick={() => navigate('/login')}>
            Iniciar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
