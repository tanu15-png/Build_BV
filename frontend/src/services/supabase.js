import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url?.startsWith('https://') && key?.startsWith('sb_publishable_')
  ? createClient(url, key, {
    auth: { flowType: 'pkce', storage: sessionStorage, persistSession: true, detectSessionInUrl: true },
  }) : null;
