// PATRÓN: Context + Provider (Singleton en React)
// AuthContext actúa como un Singleton para el estado de autenticación.
// Centraliza la sesión del usuario, su perfil y rol en un solo lugar,
// evitando prop drilling y consultas duplicadas a Supabase Auth.
//
// SRP: Este contexto solo gestiona autenticación y perfil del usuario.
// No contiene lógica de negocio ni de UI — eso se delega a hooks y componentes.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, Rol } from '@/types'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  rol: Rol | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (
    email: string,
    password: string,
    metadata: { nombre: string; telefono?: string; rol: Rol },
    emailRedirectTo?: string
  ) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch del perfil desde la tabla profiles
  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Error al obtener perfil:', error.message)
      return null
    }
    return data as Profile
  }

  useEffect(() => {
    // Timeout de seguridad: si en 6s no terminó de cargar, forzar loading=false
    const timeout = setTimeout(() => setLoading(false), 6000)

    // Obtener sesión inicial — solo setear user/session, NO llamar fetchProfile aquí.
    // El useEffect de [user?.id] se encarga del fetch (corre fuera del lock de auth).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (!session?.user) {
        clearTimeout(timeout)
        setLoading(false)
      }
      // Con usuario: el useEffect de [user?.id] hace fetchProfile y setLoading(false)
    }).catch(() => {
      clearTimeout(timeout)
      setLoading(false)
    })

    // Escuchar cambios de auth — tampoco llamar fetchProfile aquí.
    // RAZÓN: onAuthStateChange corre DENTRO del lock de auth de Supabase.
    // Llamar fetchProfile (que hace un request con el token) dentro del lock
    // causa un deadlock de 5s (el lock no puede ser adquirido por el request).
    // Solución: solo actualizar user/session; el useEffect de [user?.id] maneja el resto.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'INITIAL_SESSION') return
      setSession(session)
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
        setLoading(false)
      }
      // Con usuario: useEffect de [user?.id] activará fetchProfile
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  // Fetch del perfil cuando cambia el usuario — corre FUERA del lock de auth,
  // evitando el deadlock que ocurría al llamar Supabase dentro de onAuthStateChange.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setLoading(true)
    fetchProfile(user.id).then((profile) => {
      if (!cancelled) {
        setProfile(profile)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [user?.id])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? new Error(error.message) : null }
  }

  async function signUp(
    email: string,
    password: string,
    metadata: { nombre: string; telefono?: string; rol: Rol },
    emailRedirectTo?: string
  ) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: emailRedirectTo ?? `${window.location.origin}/auth/callback`,
      },
    })
    return { error: error ? new Error(error.message) : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        rol: profile?.rol ?? null,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Hook para consumir el contexto de auth de forma segura
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>')
  }
  return context
}
