import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request) {
  const path = request.nextUrl.pathname;

  // Skip middleware for signout — never refresh session during signout
  if (path.startsWith('/api/auth/signout')) {
    return;
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
