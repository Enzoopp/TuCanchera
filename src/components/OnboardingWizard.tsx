// Onboarding — wizard 3 pasos con diseño Claude.
// Paso 1: complejo (nombre, slug, descripción, dirección, logo)
// Paso 2: horarios semanales de atención
// Paso 3: primera cancha (tipo, nombre, precio, duración)
// Final: pantalla con confetti + check animado → redirige al dashboard.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import {
  crearComplejo,
  slugify,
  slugDisponible,
  uploadLogo,
  updateComplejo,
  crearCancha,
} from '@/services/adminService'
import type { TipoCancha } from '@/types'
import Logo from '@/components/brand/Logo'
import SportIcon from '@/components/brand/SportIcon'
import { Check, MapPin, Trophy, Upload } from 'lucide-react'

// ─── Constantes ──────────────────────────────────────────────────────────

type DayKey = 'Lun' | 'Mar' | 'Mié' | 'Jue' | 'Vie' | 'Sáb' | 'Dom'
const DAYS_ES: DayKey[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const DAY_TO_DB: Record<DayKey, number> = {
  Lun: 1,
  Mar: 2,
  Mié: 3,
  Jue: 4,
  Vie: 5,
  Sáb: 6,
  Dom: 0,
}

const SPORT_TYPES: Array<{ key: TipoCancha; label: string; bg: string; text: string }> = [
  { key: 'futbol5', label: 'Fútbol 5', bg: '#f0fdf4', text: '#16a34a' },
  { key: 'futbol7', label: 'Fútbol 7', bg: '#eff6ff', text: '#2563eb' },
  { key: 'padel', label: 'Pádel', bg: '#faf5ff', text: '#7c3aed' },
]

type HoursState = Record<DayKey, { on: boolean; open: number; close: number }>

const DEFAULT_HOURS: HoursState = {
  Lun: { on: true, open: 9, close: 23 },
  Mar: { on: true, open: 9, close: 23 },
  Mié: { on: true, open: 9, close: 23 },
  Jue: { on: true, open: 9, close: 23 },
  Vie: { on: true, open: 9, close: 24 },
  Sáb: { on: true, open: 10, close: 24 },
  Dom: { on: true, open: 10, close: 23 },
}

interface CourtDraft {
  sport: TipoCancha
  name: string
  price: number
  duration: 60 | 90
}

const onbHourInput: React.CSSProperties = {
  width: 56,
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: 'white',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '0.9rem',
  fontWeight: 700,
  color: '#0f172a',
  outline: 'none',
  textAlign: 'center',
  boxSizing: 'border-box',
}

// ─── Componente principal ─────────────────────────────────────────────────

export default function OnboardingWizard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [nombre, setNombre] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [direccion, setDireccion] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [hours, setHours] = useState<HoursState>(DEFAULT_HOURS)
  const [court, setCourt] = useState<CourtDraft>({
    sport: 'futbol5',
    name: '',
    price: 8000,
    duration: 60,
  })

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // autogenerar slug mientras el usuario no lo haya editado manualmente
  useEffect(() => {
    if (!slugManual) setSlug(slugify(nombre))
  }, [nombre, slugManual])

  const steps = [
    { n: 1, label: 'Tu complejo' },
    { n: 2, label: 'Horarios' },
    { n: 3, label: 'Primera cancha' },
  ] as const

  function setDay(day: DayKey, patch: Partial<HoursState[DayKey]>) {
    setHours((h) => ({ ...h, [day]: { ...h[day], ...patch } }))
  }

  function applyWeekdays() {
    setHours((h) => {
      const base = h.Lun
      return { ...h, Mar: { ...base }, Mié: { ...base }, Jue: { ...base }, Vie: { ...base } }
    })
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 2 * 1024 * 1024) {
      toast.error('El logo debe pesar menos de 2MB')
      return
    }
    setLogoFile(f)
    setLogoPreview(URL.createObjectURL(f))
  }

  // Validación por paso
  const step1Valid = nombre.trim().length >= 3 && slug.length >= 3
  const step2Valid = DAYS_ES.some((d) => hours[d].on)
  const step3Valid =
    court.name.trim().length >= 1 && court.price > 0 && (court.duration === 60 || court.duration === 90)

  async function avanzar() {
    setError(null)
    if (step === 1) {
      if (!step1Valid) {
        setError('Completá el nombre y elegí una URL de al menos 3 caracteres.')
        return
      }
      setSaving(true)
      try {
        const disponible = await slugDisponible(slug)
        if (!disponible) {
          setError('Esa URL ya está en uso. Probá con otra.')
          setSaving(false)
          return
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo validar la URL.')
        setSaving(false)
        return
      }
      setSaving(false)
      setStep(2)
    } else if (step === 2) {
      if (!step2Valid) {
        setError('Al menos un día tiene que estar habilitado.')
        return
      }
      setStep(3)
    } else if (step === 3) {
      if (!step3Valid) {
        setError('Completá los datos de la primera cancha.')
        return
      }
      await finalizar()
    }
  }

  function retroceder() {
    setError(null)
    if (step === 1) {
      navigate('/login')
    } else if (step === 2) {
      setStep(1)
    } else if (step === 3) {
      setStep(2)
    }
  }

  async function finalizar() {
    if (!profile) {
      setError('No se pudo identificar al usuario. Volvé a iniciar sesión.')
      return
    }
    setSaving(true)
    try {
      // 1. Crear complejo
      const complejo = await crearComplejo({
        adminId: profile.id,
        nombre: nombre.trim(),
        slug,
        descripcion: descripcion.trim() || undefined,
        direccion: direccion.trim() || undefined,
      })

      // 2. Upload logo si corresponde
      if (logoFile) {
        try {
          const url = await uploadLogo(complejo.id, logoFile)
          await updateComplejo(complejo.id, { logo_url: url })
        } catch (err) {
          console.error('Error subiendo logo', err)
          toast.error('El complejo se creó pero el logo no se pudo subir.')
        }
      }

      // 3. Crear primera cancha con horarios
      const horariosDB = DAYS_ES.filter((d) => hours[d].on).map((d) => ({
        dia_semana: DAY_TO_DB[d],
        hora_inicio: `${String(hours[d].open).padStart(2, '0')}:00:00`,
        hora_fin: `${String(Math.min(24, hours[d].close)).padStart(2, '0')}:00:00`,
      }))

      await crearCancha({
        complejoId: complejo.id,
        tipo: court.sport,
        nombre: court.name.trim(),
        precio: court.price,
        duracion_min: court.duration,
        horarios: horariosDB,
      })

      await queryClient.invalidateQueries({ queryKey: ['mi-complejo'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-canchas'] })

      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error al crear el complejo.')
    } finally {
      setSaving(false)
    }
  }

  const slugDisplay = useMemo(() => {
    if (!slug) return null
    return slug
  }, [slug])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#eff6ff',
        fontFamily: "'DM Sans', sans-serif",
        padding: '40px 20px 60px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Patrón de puntos decorativo */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4, pointerEvents: 'none' }}
      >
        <defs>
          <pattern id="dots-onb" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#bfdbfe" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots-onb)" />
      </svg>

      <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <Logo size="sm" />
        </div>

        {step < 4 ? (
          <>
            {/* Progress bar */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 0,
                  maxWidth: 500,
                  width: '100%',
                }}
              >
                {steps.map((s, i) => {
                  const done = step > s.n
                  const active = step === s.n
                  return (
                    <div key={s.n} style={{ display: 'contents' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 8,
                          flexShrink: 0,
                          width: 80,
                        }}
                      >
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 99,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: "'Space Grotesk', sans-serif",
                            fontWeight: 800,
                            fontSize: '1rem',
                            background: done ? '#16a34a' : active ? '#2563eb' : 'white',
                            color: done || active ? 'white' : '#94a3b8',
                            border: active ? 'none' : done ? 'none' : '2px solid #e2e8f0',
                            boxShadow: active ? '0 0 0 6px rgba(37,99,235,0.15)' : 'none',
                            transition: 'all 0.25s',
                          }}
                        >
                          {done ? <Check size={18} /> : s.n}
                        </div>
                        <div
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: active ? 700 : 600,
                            color: active ? '#1d4ed8' : done ? '#16a34a' : '#94a3b8',
                            textAlign: 'center',
                          }}
                        >
                          {s.label}
                        </div>
                      </div>
                      {i < steps.length - 1 && (
                        <div
                          style={{
                            flex: 1,
                            height: 2,
                            background: '#e2e8f0',
                            marginTop: 20,
                            borderRadius: 99,
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: '#16a34a',
                              transform: `scaleX(${step > s.n ? 1 : 0})`,
                              transformOrigin: 'left',
                              transition: 'transform 0.4s ease',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Card */}
            <div
              key={step}
              className="page-enter"
              style={{
                background: 'white',
                borderRadius: 20,
                padding: '36px 40px',
                boxShadow: '0 10px 40px rgba(15,23,42,0.08)',
                border: '1px solid #e2e8f0',
              }}
            >
              {step === 1 && (
                <>
                  <h2
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      letterSpacing: '-0.03em',
                      margin: '0 0 6px',
                    }}
                  >
                    Contanos sobre tu complejo
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: 24 }}>
                    Estos datos se mostrarán en tu página pública.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Nombre */}
                    <FieldLabel>Nombre del complejo</FieldLabel>
                    <TextInput
                      placeholder="Palermo Sport"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                    />

                    {/* URL */}
                    <div>
                      <FieldLabel>URL pública</FieldLabel>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 14px',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: 12,
                          background: '#f8fafc',
                          fontSize: '0.92rem',
                          gap: 0,
                        }}
                      >
                        <span style={{ color: '#94a3b8' }}>tucanchera.com/</span>
                        <input
                          value={slug}
                          onChange={(e) => {
                            setSlugManual(true)
                            setSlug(slugify(e.target.value))
                          }}
                          placeholder="tu-slug"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#2563eb',
                            fontFamily: "'DM Sans', sans-serif",
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            flex: 1,
                            minWidth: 0,
                          }}
                        />
                      </div>
                      {!slugDisplay && (
                        <p style={{ margin: '6px 0 0', fontSize: '0.74rem', color: '#94a3b8' }}>
                          Solo minúsculas, números y guiones. Se genera automáticamente a partir del nombre.
                        </p>
                      )}
                    </div>

                    {/* Descripción */}
                    <div>
                      <FieldLabel>Descripción</FieldLabel>
                      <textarea
                        rows={3}
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                        placeholder="Contá qué hace especial a tu complejo..."
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '12px 14px',
                          resize: 'vertical',
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '0.93rem',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: 12,
                          background: '#fafafa',
                          outline: 'none',
                          color: '#111827',
                          lineHeight: 1.5,
                        }}
                      />
                    </div>

                    {/* Dirección */}
                    <FieldLabel>Dirección</FieldLabel>
                    <TextInput
                      placeholder="Av. Santa Fe 4200, Palermo"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      icon={<MapPin size={15} />}
                    />

                    {/* Logo */}
                    <div>
                      <FieldLabel>Logo del complejo</FieldLabel>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            flexShrink: 0,
                            background: logoPreview
                              ? `url(${logoPreview}) center/cover`
                              : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '3px solid white',
                            boxShadow: '0 2px 10px rgba(37,99,235,0.25)',
                          }}
                        >
                          {!logoPreview && <Trophy size={34} color="white" />}
                        </div>
                        <label
                          style={{
                            flex: 1,
                            padding: '18px 20px',
                            border: '2px dashed #cbd5e1',
                            borderRadius: 12,
                            background: '#fafbfc',
                            textAlign: 'center',
                            cursor: 'pointer',
                            display: 'block',
                          }}
                        >
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleLogoChange}
                            style={{ display: 'none' }}
                          />
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Upload size={14} color="#475569" />
                            <span style={{ color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
                              {logoFile ? logoFile.name : 'Seleccioná un logo'}
                            </span>
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.76rem' }}>PNG o JPG, máx 2MB</div>
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap',
                      marginBottom: 24,
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontSize: '1.6rem',
                          fontWeight: 800,
                          color: '#0f172a',
                          letterSpacing: '-0.03em',
                          margin: '0 0 6px',
                        }}
                      >
                        ¿Cuándo abrís?
                      </h2>
                      <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>
                        Definí los horarios de atención por día.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={applyWeekdays}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 10,
                        border: '1.5px solid #bfdbfe',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.82rem',
                        fontWeight: 700,
                      }}
                    >
                      Aplicar lunes a viernes
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {DAYS_ES.map((day) => {
                      const h = hours[day]
                      return (
                        <div
                          key={day}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '60px auto 1fr 1fr',
                            gap: 12,
                            alignItems: 'center',
                            padding: '12px 14px',
                            borderRadius: 12,
                            background: h.on ? '#f8fafc' : '#fafafa',
                            border: '1px solid',
                            borderColor: h.on ? '#e2e8f0' : '#f1f5f9',
                            opacity: h.on ? 1 : 0.55,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'Space Grotesk', sans-serif",
                              fontSize: '0.92rem',
                              fontWeight: 700,
                              color: '#0f172a',
                            }}
                          >
                            {day}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDay(day, { on: !h.on })}
                            style={{
                              position: 'relative',
                              width: 40,
                              height: 22,
                              borderRadius: 99,
                              border: 'none',
                              background: h.on ? '#2563eb' : '#cbd5e1',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                          >
                            <span
                              style={{
                                position: 'absolute',
                                top: 2,
                                left: h.on ? 20 : 2,
                                width: 18,
                                height: 18,
                                borderRadius: 99,
                                background: 'white',
                                transition: 'left 0.2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                              }}
                            />
                          </button>
                          {h.on ? (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>
                                  DESDE
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={23}
                                  value={h.open}
                                  onChange={(e) =>
                                    setDay(day, { open: Math.max(0, Math.min(23, parseInt(e.target.value) || 0)) })
                                  }
                                  style={onbHourInput}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 600 }}>
                                  HASTA
                                </span>
                                <input
                                  type="number"
                                  min={1}
                                  max={24}
                                  value={h.close}
                                  onChange={(e) =>
                                    setDay(day, { close: Math.max(1, Math.min(24, parseInt(e.target.value) || 0)) })
                                  }
                                  style={onbHourInput}
                                />
                              </div>
                            </>
                          ) : (
                            <span
                              style={{
                                gridColumn: '3 / span 2',
                                fontSize: '0.82rem',
                                color: '#94a3b8',
                                fontStyle: 'italic',
                              }}
                            >
                              Cerrado
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '1.6rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      letterSpacing: '-0.03em',
                      margin: '0 0 6px',
                    }}
                  >
                    Agregá tu primera cancha
                  </h2>
                  <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: 24 }}>
                    Podés agregar más canchas después desde el panel.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <FieldLabel>Tipo de deporte</FieldLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {SPORT_TYPES.map((s) => {
                          const sel = court.sport === s.key
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={() => setCourt((c) => ({ ...c, sport: s.key }))}
                              style={{
                                padding: '18px 10px',
                                borderRadius: 14,
                                border: `2px solid ${sel ? s.text : '#e2e8f0'}`,
                                background: sel ? s.bg : 'white',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: 10,
                                color: sel ? s.text : '#475569',
                              }}
                            >
                              <SportIcon sport={s.key} size={32} />
                              <span
                                style={{
                                  fontSize: '0.88rem',
                                  fontWeight: 700,
                                  fontFamily: "'DM Sans', sans-serif",
                                }}
                              >
                                {s.label}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Nombre de la cancha</FieldLabel>
                      <TextInput
                        placeholder="Cancha 1 — F5 Césped"
                        value={court.name}
                        onChange={(e) => setCourt((c) => ({ ...c, name: e.target.value }))}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <FieldLabel>Precio por turno</FieldLabel>
                        <div style={{ position: 'relative' }}>
                          <span
                            style={{
                              position: 'absolute',
                              left: 14,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: '#94a3b8',
                              fontWeight: 600,
                            }}
                          >
                            $
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={court.price}
                            onChange={(e) =>
                              setCourt((c) => ({ ...c, price: parseInt(e.target.value) || 0 }))
                            }
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: '12px 14px 12px 28px',
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
                      <div>
                        <FieldLabel>Duración</FieldLabel>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {([60, 90] as const).map((d) => {
                            const sel = court.duration === d
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setCourt((c) => ({ ...c, duration: d }))}
                                style={{
                                  flex: 1,
                                  padding: '11px 0',
                                  borderRadius: 10,
                                  border: '1.5px solid',
                                  borderColor: sel ? '#2563eb' : '#e2e8f0',
                                  background: sel ? '#2563eb' : 'white',
                                  color: sel ? 'white' : '#475569',
                                  fontFamily: "'DM Sans', sans-serif",
                                  fontSize: '0.84rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {d} min
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Error */}
              {error && (
                <div
                  style={{
                    marginTop: 20,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    fontSize: '0.85rem',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Nav */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 32,
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={retroceder}
                  disabled={saving}
                  style={{
                    padding: '11px 20px',
                    borderRadius: 10,
                    border: '1.5px solid #e2e8f0',
                    background: 'white',
                    color: '#475569',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {step === 1 ? 'Cancelar' : 'Anterior'}
                </button>
                <button
                  type="button"
                  onClick={avanzar}
                  disabled={saving}
                  style={{
                    padding: '11px 22px',
                    borderRadius: 10,
                    border: 'none',
                    background: saving
                      ? '#93c5fd'
                      : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: 'white',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: saving ? 'none' : '0 2px 10px rgba(37,99,235,0.3)',
                  }}
                >
                  {saving
                    ? 'Guardando…'
                    : step === 3
                      ? 'Finalizar configuración →'
                      : 'Siguiente →'}
                </button>
              </div>
            </div>
          </>
        ) : (
          // Paso final con confetti
          <div className="page-enter" style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {Array.from({ length: 30 }).map((_, i) => {
                const colors = ['#2563eb', '#16a34a', '#f59e0b', '#ec4899', '#7c3aed']
                const color = colors[i % colors.length]
                const left = (i * 37) % 100
                const delay = (i * 0.15) % 2
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: -20,
                      left: `${left}%`,
                      width: 8,
                      height: 14,
                      background: color,
                      animation: `confettiFall ${2 + (i % 3) * 0.5}s ease-in ${delay}s infinite`,
                      borderRadius: 2,
                      transform: `rotate(${i * 30}deg)`,
                    }}
                  />
                )
              })}
            </div>

            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                margin: '0 auto 24px',
                background: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 12px rgba(22,163,74,0.15), 0 8px 30px rgba(22,163,74,0.3)',
                animation: 'popCheck 0.5s cubic-bezier(0.34,1.56,0.64,1)',
              }}
            >
              <svg
                width="56"
                height="56"
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
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '2.2rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.03em',
                margin: '0 0 10px',
              }}
            >
              ¡Listo! Tu complejo está configurado
            </h1>
            <p style={{ color: '#64748b', fontSize: '1.05rem', marginBottom: 30 }}>
              Ya podés empezar a recibir reservas.
            </p>
            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              style={{
                padding: '14px 28px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: 'white',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
              }}
            >
              Ir al dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Subcomponentes ───────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#374151',
        display: 'block',
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
  icon,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  icon?: React.ReactNode
}) {
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
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {icon}
        </span>
      )}
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: icon ? '12px 14px 12px 36px' : '12px 14px',
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
  )
}
