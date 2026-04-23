import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/AuthContext'
import { TenantProvider } from '@/context/TenantContext'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import RegisterAdmin from '@/pages/RegisterAdmin'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import AuthCallback from '@/pages/AuthCallback'
import Complejo from '@/pages/Complejo'
import Landing from '@/pages/Landing'
import Reservar from '@/pages/Reservar'
import MisReservas from '@/pages/MisReservas'
import Dashboard from '@/pages/admin/Dashboard'
import GestionComplejo from '@/pages/admin/GestionComplejo'
import GestionCanchas from '@/pages/admin/GestionCanchas'
import Bloqueos from '@/pages/admin/Bloqueos'
import ReservasAdmin from '@/pages/admin/Reservas'
import Estadisticas from '@/pages/admin/Estadisticas'
import ResumenesMensuales from '@/pages/admin/ResumenesMensuales'
import { Toaster } from '@/components/ui/sonner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

// Ruta raíz inteligente:
// - No autenticado → login
// - Admin         → panel admin
// - Cliente       → explorar complejos
function RootRedirect() {
  const { user, rol, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (rol === 'admin') return <Navigate to="/admin/dashboard" replace />
  return <Navigate to="/explorar" replace />
}

// Layout para rutas que requieren TenantContext (/:slug/*)
function TenantLayout() {
  return (
    <TenantProvider>
      <Outlet />
    </TenantProvider>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Raíz: redirige según estado de auth */}
            <Route path="/" element={<RootRedirect />} />

            {/* Rutas públicas de autenticación */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register-admin" element={<RegisterAdmin />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Explorar complejos (pública) */}
            <Route path="/explorar" element={<Landing />} />

            {/* Rutas protegidas: cualquier rol autenticado */}
            <Route element={<ProtectedRoute />}>
              <Route path="/mis-reservas" element={<MisReservas />} />
            </Route>

            {/* Rutas admin */}
            <Route element={<ProtectedRoute rol="admin" />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="complejo" element={<GestionComplejo />} />
                <Route path="canchas" element={<GestionCanchas />} />
                <Route path="bloqueos" element={<Bloqueos />} />
                <Route path="reservas" element={<ReservasAdmin />} />
                <Route path="estadisticas" element={<Estadisticas />} />
                <Route path="resumenes" element={<ResumenesMensuales />} />
              </Route>
            </Route>

            {/* Rutas del complejo por slug (tenant) */}
            <Route path="/:slug" element={<TenantLayout />}>
              <Route index element={<Complejo />} />
              <Route path="reservar/:canchaId" element={<Reservar />} />
            </Route>
          </Routes>
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
