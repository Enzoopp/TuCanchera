// SRP: Edición de datos del complejo + logo + galería de fotos.
// Diseño replicado de AdminComplex.jsx — tabs (Info / Logo / Fotos),
// sticky header con botones, vista previa en card derecha.
// Upload a Supabase Storage (buckets 'logos' y 'fotos-complejos').

import { useEffect, useState, type ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchFotosByComplejo } from '@/services/complejoService'
import {
  updateComplejo,
  uploadLogo,
  uploadFotoComplejo,
  deleteFotoComplejo,
  reordenarFotos,
} from '@/services/adminService'
import OnboardingWizard from '@/components/OnboardingWizard'
import {
  Check,
  MapPin,
  Phone,
  Clock,
  Trophy,
  Upload,
  Plus,
  X,
  Trash2,
  Star,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

const MAX_DESC = 280

type SectionKey = 'info' | 'logo' | 'photos'

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'info', label: 'Información general' },
  { key: 'logo', label: 'Logo' },
  { key: 'photos', label: 'Galería de fotos' },
]

export default function GestionComplejo() {
  const queryClient = useQueryClient()
  const { data: complejo, isLoading } = useMiComplejo()

  const [section, setSection] = useState<SectionKey>('info')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [direccion, setDireccion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    if (complejo) {
      setNombre(complejo.nombre)
      setDescripcion(complejo.descripcion ?? '')
      setDireccion(complejo.direccion ?? '')
    }
  }, [complejo])

  const { data: fotos } = useQuery({
    queryKey: ['fotos', complejo?.id],
    queryFn: () => fetchFotosByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  function handleCancel() {
    if (!complejo) return
    setNombre(complejo.nombre)
    setDescripcion(complejo.descripcion ?? '')
    setDireccion(complejo.direccion ?? '')
  }

  async function handleGuardar() {
    if (!complejo) return
    setGuardando(true)
    try {
      await updateComplejo(complejo.id, { nombre, descripcion, direccion })
      await queryClient.invalidateQueries({ queryKey: ['mi-complejo'] })
      setShowToast(true)
      setTimeout(() => setShowToast(false), 2800)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function handleLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !complejo) return
    setSubiendoLogo(true)
    try {
      const url = await uploadLogo(complejo.id, file)
      await updateComplejo(complejo.id, { logo_url: url })
      await queryClient.invalidateQueries({ queryKey: ['mi-complejo'] })
      toast.success('Logo actualizado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir logo')
    } finally {
      setSubiendoLogo(false)
      e.target.value = ''
    }
  }

  async function handleFoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !complejo) return
    setSubiendoFoto(true)
    try {
      const orden = (fotos?.length ?? 0) + 1
      await uploadFotoComplejo(complejo.id, file, orden)
      await queryClient.invalidateQueries({ queryKey: ['fotos', complejo.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir foto')
    } finally {
      setSubiendoFoto(false)
      e.target.value = ''
    }
  }

  async function handleEliminarFoto(id: string) {
    if (!complejo) return
    try {
      await deleteFotoComplejo(id)
      await queryClient.invalidateQueries({ queryKey: ['fotos', complejo.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  async function handleMover(idx: number, dir: -1 | 1) {
    if (!fotos || !complejo) return
    const nuevo = [...fotos]
    const target = idx + dir
    if (target < 0 || target >= nuevo.length) return
    ;[nuevo[idx], nuevo[target]] = [nuevo[target], nuevo[idx]]
    const updates = nuevo.map((f, i) => ({ id: f.id, orden: i + 1 }))
    try {
      await reordenarFotos(updates)
      await queryClient.invalidateQueries({ queryKey: ['fotos', complejo.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al reordenar')
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: 32, color: '#64748b', fontFamily: "'DM Sans', sans-serif" }}>
        Cargando complejo…
      </div>
    )
  }

  if (!complejo) {
    return <OnboardingWizard />
  }

  const slug = complejo.slug
  const portada = fotos?.[0]?.url

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#f8fafc', minHeight: '100vh' }}>
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px 32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: 1400,
            margin: '0 auto',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.4rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                margin: '0 0 2px',
              }}
            >
              Mi Complejo
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
              Editá la información pública de tu complejo.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleCancel} style={btnOutline} disabled={guardando}>
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              style={btnPrimary}
              disabled={guardando || section !== 'info'}
              title={section !== 'info' ? 'Sólo aplica a la sección de información' : ''}
            >
              <Check size={16} />
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 32px 60px', maxWidth: 1400, margin: '0 auto' }}>
        <div
          className="complex-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 340px',
            gap: 28,
          }}
        >
          {/* Left: editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            {/* Section tabs */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                borderBottom: '2px solid #f1f5f9',
                marginBottom: 4,
                overflowX: 'auto',
              }}
            >
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  style={{
                    position: 'relative',
                    background: 'none',
                    border: 'none',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: section === s.key ? '#2563eb' : '#64748b',
                    letterSpacing: '-0.01em',
                    transition: 'color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.label}
                  {section === s.key && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: '#2563eb',
                        borderRadius: '3px 3px 0 0',
                      }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Info section */}
            {section === 'info' && (
              <div style={card}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <FormField
                    label="Nombre del complejo"
                    value={nombre}
                    onChange={setNombre}
                  />

                  {/* Slug preview */}
                  <div>
                    <label style={fieldLabel}>URL pública</label>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '11px 14px',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: 12,
                        background: '#f8fafc',
                        fontSize: '0.9rem',
                        fontFamily: "'DM Sans', sans-serif",
                        overflow: 'hidden',
                      }}
                    >
                      <span style={{ color: '#94a3b8', flexShrink: 0 }}>tucanchera.com/</span>
                      <span
                        style={{
                          color: '#2563eb',
                          fontWeight: 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {slug}
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: '0.7rem',
                          color: '#94a3b8',
                          flexShrink: 0,
                          paddingLeft: 8,
                        }}
                      >
                        no se puede modificar
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={fieldLabel}>Descripción</label>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: descripcion.length > MAX_DESC ? '#dc2626' : '#94a3b8',
                        }}
                      >
                        {descripcion.length}/{MAX_DESC}
                      </span>
                    </div>
                    <textarea
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      rows={4}
                      placeholder="Contá qué tipo de canchas tenés, servicios, ambiente…"
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

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: 14,
                    }}
                  >
                    <FormField
                      label="Dirección"
                      value={direccion}
                      onChange={setDireccion}
                      icon={<MapPin size={16} color="#94a3b8" />}
                      placeholder="Av. Santa Fe 4200, Palermo"
                    />
                    <FormField
                      label="Teléfono de contacto"
                      value={complejo.admin_id ? '—' : ''}
                      onChange={() => undefined}
                      icon={<Phone size={16} color="#94a3b8" />}
                      placeholder="+54 11 4831-9922"
                      readOnly
                      hint="Se gestiona desde tu perfil"
                    />
                  </div>
                  <FormField
                    label="Horario de atención"
                    value="—"
                    onChange={() => undefined}
                    icon={<Clock size={16} color="#94a3b8" />}
                    placeholder="Lun-Dom 8:00 - 24:00"
                    readOnly
                    hint="Se calcula desde los horarios de cada cancha"
                  />
                </div>
              </div>
            )}

            {/* Logo section */}
            {section === 'logo' && (
              <div style={card}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 24,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: complejo.logo_url
                        ? `url("${complejo.logo_url}") center/cover, linear-gradient(135deg, #2563eb, #1d4ed8)`
                        : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '4px solid white',
                      boxShadow: '0 4px 20px rgba(37,99,235,0.3)',
                      overflow: 'hidden',
                    }}
                  >
                    {!complejo.logo_url && <Trophy size={52} color="white" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <h4
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        margin: '0 0 4px',
                      }}
                    >
                      Logo del complejo
                    </h4>
                    <p
                      style={{
                        color: '#64748b',
                        fontSize: '0.85rem',
                        marginBottom: 16,
                        lineHeight: 1.5,
                      }}
                    >
                      Formato cuadrado, mínimo 400×400px. PNG o JPG, máximo 2MB.
                    </p>
                    <label style={btnOutline}>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleLogo}
                        disabled={subiendoLogo}
                      />
                      <Upload size={15} />
                      {subiendoLogo ? 'Subiendo…' : 'Cambiar logo'}
                    </label>
                  </div>
                </div>

                {/* Drop zone (visual only) */}
                <label
                  style={{
                    display: 'block',
                    marginTop: 20,
                    padding: '32px 24px',
                    border: '2px dashed #cbd5e1',
                    borderRadius: 14,
                    background: '#fafbfc',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogo}
                    disabled={subiendoLogo}
                  />
                  <Upload size={32} color="#94a3b8" />
                  <p
                    style={{
                      color: '#475569',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      margin: '10px 0 4px',
                    }}
                  >
                    Arrastrá tu nuevo logo acá
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', margin: 0 }}>
                    o hacé clic para buscar
                  </p>
                </label>
              </div>
            )}

            {/* Photos section */}
            {section === 'photos' && (
              <div style={card}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <h4
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      margin: 0,
                    }}
                  >
                    Fotos del complejo
                  </h4>
                  <span
                    style={{
                      background: (fotos?.length ?? 0) >= 10 ? '#fef2f2' : '#eff6ff',
                      color: (fotos?.length ?? 0) >= 10 ? '#dc2626' : '#1d4ed8',
                      padding: '4px 12px',
                      borderRadius: 99,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                    }}
                  >
                    {fotos?.length ?? 0}/10 fotos
                  </span>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: 16 }}>
                  Usá las flechas para reordenar. La primera foto es la principal.
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 12,
                  }}
                >
                  {(fotos ?? []).map((f, i) => (
                    <div
                      key={f.id}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '2px solid transparent',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}
                    >
                      <img
                        src={f.url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {i === 0 && (
                        <div style={{ position: 'absolute', top: 8, left: 8 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '3px 9px',
                              borderRadius: 99,
                              background: '#2563eb',
                              color: 'white',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              letterSpacing: '0.02em',
                            }}
                          >
                            Principal
                          </span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          display: 'flex',
                          gap: 4,
                        }}
                      >
                        {i > 0 && (
                          <button
                            onClick={() => handleMover(i, -1)}
                            title="Mover arriba"
                            style={photoBtn}
                          >
                            <ArrowUp size={13} />
                          </button>
                        )}
                        {fotos && i < fotos.length - 1 && (
                          <button
                            onClick={() => handleMover(i, 1)}
                            title="Mover abajo"
                            style={photoBtn}
                          >
                            <ArrowDown size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => handleEliminarFoto(f.id)}
                          title="Eliminar"
                          style={{ ...photoBtn, color: 'white', background: 'rgba(220,38,38,0.85)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* Add */}
                  {(fotos?.length ?? 0) < 10 && (
                    <label
                      style={{
                        aspectRatio: '1',
                        borderRadius: 12,
                        border: '2px dashed #cbd5e1',
                        background: '#fafbfc',
                        cursor: subiendoFoto ? 'wait' : 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        color: '#64748b',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#2563eb'
                        e.currentTarget.style.background = '#eff6ff'
                        e.currentTarget.style.color = '#2563eb'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1'
                        e.currentTarget.style.background = '#fafbfc'
                        e.currentTarget.style.color = '#64748b'
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFoto}
                        disabled={subiendoFoto}
                      />
                      <Plus size={22} />
                      <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                        {subiendoFoto ? 'Subiendo…' : 'Subir foto'}
                      </span>
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: live preview */}
          <div className="complex-preview" style={{ alignSelf: 'flex-start', position: 'sticky', top: 100 }}>
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 10,
              }}
            >
              Vista previa en la landing
            </div>
            <div
              style={{
                background: '#f8fafc',
                padding: 16,
                borderRadius: 16,
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    height: 150,
                    overflow: 'hidden',
                    background: '#f1f5f9',
                  }}
                >
                  {portada && (
                    <img
                      src={portada}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>
                <div style={{ padding: '14px 16px 16px' }}>
                  <h4
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      margin: '0 0 4px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {nombre || 'Nombre del complejo'}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
                    <MapPin size={12} color="#94a3b8" />
                    <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                      {direccion || 'Dirección…'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Star size={12} color="#94a3b8" />
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          marginLeft: 3,
                          fontWeight: 600,
                        }}
                      >
                        Nuevo
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        color: '#0f172a',
                      }}
                    >
                      Ver canchas →
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 10, lineHeight: 1.5 }}>
              Así se verá tu complejo en la página de búsqueda. Los cambios se reflejan al guardar.
            </p>
          </div>
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: 'white',
            borderRadius: 14,
            padding: '14px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            border: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 99,
              background: '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={17} color="#16a34a" />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
              Cambios guardados
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Tu complejo se actualizó correctamente.
            </div>
          </div>
          <button
            onClick={() => setShowToast(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 980px) {
          .complex-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .complex-preview {
            position: static !important;
          }
        }
      `}</style>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Sub-utils                                  */
/* -------------------------------------------------------------------------- */

function FormField({
  label,
  value,
  onChange,
  icon,
  placeholder,
  readOnly,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  icon?: React.ReactNode
  placeholder?: string
  readOnly?: boolean
  hint?: string
}) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <div
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            {icon}
          </div>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: icon ? '11px 14px 11px 40px' : '11px 14px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.93rem',
            border: '1.5px solid #e2e8f0',
            borderRadius: 12,
            background: readOnly ? '#f8fafc' : '#fafafa',
            outline: 'none',
            color: readOnly ? '#94a3b8' : '#111827',
          }}
        />
      </div>
      {hint && (
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>{hint}</div>
      )}
    </div>
  )
}

const fieldLabel: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#374151',
  display: 'block',
  marginBottom: 6,
}

const card: React.CSSProperties = {
  background: 'white',
  borderRadius: 16,
  padding: 24,
  border: '1px solid #f1f5f9',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  borderRadius: 12,
  border: 'none',
  background: '#2563eb',
  color: 'white',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '0.88rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(37,99,235,0.25)',
}

const btnOutline: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 18px',
  borderRadius: 12,
  border: '1.5px solid #e2e8f0',
  background: 'white',
  color: '#0f172a',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '0.88rem',
  fontWeight: 700,
  cursor: 'pointer',
}

const photoBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 8,
  background: 'rgba(255,255,255,0.92)',
  border: 'none',
  color: '#0f172a',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
