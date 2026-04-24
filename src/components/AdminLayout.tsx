// SRP: Layout común para páginas del admin con sidebar blanco (diseño Claude).
// Replica AdminLayout.jsx: sidebar sticky con logo, badge de complejo activo,
// navegación con indicador vertical azul, footer con avatar + logout.
// En mobile se transforma en drawer con overlay.

import { useEffect, useState, type ComponentType } from 'react'
import { NavLink, Outlet, Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import Logo from '@/components/brand/Logo'
import {
  LayoutDashboard,
  Building2,
  LandPlot,
  CalendarX,
  ClipboardList,
  BarChart3,
  BookMarked,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ size?: number }>
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/complejo', label: 'Mi Complejo', icon: Building2 },
  { to: '/admin/canchas', label: 'Canchas', icon: LandPlot },
  { to: '/admin/bloqueos', label: 'Bloqueos', icon: CalendarX },
  { to: '/admin/reservas', label: 'Reservas', icon: ClipboardList },
  { to: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { to: '/admin/resumenes', label: 'Resúmenes', icon: BookMarked },
]

function getInitials(nombre: string | null | undefined): string {
  if (!nombre) return '?'
  const parts = nombre.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const { data: complejo, isLoading: loadingComplejo } = useMiComplejo()
  const location = useLocation()

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    function onResize() {
      setIsMobile(window.innerWidth < 900)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  if (
    !loadingComplejo &&
    profile?.rol === 'admin' &&
    !complejo &&
    location.pathname !== '/admin/complejo'
  ) {
    return <Navigate to="/admin/complejo" replace />
  }

  const sidebarVisible = !isMobile || mobileOpen

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Sidebar */}
      {sidebarVisible && (
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            background: 'white',
            borderRight: '1px solid #e2e8f0',
            position: isMobile ? 'fixed' : 'sticky',
            top: 0,
            left: 0,
            height: '100vh',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: isMobile ? '4px 0 24px rgba(0,0,0,0.1)' : 'none',
            animation: isMobile ? 'slideRight 0.25s ease' : 'none',
          }}
        >
          {/* Top: logo + complex badge */}
          <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid #f1f5f9' }}>
            <Link
              to="/"
              style={{
                display: 'inline-block',
                textDecoration: 'none',
                marginBottom: 14,
              }}
            >
              <Logo size="sm" />
            </Link>
            <div
              style={{
                background: 'linear-gradient(135deg, #dbeafe, #eff6ff)',
                borderRadius: 10,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                border: '1px solid #bfdbfe',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: complejo ? '#22c55e' : '#94a3b8',
                  boxShadow: complejo
                    ? '0 0 0 3px rgba(34,197,94,0.2)'
                    : '0 0 0 3px rgba(148,163,184,0.2)',
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: '#3b82f6',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Administrando
                </div>
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#1e40af',
                    fontFamily: "'Space Grotesk', sans-serif",
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {complejo?.nombre ?? 'Sin complejo'}
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav
            style={{
              flex: 1,
              padding: '14px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              overflowY: 'auto',
            }}
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: isActive ? '#eff6ff' : 'transparent',
                    color: isActive ? '#1d4ed8' : '#475569',
                    textDecoration: 'none',
                    fontSize: '0.88rem',
                    fontWeight: isActive ? 700 : 600,
                    fontFamily: "'DM Sans', sans-serif",
                    transition: 'background 0.15s, color 0.15s',
                    position: 'relative',
                  })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon size={18} />
                      <span>{item.label}</span>
                      {isActive && (
                        <span
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 8,
                            bottom: 8,
                            width: 3,
                            background: '#2563eb',
                            borderRadius: '0 3px 3px 0',
                          }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* User footer */}
          <div style={{ padding: 14, borderTop: '1px solid #f1f5f9' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                borderRadius: 10,
                background: '#f8fafc',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 99,
                  flexShrink: 0,
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {getInitials(profile?.nombre)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {profile?.nombre ?? '—'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.2 }}>
                  Admin
                </div>
              </div>
              <button
                onClick={signOut}
                title="Cerrar sesión"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: 'none',
                  background: 'white',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fef2f2'
                  e.currentTarget.style.color = '#dc2626'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.color = '#64748b'
                }}
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.4)',
            zIndex: 99,
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}

      {/* Content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {/* Mobile topbar */}
        {isMobile && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 50,
              background: 'white',
              borderBottom: '1px solid #e2e8f0',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Abrir menú"
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: 8,
                  padding: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {mobileOpen ? <X size={20} color="#374151" /> : <Menu size={20} color="#374151" />}
              </button>
              <Logo size="sm" />
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
