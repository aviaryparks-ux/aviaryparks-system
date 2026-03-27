// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ✅ HARUS DI SINI (atas)
const publicRoutes = ['/login', '/profile'];

const adminRoutes = [
  '/dashboard',
  '/attendance',
  '/attendance-corrections',
  '/users',
  '/settings',
  '/approval-flow'
];

const mobileRoutes = [
  '/mobile/attendance',
  '/mobile/correction',
  '/mobile/history',
  '/mobile/profile'
];

const adminRoles = ['super_admin', 'admin', 'hr', 'spv'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ PUBLIC
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // ✅ STATIC
  if (
    pathname.includes('/_next/') ||
    pathname.includes('/favicon.ico') ||
    pathname.includes('/icons/') ||
    pathname.includes('/manifest.json') ||
    pathname.includes('/sw.js')
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('__session')?.value;

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const userData = JSON.parse(
      Buffer.from(session, 'base64').toString('utf-8')
    );

    const userRole = userData.role || 'employee';

    // ✅ MOBILE BEBAS
    if (mobileRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.next();
    }

    // ✅ ADMIN ONLY
    if (adminRoutes.some(route => pathname.startsWith(route))) {
      if (!adminRoles.includes(userRole)) {
        if (pathname !== '/mobile/attendance') {
          return NextResponse.redirect(
            new URL('/mobile/attendance', request.url)
          );
        }
      }
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};