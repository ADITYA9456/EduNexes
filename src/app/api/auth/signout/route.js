import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { origin } = new URL(request.url);
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();

  // Build redirect response
  const response = NextResponse.redirect(`${origin}/login`, { status: 302 });

  // Raw Set-Cookie headers to delete every Supabase cookie — most reliable method
  for (const cookie of allCookies) {
    if (cookie.name.startsWith('sb-')) {
      response.headers.append(
        'Set-Cookie',
        `${cookie.name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax`
      );
    }
  }

  return response;
}

export async function POST(request) {
  return GET(request);
}
