// Tipos e interfaces globales de TuCanchera
// Mapean directamente a las tablas de Supabase definidas en supabase/schema.sql

export type Rol = 'cliente' | 'admin' | 'superadmin'

export type TipoCancha = 'futbol5' | 'futbol7' | 'padel'

export type MetodoPago = 'mercadopago' | 'en_lugar'

export type EstadoReserva = 'pendiente_pago' | 'confirmada' | 'cancelada_admin'

export type EstadoSlot = 'libre' | 'ocupado' | 'bloqueado'

export interface Profile {
  id: string
  user_id: string
  nombre: string
  telefono: string | null
  email: string | null
  rol: Rol
  creado_en: string
}

export interface Complejo {
  id: string
  admin_id: string
  nombre: string
  slug: string
  descripcion: string | null
  direccion: string | null
  logo_url: string | null
  activo: boolean
  creado_en: string
}

export interface FotoComplejo {
  id: string
  complejo_id: string
  url: string
  orden: number
}

export interface Cancha {
  id: string
  complejo_id: string
  tipo: TipoCancha
  nombre: string
  duracion_min: 60 | 90
  precio: number
  activa: boolean
}

export interface HorarioCancha {
  id: string
  cancha_id: string
  dia_semana: number // 0=domingo, 1=lunes, ..., 6=sábado
  hora_inicio: string // formato TIME "HH:MM:SS"
  hora_fin: string
}

export interface Bloqueo {
  id: string
  cancha_id: string
  fecha: string // formato DATE "YYYY-MM-DD"
  hora_inicio: string
  motivo: string | null
  creado_en: string
}

export interface Reserva {
  id: string
  cancha_id: string
  cliente_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  metodo_pago: MetodoPago
  estado: EstadoReserva
  mp_payment_id: string | null
  // null = sin confirmar (turno futuro o no aplica), true = vino, false = no se presentó
  asistio: boolean | null
  archivada: boolean
  creado_en: string
}

export interface Slot {
  horaInicio: string
  horaFin: string
  estado: EstadoSlot
}

export interface CodigoInvitacion {
  id: string
  codigo: string
  usado: boolean
  creado_en: string
}
