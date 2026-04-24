// SRP: Gestiona el formulario de inicio de sesión.
// Diseño replicado de LoginPage.jsx (Claude Design drop).
// Layout 60/40: hero fotográfico a la izquierda + formulario a la derecha.

import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthShell from '@/components/brand/AuthShell'
import { Mail, Lock, Eye, EyeOff, Sparkles, Check } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signInWithGoogle, user, rol, loading: authLoading } = useAuth()

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname
  const successMessage = (location.state as { message?: string })?.message

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleHint, setGoogleHint] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  useEffect(() => {
    if (!submitted) return
    if (authLoading) return
    if (!user) return

    if (from) {
      navigate(from, { replace: true })
    } else if (rol === 'superadmin') {
      navigate('/superadmin', { replace: true })
    } else if (rol === 'admin') {
      navigate('/admin/dashboard', { replace: true })
    } else {
      navigate('/explorar', { replace: true })
    }
  }, [submitted, authLoading, user, rol, from, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setGoogleHint(false)
    setSubmitted(false)

    try {
      const { error: signInError } = await signIn(email, password)
      if (signInError) {
        const isInvalidCreds = signInError.message.includes('Invalid login credentials')
        setGoogleHint(isInvalidCreds)
        setError(translateAuthError(signInError.message))
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Ocurrió un error inesperado. Intentá de nuevo.')
    }
  }

  const isLoading = submitted && (authLoading || !!user)

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setError('No se pudo iniciar sesión con Google. Intentá de nuevo.')
      setGoogleLoading(false)
    }
  }

  return (
    <AuthShell
      hero="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1400&q=85&fit=crop"
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
          <span style={{ color: '#bfdbfe', fontSize: '0.8rem', fontWeight: 600 }}>
            La plataforma de canchas #1 de Argentina
          </span>
        </div>
      }
      title={
        <>
          Reservá tu cancha
          <br />
          en segundos.
        </>
      }
      subtitle="Fútbol 5, fútbol 7 y pádel en los mejores complejos cerca tuyo — sin llamadas ni esperas."
      heroFooter={
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              'Disponibilidad en tiempo real',
              'Pago online con MercadoPago',
              'Confirmación instantánea por WhatsApp',
            ].map((b) => (
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
          <div style={{ display: 'flex', gap: 24 }}>
            {[
              { v: '2.000+', l: 'jugadores' },
              { v: '50+', l: 'complejos' },
              { v: '30 s', l: 'para reservar' },
            ].map((s) => (
              <div key={s.l}>
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: 'white',
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}
                >
                  {s.v}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.78rem', marginTop: 4 }}>
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </>
      }
    >
      <h2
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.85rem',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.03em',
          marginBottom: 6,
        }}
      >
        Bienvenido de nuevo
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: 28 }}>
        Iniciá sesión para seguir reservando.
      </p>

      {successMessage && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: '0.88rem',
            marginBottom: 18,
          }}
        >
          {successMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field
          label="Correo electrónico"
          icon={<Mail size={16} />}
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(v) => setEmail(v)}
          autoComplete="email"
          required
          disabled={isLoading}
        />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#374151',
              }}
            >
              Contraseña
            </label>
            <Link
              to="/forgot-password"
              style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
            >
              ¿La olvidaste?
            </Link>
          </div>
          <FieldInput
            icon={<Lock size={16} />}
            rightIcon={showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            onRightClick={() => setShowPass(!showPass)}
            type={showPass ? 'text' : 'password'}
            placeholder="Tu contraseña"
            value={password}
            onChange={(v) => setPassword(v)}
            autoComplete="current-password"
            required
            disabled={isLoading}
          />
        </div>

        {error && (
          <div
            style={{
              background: googleHint ? '#fffbeb' : '#fef2f2',
              border: `1px solid ${googleHint ? '#fde68a' : '#fecaca'}`,
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: '0.85rem',
            }}
          >
            <p style={{ color: googleHint ? '#92400e' : '#b91c1c', margin: 0 }}>
              {error}
            </p>
            {googleHint && (
              <p style={{ color: '#78350f', margin: '8px 0 0', fontSize: '0.82rem' }}>
                ¿Te registraste con Google?{' '}
                <button
                  type="button"
                  onClick={handleGoogle}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#d97706',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '0.82rem',
                    textDecoration: 'underline',
                  }}
                >
                  Ingresá con Google
                </button>
                {' '}— las cuentas de Google no tienen contraseña en la app.
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
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
            cursor: isLoading ? 'wait' : 'pointer',
            opacity: isLoading ? 0.75 : 1,
            transition: 'all 0.15s',
            marginTop: 4,
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
          }}
        >
          {isLoading ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </button>
      </form>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
        <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>o continuá con</span>
        <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isLoading || googleLoading}
        style={{
          width: '100%',
          padding: '12px 18px',
          borderRadius: 12,
          border: '1.5px solid #e2e8f0',
          background: 'white',
          color: '#374151',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.92rem',
          fontWeight: 600,
          cursor: googleLoading ? 'wait' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          transition: 'all 0.15s',
          opacity: isLoading || googleLoading ? 0.7 : 1,
        }}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {googleLoading ? 'Redirigiendo…' : 'Continuar con Google'}
      </button>

      <p
        style={{
          marginTop: 28,
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.88rem',
        }}
      >
        ¿No tenés cuenta?{' '}
        <Link
          to="/register"
          style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
        >
          Crear cuenta gratis
        </Link>
      </p>
    </AuthShell>
  )
}

// -- Field helpers (inline, matching design Input component) --

interface FieldProps {
  label: string
  icon?: React.ReactNode
  rightIcon?: React.ReactNode
  onRightClick?: () => void
  type?: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  required?: boolean
  disabled?: boolean
}

function Field({ label, ...rest }: FieldProps) {
  return (
    <div>
      <label
        style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          color: '#374151',
          display: 'block',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <FieldInput {...rest} />
    </div>
  )
}

function FieldInput({
  icon,
  rightIcon,
  onRightClick,
  type = 'text',
  placeholder,
  value,
  onChange,
  autoComplete,
  required,
  disabled,
}: Omit<FieldProps, 'label'>) {
  return (
    <div style={{ position: 'relative' }}>
      {icon && (
        <span
          style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {icon}
        </span>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: `12px 14px 12px ${icon ? 40 : 14}px`,
          paddingRight: rightIcon ? 44 : 14,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.93rem',
          border: '1.5px solid #e2e8f0',
          borderRadius: 12,
          background: '#fafafa',
          outline: 'none',
          color: '#111827',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#2563eb'
          e.currentTarget.style.background = 'white'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '#e2e8f0'
          e.currentTarget.style.background = '#fafafa'
        }}
      />
      {rightIcon && (
        <button
          type="button"
          onClick={onRightClick}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 6,
            display: 'flex',
          }}
        >
          {rightIcon}
        </button>
      )}
    </div>
  )
}

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos.'
  }
  if (message.includes('Email not confirmed')) {
    return 'Necesitás confirmar tu email antes de iniciar sesión. Revisá tu bandeja de entrada.'
  }
  if (message.includes('Too many requests')) {
    return 'Demasiados intentos. Esperá un momento e intentá de nuevo.'
  }
  return 'Ocurrió un error al iniciar sesión. Intentá de nuevo.'
}
