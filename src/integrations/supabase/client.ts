import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// A Anon Key é uma chave PÚBLICA por design.
// A segurança dos dados é garantida pelo RLS (Row Level Security) no Supabase.
const SUPABASE_URL = 'https://rgikyyazotqapaxijwui.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnaWt5eWF6b3RxYXBheGlqd3VpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNjM5NTIsImV4cCI6MjA4OTgzOTk1Mn0.ADQ3VDenVwNL3fgyNc2Fgu-Si66T7SHdG5se4Hvf5eg';

// import { supabase } from "@/integrations/supabase/client";
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
