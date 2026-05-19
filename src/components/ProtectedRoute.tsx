// PATRÓN: Higher-Order Component (HOC) para protección de rutas
// Implementa el principio DIP (Dependency Inversion): los componentes de página
// no conocen la lógica de autorización. Solo ProtectedRoute depende de AuthContext,
// permitiendo cambiar la estrategia de auth sin tocar las páginas.
//
// Uso: <Route element={<ProtectedRoute rol="admin" />}>
//        <Route path="/admin/dashboard" element={<Dashboard />} />
//      </Route>

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { Rol } from '@/types'

interface ProtectedRouteProps {
  rol?: Rol
}

export default function ProtectedRoute({ rol }: ProtectedRouteProps) {
  const { user, rol: userRol, loading } = useAuth()
  const location = useLocation()

  // Mientras se carga la sesión, mostrar un indicador
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="mt-4 text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  // Si no está autenticado, redirigir al login preservando la URL original
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Si se requiere un rol específico y no coincide, redirigir a la home
  if (rol && userRol !== rol) {
    return <Navigate to="/" replace />
  }

  // Autorizado: renderizar las rutas hijas
  return <Outlet />
}
