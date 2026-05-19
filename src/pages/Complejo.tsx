// SRP: Página pública del complejo. Diseño replicado de ComplexPage.jsx
// (hero 420px + galería horizontal + chips de deporte + grid de canchas).
// Al hacer clic en una cancha, navega a /:slug/reservar/:canchaId donde se
// elige el slot específico (Reservar.tsx).

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTenant } from '@/context/TenantContext'
import { useCanchas } from '@/hooks/useCanchas'
import { useFotos } from '@/hooks/useFotos'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import ComplejoNoEncontrado from '@/pages/ComplejoNoEncontrado'
import Navbar from '@/components/brand/Navbar'
import SportIcon, { sportPalette, sportLabel } from '@/components/brand/SportIcon'
import { ChevronLeft, MapPin, Clock, Star, Calendar, Phone, X, ArrowRight } from 'lucide-react'
import type { Cancha, TipoCancha } from '@/types'

// Hero fallback si el complejo no tiene fotos cargadas
const FALLBACK_HERO =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&q=85&fit=crop'

type SportFilter = 'Todos' | 'Fútbol 5' | 'Fútbol 7' | 'Pádel'

export default function Complejo() {
  const { complejo, loading: loadingComplejo, error } = useTenant()
  const { data: canchas, isLoading: loadingCanchas } = useCanchas(complejo?.id)
  const { data: fotos } = useFotos(complejo?.id)
  const navigate = useNavigate()

  const [sportFilter, setSportFilter] = useState<SportFilter>('Todos')
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Tipos de deporte disponibles en este complejo
  const sportsDisponibles = useMemo(() => {
    if (!canchas) return [] as Array<'Fútbol 5' | 'Fútbol 7' | 'Pádel'>
    const setTipos = new Set<TipoCancha>()
    canchas.forEach((c) => setTipos.add(c.tipo))
    return Array.from(setTipos).map((t) => sportLabel(t))
  }, [canchas])

  const canchasFiltradas = useMemo(() => {
    if (!canchas) return []
    if (sportFilter === 'Todos') return canchas
    return canchas.filter((c) => sportLabel(c.tipo) === sportFilter)
  }, [canchas, sportFilter])

  useDocumentMeta({
    title: complejo
      ? `${complejo.nombre} — Reservá tu cancha | TuCanchera`
      : 'TuCanchera',
    description: complejo
      ? `Reservá canchas en ${complejo.nombre}. ${complejo.direccion ?? ''} — Disponibilidad en tiempo real.`
      : 'Reservá canchas de fútbol y pádel en tiempo real.',
    ogImage: fotos && fotos.length > 0 ? fotos[0].url : FALLBACK_HERO,
    ogUrl: window.location.href,
    canonical: window.location.href,
  })

  if (loadingComplejo) return <ComplejoSkeleton />
  if (error || !complejo) return <ComplejoNoEncontrado />

  const heroImg = fotos && fotos.length > 0 ? fotos[0].url : FALLBACK_HERO
  const chips: SportFilter[] = ['Todos', ...(sportsDisponibles as SportFilter[])]

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Navbar />

      {/* ── HERO 420px ────────────────────────────────────────────────────── */}
      <div className="complex-hero" style={{ position: 'relative', height: 420, overflow: 'hidden' }}>
        <img
          src={heroImg}
          alt={complejo.nombre}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(15,23,42,0.35) 0%, rgba(15,23,42,0.75) 100%)',
          }}
        />

        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate('/explorar')}
          style={{
            position: 'absolute',
            top: 24,
            left: 32,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 10,
            color: 'white',
            padding: '8px 16px',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
          Volver
        </button>

        {/* Complex info */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '32px 40px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 24,
            flexWrap: 'wrap',
          }}
          className="complex-hero-info"
        >
          {/* Logo o inicial */}
          <div
            className="complex-logo"
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              flexShrink: 0,
              background: complejo.logo_url
                ? `#0f172a`
                : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid white',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              marginBottom: -20,
              overflow: 'hidden',
            }}
          >
            {complejo.logo_url ? (
              <img
                src={complejo.logo_url}
                alt={`Logo ${complejo.nombre}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span
                style={{
                  color: 'white',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '2.4rem',
                  fontWeight: 800,
                }}
              >
                {complejo.nombre.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="complex-info-text" style={{ paddingBottom: 20, minWidth: 0, flex: 1 }}>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: 'white',
                fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                margin: '0 0 8px',
                textShadow: '0 2px 12px rgba(0,0,0,0.3)',
                lineHeight: 1.1,
              }}
            >
              {complejo.nombre}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {complejo.direccion && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: '0.88rem',
                  }}
                >
                  <MapPin size={15} color="#93c5fd" />
                  {complejo.direccion}
                </div>
              )}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: '0.88rem',
                }}
              >
                <Star size={15} color="#f59e0b" fill="#f59e0b" />
                Nuevo en TuCanchera
              </div>
            </div>
          </div>

          <div className="complex-cta" style={{ marginLeft: 'auto', paddingBottom: 20 }}>
            <a
              className="complex-cta-btn"
              href="#canchas"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#2563eb',
                color: 'white',
                padding: '14px 22px',
                borderRadius: 12,
                border: 'none',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.95rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                cursor: 'pointer',
              }}
            >
              <Calendar size={17} />
              Reservar ahora
            </a>
          </div>
        </div>
      </div>

      {/* ── Chips de deporte debajo del hero ──────────────────────────────── */}
      <div
        style={{
          background: 'white',
          borderBottom: '1px solid #f1f5f9',
          padding: '28px 40px 18px',
          paddingLeft: 180,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
        className="complex-sport-chips"
      >
        {sportsDisponibles.length > 0 ? (
          sportsDisponibles.map((s) => {
            const pal = sportPalette(s)
            return (
              <span
                key={s}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: pal.bg,
                  color: pal.text,
                  padding: '6px 14px',
                  borderRadius: 99,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                <SportIcon sport={s} size={14} color={pal.text} />
                {s}
              </span>
            )
          })
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Sin canchas cargadas
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <a
            href="https://wa.me/543435059834"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 10,
              background: 'transparent',
              color: '#64748b',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <Phone size={15} />
            Contactar
          </a>
        </div>
      </div>

      {/* ── Galería + canchas ─────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px' }}>
        {/* Descripción */}
        {complejo.descripcion && (
          <div
            style={{
              background: 'white',
              borderRadius: 14,
              padding: '20px 22px',
              border: '1px solid #f1f5f9',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              marginBottom: 32,
            }}
          >
            <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
              {complejo.descripcion}
            </p>
          </div>
        )}

        {/* Galería */}
        {fotos && fotos.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                marginBottom: 16,
              }}
            >
              Galería
            </h2>
            <div
              style={{
                display: 'flex',
                gap: 12,
                overflowX: 'auto',
                paddingBottom: 8,
                scrollbarWidth: 'thin',
              }}
            >
              {fotos.map((foto) => (
                <button
                  type="button"
                  key={foto.id}
                  onClick={() => setLightbox(foto.url)}
                  style={{
                    width: 200,
                    height: 130,
                    borderRadius: 12,
                    overflow: 'hidden',
                    flexShrink: 0,
                    cursor: 'pointer',
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <img
                    src={foto.url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Canchas */}
        <div id="canchas">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Canchas disponibles
            </h2>
            {chips.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {chips.map((s) => {
                  const active = sportFilter === s
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSportFilter(s)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: 99,
                        border: '1.5px solid',
                        borderColor: active ? '#2563eb' : '#e2e8f0',
                        background: active ? '#2563eb' : 'white',
                        color: active ? 'white' : '#374151',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {loadingCanchas ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 20,
              }}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <CourtSkeleton key={i} />
              ))}
            </div>
          ) : canchasFiltradas.length === 0 ? (
            <div
              style={{
                background: 'white',
                borderRadius: 14,
                border: '1.5px dashed #cbd5e1',
                padding: 48,
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.95rem',
              }}
            >
              {canchas && canchas.length > 0
                ? 'No hay canchas que coincidan con este filtro.'
                : 'Este complejo todavía no tiene canchas cargadas.'}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 20,
              }}
            >
              {canchasFiltradas.map((c, idx) => (
                <CourtCard
                  key={c.id}
                  cancha={c}
                  slug={complejo.slug}
                  fallbackIdx={idx}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <img
            src={lightbox}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setLightbox(null)
            }}
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 99,
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X color="white" />
          </button>
        </div>
      )}

      <style>{`
        /* Tablet */
        @media (max-width: 900px) {
          .complex-hero-info { padding: 20px !important; }
          .complex-sport-chips { padding-left: 20px !important; padding-right: 20px !important; }
        }
        /* Mobile */
        @media (max-width: 640px) {
          .complex-hero { height: 320px !important; }
          .complex-hero-info {
            padding: 14px 14px 18px !important;
            gap: 10px !important;
            align-items: flex-start !important;
          }
          .complex-logo {
            width: 56px !important;
            height: 56px !important;
            margin-bottom: 0 !important;
            border-radius: 12px !important;
          }
          .complex-info-text {
            padding-bottom: 0 !important;
          }
          .complex-cta {
            flex-basis: 100% !important;
            width: 100% !important;
            margin-left: 0 !important;
            padding-bottom: 0 !important;
          }
          .complex-cta-btn {
            width: 100% !important;
            box-sizing: border-box !important;
            justify-content: center !important;
            display: inline-flex !important;
          }
          .complex-sport-chips {
            padding: 18px 14px 14px !important;
          }
        }
      `}</style>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Subcomponentes                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

const COURT_FALLBACK_IMGS = [
  'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=400&q=80&fit=crop',
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=400&q=80&fit=crop',
  'https://images.unsplash.com/photo-1551958219-acbc04e21db8?w=400&q=80&fit=crop',
  'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&q=80&fit=crop',
  'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=400&q=80&fit=crop',
  'https://images.unsplash.com/photo-1508098682722-e99c643e3485?w=400&q=80&fit=crop',
]

function CourtCard({
  cancha,
  slug,
  fallbackIdx,
}: {
  cancha: Cancha
  slug: string
  fallbackIdx: number
}) {
  const [hovered, setHovered] = useState(false)
  const sport = sportLabel(cancha.tipo)
  const pal = sportPalette(sport)
  const img = COURT_FALLBACK_IMGS[fallbackIdx % COURT_FALLBACK_IMGS.length]

  return (
    <Link
      to={`/${slug}/reservar/${cancha.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        textDecoration: 'none',
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: hovered ? '0 12px 40px rgba(0,0,0,0.12)' : '0 2px 12px rgba(0,0,0,0.06)',
        border: '1px solid #f1f5f9',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
      }}
    >
      <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
        <img
          src={img}
          alt={cancha.nombre}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.35s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 6,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: pal.bg,
              color: pal.text,
              padding: '4px 10px',
              borderRadius: 99,
              fontSize: '0.74rem',
              fontWeight: 700,
            }}
          >
            <SportIcon sport={sport} size={12} color={pal.text} />
            {sport}
          </span>
          <span
            style={{
              background: 'rgba(22,163,74,0.95)',
              color: 'white',
              padding: '4px 10px',
              borderRadius: 99,
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            Ver turnos
          </span>
        </div>
      </div>
      <div style={{ padding: '16px 18px 18px' }}>
        <h3
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '0.95rem',
            fontWeight: 700,
            color: '#0f172a',
            margin: '0 0 10px',
            letterSpacing: '-0.01em',
          }}
        >
          {cancha.nombre}
        </h3>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              color: '#64748b',
              fontSize: '0.82rem',
            }}
          >
            <Clock size={14} />
            {cancha.duracion_min} min
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.2rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              ${cancha.precio.toLocaleString('es-AR')}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 1 }}>por turno</div>
          </div>
        </div>
        <div
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 10,
            background: '#2563eb',
            color: 'white',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.87rem',
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
          }}
        >
          Reservar turno
          <ArrowRight size={14} />
        </div>
      </div>
    </Link>
  )
}

function CourtSkeleton() {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #f1f5f9',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ height: 160, background: '#f1f5f9' }} />
      <div style={{ padding: '16px 18px 18px' }}>
        <div style={{ height: 14, background: '#f1f5f9', borderRadius: 6, marginBottom: 10, width: '70%' }} />
        <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, marginBottom: 16, width: '50%' }} />
        <div style={{ height: 36, background: '#f1f5f9', borderRadius: 10 }} />
      </div>
    </div>
  )
}

function ComplejoSkeleton() {
  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ height: 420, background: '#e2e8f0' }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px' }}>
        <div style={{ height: 28, background: '#e2e8f0', borderRadius: 8, width: 240, marginBottom: 24 }} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}
        >
          {[1, 2, 3].map((i) => (
            <CourtSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

