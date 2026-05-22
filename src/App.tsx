import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { TenantProvider } from '@/context/TenantContext'
import { useAuth } from '@/context/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import AuthCallback from '@/pages/AuthCallback'
import Complejo from '@/pages/Complejo'
import Landing from '@/pages/Landing'
import Reservar from '@/pages/Reservar'
import MisReservas from '@/pages/MisReservas'
import Perfil from '@/pages/Perfil'
import Dashboard from '@/pages/admin/Dashboard'
import GestionComplejo from '@/pages/admin/GestionComplejo'
import GestionCanchas from '@/pages/admin/GestionCanchas'
import Bloqueos from '@/pages/admin/Bloqueos'
import ReservasAdmin from '@/pages/admin/Reservas'
import Estadisticas from '@/pages/admin/Estadisticas'
import ResumenesMensuales from '@/pages/admin/ResumenesMensuales'
import InvitarAdmin from '@/pages/superadmin/InvitarAdmin'
import { Toaster } from '@/components/ui/sonner'
import CompletarPerfilModal, { useDeberiaCompletarPerfil } from '@/components/CompletarPerfilModal'

// ErrorBoundary global: muestra un mensaje legible en lugar de pantalla en blanco
// cuando un componente tira un error no capturado durante el render.
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: '#f8fafc',
            fontFamily: "'DM Sans', sans-serif",
            padding: 24,
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '2.5rem' }}>⚠️</span>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
            }}
          >
            Ocurrió un error inesperado
          </h2>
          <p style={{ color: '#64748b', margin: 0, maxWidth: 420 }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '10px 22px',
              borderRadius: 10,
              border: 'none',
              background: '#2563eb',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Recargar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
  if (rol === 'superadmin') return <Navigate to="/superadmin" replace />
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
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Raíz: redirige según estado de auth */}
              <Route path="/" element={<RootRedirect />} />

              {/* Rutas públicas de autenticación */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              {/* /register-admin eliminado — los admins se crean por invitación */}
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Explorar complejos (pública) */}
              <Route path="/explorar" element={<Landing />} />

              {/* Rutas protegidas: cualquier rol autenticado */}
              <Route element={<ProtectedRoute />}>
                <Route path="/mis-reservas" element={<MisReservas />} />
                <Route path="/perfil" element={<Perfil />} />
              </Route>

              {/* Ruta superadmin */}
              <Route element={<ProtectedRoute rol="superadmin" />}>
                <Route path="/superadmin" element={<InvitarAdmin />} />
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
            <PerfilModalGlobal />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}

// Wrapper global que muestra el modal de perfil incompleto si aplica
function PerfilModalGlobal() {
  const mostrar = useDeberiaCompletarPerfil()
  if (!mostrar) return null
  return <CompletarPerfilModal />
}

export default App
