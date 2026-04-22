// SRP: Página pública de inicio. Lista todos los complejos activos
// para que los clientes puedan descubrirlos, y ofrece accesos a login/registro.

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { fetchComplejosActivos } from '@/services/complejoService'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MapPin,
  ArrowRight,
  LogIn,
  User,
  LandPlot,
  LogOut,
  Zap,
} from 'lucide-react'

export default function Landing() {
  const { user, rol, signOut } = useAuth()
  const { data: complejos, isLoading } = useQuery({
    queryKey: ['complejos-activos'],
    queryFn: fetchComplejosActivos,
  })

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Link to="/explorar" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-white">
              <Zap className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold text-white">TuCanchera</span>
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                {rol === 'admin' ? (
                  <Link to="/admin/dashboard">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                    >
                      Panel admin
                    </Button>
                  </Link>
                ) : (
                  <Link to="/mis-reservas">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                    >
                      <User className="mr-1.5 h-4 w-4" />
                      Mis reservas
                    </Button>
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={signOut}
                  title="Cerrar sesión"
                  className="text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <LogIn className="mr-1.5 h-4 w-4" />
                    Iniciar sesión
                  </Button>
                </Link>
                <Link to="/register">
                  <Button
                    size="sm"
                    className="bg-primary-500 text-white hover:bg-primary-400"
                  >
                    Registrarme
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[520px] items-center overflow-hidden bg-neutral-950 pt-16">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-primary-950/60 to-neutral-950" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(var(--color-primary-400) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary-400) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Glow effect */}
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary-600/20 blur-3xl" />
        <div className="absolute -bottom-20 right-20 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-4 py-24 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-1.5 text-sm font-medium text-primary-400">
            <Zap className="h-3.5 w-3.5" />
            Reservá en segundos, jugá al instante
          </div>

          <h1 className="mt-4 text-5xl font-black tracking-tight text-white sm:text-6xl md:text-7xl">
            Reservá tu cancha
            <br />
            <span className="text-primary-400">al instante</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-400">
            Explorá complejos de fútbol y pádel, elegí el horario que más te
            convenga y confirmá tu turno sin llamadas ni esperas.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#complejos">
              <Button
                size="lg"
                className="rounded-full bg-primary-500 px-8 text-base font-semibold text-white hover:bg-primary-400"
              >
                Ver complejos disponibles
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            {!user && (
              <Link to="/register">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/20 bg-white/5 px-8 text-base text-white hover:bg-white/10"
                >
                  Crear cuenta gratis
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="border-y border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-4xl grid-cols-3 divide-x divide-neutral-200 px-4 py-5 text-center">
          <div>
            <p className="text-2xl font-black text-primary-600">100%</p>
            <p className="mt-0.5 text-xs text-neutral-500">Online sin llamadas</p>
          </div>
          <div>
            <p className="text-2xl font-black text-primary-600">24/7</p>
            <p className="mt-0.5 text-xs text-neutral-500">Disponible siempre</p>
          </div>
          <div>
            <p className="text-2xl font-black text-primary-600">⚡ 30s</p>
            <p className="mt-0.5 text-xs text-neutral-500">Para reservar</p>
          </div>
        </div>
      </div>

      {/* Listado de complejos */}
      <main id="complejos" className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-black text-neutral-900">
            Complejos disponibles
          </h2>
          <p className="mt-2 text-neutral-500">
            Hacé clic en cualquier complejo para ver canchas y disponibilidad en tiempo real.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-60 rounded-2xl" />
            ))}
          </div>
        ) : !complejos || complejos.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {complejos.map((c) => (
              <Link
                key={c.id}
                to={`/${c.slug}`}
                className="group block overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                {/* Image / Logo area */}
                <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-primary-600 to-primary-900">
                  {/* Diagonal lines pattern */}
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)',
                      backgroundSize: '12px 12px',
                    }}
                  />
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      alt={`Logo de ${c.nombre}`}
                      className="relative z-10 h-20 w-20 rounded-xl object-cover shadow-lg ring-4 ring-white/20"
                    />
                  ) : (
                    <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-xl bg-white/10 text-4xl font-black text-white shadow-lg ring-4 ring-white/20 backdrop-blur-sm">
                      {c.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4">
                  <h3 className="text-base font-bold text-neutral-900 group-hover:text-primary-600 transition-colors">
                    {c.nombre}
                  </h3>
                  {c.direccion && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-neutral-500">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-primary-500" />
                      <span className="line-clamp-1">{c.direccion}</span>
                    </p>
                  )}
                  {c.descripcion && (
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-600">
                      {c.descripcion}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                      Ver disponibilidad
                    </span>
                    <ArrowRight className="h-4 w-4 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-primary-500" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-neutral-950">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary-500 text-white">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-bold text-white">TuCanchera</span>
            <span className="text-sm text-neutral-500">
              © {new Date().getFullYear()}
            </span>
          </div>
          <Link
            to="/register-admin"
            className="text-sm font-medium text-primary-400 hover:text-primary-300 hover:underline transition-colors"
          >
            ¿Tenés un complejo? Sumate →
          </Link>
        </div>
      </footer>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
        <LandPlot className="h-7 w-7 text-primary-500" />
      </div>
      <h3 className="text-lg font-bold text-neutral-900">
        Todavía no hay complejos cargados
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
        Volvé pronto o, si administrás un complejo, registrate como admin para
        ser de los primeros en aparecer acá.
      </p>
      <Link to="/register-admin" className="mt-5 inline-block">
        <Button size="sm" className="rounded-full">
          Registrarme como admin
        </Button>
      </Link>
    </div>
  )
}
