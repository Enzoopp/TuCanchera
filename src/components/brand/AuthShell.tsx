// AuthShell — layout 60/40 con hero fotográfico para Login/Register/ForgotPassword.
// Replicado de PasswordPages.jsx (diseño Claude).

import type { ReactNode } from 'react'
import Logo from './Logo'

interface AuthShellProps {
  hero: string // URL de la imagen
  kicker?: ReactNode // pill de kicker en el hero
  title: ReactNode // h1 grande
  subtitle?: ReactNode
  heroFooter?: ReactNode // contenido extra en el hero (benefits, stats, etc.)
  children: ReactNode // formulario a la derecha
  /** 60/40 por defecto; 55/45 para el modo auth compacto */
  ratio?: '60/40' | '55/45'
}

export default function AuthShell({
  hero,
  kicker,
  title,
  subtitle,
  heroFooter,
  children,
  ratio = '60/40',
}: AuthShellProps) {
  const leftBasis = ratio === '55/45' ? '55%' : '60%'
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        fontFamily: "'DM Sans', sans-serif",
        background: 'white',
      }}
      className="auth-shell"
    >
      {/* Left — hero */}
      <div
        className="auth-left"
        style={{
          flex: `0 0 ${leftBasis}`,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '60px 64px',
          color: 'white',
        }}
      >
        <img
          src={hero}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(150deg, rgba(15,23,42,0.55) 0%, rgba(29,78,216,0.82) 100%)',
          }}
        />
        <div style={{ position: 'absolute', top: 48, left: 64 }}>
          <Logo dark size="md" />
        </div>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 480 }}>
          {kicker}
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '2.8rem',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              margin: '0 0 20px',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: '1.05rem',
                lineHeight: 1.6,
                maxWidth: 420,
                marginBottom: heroFooter ? 32 : 0,
              }}
            >
              {subtitle}
            </p>
          )}
          <div className="auth-hero-footer">{heroFooter}</div>
        </div>
      </div>

      {/* Right — form */}
      <div
        className="auth-right"
        style={{
          flex: 1,
          background: 'white',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 56px',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}>{children}</div>
      </div>

      {/* Responsive: collapse hero on small screens */}
      <style>{`
        @media (max-width: 900px) {
          .auth-shell { flex-direction: column; }
          .auth-shell .auth-left { flex: 0 0 auto; min-height: 300px; padding: 40px 28px; }
          .auth-shell .auth-left > div[style*="top: 48px"] { top: 24px; left: 28px; }
          .auth-shell .auth-left h1 { font-size: 2rem !important; }
          .auth-shell .auth-right { padding: 36px 24px; }
          .auth-hero-footer { display: none; }
        }
        @media (max-width: 480px) {
          .auth-shell .auth-left { min-height: 240px; padding: 32px 20px; }
          .auth-shell .auth-left h1 { font-size: 1.65rem !important; }
          .auth-shell .auth-right { padding: 28px 20px 48px; }
        }
      `}</style>
    </div>
  )
}
