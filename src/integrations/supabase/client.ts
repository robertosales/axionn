import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Variáveis injetadas pelo Lovable (APP_SUPABASE_*) ou pelo .env local (VITE_SUPABASE_*).
const SUPABASE_URL: string =
  (import.meta.env.APP_SUPABASE_URL as string) ||
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  '';

const SUPABASE_PUBLISHABLE_KEY: string =
  (import.meta.env.APP_SUPABASE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  '';

// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
