// Navbar público — replicado del diseño Claude (shared.jsx / LandingPage).
// Adaptado a react-router + AuthContext de TuCanchera.

import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Logo from './Logo'
import { LogOut, User as UserIcon } from 'lucide-react'

interface NavbarProps {
  transparent?: boolean // para heros full-bleed: fondo transparente, texto blanco
}

export default function Navbar({ transparent = false }: NavbarProps) {
  const { user, rol, signOut } = useAuth()
  const navigate = useNavigate()

  const bg = transparent
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(255,255,255,0.92)'
  const border = transparent
    ? '1px solid rgba(255,255,255,0.15)'
    : '1px solid #f1f5f9'
  const textColor = transparent ? 'white' : '#0f172a'

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: bg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: border,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Link to="/explorar" style={{ textDecoration: 'none' }}>
          <Logo size="sm" dark={transparent} />
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user ? (
            <>
              {rol === 'superadmin' && (
                <Link
                  to="/superadmin"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: textColor,
                    textDecoration: 'none',
                    transition: 'background 0.15s',
                  }}
                >
                  Super admin
                </Link>
              )}
              {rol === 'admin' && (
                <Link
                  to="/admin/dashboard"
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: textColor,
                    textDecoration: 'none',
                    transition: 'background 0.15s',
                  }}
                >
                  Panel admin
                </Link>
              )}
              <Link
                to="/mis-reservas"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: textColor,
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}
              >
                <UserIcon size={15} /> Mis reservas
              </Link>
              <button
                onClick={async () => {
                  await signOut()
                  navigate('/login')
                }}
                title="Cerrar sesión"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: transparent ? 'rgba(255,255,255,0.75)' : '#64748b',
                }}
              >
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: textColor,
                  textDecoration: 'none',
                }}
              >
                Iniciar sesión
              </Link>
              <Link
                to="/register"
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  background: '#2563eb',
                  color: 'white',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                }}
              >
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
