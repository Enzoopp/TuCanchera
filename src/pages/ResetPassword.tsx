// SRP: Solo gestiona el formulario para establecer la nueva contraseña.
// Diseño replicado de PasswordPages.jsx (NewPasswordPage).
// Incluye medidor de fortaleza, check de coincidencia y animación de éxito
// con progress bar automática hacia /login.

import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import AuthShell from '@/components/brand/AuthShell'
import { Lock, Eye, EyeOff, Check, Sparkles, ShieldCheck } from 'lucide-react'

const STRENGTH_LABEL = ['', 'Débil', 'Regular', 'Buena', 'Fuerte']
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Después de un reset exitoso: 2s de progress bar y al login
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => {
      navigate('/login', {
        state: {
          message: '¡Contraseña actualizada! Ya podés iniciar sesión con tu nueva contraseña.',
        },
      })
    }, 2000)
    return () => clearTimeout(timer)
  }, [done, navigate])

  const strength = useMemo(() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  }, [password])

  const matches = confirm.length > 0 && password === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError('No se pudo actualizar la contraseña. El link puede haber expirado.')
    } else {
      setDone(true)
    }
  }

  return (
    <AuthShell
      ratio="55/45"
      hero="https://images.unsplash.com/photo-1552667466-07770ae110d0?w=1400&q=85&fit=crop"
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
          <span style={{ color: '#bfdbfe', fontSize: '0.8rem', fontWeight: 600 }}>Cuenta segura</span>
        </div>
      }
      title={<>Elegí una<br />contraseña fuerte.</>}
      subtitle="Usá al menos 8 caracteres, combiná mayúsculas, números y símbolos. Tu cuenta, más segura."
    >
      {!ready ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div
            style={{
              width: 56,
              height: 56,
              margin: '0 auto 20px',
              border: '4px solid #dbeafe',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.4rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              marginBottom: 8,
            }}
          >
            Verificando link…
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Si este mensaje persiste, el link puede haber expirado.
            <br />
            <Link to="/forgot-password" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
              Solicitá uno nuevo
            </Link>
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : done ? (
        <div className="page-enter" style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: '50%',
              margin: '0 auto 24px',
              background: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 12px rgba(22,163,74,0.15), 0 8px 30px rgba(22,163,74,0.35)',
              animation: 'popCheck 0.5s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <svg
              width="52"
              height="52"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ strokeDasharray: 25, animation: 'drawCheck 0.6s ease 0.3s backwards' }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
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
            ¡Contraseña actualizada!
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: 24 }}>
            Te redirigimos al login en un instante…
          </p>
          <div style={{ height: 4, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', marginBottom: 20 }}>
            <div
              style={{
                height: '100%',
                background: '#16a34a',
                borderRadius: 99,
                animation: 'progress 2s linear forwards',
              }}
            />
          </div>
          <Link
            to="/login"
            style={{ color: '#2563eb', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none' }}
          >
            Ir ahora →
          </Link>
        </div>
      ) : (
        <>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 22,
              boxShadow: '0 4px 14px rgba(22,163,74,0.25)',
            }}
          >
            <ShieldCheck size={28} color="white" />
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
            Nueva contraseña
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: 28 }}>
            Elegí una contraseña nueva y segura para tu cuenta.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PasswordField
              label="Nueva contraseña"
              value={password}
              onChange={setPassword}
              show={showPass}
              onToggle={() => setShowPass(!showPass)}
              placeholder="Mínimo 8 caracteres"
              disabled={loading}
            />

            {password.length > 0 && (
              <div style={{ marginTop: -8 }}>
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
                <span style={{ fontSize: '0.78rem', color: STRENGTH_COLOR[strength], fontWeight: 600 }}>
                  {STRENGTH_LABEL[strength]}
                </span>
              </div>
            )}

            <PasswordField
              label="Confirmá la contraseña"
              value={confirm}
              onChange={setConfirm}
              show={showPass}
              onToggle={() => setShowPass(!showPass)}
              placeholder="Repetí la contraseña"
              disabled={loading}
            />

            {confirm.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.82rem',
                  marginTop: -8,
                  color: matches ? '#15803d' : '#b91c1c',
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 99,
                    background: matches ? '#dcfce7' : '#fee2e2',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {matches ? <Check size={12} strokeWidth={3} /> : '×'}
                </span>
                {matches ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
              </div>
            )}

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
              {loading ? 'Guardando…' : 'Guardar nueva contraseña'}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}

interface PwdProps {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  placeholder?: string
  disabled?: boolean
}

function PasswordField({ label, value, onChange, show, onToggle, placeholder, disabled }: PwdProps) {
  return (
    <div>
      <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <Lock
          size={16}
          color="#94a3b8"
          style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
        />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          autoComplete="new-password"
          disabled={disabled}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 44px 12px 40px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.93rem',
            border: '1.5px solid #e2e8f0',
            borderRadius: 12,
            background: '#fafafa',
            outline: 'none',
            color: '#111827',
          }}
        />
        <button
          type="button"
          onClick={onToggle}
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
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}
