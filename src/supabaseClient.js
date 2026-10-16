import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Não derruba o app (tela branca) quando as variáveis faltam: o erro é mostrado na tela.
export const supabase = supabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

export const MISSING_ENV_MESSAGE =
  'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas. ' +
  'Configure-as no arquivo .env (local) ou na Vercel (Settings > Environment Variables) e refaça o deploy.'
