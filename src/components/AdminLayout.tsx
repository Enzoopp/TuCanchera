// SRP: Layout común para páginas del admin con sidebar de navegación oscuro.
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
  Zap,
  ChevronRight,
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

  if (
    !loadingComplejo &&
    profile?.rol === 'admin' &&
    !complejo &&
    location.pathname !== '/admin/complejo'
  ) {
    return <Navigate to="/admin/complejo" replace />
  }

  return (
    <div className="flex min-h-screen bg-neutral-100">
      {/* ── Sidebar desktop ────────────────────────────────────────────── */}
      <aside className="hidden w-60 shrink-0 flex-col bg-neutral-950 lg:flex">
        {/* Brand */}
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-black text-white">TuCanchera</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-white truncate">
            {complejo?.nombre ?? '—'}
          </p>
          {complejo?.slug && (
            <Link
              to={`/${complejo.slug}`}
              target="_blank"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
            >
              Ver página pública
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary-400' : ''}`} />
                    <span className="flex-1">{item.label}</span>
                    {isActive && (
                      <ChevronRight className="h-3 w-3 text-primary-400 opacity-60" />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
              {profile?.nombre?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <span className="flex-1 truncate text-xs text-white/50">
              {profile?.nombre}
            </span>
          </div>
          <button
            onClick={signOut}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-500">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-neutral-900">
              {complejo?.nombre ?? 'Admin'}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        {/* Tabs mobile */}
        <nav className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-white px-2 py-2 lg:hidden scrollbar-none">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
