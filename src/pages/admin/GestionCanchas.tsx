// SRP: CRUD de canchas + horarios semanales (diseño Claude / AdminCourts.jsx).
// - Header con conteo activas/inactivas y botón "Nueva cancha"
// - Grid de cards con sport icon tile, toggle, precio/duración, resumen de horario
// - Drawer lateral derecho (createPortal) para crear/editar cancha con selector de
//   deporte + horarios día por día (toggle + horas)
// - Toast bottom-right con animación slideUp

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMiComplejo } from '@/hooks/useMiComplejo'
import {
  fetchCanchasByComplejo,
  fetchHorariosByCancha,
} from '@/services/complejoService'
import {
  crearCancha,
  updateCancha,
  deleteCancha,
  replaceHorarios,
} from '@/services/adminService'
import SportIcon, { sportPalette, sportLabel } from '@/components/brand/SportIcon'
import { Clock, Pencil, Plus, Trash2, X, Check } from 'lucide-react'
import type { Cancha, HorarioCancha, TipoCancha } from '@/types'

// ---------- Constantes ----------

const SPORT_TYPES: Array<{ key: TipoCancha; label: string; bg: string; text: string }> = [
  { key: 'futbol5', label: 'Fútbol 5', bg: '#f0fdf4', text: '#16a34a' },
  { key: 'futbol7', label: 'Fútbol 7', bg: '#eff6ff', text: '#2563eb' },
  { key: 'padel',   label: 'Pádel',    bg: '#faf5ff', text: '#7c3aed' },
]

// Días en orden visual (lunes primero) y su mapeo a dia_semana del DB (0=domingo)
const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const
type DayKey = (typeof DAYS_ES)[number]
const DAY_TO_DB: Record<DayKey, number> = {
  Lun: 1, Mar: 2, 'Mié': 3, Jue: 4, Vie: 5, 'Sáb': 6, Dom: 0,
}
const DB_TO_DAY: Record<number, DayKey> = {
  1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 0: 'Dom',
}

type Schedule = Partial<Record<DayKey, [number, number]>>

interface FormState {
  id?: string
  tipo: TipoCancha
  nombre: string
  precio: number
  duracion_min: 60 | 90
  activa: boolean
  schedule: Schedule
}

// ---------- Helpers ----------

function summarizeSchedule(s: Schedule): string {
  const active = DAYS_ES.filter((d) => s[d])
  if (active.length === 0) return 'Cerrada'
  const first = s[active[0]]!
  const allSame = active.every((d) => {
    const p = s[d]
    return p && p[0] === first[0] && p[1] === first[1]
  })
  if (allSame && active.length === 7) {
    return `Todos los días ${first[0]}:00-${first[1]}:00`
  }
  if (allSame) {
    return `${active[0]}-${active[active.length - 1]} ${first[0]}:00-${first[1]}:00`
  }
  return 'Horarios variables'
}

function defaultSchedule(): Schedule {
  return {
    Lun: [9, 22],
    Mar: [9, 22],
    'Mié': [9, 22],
    Jue: [9, 22],
    Vie: [9, 22],
    'Sáb': [10, 22],
    Dom: [10, 22],
  }
}

function horariosFromDB(rows: HorarioCancha[] | undefined): Schedule {
  const s: Schedule = {}
  if (!rows) return s
  for (const r of rows) {
    const day = DB_TO_DAY[r.dia_semana]
    if (!day) continue
    const start = parseInt(r.hora_inicio.slice(0, 2), 10)
    const end = parseInt(r.hora_fin.slice(0, 2), 10)
    s[day] = [start, end]
  }
  return s
}

function horariosToDB(s: Schedule): Array<Omit<HorarioCancha, 'id' | 'cancha_id'>> {
  const out: Array<Omit<HorarioCancha, 'id' | 'cancha_id'>> = []
  for (const day of DAYS_ES) {
    const pair = s[day]
    if (!pair) continue
    const [a, b] = pair
    out.push({
      dia_semana: DAY_TO_DB[day],
      hora_inicio: `${String(a).padStart(2, '0')}:00:00`,
      hora_fin: `${String(b).padStart(2, '0')}:00:00`,
    })
  }
  return out
}

// ---------- Página ----------

export default function GestionCanchas() {
  const queryClient = useQueryClient()
  const { data: complejo } = useMiComplejo()

  const { data: canchas, isLoading } = useQuery({
    queryKey: ['admin-canchas-todas', complejo?.id],
    queryFn: () => fetchCanchasByComplejo(complejo!.id),
    enabled: !!complejo,
  })

  const [drawer, setDrawer] = useState<null | 'new' | Cancha>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Cancha | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2500)
  }

  async function invalidar() {
    await queryClient.invalidateQueries({ queryKey: ['admin-canchas-todas'] })
  }

  async function handleToggle(c: Cancha) {
    try {
      await updateCancha(c.id, { activa: !c.activa })
      await invalidar()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error')
    }
  }

  async function handleDelete(c: Cancha) {
    try {
      await deleteCancha(c.id)
      await invalidar()
      showToast('Cancha eliminada')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setConfirmDelete(null)
    }
  }

  async function handleSave(form: FormState) {
    if (!complejo) return
    try {
      if (form.id) {
        await updateCancha(form.id, {
          nombre: form.nombre,
          precio: form.precio,
          duracion_min: form.duracion_min,
          activa: form.activa,
        })
        await replaceHorarios(form.id, horariosToDB(form.schedule))
        await queryClient.invalidateQueries({ queryKey: ['horarios', form.id] })
        showToast('Cancha actualizada')
      } else {
        await crearCancha({
          complejoId: complejo.id,
          tipo: form.tipo,
          nombre: form.nombre,
          precio: form.precio,
          duracion_min: form.duracion_min,
          horarios: horariosToDB(form.schedule),
        })
        showToast('Cancha creada')
      }
      await invalidar()
      setDrawer(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const activeCount = canchas?.filter((c) => c.activa).length ?? 0
  const inactiveCount = (canchas?.length ?? 0) - activeCount

  return (
    <div style={{ padding: '32px 32px 60px', maxWidth: 1400, margin: '0 auto', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
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
            Mis canchas
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
            <CountBadge color="green">{activeCount} activas</CountBadge>
            {inactiveCount > 0 && (
              <CountBadge color="gray">
                {inactiveCount} inactiva{inactiveCount !== 1 ? 's' : ''}
              </CountBadge>
            )}
          </div>
        </div>
        <button
          onClick={() => setDrawer('new')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 18px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: 'white',
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(37,99,235,0.35)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.25)'
          }}
        >
          <Plus size={16} />
          Nueva cancha
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <SkeletonGrid />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 18,
          }}
        >
          {canchas?.map((c) => (
            <CourtCardAdmin
              key={c.id}
              cancha={c}
              onEdit={() => setDrawer(c)}
              onDelete={() => setConfirmDelete(c)}
              onToggle={() => handleToggle(c)}
            />
          ))}
          {/* Add card */}
          <button
            onClick={() => setDrawer('new')}
            style={{
              minHeight: 260,
              borderRadius: 16,
              border: '2px dashed #cbd5e1',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              color: '#64748b',
              transition: 'all 0.15s',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2563eb'
              e.currentTarget.style.background = 'rgba(37,99,235,0.03)'
              e.currentTarget.style.color = '#2563eb'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#64748b'
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={24} />
            </div>
            <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>Agregar cancha</span>
          </button>
        </div>
      )}

      {/* Drawer */}
      {drawer && complejo && (
        <CourtDrawer
          cancha={drawer === 'new' ? null : drawer}
          onClose={() => setDrawer(null)}
          onSave={handleSave}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmDeleteModal
          cancha={confirmDelete}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} />}
    </div>
  )
}

// ---------- Sub-componentes ----------

function CountBadge({
  color,
  children,
}: {
  color: 'green' | 'gray'
  children: React.ReactNode
}) {
  const palette =
    color === 'green'
      ? { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' }
      : { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 99,
        background: palette.bg,
        color: palette.text,
        border: `1px solid ${palette.border}`,
        fontSize: '0.78rem',
        fontWeight: 700,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {children}
    </span>
  )
}

function CourtCardAdmin({
  cancha,
  onEdit,
  onDelete,
  onToggle,
}: {
  cancha: Cancha
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const palette = sportPalette(cancha.tipo)
  const label = sportLabel(cancha.tipo)

  // Cargar resumen de horarios
  const { data: horariosData } = useQuery({
    queryKey: ['horarios', cancha.id],
    queryFn: () => fetchHorariosByCancha(cancha.id),
  })
  const schedule = useMemo(() => horariosFromDB(horariosData), [horariosData])

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white',
        borderRadius: 16,
        padding: 22,
        border: '1px solid #f1f5f9',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'all 0.2s ease',
        opacity: cancha.activa ? 1 : 0.7,
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: palette.bg,
              color: palette.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SportIcon sport={cancha.tipo} size={22} />
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 99,
              background: palette.bg,
              color: palette.text,
              border: `1px solid ${palette.text}33`,
              fontSize: '0.78rem',
              fontWeight: 700,
            }}
          >
            {label}
          </span>
        </div>

        {/* Active toggle */}
        <button
          onClick={onToggle}
          title={cancha.activa ? 'Desactivar cancha' : 'Activar cancha'}
          style={{
            position: 'relative',
            width: 44,
            height: 24,
            borderRadius: 99,
            border: 'none',
            background: cancha.activa ? '#2563eb' : '#cbd5e1',
            cursor: 'pointer',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: cancha.activa ? 23 : 3,
              width: 18,
              height: 18,
              borderRadius: 99,
              background: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 0.2s',
            }}
          />
        </button>
      </div>

      <h3
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.1rem',
          fontWeight: 800,
          color: '#0f172a',
          letterSpacing: '-0.02em',
          margin: '0 0 14px',
        }}
      >
        {cancha.nombre}
      </h3>

      {/* Info row */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          marginBottom: 14,
          padding: '12px 14px',
          background: '#f8fafc',
          borderRadius: 10,
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.68rem',
              color: '#94a3b8',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 2,
            }}
          >
            Precio
          </div>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            ${cancha.precio.toLocaleString('es-AR')}
          </div>
        </div>
        <div style={{ width: 1, background: '#e2e8f0' }} />
        <div>
          <div
            style={{
              fontSize: '0.68rem',
              color: '#94a3b8',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 2,
            }}
          >
            Duración
          </div>
          <div
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            {cancha.duracion_min} min
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          color: '#64748b',
          fontSize: '0.82rem',
          marginBottom: 18,
        }}
      >
        <Clock size={14} color="#94a3b8" />
        {summarizeSchedule(schedule)}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onEdit}
          style={{
            flex: 1,
            padding: '9px 14px',
            borderRadius: 10,
            border: '1.5px solid #e2e8f0',
            background: 'white',
            color: '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.84rem',
            fontWeight: 600,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2563eb'
            e.currentTarget.style.color = '#2563eb'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.color = '#475569'
          }}
        >
          <Pencil size={14} />
          Editar
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: '9px 14px',
            borderRadius: 10,
            border: '1.5px solid #fee2e2',
            background: '#fef2f2',
            color: '#dc2626',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#fee2e2'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#fef2f2'
          }}
          aria-label="Eliminar cancha"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 18,
      }}
    >
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            background: 'white',
            borderRadius: 16,
            padding: 22,
            border: '1px solid #f1f5f9',
            height: 280,
            opacity: 0.6,
          }}
        >
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 11, background: '#f1f5f9' }} />
            <div style={{ flex: 1, height: 24, background: '#f1f5f9', borderRadius: 6 }} />
          </div>
          <div style={{ height: 18, background: '#f1f5f9', borderRadius: 6, marginBottom: 14 }} />
          <div style={{ height: 60, background: '#f8fafc', borderRadius: 10, marginBottom: 14 }} />
          <div style={{ height: 14, background: '#f1f5f9', borderRadius: 6, marginBottom: 18, width: '60%' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, height: 36, background: '#f1f5f9', borderRadius: 10 }} />
            <div style={{ width: 44, height: 36, background: '#fef2f2', borderRadius: 10 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Drawer ----------

function CourtDrawer({
  cancha,
  onClose,
  onSave,
}: {
  cancha: Cancha | null
  onClose: () => void
  onSave: (form: FormState) => void
}) {
  const editing = !!cancha

  // Cargar horarios si está editando
  const { data: horariosData } = useQuery({
    queryKey: ['horarios', cancha?.id],
    queryFn: () => fetchHorariosByCancha(cancha!.id),
    enabled: !!cancha,
  })

  const [form, setForm] = useState<FormState>(() =>
    cancha
      ? {
          id: cancha.id,
          tipo: cancha.tipo,
          nombre: cancha.nombre,
          precio: cancha.precio,
          duracion_min: cancha.duracion_min,
          activa: cancha.activa,
          schedule: defaultSchedule(),
        }
      : {
          tipo: 'futbol5',
          nombre: '',
          precio: 8000,
          duracion_min: 60,
          activa: true,
          schedule: defaultSchedule(),
        }
  )

  // Cuando cargan los horarios del editar, popular el form
  useEffect(() => {
    if (cancha && horariosData) {
      setForm((f) => ({ ...f, schedule: horariosFromDB(horariosData) }))
    }
  }, [cancha, horariosData])

  // Escape para cerrar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function toggleDay(d: DayKey) {
    setForm((f) => ({
      ...f,
      schedule: f.schedule[d]
        ? { ...f.schedule, [d]: undefined }
        : { ...f.schedule, [d]: [9, 22] },
    }))
  }

  function updateHour(d: DayKey, idx: 0 | 1, val: string) {
    setForm((f) => {
      const pair: [number, number] = [...(f.schedule[d] ?? [9, 22])] as [number, number]
      const n = parseInt(val, 10)
      pair[idx] = Number.isNaN(n) ? pair[idx] : n
      return { ...f, schedule: { ...f.schedule, [d]: pair } }
    })
  }

  const canSave = form.nombre.trim().length > 0 && form.precio > 0

  const drawerContent = (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.55)',
          zIndex: 200,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(520px, 100vw)',
          background: 'white',
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideLeft 0.3s ease',
          boxShadow: '-12px 0 40px rgba(0,0,0,0.15)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                margin: '0 0 2px',
              }}
            >
              {editing ? 'Editar cancha' : 'Nueva cancha'}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
              {editing
                ? 'Actualizá los datos de la cancha.'
                : 'Completá los datos para sumar una cancha al complejo.'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 10,
              width: 36,
              height: 36,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <X size={16} color="#64748b" />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Sport selector */}
          <div>
            <label
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#374151',
                display: 'block',
                marginBottom: 10,
              }}
            >
              Tipo de deporte
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {SPORT_TYPES.map((s) => {
                const selected = form.tipo === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipo: s.key }))}
                    disabled={editing}
                    style={{
                      padding: '14px 10px',
                      borderRadius: 12,
                      border: `2px solid ${selected ? s.text : '#e2e8f0'}`,
                      background: selected ? s.bg : 'white',
                      cursor: editing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      color: selected ? s.text : '#475569',
                      opacity: editing && !selected ? 0.4 : 1,
                    }}
                  >
                    <SportIcon sport={s.key} size={24} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{s.label}</span>
                  </button>
                )
              })}
            </div>
            {editing && (
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '6px 0 0' }}>
                El tipo de deporte no se puede cambiar después de crear la cancha.
              </p>
            )}
          </div>

          {/* Nombre */}
          <div>
            <label
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#374151',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Nombre de la cancha
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Cancha 1 — F5 Césped"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
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
          </div>

          {/* Precio + Duración */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#374151',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Precio por turno
              </label>
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
                  value={form.precio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, precio: parseInt(e.target.value, 10) || 0 }))
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
              <label
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#374151',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Duración
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {([60, 90] as const).map((d) => {
                  const sel = form.duracion_min === d
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, duracion_min: d }))}
                      style={{
                        flex: 1,
                        padding: '11px 0',
                        borderRadius: 10,
                        border: `1.5px solid ${sel ? '#2563eb' : '#e2e8f0'}`,
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

          {/* Schedule */}
          <div>
            <label
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#374151',
                display: 'block',
                marginBottom: 10,
              }}
            >
              Horarios de atención
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DAYS_ES.map((d) => {
                const pair = form.schedule[d]
                const active = !!pair
                return (
                  <div
                    key={d}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '60px auto 1fr 1fr',
                      gap: 10,
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: active ? '#f8fafc' : '#fafafa',
                      border: `1px solid ${active ? '#e2e8f0' : '#f1f5f9'}`,
                      opacity: active ? 1 : 0.55,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        color: '#0f172a',
                      }}
                    >
                      {d}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleDay(d)}
                      style={{
                        position: 'relative',
                        width: 36,
                        height: 20,
                        borderRadius: 99,
                        border: 'none',
                        background: active ? '#2563eb' : '#cbd5e1',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      aria-label={active ? `Cerrar ${d}` : `Abrir ${d}`}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: active ? 18 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: 99,
                          background: 'white',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                          transition: 'left 0.2s',
                        }}
                      />
                    </button>
                    {active && pair ? (
                      <>
                        <input
                          type="number"
                          min={0}
                          max={23}
                          value={pair[0]}
                          onChange={(e) => updateHour(d, 0, e.target.value)}
                          style={dayHourInputStyle}
                        />
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={pair[1]}
                          onChange={(e) => updateHour(d, 1, e.target.value)}
                          style={dayHourInputStyle}
                        />
                      </>
                    ) : (
                      <span
                        style={{
                          gridColumn: '3 / span 2',
                          fontSize: '0.8rem',
                          color: '#94a3b8',
                          fontStyle: 'italic',
                        }}
                      >
                        Cerrada
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activa toggle (solo en editar) */}
          {editing && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginBottom: 2,
                  }}
                >
                  Cancha activa
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Las canchas inactivas no aparecen en la grilla pública.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, activa: !f.activa }))}
                style={{
                  position: 'relative',
                  width: 44,
                  height: 24,
                  borderRadius: 99,
                  border: 'none',
                  background: form.activa ? '#2563eb' : '#cbd5e1',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: form.activa ? 23 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: 99,
                    background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 18,
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1.5px solid #e2e8f0',
              background: 'white',
              color: '#475569',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={() => onSave(form)}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: canSave
                ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                : '#94a3b8',
              color: 'white',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: canSave ? 'pointer' : 'not-allowed',
              boxShadow: canSave ? '0 4px 12px rgba(37,99,235,0.25)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {editing ? 'Guardar cambios' : 'Crear cancha'}
          </button>
        </div>
      </div>
    </>
  )

  return createPortal(drawerContent, document.body)
}

const dayHourInputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 7,
  border: '1px solid #e2e8f0',
  background: 'white',
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '0.85rem',
  fontWeight: 700,
  color: '#0f172a',
  outline: 'none',
  textAlign: 'center',
  boxSizing: 'border-box',
  width: '100%',
}

// ---------- Confirm delete ----------

function ConfirmDeleteModal({
  cancha,
  onConfirm,
  onCancel,
}: {
  cancha: Cancha
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return createPortal(
    <>
      <div
        onClick={onCancel}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.55)',
          zIndex: 300,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(420px, calc(100vw - 32px))',
          background: 'white',
          borderRadius: 16,
          padding: 24,
          zIndex: 301,
          boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          animation: 'popIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#fef2f2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Trash2 size={22} />
        </div>
        <h3
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1.15rem',
            fontWeight: 800,
            color: '#0f172a',
            textAlign: 'center',
            margin: '0 0 8px',
          }}
        >
          Eliminar cancha
        </h3>
        <p
          style={{
            color: '#64748b',
            fontSize: '0.88rem',
            textAlign: 'center',
            margin: '0 0 20px',
            lineHeight: 1.5,
          }}
        >
          ¿Seguro que querés eliminar <strong style={{ color: '#0f172a' }}>{cancha.nombre}</strong>?
          Esta acción también borra su historial y no se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: 12,
              border: '1.5px solid #e2e8f0',
              background: 'white',
              color: '#475569',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '11px 16px',
              borderRadius: 12,
              border: 'none',
              background: '#dc2626',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ---------- Toast ----------

function Toast({ message }: { message: string }) {
  return createPortal(
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
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 99,
          background: '#dcfce7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Check size={15} color="#16a34a" />
      </div>
      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>{message}</span>
    </div>,
    document.body
  )
}
