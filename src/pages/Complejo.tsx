// SRP: Página pública del complejo. Muestra la info del complejo y sus canchas.
// Usa TenantContext para obtener datos del complejo y hooks para canchas y fotos.
// Los filtros son componentes controlados que filtran client-side sin recargar.

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

type FiltroTipo = TipoCancha | 'todos'
type OrdenPrecio = 'default' | 'asc' | 'desc'

export default function Complejo() {
  const { complejo, loading: loadingComplejo, error } = useTenant()
  const { data: canchas, isLoading: loadingCanchas } = useCanchas(complejo?.id)
  const { data: fotos, isLoading: loadingFotos } = useFotos(complejo?.id)

  // Estado de filtros
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [ordenPrecio, setOrdenPrecio] = useState<OrdenPrecio>('default')

  // Aplicar filtros y ordenamiento
  const canchasFiltradas = useMemo(() => {
    if (!canchas) return []

    let resultado = [...canchas]

    // Filtrar por tipo
    if (filtroTipo !== 'todos') {
      resultado = resultado.filter((c) => c.tipo === filtroTipo)
    }

    // Ordenar por precio
    if (ordenPrecio === 'asc') {
      resultado.sort((a, b) => a.precio - b.precio)
    } else if (ordenPrecio === 'desc') {
      resultado.sort((a, b) => b.precio - a.precio)
    }

    return resultado
  }, [canchas, filtroTipo, ordenPrecio])

  // Loading state
  if (loadingComplejo) {
    return <ComplejoSkeleton />
  }

  // Complejo no encontrado
  if (error || !complejo) {
    return <ComplejoNoEncontrado />
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header del complejo */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Logo */}
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

            {/* Info */}
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-bold text-neutral-900">
                {complejo.nombre}
              </h1>
              {complejo.descripcion && (
                <p className="mt-2 max-w-2xl text-neutral-600">
                  {complejo.descripcion}
                </p>
              )}
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

      {/* Galería de fotos */}
      {!loadingFotos && fotos && fotos.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 py-6">
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
      {loadingFotos && (
        <section className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-72 flex-shrink-0 rounded-lg" />
            ))}
          </div>
        </section>
      )}

      {/* Filtros + Canchas */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-neutral-900">
            Canchas disponibles
          </h2>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            {/* Filtro por tipo */}
            <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-neutral-200">
              <FilterButton
                active={filtroTipo === 'todos'}
                onClick={() => setFiltroTipo('todos')}
              >
                Todas
              </FilterButton>
              {(['futbol5', 'futbol7', 'padel'] as TipoCancha[]).map((tipo) => (
                <FilterButton
                  key={tipo}
                  active={filtroTipo === tipo}
                  onClick={() => setFiltroTipo(tipo)}
                >
                  {tipoCanchaLabels[tipo]}
                </FilterButton>
              ))}
            </div>

            {/* Orden por precio */}
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

        {/* Lista de canchas */}
        {loadingCanchas ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : canchasFiltradas.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm ring-1 ring-neutral-200">
            <p className="text-neutral-500">
              {canchas?.length === 0
                ? 'Este complejo aún no tiene canchas cargadas.'
                : 'No hay canchas que coincidan con los filtros seleccionados.'}
            </p>
          </div>
        ) : (
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

// Componente de tarjeta de cancha
function CanchaCard({ cancha, slug }: { cancha: Cancha; slug: string }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{cancha.nombre}</CardTitle>
          <Badge variant="secondary">
            {tipoCanchaLabels[cancha.tipo]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-neutral-600">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-neutral-400" />
            <span className="font-semibold text-neutral-900">
              ${cancha.precio.toLocaleString('es-AR')}
            </span>
            <span>por turno</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-neutral-400" />
            <span>{cancha.duracion_min} minutos</span>
          </div>
        </div>
        <Link to={`/${slug}/reservar/${cancha.id}`} className="mt-4 block">
          <Button className="w-full" size="lg">
            Ver turnos
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// Botón de filtro reutilizable
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
          ? 'bg-primary-600 text-white'
          : 'text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  )
}

// Skeleton de carga para la página del complejo
function ComplejoSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <Skeleton className="h-24 w-24 rounded-xl" />
            <div className="space-y-3 text-center sm:text-left">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
              <Skeleton className="h-4 w-48" />
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
