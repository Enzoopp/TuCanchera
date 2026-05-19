// SRP: Esta página solo gestiona el formulario de registro de clientes.
// Diseño replicado de RegisterPage.jsx (Claude Design drop).
// Layout 60/40 con hero + formulario con medidor de fortaleza de contraseña.

import { useState, useMemo, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthShell from '@/components/brand/AuthShell'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  Phone,
  Sparkles,
  Check,
} from 'lucide-react'

const STRENGTH_LABEL = ['', 'Débil', 'Regular', 'Buena', 'Fuerte']
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']

export default function Register() {
  const navigate = useNavigate()
  const { signUp, signInWithGoogle } = useAuth()

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = useMemo(() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  }, [password])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!accepted) {
      setError('Tenés que aceptar los términos para continuar.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)

    const fullName = apellido ? `${nombre} ${apellido}`.trim() : nombre
    const { error } = await signUp(
      email,
      password,
      {
        nombre: fullName,
        telefono: telefono || undefined,
        rol: 'cliente',
      },
      `${window.location.origin}/auth/callback`,
    )

    setLoading(false)

    if (error) {
      setError(translateRegisterError(error.message))
      return
    }

    navigate('/login', {
      state: { message: 'Cuenta creada. Revisá tu email para confirmar el registro.' },
    })
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) {
      setError('No se pudo continuar con Google. Intentá de nuevo.')
      setGoogleLoading(false)
    }
  }

  return (
    <AuthShell
      hero="https://swisspadel.ch/wp-content/uploads/2024/07/DSC01134-1-2048x1366.jpg"
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
              Plataforma de Reserva de Canchas
          </span>
        </div>
      }
      title={
        <>
          Unite a 
          <br />
          TuCanchera
        </>
      }
      subtitle="Reservá canchas de fútbol 5, fútbol 7 y pádel en los mejores complejos cerca tuyo."
      heroFooter={
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, rowGap: 14 }}>
          {[
            'Sin costo de registro',
            'Confirmación instantánea',
            'Historial de reservas',
            'Cancelación flexible',
          ].map((t) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 99,
                  background: 'rgba(74,222,128,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#4ade80',
                }}
              >
                <Check size={14} strokeWidth={3} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.88rem' }}>{t}</span>
            </div>
          ))}
        </div>
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
        Crear cuenta gratis
      </h2>
      <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: 28 }}>
        Completá tus datos y empezá a reservar hoy.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FieldInput label="Nombre" icon={<UserIcon size={15} />} placeholder="Juan" value={nombre} onChange={setNombre} required />
          <FieldInput label="Apellido" placeholder="García" value={apellido} onChange={setApellido} />
        </div>
        <FieldInput label="Teléfono" icon={<Phone size={15} />} type="tel" placeholder="+54 11 1234-5678" value={telefono} onChange={setTelefono} />
        <FieldInput label="Correo electrónico" icon={<Mail size={15} />} type="email" placeholder="tu@email.com" value={email} onChange={setEmail} required autoComplete="email" />

        <div>
          <FieldInput
            label="Contraseña"
            icon={<Lock size={15} />}
            rightIcon={showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            onRightClick={() => setShowPass(!showPass)}
            type={showPass ? 'text' : 'password'}
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={setPassword}
            required
            autoComplete="new-password"
          />
          {password.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 99,
                      background: i <= strength ? STRENGTH_COLOR[strength] : '#e2e8f0',
                      transition: 'background 0.25s',
                    }}
                  />
                ))}
              </div>
              <span
                style={{
                  fontSize: '0.78rem',
                  color: STRENGTH_COLOR[strength],
                  fontWeight: 600,
                }}
              >
                {STRENGTH_LABEL[strength]}
              </span>
            </div>
          )}
        </div>

        <label
          htmlFor="terms"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginTop: 4,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            id="terms"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ marginTop: 2, accentColor: '#2563eb', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.5 }}>
            Acepto los{' '}
            <span style={{ color: '#2563eb', fontWeight: 600 }}>Términos de uso</span> y la{' '}
            <span style={{ color: '#2563eb', fontWeight: 600 }}>Política de privacidad</span>
          </span>
        </label>

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
            marginTop: 4,
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
          }}
        >
          {loading ? 'Creando cuenta…' : 'Crear cuenta gratis'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0' }}>
        <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontWeight: 600 }}>o registrate con</span>
        <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading || googleLoading}
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
          opacity: loading || googleLoading ? 0.7 : 1,
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

      <p style={{ marginTop: 24, textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
          Iniciá sesión
        </Link>
      </p>
    </AuthShell>
  )
}

// -- Field helper, same shape as Login's FieldInput --
interface FieldInputProps {
  label?: string
  icon?: React.ReactNode
  rightIcon?: React.ReactNode
  onRightClick?: () => void
  type?: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  autoComplete?: string
}

function FieldInput({
  label,
  icon,
  rightIcon,
  onRightClick,
  type = 'text',
  placeholder,
  value,
  onChange,
  required,
  autoComplete,
}: FieldInputProps) {
  return (
    <div>
      {label && (
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
      )}
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
          required={required}
          autoComplete={autoComplete}
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
    </div>
  )
}

function translateRegisterError(message: string): string {
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Este email ya está registrado.'
  }
  if (message.includes('valid email')) {
    return 'Ingresá un email válido.'
  }
  if (message.includes('Password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  return 'Ocurrió un error al crear la cuenta. Intentá de nuevo.'
}
