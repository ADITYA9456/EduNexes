import { NextResponse } from 'next/server';

// Supabase auth callback — handles OAuth redirects (Google) and email confirmations
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  if (code) {
    const { createServerSupabase } = await import('@/lib/supabase/server');
    const { supabase } = createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
