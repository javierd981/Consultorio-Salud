import { createClient } from '@supabase/supabase-js'

// Toma las variables de entorno que configuraremos en el archivo .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Exporta el cliente para poder usarlo en toda la aplicación
export const supabase = createClient(supabaseUrl, supabaseAnonKey)