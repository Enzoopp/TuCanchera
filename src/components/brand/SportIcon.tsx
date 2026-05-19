// SportIcon — iconos de deportes replicados del diseño Claude.
// Mapea tanto tipos de base de datos ("futbol5","futbol7","padel")
// como etiquetas visibles ("Fútbol 5", "Fútbol 7", "Pádel").

import type { TipoCancha } from '@/types'

type SportKey = TipoCancha | 'Fútbol 5' | 'Fútbol 7' | 'Pádel' | string

interface SportIconProps {
  sport: SportKey
  size?: number
  color?: string
}

function normalize(sport: SportKey): 'padel' | 'futbol' {
  const s = String(sport).toLowerCase()
  if (s.includes('pád') || s.includes('pad') || s === 'padel') return 'padel'
  return 'futbol'
}

export default function SportIcon({ sport, size = 20, color = 'currentColor' }: SportIconProps) {
  const kind = normalize(sport)

  if (kind === 'padel') {
    // Pádel: raqueta sólida
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <ellipse cx="12" cy="9" rx="6.5" ry="7" />
        <circle cx="9.5" cy="7" r="0.7" fill={color} stroke="none" />
        <circle cx="12" cy="6" r="0.7" fill={color} stroke="none" />
        <circle cx="14.5" cy="7" r="0.7" fill={color} stroke="none" />
        <circle cx="9" cy="10" r="0.7" fill={color} stroke="none" />
        <circle cx="12" cy="9.5" r="0.7" fill={color} stroke="none" />
        <circle cx="15" cy="10" r="0.7" fill={color} stroke="none" />
        <path d="M12 16v5" />
      </svg>
    )
  }

  // Fútbol 5 / Fútbol 7 — pelota con hexágonos
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7 L8 10 L9.5 14 L14.5 14 L16 10 Z" />
      <path d="M12 3 L12 7" />
      <path d="M3.5 9 L8 10" />
      <path d="M20.5 9 L16 10" />
      <path d="M6.5 19 L9.5 14" />
      <path d="M17.5 19 L14.5 14" />
    </svg>
  )
}

// Paleta por deporte (del diseño, SPORT_TYPES en AdminCourts.jsx)
// eslint-disable-next-line react-refresh/only-export-components
export const SPORT_PALETTE = {
  'Fútbol 5':  { bg: '#f0fdf4', text: '#16a34a', color: 'green'  as const },
  'Fútbol 7':  { bg: '#eff6ff', text: '#2563eb', color: 'blue'   as const },
  'Pádel':     { bg: '#faf5ff', text: '#7c3aed', color: 'purple' as const },
} as const

// eslint-disable-next-line react-refresh/only-export-components
export function sportPalette(sport: string) {
  if (sport === 'Fútbol 5' || sport === 'futbol5') return SPORT_PALETTE['Fútbol 5']
  if (sport === 'Fútbol 7' || sport === 'futbol7') return SPORT_PALETTE['Fútbol 7']
  if (sport === 'Pádel' || sport === 'padel') return SPORT_PALETTE['Pádel']
  return SPORT_PALETTE['Fútbol 5']
}

// eslint-disable-next-line react-refresh/only-export-components
export function sportLabel(tipo: TipoCancha): string {
  if (tipo === 'futbol5') return 'Fútbol 5'
  if (tipo === 'futbol7') return 'Fútbol 7'
  return 'Pádel'
}
