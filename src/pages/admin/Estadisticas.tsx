// Estadísticas del complejo — diseño Claude (AdminStats).
// Conserva la capa de datos existente (fetchReservasConfirmadasRango) y
// reemplaza toda la presentación por el diseño drop.
//
// Gráficos:
//   - Línea Mercado Pago vs "en el lugar" sobre el tiempo (SVG custom)
//   - Barras horizontales con reservas por cancha
//   - Dona de métodos de pago
//   - Tabla de ranking de canchas
// Filtros: botones de período (semana/mes/año/personalizado) + rango de fechas.

import { useMemo, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, differenceInCalendarDays, addDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import { fetchReservasConfirmadasRango } from '@/services/adminService'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type PeriodKey = 'week' | 'month' | 'year' | 'custom'

interface CanchaJoin {
  nombre: string
  tipo: string
  precio: number
}

interface BucketData {
  days: string[]
  mp: number[]
  cash: number[]
}

interface CourtStat {
  name: string
  tipo: string
  bookings: number
  revenue: number
  occupancy: number
  trend: number
  color: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colorPorTipo(tipo: string): string {
  if (tipo === 'futbol5') return '#16a34a'
  if (tipo === 'futbol7') return '#2563eb'
  if (tipo === 'padel') return '#7c3aed'
  return '#64748b'
}

function rangoDePeriodo(period: PeriodKey, desde: string, hasta: string): { desde: string; hasta: string } {
  const hoy = new Date()
  if (period === 'week') {
    return {
      desde: format(subDays(hoy, 6), 'yyyy-MM-dd'),
      hasta: format(hoy, 'yyyy-MM-dd'),
    }
  }
  if (period === 'month') {
    return {
      desde: format(startOfMonth(hoy), 'yyyy-MM-dd'),
      hasta: format(endOfMonth(hoy), 'yyyy-MM-dd'),
    }
  }
  if (period === 'year') {
    return {
      desde: format(startOfYear(hoy), 'yyyy-MM-dd'),
      hasta: format(endOfYear(hoy), 'yyyy-MM-dd'),
    }
  }
  return { desde, hasta }
}

function construirBuckets(reservas: Array<{ fecha: string; metodo_pago: string; canchas: CanchaJoin | null }>, desde: string, hasta: string): BucketData {
  const d0 = parseISO(desde)
  const d1 = parseISO(hasta)
  const totalDias = Math.max(1, differenceInCalendarDays(d1, d0) + 1)

  // Elegir granularidad según largo del rango
  let nBuckets: number
  let etiqueta: (fecha: Date, idx: number) => string
  let bucketIndex: (fecha: Date) => number

  if (totalDias <= 14) {
    // día a día
    nBuckets = totalDias
    etiqueta = (f) => format(f, 'dd MMM', { locale: es })
    bucketIndex = (f) => differenceInCalendarDays(f, d0)
  } else if (totalDias <= 90) {
    // por semana (4 a 13 barras aprox)
    nBuckets = Math.ceil(totalDias / 7)
    etiqueta = (_f, i) => `S${i + 1}`
    bucketIndex = (f) => Math.floor(differenceInCalendarDays(f, d0) / 7)
  } else {
    // por mes
    nBuckets = Math.min(12, Math.max(1, Math.ceil(totalDias / 30)))
    etiqueta = (f) => format(f, 'MMM', { locale: es })
    bucketIndex = (f) => Math.min(nBuckets - 1, Math.floor(differenceInCalendarDays(f, d0) / Math.ceil(totalDias / nBuckets)))
  }

  const days: string[] = []
  for (let i = 0; i < nBuckets; i++) {
    const ref = totalDias <= 14
      ? addDays(d0, i)
      : totalDias <= 90
        ? addDays(d0, i * 7)
        : addDays(d0, Math.floor(i * (totalDias / nBuckets)))
    days.push(etiqueta(ref, i))
  }

  const mp = new Array<number>(nBuckets).fill(0)
  const cash = new Array<number>(nBuckets).fill(0)

  for (const r of reservas) {
    const fecha = parseISO(r.fecha)
    const i = Math.min(nBuckets - 1, Math.max(0, bucketIndex(fecha)))
    const precio = r.canchas?.precio ?? 0
    if (r.metodo_pago === 'mercadopago') mp[i] += precio
    else cash[i] += precio
  }

  return { days, mp, cash }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}

function formatARS(n: number): string {
  return `$${n.toLocaleString('es-AR')}`
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function CircularMetric({ value, size = 60, stroke = 6, color = '#2563eb' }: { value: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.max(0, Math.min(100, value)) / 100) * c
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        fontFamily="Space Grotesk, sans-serif"
        fontSize="13"
        fontWeight="800"
        fill="#0f172a"
      >
        {value}%
      </text>
    </svg>
  )
}

function ChartLine({ data }: { data: BucketData }) {
  const W = 900
  const H = 280
  const pad = { t: 20, r: 24, b: 36, l: 56 }
  const cw = W - pad.l - pad.r
  const ch = H - pad.t - pad.b
  const max = Math.max(1, ...data.mp, ...data.cash) * 1.1
  const [hover, setHover] = useState<number | null>(null)

  const pt = (arr: number[], i: number): [number, number] => {
    const denom = Math.max(1, arr.length - 1)
    const x = pad.l + (i / denom) * cw
    const y = pad.t + ch - (arr[i] / max) * ch
    return [x, y]
  }

  const line = (arr: number[]) =>
    arr
      .map((_, i) => {
        const [x, y] = pt(arr, i)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')

  const area = (arr: number[]) => {
    const [x0] = pt(arr, 0)
    const [xN] = pt(arr, arr.length - 1)
    return `${line(arr)} L ${xN} ${pad.t + ch} L ${x0} ${pad.t + ch} Z`
  }

  const gridLines = 4

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="mpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = pad.t + (i / gridLines) * ch
          const val = max - (i / gridLines) * max
          return (
            <g key={i}>
              <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text
                x={pad.l - 8}
                y={y + 4}
                textAnchor="end"
                fontFamily="DM Sans, sans-serif"
                fontSize="10"
                fill="#94a3b8"
              >
                {fmt(val)}
              </text>
            </g>
          )
        })}

        {/* X labels */}
        {data.days.map((d, i) => {
          const [x] = pt(data.mp, i)
          return (
            <text
              key={i}
              x={x}
              y={H - pad.b + 18}
              textAnchor="middle"
              fontFamily="DM Sans, sans-serif"
              fontSize="11"
              fill="#64748b"
              fontWeight="600"
            >
              {d}
            </text>
          )
        })}

        {/* Areas */}
        <path d={area(data.mp)} fill="url(#mpGrad)" style={{ animation: 'drawIn 0.9s ease' }} />
        <path d={area(data.cash)} fill="url(#cashGrad)" style={{ animation: 'drawIn 0.9s ease 0.1s backwards' }} />

        {/* Lines */}
        <path
          d={line(data.mp)}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: 'drawPath 1s ease' }}
        />
        <path
          d={line(data.cash)}
          fill="none"
          stroke="#16a34a"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: 'drawPath 1s ease 0.15s backwards' }}
        />

        {/* Points + hover */}
        {data.mp.map((_, i) => {
          const [x1, y1] = pt(data.mp, i)
          const [x2, y2] = pt(data.cash, i)
          const barW = cw / Math.max(1, data.days.length)
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x1 - barW / 2} y={pad.t} width={barW} height={ch} fill="transparent" style={{ cursor: 'pointer' }} />
              {hover === i && (
                <line x1={x1} y1={pad.t} x2={x1} y2={pad.t + ch} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" />
              )}
              <circle cx={x1} cy={y1} r={hover === i ? 6 : 4} fill="white" stroke="#2563eb" strokeWidth="2.5" />
              <circle cx={x2} cy={y2} r={hover === i ? 6 : 4} fill="white" stroke="#16a34a" strokeWidth="2.5" />
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hover !== null && (() => {
        const [x] = pt(data.mp, hover)
        const left = (x / W) * 100
        return (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: `${left}%`,
              transform: 'translateX(-50%)',
              background: '#0f172a',
              color: 'white',
              padding: '10px 14px',
              borderRadius: 10,
              fontFamily: "'DM Sans', sans-serif",
              pointerEvents: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              minWidth: 150,
            }}
          >
            <div
              style={{
                fontSize: '0.74rem',
                color: '#94a3b8',
                fontWeight: 700,
                marginBottom: 6,
                textTransform: 'uppercase',
              }}
            >
              {data.days[hover]}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: '#3b82f6' }} /> MP
              </span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.9rem', fontWeight: 800 }}>
                {fmt(data.mp[hover])}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: '#22c55e' }} /> Lugar
              </span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.9rem', fontWeight: 800 }}>
                {fmt(data.cash[hover])}
              </span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function HBarChart({ courts }: { courts: CourtStat[] }) {
  if (courts.length === 0) {
    return (
      <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.86rem' }}>
        Sin reservas en el período.
      </div>
    )
  }
  const max = courts[0]?.bookings ?? 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {courts.slice(0, 5).map((c, i) => {
        const pct = (c.bookings / Math.max(1, max)) * 100
        return (
          <div key={c.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 600 }}>{c.name}</span>
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: c.color,
                }}
              >
                {c.bookings}
              </span>
            </div>
            <div style={{ height: 10, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: c.color,
                  borderRadius: 99,
                  animation: `growBar 1s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.1}s backwards`,
                  transformOrigin: 'left',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PaymentDonut({ mp, cash }: { mp: number; cash: number }) {
  const total = Math.max(1, mp + cash)
  const r = 58
  const c = 2 * Math.PI * r
  const mpLen = (mp / total) * c
  const cashLen = (cash / total) * c
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <svg width={150} height={150} viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={r} fill="none" stroke="#f1f5f9" strokeWidth="16" />
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke="#2563eb"
          strokeWidth="16"
          strokeDasharray={`${mpLen} ${c}`}
          transform="rotate(-90 75 75)"
          strokeLinecap="round"
          style={{ animation: 'drawIn 1s ease' }}
        />
        <circle
          cx="75"
          cy="75"
          r={r}
          fill="none"
          stroke="#16a34a"
          strokeWidth="16"
          strokeDasharray={`${cashLen} ${c}`}
          strokeDashoffset={-mpLen}
          transform="rotate(-90 75 75)"
          strokeLinecap="round"
          style={{ animation: 'drawIn 1s ease 0.15s backwards' }}
        />
        <text x="75" y="70" textAnchor="middle" fontFamily="DM Sans, sans-serif" fontSize="10" fill="#64748b" fontWeight="700">
          TOTAL
        </text>
        <text
          x="75"
          y="88"
          textAnchor="middle"
          fontFamily="Space Grotesk, sans-serif"
          fontSize="18"
          fontWeight="800"
          fill="#0f172a"
        >
          {fmt(mp + cash)}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        {[
          { color: '#2563eb', label: 'MercadoPago', val: mp, pct: Math.round((mp / total) * 100) },
          { color: '#16a34a', label: 'En el lugar', val: cash, pct: Math.round((cash / total) * 100) },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 9,
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
              <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1,
                }}
              >
                {fmt(s.val)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>{s.pct}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Estadisticas() {
  const { data: complejo } = useMiComplejo()

  const hoy = new Date()
  const haceMes = new Date()
  haceMes.setDate(hoy.getDate() - 30)
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [desde, setDesde] = useState(format(haceMes, 'yyyy-MM-dd'))
  const [hasta, setHasta] = useState(format(hoy, 'yyyy-MM-dd'))

  const rangoEfectivo = useMemo(() => rangoDePeriodo(period, desde, hasta), [period, desde, hasta])

  const { data: reservas, isLoading } = useQuery({
    queryKey: ['admin-stats', complejo?.id, rangoEfectivo.desde, rangoEfectivo.hasta],
    queryFn: () => fetchReservasConfirmadasRango(complejo!.id, rangoEfectivo.desde, rangoEfectivo.hasta),
    enabled: !!complejo,
  })

  const stats = useMemo(() => {
    const lista = (reservas ?? []) as unknown as Array<{
      fecha: string
      metodo_pago: string
      canchas: CanchaJoin | null
    }>

    const buckets = construirBuckets(lista, rangoEfectivo.desde, rangoEfectivo.hasta)

    let totalMP = 0
    let totalCash = 0
    const porCancha = new Map<string, CourtStat>()

    for (const r of lista) {
      const cancha = r.canchas
      const precio = cancha?.precio ?? 0
      const nombre = cancha?.nombre ?? 'Sin nombre'
      const tipo = cancha?.tipo ?? ''
      if (r.metodo_pago === 'mercadopago') totalMP += precio
      else totalCash += precio

      const prev = porCancha.get(nombre)
      if (prev) {
        prev.bookings += 1
        prev.revenue += precio
      } else {
        porCancha.set(nombre, {
          name: nombre,
          tipo,
          bookings: 1,
          revenue: precio,
          occupancy: 0,
          trend: 0,
          color: colorPorTipo(tipo),
        })
      }
    }

    const courts = Array.from(porCancha.values()).sort((a, b) => b.bookings - a.bookings)
    const maxBookings = courts[0]?.bookings ?? 1
    for (const c of courts) {
      c.occupancy = Math.round((c.bookings / Math.max(1, maxBookings)) * 100)
    }

    const totalBookings = lista.length
    const totalRevenue = totalMP + totalCash
    // ocupación global: reservas / (canchas × días), normalizado a % (tope 100)
    const dias = Math.max(1, differenceInCalendarDays(parseISO(rangoEfectivo.hasta), parseISO(rangoEfectivo.desde)) + 1)
    const nCanchas = porCancha.size || 1
    const slotsEstimados = nCanchas * dias * 10 // ~10 turnos útiles/día
    const occupancyGlobal = Math.min(100, Math.round((totalBookings / Math.max(1, slotsEstimados)) * 100))

    return {
      buckets,
      totalMP,
      totalCash,
      totalRevenue,
      totalBookings,
      courts,
      topCourt: courts[0] ?? null,
      occupancyGlobal,
    }
  }, [reservas, rangoEfectivo])

  const periods: Array<{ key: PeriodKey; label: string }> = [
    { key: 'week', label: 'Esta semana' },
    { key: 'month', label: 'Este mes' },
    { key: 'year', label: 'Este año' },
    { key: 'custom', label: 'Personalizado' },
  ]

  const pageStyle: CSSProperties = {
    padding: '32px 32px 60px',
    maxWidth: 1400,
    fontFamily: "'DM Sans', sans-serif",
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.9rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.03em',
              margin: '0 0 6px',
            }}
          >
            Estadísticas
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>
            Analizá el rendimiento de tu complejo.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            background: 'white',
            borderRadius: 12,
            padding: 4,
            border: '1px solid #e2e8f0',
            gap: 2,
          }}
        >
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              style={{
                padding: '8px 14px',
                borderRadius: 9,
                border: 'none',
                background: period === p.key ? '#2563eb' : 'transparent',
                color: period === p.key ? 'white' : '#475569',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'custom' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20,
            padding: 14,
            background: 'white',
            borderRadius: 12,
            border: '1px solid #f1f5f9',
          }}
        >
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: 9,
              border: '1.5px solid #e2e8f0',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
          <span style={{ color: '#94a3b8' }}>→</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            style={{
              padding: '9px 12px',
              borderRadius: 9,
              border: '1.5px solid #e2e8f0',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
          <div
            style={{
              display: 'inline-block',
              width: 32,
              height: 32,
              border: '3px solid #e2e8f0',
              borderTop: '3px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ marginTop: 12, fontSize: '0.88rem' }}>Cargando estadísticas…</div>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* Revenue */}
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: 22,
                border: '1px solid #f1f5f9',
                borderTop: '3px solid #16a34a',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  fontSize: '0.76rem',
                  color: '#64748b',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 10,
                }}
              >
                Ingresos totales
              </div>
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '1.9rem',
                  fontWeight: 800,
                  color: '#16a34a',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {fmt(stats.totalRevenue)}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8 }}>
                Confirmadas en el período
              </div>
            </div>

            {/* Bookings */}
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: 22,
                border: '1px solid #f1f5f9',
                borderTop: '3px solid #2563eb',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  fontSize: '0.76rem',
                  color: '#64748b',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 10,
                }}
              >
                Total reservas
              </div>
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '1.9rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {stats.totalBookings}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8 }}>
                {stats.courts.length} cancha{stats.courts.length === 1 ? '' : 's'} con actividad
              </div>
            </div>

            {/* Occupancy */}
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: 22,
                border: '1px solid #f1f5f9',
                borderTop: '3px solid #7c3aed',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: '#64748b',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 10,
                  }}
                >
                  Tasa de ocupación
                </div>
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '1.9rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                >
                  {stats.occupancyGlobal}%
                </div>
              </div>
              <CircularMetric value={stats.occupancyGlobal} color="#7c3aed" size={64} stroke={6} />
            </div>

            {/* Top court */}
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: 22,
                border: '1px solid #f1f5f9',
                borderTop: '3px solid #d97706',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <div
                style={{
                  fontSize: '0.76rem',
                  color: '#64748b',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 10,
                }}
              >
                Cancha top
              </div>
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                  marginBottom: 10,
                  minHeight: 28,
                }}
              >
                {stats.topCourt?.name ?? '—'}
              </div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: 99,
                  background: '#dcfce7',
                  color: '#15803d',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                {stats.topCourt ? `${stats.topCourt.bookings} reservas` : 'Sin actividad'}
              </span>
            </div>
          </div>

          {/* Sin datos */}
          {stats.totalBookings === 0 ? (
            <div
              style={{
                background: 'white',
                borderRadius: 16,
                padding: 60,
                border: '1.5px dashed #cbd5e1',
                textAlign: 'center',
                color: '#94a3b8',
              }}
            >
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#475569',
                  marginBottom: 6,
                }}
              >
                Sin datos en este período
              </div>
              <div style={{ fontSize: '0.86rem' }}>Probá ampliando el rango de fechas.</div>
            </div>
          ) : (
            <>
              {/* Main line chart */}
              <div
                style={{
                  background: 'white',
                  borderRadius: 16,
                  padding: 24,
                  marginBottom: 24,
                  border: '1px solid #f1f5f9',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 18,
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: '#0f172a',
                        letterSpacing: '-0.02em',
                        margin: '0 0 2px',
                      }}
                    >
                      Ingresos en el tiempo
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
                      MercadoPago vs pago en el lugar
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 99, background: '#2563eb' }} />
                      <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>MercadoPago</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 99, background: '#16a34a' }} />
                      <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>En el lugar</span>
                    </div>
                  </div>
                </div>
                <ChartLine data={stats.buckets} />
              </div>

              {/* Two-column charts */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
                  gap: 20,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    padding: 24,
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      letterSpacing: '-0.02em',
                      margin: '0 0 18px',
                    }}
                  >
                    Reservas por cancha
                  </h3>
                  <HBarChart courts={stats.courts} />
                </div>
                <div
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    padding: 24,
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      letterSpacing: '-0.02em',
                      margin: '0 0 18px',
                    }}
                  >
                    Métodos de pago
                  </h3>
                  <PaymentDonut mp={stats.totalMP} cash={stats.totalCash} />
                </div>
              </div>

              {/* Ranking table */}
              <div
                style={{
                  background: 'white',
                  borderRadius: 16,
                  border: '1px solid #f1f5f9',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9' }}>
                  <h3
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      letterSpacing: '-0.02em',
                      margin: 0,
                    }}
                  >
                    Ranking de canchas
                  </h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#fafbfc', borderBottom: '1.5px solid #e2e8f0' }}>
                        {['#', 'Cancha', 'Reservas', 'Ingresos', 'Actividad relativa'].map((h, i) => (
                          <th
                            key={h}
                            style={{
                              padding: '12px 18px',
                              textAlign: i >= 2 ? 'right' : 'left',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              color: '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.courts.map((c, i) => (
                        <tr
                          key={c.name}
                          style={{
                            borderBottom: i < stats.courts.length - 1 ? '1px solid #f1f5f9' : 'none',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#fafbfc'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          <td style={{ padding: '14px 18px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 26,
                                height: 26,
                                borderRadius: 99,
                                background: i === 0 ? '#fef3c7' : '#f1f5f9',
                                color: i === 0 ? '#d97706' : '#64748b',
                                fontFamily: "'Space Grotesk', sans-serif",
                                fontSize: '0.82rem',
                                fontWeight: 800,
                              }}
                            >
                              {i + 1}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '14px 18px',
                              fontSize: '0.88rem',
                              color: '#0f172a',
                              fontWeight: 600,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 3,
                                  background: c.color,
                                }}
                              />
                              {c.name}
                            </div>
                          </td>
                          <td
                            style={{
                              padding: '14px 18px',
                              textAlign: 'right',
                              fontFamily: "'Space Grotesk', sans-serif",
                              fontWeight: 800,
                              color: '#0f172a',
                            }}
                          >
                            {c.bookings}
                          </td>
                          <td
                            style={{
                              padding: '14px 18px',
                              textAlign: 'right',
                              fontFamily: "'Space Grotesk', sans-serif",
                              fontWeight: 800,
                              color: '#16a34a',
                            }}
                          >
                            {formatARS(c.revenue)}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                justifyContent: 'flex-end',
                              }}
                            >
                              <div
                                style={{
                                  width: 80,
                                  height: 6,
                                  background: '#f1f5f9',
                                  borderRadius: 99,
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${c.occupancy}%`,
                                    background: c.color,
                                    borderRadius: 99,
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontFamily: "'Space Grotesk', sans-serif",
                                  fontSize: '0.85rem',
                                  fontWeight: 700,
                                  color: '#0f172a',
                                  minWidth: 34,
                                  textAlign: 'right',
                                }}
                              >
                                {c.occupancy}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
