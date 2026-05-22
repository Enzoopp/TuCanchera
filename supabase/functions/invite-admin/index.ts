// Edge Function: invite-admin
// Solo ejecutable por superadmins. Envía un invite de Supabase Auth
// al email indicado con rol='admin' en los metadatos.
// Usa service_role key (nunca expuesta al frontend).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? 'https://tucanchera.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verificar que el caller es superadmin usando su JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user } } = await callerClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verificar rol superadmin
    const { data: profile } = await callerClient
      .from('profiles')
      .select('rol')
      .eq('user_id', user.id)
      .single()

    if (profile?.rol !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Acceso denegado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Parsear body
    const { email, nombre } = await req.json()
    if (!email || !nombre) {
      return new Response(JSON.stringify({ error: 'email y nombre son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Crear invite con service_role
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const appUrl = Deno.env.get('APP_URL') ?? 'https://tucanchera.vercel.app'

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      // invited_at también se incluye en metadata como fallback:
      // el trigger handle_new_user chequea BOTH la columna nativa auth.users.invited_at
      // Y este campo en metadata, para garantizar rol='admin' sin importar el timing de GoTrue.
      data: { nombre, rol: 'admin', invited_at: new Date().toISOString() },
      redirectTo: `${appUrl}/auth/callback`,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, userId: data.user?.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
