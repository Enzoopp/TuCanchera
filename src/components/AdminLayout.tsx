// SRP: Layout común para páginas del admin con sidebar de navegación.
// Incluye NavLink de react-router para resaltar el ítem activo.

import { NavLink, Outlet, Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Building2,
  LandPlot,
  CalendarX,
  ClipboardList,
  BarChart3,
  LogOut,
  ExternalLink,
} from 'lucide-react'

const items = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/complejo', label: 'Mi complejo', icon: Building2 },
  { to: '/admin/canchas', label: 'Canchas', icon: LandPlot },
  { to: '/admin/bloqueos', label: 'Bloqueos', icon: CalendarX },
  { to: '/admin/reservas', label: 'Reservas', icon: ClipboardList },
  { to: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3 },
]

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const { data: complejo, isLoading: loadingComplejo } = useMiComplejo()
  const location = useLocation()

  // Onboarding: si el admin no tiene complejo, forzar a /admin/complejo
  // donde se renderiza el wizard. Evita que vea dashboards vacíos.
  if (
    !loadingComplejo &&
    profile?.rol === 'admin' &&
    !complejo &&
    location.pathname !== '/admin/complejo'
  ) {
    return <Navigate to="/admin/complejo" replace />
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="flex min-h-screen">
        {/* Sidebar desktop */}
        <aside className="hidden w-64 shrink-0 border-r border-neutral-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-neutral-200 p-5">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Admin
            </p>
            <h1 className="mt-0.5 text-base font-semibold text-neutral-900">
              {complejo?.nombre ?? 'TuCanchera'}
            </h1>
            {complejo?.slug && (
              <Link
                to={`/${complejo.slug}`}
                target="_blank"
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
              >
                Ver página pública <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>

          <nav className="flex-1 p-3">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `mb-1 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`
                  }
                  end
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="border-t border-neutral-200 p-3">
            <p className="px-3 text-xs text-neutral-500">{profile?.nombre}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start"
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </Button>
          </div>
        </aside>

        {/* Contenido */}
        <main className="flex-1">
          {/* Topbar mobile */}
          <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
            <h1 className="font-semibold text-neutral-900">
              {complejo?.nombre ?? 'Admin'}
            </h1>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </header>

          {/* Tabs mobile */}
          <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-2 py-2 lg:hidden">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 text-xs ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-neutral-600'
                  }`
                }
                end
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
