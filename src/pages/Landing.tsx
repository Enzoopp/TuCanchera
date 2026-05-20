// SRP: Página pública de inicio. Lista todos los complejos activos
// para que los clientes puedan descubrirlos, y ofrece accesos a login/registro.
// Diseño replicado de LandingPage.jsx (hero + search + grid + owner CTA + footer).

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchComplejosActivos } from '@/services/complejoService'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import Navbar from '@/components/brand/Navbar'
import SportIcon from '@/components/brand/SportIcon'
import { Search, ChevronDown, MapPin, ArrowRight, Sparkles, Building2, Star } from 'lucide-react'
import type { Cancha, Complejo, TipoCancha } from '@/types'

const SPORTS = ['Todos', 'Fútbol 5', 'Fútbol 7', 'Pádel'] as const
type SportFilter = (typeof SPORTS)[number]

// Mapea tipo DB → label
const TIPO_TO_LABEL: Record<TipoCancha, 'Fútbol 5' | 'Fútbol 7' | 'Pádel'> = {
  futbol5: 'Fútbol 5',
  futbol7: 'Fútbol 7',
  padel: 'Pádel',
}

// Fotos de fallback por tipo (cuando el complejo no tiene logo)
const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1508098682722-e99c643e3485?w=600&q=80&fit=crop'

interface ComplejoEnriquecido extends Complejo {
  sports: Array<'Fútbol 5' | 'Fútbol 7' | 'Pádel'>
  priceFrom: number | null
}

// Helper: extrae ciudades únicas de una lista de complejos
function getCiudades(complejos: ComplejoEnriquecido[]): string[] {
  const set = new Set<string>()
  for (const c of complejos) {
    if (c.ciudad) set.add(c.ciudad.trim())
  }
  return Array.from(set).sort()
}

async function fetchAllCanchasActivas(): Promise<Cancha[]> {
  const { data, error } = await supabase
    .from('canchas')
    .select('id, complejo_id, tipo, nombre, duracion_min, precio, activa')
    .eq('activa', true)
  if (error) throw error
  return data as Cancha[]
}

export default function Landing() {
  useDocumentMeta({
    title: 'TuCanchera — Reservá canchas de fútbol y pádel',
    description:
      'Encontrá y reservá canchas de fútbol 5, fútbol 7 y pádel cerca tuyo. Disponibilidad en tiempo real, sin llamadas.',
    ogImage: 'https://images.unsplash.com/photo-1508098682722-e99c643e3485?w=1200&q=80&fit=crop',
    canonical: window.location.origin,
  })

  const [sport, setSport] = useState<SportFilter>('Todos')
  const [search, setSearch] = useState('')
  const [ciudadFilter, setCiudadFilter] = useState('Todas')

  const { data: complejos, isLoading: loadingComplejos } = useQuery({
    queryKey: ['complejos-activos'],
    queryFn: fetchComplejosActivos,
  })

  const { data: canchas, isLoading: loadingCanchas } = useQuery({
    queryKey: ['canchas-all-activas'],
    queryFn: fetchAllCanchasActivas,
  })

  const enriquecidos: ComplejoEnriquecido[] = useMemo(() => {
    if (!complejos) return []
    const map: Record<string, Cancha[]> = {}
    if (canchas) {
      for (const c of canchas) {
        if (!map[c.complejo_id]) map[c.complejo_id] = []
        map[c.complejo_id].push(c)
      }
    }
    return complejos.map((cx) => {
      const cc = map[cx.id] || []
      const sportsSet = new Set<'Fútbol 5' | 'Fútbol 7' | 'Pádel'>()
      let min: number | null = null
      for (const k of cc) {
        sportsSet.add(TIPO_TO_LABEL[k.tipo])
        if (min === null || k.precio < min) min = k.precio
      }
      return {
        ...cx,
        sports: [...sportsSet],
        priceFrom: min,
      }
    })
  }, [complejos, canchas])

  const ciudades = useMemo(() => getCiudades(enriquecidos), [enriquecidos])

  const filtered = useMemo(() => {
    return enriquecidos.filter((cx) => {
      const matchSport = sport === 'Todos' || cx.sports.includes(sport as 'Fútbol 5' | 'Fútbol 7' | 'Pádel')
      const matchCiudad = ciudadFilter === 'Todas' || (cx.ciudad?.trim() ?? '') === ciudadFilter
      const q = search.trim().toLowerCase()
      const matchSearch =
        !q ||
        cx.nombre.toLowerCase().includes(q) ||
        (cx.direccion || '').toLowerCase().includes(q) ||
        (cx.ciudad || '').toLowerCase().includes(q) ||
        cx.sports.some((s) => s.toLowerCase().includes(q))
      return matchSport && matchCiudad && matchSearch
    })
  }, [enriquecidos, sport, search, ciudadFilter])

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Navbar transparente sobre el hero */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <Navbar transparent />
      </div>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          minHeight: 620,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1600&q=85&fit=crop"
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(165deg, #0f172a 0%, rgba(29,78,216,0.88) 100%)',
          }}
        />
        <div
          className="page-enter"
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            padding: '120px 24px 80px',
            maxWidth: 760,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(6px)',
              borderRadius: 99,
              padding: '6px 18px',
              marginBottom: 24,
            }}
          >
            <Sparkles size={14} color="#93c5fd" />
            <span style={{ color: '#bfdbfe', fontSize: '0.8rem', fontWeight: 600 }}>
              Disponible en toda la provincia de Entre Ríos
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: 'white',
              fontSize: 'clamp(2.4rem, 5vw, 3.6rem)',
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: '-0.03em',
              margin: '0 0 18px',
            }}
          >
            Encontrá tu<br />cancha ideal
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '1.1rem', marginBottom: 40, lineHeight: 1.6 }}>
            Reservá canchas de fútbol y pádel en los mejores complejos, en segundos.
          </p>

          {/* Search bar */}
          <div
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 8,
              display: 'flex',
              gap: 8,
              boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
              maxWidth: 680,
              margin: '0 auto 40px',
              alignItems: 'center',
            }}
            className="landing-search"
          >
            <div className="landing-search-input" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
              <Search size={18} color="#94a3b8" />
              <input
                placeholder="Barrio, complejo o deporte…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '0.95rem',
                  color: '#111827',
                  fontFamily: "'DM Sans', sans-serif",
                  width: '100%',
                }}
              />
            </div>
            <div className="landing-search-row2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="landing-search-divider" style={{ width: 1, background: '#e2e8f0', alignSelf: 'center', height: 28 }} />
              <div className="landing-search-sport" style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: 140 }}>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value as SportFilter)}
                  style={{
                    appearance: 'none',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    padding: '8px 36px 8px 14px',
                    fontSize: '0.9rem',
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  {SPORTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <span style={{ position: 'absolute', right: 10, pointerEvents: 'none' }}>
                  <ChevronDown size={16} color="#6b7280" />
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('complejos')
                  if (el) el.scrollIntoView({ behavior: 'smooth' })
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#2563eb',
                  color: 'white',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                }}
              >
                <Search size={16} />
                Buscar
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}>
            {[
              ['500+', 'Reservas mensuales'],
              ['20+', 'Complejos activos'],
              ['3', 'Deportes'],
            ].map(([n, l]) => (
              <div key={n} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    color: 'white',
                    fontSize: '1.8rem',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {n}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Complexes grid ─────────────────────────────────────────────────── */}
      <div id="complejos" style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 32,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.8rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                margin: '0 0 6px',
              }}
            >
              Complejos disponibles
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              {loadingComplejos
                ? 'Cargando complejos…'
                : `${filtered.length} complejo${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SPORTS.map((s) => {
              const active = sport === s
              return (
                <button
                  key={s}
                  onClick={() => setSport(s)}
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
        </div>

        {/* Ciudad filter */}
        {ciudades.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>Ciudad:</span>
            {['Todas', ...ciudades].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCiudadFilter(c)}
                style={{
                  padding: '5px 14px',
                  borderRadius: 99,
                  border: ciudadFilter === c ? '2px solid #2563eb' : '1.5px solid #e2e8f0',
                  background: ciudadFilter === c ? '#eff6ff' : 'white',
                  color: ciudadFilter === c ? '#2563eb' : '#64748b',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.82rem',
                  fontWeight: ciudadFilter === c ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {loadingComplejos || loadingCanchas ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 24,
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 24,
            }}
          >
            {filtered.map((cx) => (
              <ComplexCard key={cx.id} cx={cx} />
            ))}
          </div>
        )}
      </div>

      {/* ── Owner CTA ─────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          padding: '72px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 99,
              padding: '6px 18px',
              marginBottom: 20,
            }}
          >
            <Building2 size={14} color="white" />
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', fontWeight: 600 }}>
              Para dueños de complejos
            </span>
          </div>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: 'white',
              fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              margin: '0 0 16px',
              lineHeight: 1.1,
            }}
          >
            ¿Tenés un complejo<br />deportivo?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', lineHeight: 1.7, marginBottom: 36 }}>
            Sumate a TuCanchera y empezá a recibir reservas online hoy mismo.
            <br />
            Sin comisiones ocultas, setup en minutos.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://wa.me/543435059834"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'white',
                color: '#1e3a8a',
                padding: '14px 28px',
                borderRadius: 12,
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.95rem',
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
              }}
            >
              Registrar mi complejo
            </a>
            <a
              href="mailto:enzopitana@gmail.com"
              style={{
                background: 'transparent',
                color: 'white',
                padding: '14px 28px',
                borderRadius: 12,
                border: '1.5px solid rgba(255,255,255,0.4)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.95rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Contactar
            </a>
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div style={{ background: '#0f172a', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ color: '#475569', fontSize: '0.82rem', fontFamily: "'DM Sans', sans-serif" }}>
          © {new Date().getFullYear()} TuCanchera · Todos los derechos reservados ·{' '}
          <span style={{ color: '#2563eb' }}>Términos</span> ·{' '}
          <span style={{ color: '#2563eb' }}>Privacidad</span>
        </p>
      </div>

      <style>{`
        @media (max-width: 600px) {
          /* Stack search bar vertically on mobile */
          .landing-search {
            flex-direction: column !important;
            gap: 0 !important;
            padding: 6px !important;
          }
          .landing-search-input {
            padding: 10px 14px !important;
            border-bottom: 1px solid #f1f5f9;
          }
          .landing-search-row2 {
            width: 100%;
            padding: 6px !important;
          }
          .landing-search-divider {
            display: none !important;
          }
          .landing-search-sport {
            flex: 1 !important;
            min-width: 0 !important;
          }
          .landing-search-sport select {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Subcomponentes                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */

function ComplexCard({ cx }: { cx: ComplejoEnriquecido }) {
  const [hovered, setHovered] = useState(false)
  const img = cx.logo_url || FALLBACK_IMG
  return (
    <Link
      to={`/${cx.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        textDecoration: 'none',
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: hovered ? '0 16px 48px rgba(0,0,0,0.14)' : '0 2px 16px rgba(0,0,0,0.07)',
        transform: hovered ? 'translateY(-4px)' : 'none',
        transition: 'all 0.22s ease',
        border: '1px solid #f1f5f9',
      }}
    >
      <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <img
          src={img}
          alt={cx.nombre}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: hovered ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 0.4s ease',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {cx.sports.map((s) => (
            <div
              key={s}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(8px)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: 99,
                fontSize: '0.73rem',
                fontWeight: 600,
              }}
            >
              <SportIcon sport={s} size={12} color="white" />
              {s}
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '18px 20px 20px' }}>
        <h3
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1rem',
            fontWeight: 700,
            color: '#0f172a',
            margin: '0 0 6px',
            letterSpacing: '-0.01em',
          }}
        >
          {cx.nombre}
        </h3>
        {cx.direccion && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
            <MapPin size={13} color="#94a3b8" />
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{cx.direccion}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={13} color="#f59e0b" fill={i <= 5 ? '#f59e0b' : 'none'} />
              ))}
              <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 3, fontWeight: 600 }}>—</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: 2 }}>
              Nuevo en la plataforma
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 1 }}>desde</div>
            <div
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.1rem',
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              {cx.priceFrom != null ? `$${cx.priceFrom.toLocaleString('es-AR')}` : '—'}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
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
              fontSize: '0.88rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
            }}
          >
            Ver canchas
            <ArrowRight size={15} />
          </div>
        </div>
      </div>
    </Link>
  )
}

function CardSkeleton() {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #f1f5f9',
        boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ height: 200, background: '#f1f5f9' }} />
      <div style={{ padding: '18px 20px 20px' }}>
        <div style={{ height: 14, background: '#f1f5f9', borderRadius: 6, marginBottom: 10, width: '65%' }} />
        <div style={{ height: 10, background: '#f1f5f9', borderRadius: 6, marginBottom: 16, width: '45%' }} />
        <div style={{ height: 36, background: '#f1f5f9', borderRadius: 10 }} />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        borderRadius: 16,
        border: '1.5px dashed #cbd5e1',
        background: 'white',
        padding: 48,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          margin: '0 auto 16px',
          background: '#f1f5f9',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Search size={24} color="#94a3b8" />
      </div>
      <h3
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.1rem',
          fontWeight: 700,
          color: '#0f172a',
          margin: '0 0 8px',
        }}
      >
        Sin resultados
      </h3>
      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
        No encontramos complejos con esos filtros. Probá cambiando la búsqueda.
      </p>
    </div>
  )
}