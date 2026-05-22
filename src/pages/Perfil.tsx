// Perfil del cliente: edición de nombre y teléfono.
// Ruta: /perfil (protegida, cualquier rol autenticado)

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { updatePerfil } from '@/services/profileService'
import Navbar from '@/components/brand/Navbar'
import { User, Phone, Mail, Save, ArrowLeft, Check } from 'lucide-react'

export default function Perfil() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setNombre(profile.nombre ?? '')
      setTelefono(profile.telefono ?? '')
    }
  }, [profile])

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!nombre.trim()) {
      toast.error('El nombre no puede estar vacío')
      return
    }
    setGuardando(true)
    try {
      await updatePerfil(user.id, {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
      })
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toast.success('Perfil actualizado')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const initials = (profile?.nombre || '?')
    .split(' ')
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '36px 20px 60px' }}>

        {/* Back */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', color: '#64748b',
            fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
            padding: '0 0 20px', fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <ArrowLeft size={15} /> Volver
        </button>

        {/* Avatar + título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: '1.3rem',
            fontFamily: "'Space Grotesk', sans-serif",
            boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
          }}>
            {initials}
          </div>
          <div>
            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.5rem', fontWeight: 800,
              color: '#0f172a', letterSpacing: '-0.03em', margin: 0,
            }}>
              Mi perfil
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '3px 0 0' }}>
              Editá tu información personal
            </p>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleGuardar}>
          <div style={{
            background: 'white', borderRadius: 16,
            border: '1px solid #f1f5f9',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            overflow: 'hidden', marginBottom: 16,
          }}>

            {/* Email (solo lectura) */}
            <FieldRow
              icon={<Mail size={16} />}
              label="Email"
              readOnly
            >
              <div style={{ fontSize: '0.92rem', color: '#475569', fontWeight: 500 }}>
                {profile?.email || user?.email || '—'}
              </div>
              <div style={{
                fontSize: '0.72rem', color: '#94a3b8', marginTop: 2,
              }}>
                No se puede cambiar
              </div>
            </FieldRow>

            {/* Nombre */}
            <FieldRow icon={<User size={16} />} label="Nombre completo">
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                required
                style={inputStyle}
              />
            </FieldRow>

            {/* Teléfono */}
            <FieldRow icon={<Phone size={16} />} label="Teléfono" last>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: +54 9 11 1234-5678"
                style={inputStyle}
              />
            </FieldRow>
          </div>

          <button
            type="submit"
            disabled={guardando}
            style={{
              width: '100%', padding: '14px 20px',
              borderRadius: 12, border: 'none',
              background: saved ? '#16a34a' : '#2563eb',
              color: 'white',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '0.98rem', fontWeight: 700,
              cursor: guardando ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: saved
                ? '0 4px 14px rgba(22,163,74,0.25)'
                : '0 4px 14px rgba(37,99,235,0.25)',
              transition: 'background 0.2s',
            }}
          >
            {saved ? <><Check size={17} /> Guardado</> : guardando ? 'Guardando…' : <><Save size={17} /> Guardar cambios</>}
          </button>
        </form>

        {/* Rol badge */}
        {profile?.rol && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{
              display: 'inline-block',
              background: profile.rol === 'admin' ? '#eff6ff' : '#f1f5f9',
              color: profile.rol === 'admin' ? '#2563eb' : '#64748b',
              borderRadius: 99, padding: '4px 12px',
              fontSize: '0.75rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {profile.rol === 'admin' ? 'Administrador' : profile.rol === 'superadmin' ? 'Superadmin' : 'Cliente'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 0',
  border: 'none', outline: 'none',
  fontSize: '0.92rem', color: '#0f172a',
  fontFamily: "'DM Sans', sans-serif",
  background: 'transparent',
  boxSizing: 'border-box',
}

function FieldRow({
  icon, label, children, last = false, readOnly = false,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  last?: boolean
  readOnly?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      padding: '16px 20px',
      borderBottom: last ? 'none' : '1px solid #f1f5f9',
      background: readOnly ? '#fafafa' : 'white',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: readOnly ? '#f1f5f9' : '#eff6ff',
        color: readOnly ? '#94a3b8' : '#2563eb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.7rem', color: '#94a3b8',
          fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', marginBottom: 4,
        }}>
          {label}
        </div>
        {children}
      </div>
    </div>
  )
}
