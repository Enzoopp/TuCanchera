// SRP: Solo gestiona el formulario para solicitar reseteo de contraseña.
// Diseño replicado de PasswordPages.jsx (ForgotPasswordPage).
// Muestra un ícono con gradiente + form email → estado "sent" con animación
// de sobre volando y líneas dashed.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import AuthShell from '@/components/brand/AuthShell'
import { Mail, Check, Sparkles, Unlock } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError('No pudimos enviar el email. Verificá que la dirección sea correcta.')
    } else {
      setSent(true)
    }
  }

  return (
    <AuthShell
      ratio="55/45"
      hero="https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1400&q=85&fit=crop"
      kicker={
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.14)',
            backdropFilter: 'blur(6px)',
            borderRadius: 99,
            padding: '6px 16px',
            marginBottom: 20,
          }}
        >
          <Sparkles size={15} color="#93c5fd" />
          <span style={{ color: '#bfdbfe', fontSize: '0.8rem', fontWeight: 600 }}>Recuperá tu cuenta</span>
        </div>
      }
      title={<>Volvé al juego<br />en minutos.</>}
      subtitle="Te enviamos un link seguro por email. Elegí una nueva contraseña y listo — tu cuenta te espera."
      heroFooter={
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['Link válido por 1 hora', 'Sin pérdida de historial', 'Reservas activas intactas'].map((b) => (
            <li key={b} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 99,
                  background: 'rgba(74,222,128,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4ade80',
                }}
              >
                <Check size={14} strokeWidth={3} />
              </span>
              <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.92rem' }}>{b}</span>
            </li>
          ))}
        </ul>
      }
    >
      {sent ? (
        <div className="page-enter" style={{ textAlign: 'center' }}>
          {/* Floating envelope animation */}
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(37,99,235,0.35)',
              animation: 'floatMail 3s ease-in-out infinite',
            }}
          >
            <Mail size={38} color="white" />
          </div>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              margin: '0 0 10px',
            }}
          >
            ¡Revisá tu email!
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: 24 }}>
            Enviamos el link de recuperación a
            <br />
            <strong style={{ color: '#0f172a' }}>{email}</strong>
          </p>

          {/* Dashed lines animation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280, margin: '0 auto 28px' }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 3,
                  background: 'repeating-linear-gradient(90deg, #bfdbfe 0 8px, transparent 8px 14px)',
                  borderRadius: 99,
                  animation: `mailDash 0.6s ease ${i * 0.15}s backwards`,
                }}
              />
            ))}
          </div>

          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: 16 }}>
            ¿No llegó?{' '}
            <button
              onClick={() => setSent(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.85rem',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Reenviar email
            </button>
          </p>

          <Link to="/login" style={{ color: '#64748b', fontSize: '0.88rem', textDecoration: 'none', fontWeight: 600 }}>
            ← Volver al inicio de sesión
          </Link>
        </div>
      ) : (
        <>
          {/* Icon tile */}
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 22,
              boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
            }}
          >
            <Unlock size={28} color="white" />
          </div>

          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              marginBottom: 6,
            }}
          >
            ¿Olvidaste tu contraseña?
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: 28 }}>
            Ingresá tu email y te enviamos un link para restablecerla.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Correo electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
                <input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 14px 12px 40px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.93rem',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 12,
                    background: '#fafafa',
                    outline: 'none',
                    color: '#111827',
                  }}
                />
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: '0.85rem',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 22px',
                borderRadius: 12,
                border: 'none',
                background: '#2563eb',
                color: 'white',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.75 : 1,
                boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
                marginTop: 4,
              }}
            >
              {loading ? 'Enviando…' : 'Enviar link de recuperación'}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
            <Link to="/login" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
              ← Volver al inicio de sesión
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
