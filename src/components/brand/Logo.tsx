// Logo TuCanchera — replicado del diseño Claude (shared.jsx).
// Trophy dentro de un cuadrado con gradiente azul + texto "TuCanchera".

import { Trophy } from 'lucide-react'

type Size = 'sm' | 'md' | 'lg'

interface LogoProps {
  size?: Size
  dark?: boolean // true → texto blanco para fondos oscuros
}

const SIZES: Record<Size, { box: number; icon: number; text: string }> = {
  sm: { box: 30, icon: 16, text: '1.1rem' },
  md: { box: 38, icon: 20, text: '1.35rem' },
  lg: { box: 48, icon: 26, text: '1.7rem' },
}

export default function Logo({ size = 'md', dark = false }: LogoProps) {
  const s = SIZES[size]
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: s.box,
          height: s.box,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
        }}
      >
        <Trophy size={s.icon} />
      </div>
      <span
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 800,
          fontSize: s.text,
          letterSpacing: '-0.03em',
          color: dark ? 'white' : '#0f172a',
        }}
      >
        TuCanchera
      </span>
    </div>
  )
}
