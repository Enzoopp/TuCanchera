// AdminActionModal: modal de confirmación para acciones admin sensibles.
// Reemplaza prompt() y confirm() nativos con una UI limpia y coherente.
// Tres variantes: 'bloquear' (amber), 'desbloquear' (emerald), 'cancelar' (rojo).

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Calendar, Clock, MapPin, Lock, Unlock, XCircle, User } from 'lucide-react'

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type AdminActionVariant = 'bloquear' | 'desbloquear' | 'cancelar'

interface SlotInfo {
  cancha: string
  fecha: string
  horaInicio: string
  horaFin?: string
  motivoActual?: string   // para desbloquear: motivo existente
  cliente?: string        // para cancelar: nombre del cliente
}

interface Props {
  variant: AdminActionVariant
  slot: SlotInfo
  loading?: boolean
  onConfirm: (motivo?: string) => void
  onClose: () => void
}

// ─── Config por variante ─────────────────────────────────────────────────────

const config: Record<
  AdminActionVariant,
  {
    icon: React.ElementType
    iconBg: string
    iconColor: string
    title: string
    description: string
    confirmLabel: string
    confirmClass: string
    borderColor: string
    bgColor: string
  }
> = {
  bloquear: {
    icon: Lock,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-500',
    title: 'Bloquear turno',
    description: 'Este horario quedará no disponible para reservas.',
    confirmLabel: 'Bloquear turno',
    confirmClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    borderColor: 'border-amber-200',
    bgColor: 'bg-amber-50',
  },
  desbloquear: {
    icon: Unlock,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-500',
    title: 'Desbloquear turno',
    description: 'El horario volverá a estar disponible para reservas.',
    confirmLabel: 'Desbloquear',
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    borderColor: 'border-emerald-200',
    bgColor: 'bg-emerald-50',
  },
  cancelar: {
    icon: XCircle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
    title: 'Cancelar reserva',
    description: 'La reserva se cancelará y el cliente será notificado.',
    confirmLabel: 'Sí, cancelar',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    borderColor: 'border-red-200',
    bgColor: 'bg-red-50',
  },
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function AdminActionModal({
  variant,
  slot,
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  const [motivo, setMotivo] = useState('')
  const c = config[variant]
  const Icon = c.icon

  function handleConfirm() {
    onConfirm(variant === 'bloquear' ? motivo || undefined : undefined)
  }

  return (
    <Dialog open onOpenChange={() => { if (!loading) onClose() }}>
      <DialogContent onClose={loading ? undefined : onClose}>
        {/* Icono + header */}
        <div className="flex flex-col items-center pt-2 pb-1 text-center">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full ${c.iconBg}`}>
            <Icon className={`h-7 w-7 ${c.iconColor}`} />
          </div>
          <DialogHeader className="mt-3">
            <DialogTitle className="text-xl font-black">{c.title}</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-neutral-500">
              {c.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Resumen del turno */}
        <div className={`rounded-xl border ${c.borderColor} ${c.bgColor} p-4`}>
          <div className="space-y-2.5">
            {slot.cliente && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-neutral-500">
                  <User className="h-3.5 w-3.5" /> Cliente
                </span>
                <span className="font-semibold text-neutral-900">{slot.cliente}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <MapPin className="h-3.5 w-3.5" /> Cancha
              </span>
              <span className="font-semibold text-neutral-900">{slot.cancha}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <Calendar className="h-3.5 w-3.5" /> Fecha
              </span>
              <span className="font-semibold text-neutral-900">{slot.fecha}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-neutral-500">
                <Clock className="h-3.5 w-3.5" /> Horario
              </span>
              <span className="font-semibold text-neutral-900">
                {slot.horaInicio}{slot.horaFin ? ` — ${slot.horaFin}` : 'hs'}
              </span>
            </div>
            {variant === 'desbloquear' && slot.motivoActual && (
              <div className="border-t border-amber-200 pt-2.5">
                <p className="text-xs text-neutral-500">
                  <span className="font-semibold">Motivo original:</span> {slot.motivoActual}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Campo motivo (solo para bloquear) */}
        {variant === 'bloquear' && (
          <div className="space-y-1.5">
            <Label htmlFor="motivo" className="text-sm font-semibold text-neutral-700">
              Motivo <span className="font-normal text-neutral-400">(opcional)</span>
            </Label>
            <textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: mantenimiento, evento privado…"
              rows={2}
              disabled={loading}
              className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300 disabled:opacity-60"
            />
          </div>
        )}

        {/* Botones */}
        <DialogFooter className="gap-2 pt-1">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancelar
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`flex flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${c.confirmClass}`}
          >
            {loading ? 'Procesando…' : c.confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
