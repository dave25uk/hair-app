import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** False when the app is built without the Supabase env vars (shows a setup screen). */
export const hasSupabaseConfig = Boolean(
  url && anonKey && !url.includes('your-project-ref') && !anonKey.includes('your-anon'),
)

export const supabase: SupabaseClient | null = hasSupabaseConfig
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase environment variables are missing.')
  return supabase
}

/** The shared project URL — handy for the keep-alive workflow and docs. */
export const supabaseUrl = url ?? ''
