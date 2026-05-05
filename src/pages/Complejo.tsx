// ============================================================
// COMPLEJO.TSX  (ruta: /:slug)
// Página pública del complejo deportivo.
// Muestra la información del complejo (logo, nombre, dirección,
// descripción), su galería de fotos y las canchas disponibles
// con filtros por tipo y orden de precio.
// ============================================================

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTenant } from '@/context/TenantContext'
import { useCanchas } from '@/hooks/useCanchas'
import { useFotos } from '@/hooks/useFotos'
import ComplejoNoEncontrado from '@/pages/ComplejoNoEncontrado'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Clock, DollarSign } from 'lucide-react'
import type { Cancha, TipoCancha } from '@/types'
import { tipoCanchaLabels } from '@/utils/canchaLabels'

// ── Tipos para los filtros ───────────────────────────────────
// FiltroTipo: puede ser un tipo de cancha específico o 'todos'
// OrdenPrecio: sin orden, ascendente o descendente por precio
type FiltroTipo = TipoCancha | 'todos'
type OrdenPrecio = 'default' | 'asc' | 'desc'

export default function Complejo() {
  // useTenant: lee el slug de la URL y carga el complejo correspondiente
  // desde Supabase. Si el slug no existe → error y se muestra ComplejoNoEncontrado
  const { complejo, loading: loadingComplejo, error } = useTenant()

  // useCanchas: busca todas las canchas activas del complejo (por ID)
  const { data: canchas, isLoading: loadingCanchas } = useCanchas(complejo?.id)

  // useFotos: busca las fotos de la galería del complejo
  const { data: fotos, isLoading: loadingFotos } = useFotos(complejo?.id)

  // ── Estados de los filtros ───────────────────────────────────
  // filtroTipo: botón seleccionado (Todas / Fútbol 5 / Fútbol 7 / Pádel)
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  // ordenPrecio: botón de orden seleccionado
  const [ordenPrecio, setOrdenPrecio] = useState<OrdenPrecio>('default')

  // ── Filtrado client-side con useMemo ─────────────────────────
  // useMemo: recalcula solo cuando cambian 'canchas', 'filtroTipo' u 'ordenPrecio'
  // Esto evita recorrer el array en cada render
  const canchasFiltradas = useMemo(() => {
    if (!canchas) return []

    let resultado = [...canchas]  // copia para no mutar el original

    // 1) Filtrar por tipo de cancha (si no es 'todos')
    if (filtroTipo !== 'todos') {
      resultado = resultado.filter((c) => c.tipo === filtroTipo)
    }

    // 2) Ordenar por precio
    if (ordenPrecio === 'asc') {
      resultado.sort((a, b) => a.precio - b.precio)   // menor a mayor
    } else if (ordenPrecio === 'desc') {
      resultado.sort((a, b) => b.precio - a.precio)   // mayor a menor
    }

    return resultado
  }, [canchas, filtroTipo, ordenPrecio])

  // ── Estados de carga / error ─────────────────────────────────

  // Mientras TenantContext resuelve el slug: mostramos skeletons
  if (loadingComplejo) {
    return <ComplejoSkeleton />
  }

  // Si el slug no existe en la BD o hubo un error → 404 personalizado
  if (error || !complejo) {
    return <ComplejoNoEncontrado />
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* ── Header del complejo (logo + nombre + dirección) ── */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">

            {/* Logo: imagen real si existe, fallback con la primera letra del nombre */}
            {complejo.logo_url ? (
              <img
                src={complejo.logo_url}
                alt={`Logo de ${complejo.nombre}`}
                className="h-24 w-24 rounded-xl object-cover shadow-md"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-primary-100 text-3xl font-bold text-primary-600">
                {complejo.nombre.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Información textual */}
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold text-neutral-900">
                {complejo.nombre}
              </h1>
              {/* Descripción — opcional, puede ser null en la BD */}
              {complejo.descripcion && (
                <p className="mt-2 max-w-2xl text-neutral-600">
                  {complejo.descripcion}
                </p>
              )}
              {/* Dirección con ícono de pin — opcional */}
              {complejo.direccion && (
                <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-neutral-500 sm:justify-start">
                  <MapPin className="h-4 w-4" />
                  {complejo.direccion}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Galería de fotos — scroll horizontal ── */}
      {/* Solo se renderiza si ya cargaron y hay fotos */}
      {!loadingFotos && fotos && fotos.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-6">
          {/* overflow-x-auto + flex permite desplazarse horizontalmente en mobile */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {fotos.map((foto) => (
              <img
                key={foto.id}
                src={foto.url}
                alt={`Foto de ${complejo.nombre}`}
                className="h-48 w-72 flex-shrink-0 rounded-lg object-cover shadow-sm"
              />
            ))}
          </div>
        </section>
      )}
      {/* Mientras cargan las fotos: skeletons de placeholder */}
      {loadingFotos && (
        <section className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-72 flex-shrink-0 rounded-lg" />
            ))}
          </div>
        </section>
      )}

      {/* ── Sección de filtros + lista de canchas ── */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">
            Canchas disponibles
          </h2>

          {/* ── Barra de filtros ── */}
          <div className="flex flex-wrap gap-2">

            {/* Filtro por tipo de cancha */}
            {/* Grupo de botones con fondo blanco y borde (pill selector) */}
            <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-neutral-200">
              {/* Botón "Todas" */}
              <FilterButton
                active={filtroTipo === 'todos'}
                onClick={() => setFiltroTipo('todos')}
              >
                Todas
              </FilterButton>
              {/* Botones dinámicos para cada tipo de cancha */}
              {(['futbol5', 'futbol7', 'padel'] as TipoCancha[]).map((tipo) => (
                <FilterButton
                  key={tipo}
                  active={filtroTipo === tipo}
                  onClick={() => setFiltroTipo(tipo)}
                >
                  {/* tipoCanchaLabels convierte 'futbol5' → 'Fútbol 5' etc. */}
                  {tipoCanchaLabels[tipo]}
                </FilterButton>
              ))}
            </div>

            {/* Filtro por precio */}
            <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-neutral-200">
              <FilterButton
                active={ordenPrecio === 'default'}
                onClick={() => setOrdenPrecio('default')}
              >
                Sin orden
              </FilterButton>
              <FilterButton
                active={ordenPrecio === 'asc'}
                onClick={() => setOrdenPrecio('asc')}
              >
                $ Menor
              </FilterButton>
              <FilterButton
                active={ordenPrecio === 'desc'}
                onClick={() => setOrdenPrecio('desc')}
              >
                $ Mayor
              </FilterButton>
            </div>
          </div>
        </div>

        {/* ── Lista de canchas ── */}
        {loadingCanchas ? (
          // Skeleton grid mientras cargan las canchas
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : canchasFiltradas.length === 0 ? (
          // Estado vacío: distingue entre "no hay canchas" y "no coincide el filtro"
          <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-neutral-200">
            <p className="text-neutral-500">
              {canchas?.length === 0
                ? 'Este complejo aún no tiene canchas cargadas.'
                : 'No hay canchas que coincidan con los filtros seleccionados.'}
            </p>
          </div>
        ) : (
          // Grid de CanchaCard — una por cancha
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {canchasFiltradas.map((cancha) => (
              <CanchaCard key={cancha.id} cancha={cancha} slug={complejo.slug} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ── CanchaCard ───────────────────────────────────────────────
// Tarjeta individual para una cancha.
// Muestra: nombre, tipo (badge), precio, duración, y botón "Ver turnos"
// Al hacer clic navega a /:slug/reservar/:canchaId
function CanchaCard({ cancha, slug }: { cancha: Cancha; slug: string }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{cancha.nombre}</CardTitle>
          {/* Badge de tipo: Fútbol 5, Fútbol 7, Pádel */}
          <Badge variant="secondary">
            {tipoCanchaLabels[cancha.tipo]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-neutral-600">
          {/* Precio por turno */}
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-neutral-400" />
            <span className="font-semibold text-neutral-900">
              {/* toLocaleString('es-AR'): formatea con separador de miles en español */}
              ${cancha.precio.toLocaleString('es-AR')}
            </span>
            <span>por turno</span>
          </div>
          {/* Duración del turno en minutos */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-400" />
            <span>{cancha.duracion_min} minutos</span>
          </div>
        </div>
        {/* Botón que lleva a la página de reserva de esta cancha específica */}
        <Link to={`/${slug}/reservar/${cancha.id}`} className="mt-4 block">
          <Button className="w-full" size="lg">
            Ver turnos
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// ── FilterButton ─────────────────────────────────────────────
// Botón de filtro reutilizable dentro del selector pill.
// Cuando 'active' es true, se pone con fondo azul y texto blanco.
// Cuando es false, fondo transparente con texto gris.
function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary-600 text-white'            // seleccionado
          : 'text-neutral-600 hover:bg-neutral-100' // no seleccionado
      }`}
    >
      {children}
    </button>
  )
}

// ── ComplejoSkeleton ─────────────────────────────────────────
// Pantalla de carga completa que imita la estructura de la página
// mientras TenantContext resuelve el slug de la URL.
function ComplejoSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <Skeleton className="h-24 w-24 rounded-xl" />
            <div className="space-y-3 text-center sm:text-left">
              <Skeleton className="h-8 w-64" />   {/* Nombre */}
              <Skeleton className="h-4 w-96" />   {/* Descripción */}
              <Skeleton className="h-4 w-48" />   {/* Dirección */}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Skeleton className="mb-6 h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  )
}
