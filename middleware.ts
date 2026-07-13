// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptSession } from '@/lib/crypto';
import { ADMIN_ROLES, normalizeRole } from '@/lib/roles';

// ✅ PUBLIC ROUTES
const publicRoutes = ['/login', '/profile', '/api/agora/token', '/api/auth/login'];

// ✅ ADMIN ROUTES
const adminRoutes = [
  '/dashboard',
  '/attendance',
  '/attendance-corrections',
  '/users',
  '/settings',
  '/approval-flow'
];

// ✅ MOBILE ROUTES
const mobileRoutes = [
  '/mobile/attendance',
  '/mobile/correction',
  '/mobile/history',
  '/mobile/profile'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Allow static files
  if (
    pathname.includes('/_next/') ||
    pathname.includes('/favicon.ico') ||
    pathname.includes('/icons/') ||
    pathname.includes('/manifest.json') ||
    pathname.includes('/sw.js')
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get('__session')?.value;

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const userData = decryptSession(session);

    if (!userData || typeof userData !== 'object') {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const rawUserRole = (userData as any).role || 'employee';
    const userRole = normalizeRole(rawUserRole);

    // Allow mobile routes
    if (mobileRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // Admin route check
    if (adminRoutes.some(route => pathname.startsWith(route))) {
      if (!ADMIN_ROLES.includes(userRole)) {
        if (pathname !== '/mobile/attendance') {
          return NextResponse.redirect(new URL('/mobile/attendance', request.url));
        }
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error('[MIDDLEWARE] Error:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
