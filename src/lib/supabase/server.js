// Supabase Server Client — used in Server Components, Route Handlers, Server Actions
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function createServerSupabase() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try { cookieStore.set({ name, value, ...options }); } catch (e) { /* server component */ }
        },
        remove(name, options) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (e) { /* server component */ }
        },
      },
    }
  );

  // Admin client (service role) — for privileged ops
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  return { supabase, supabaseAdmin };
}

// Standalone admin client export (for use outside request context)
export function createAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
