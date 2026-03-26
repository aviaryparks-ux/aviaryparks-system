// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Route yang bisa diakses tanpa login
const publicRoutes = ['/login', '/profile', '/mobile/attendance', '/mobile/correction', '/mobile/history', '/mobile/profile'];

// Route berdasarkan role
const roleBasedRoutes: Record<string, string[]> = {
  super_admin: [
    '/dashboard',
    '/attendance',
    '/attendance-corrections',
    '/users',
    '/settings',
    '/approval-flow',
    '/profile',
    '/mobile/attendance',
    '/mobile/correction',
    '/mobile/history',
    '/mobile/profile',
  ],
  admin: [
    '/dashboard',
    '/attendance',
    '/attendance-corrections',
    '/profile',
    '/mobile/attendance',
    '/mobile/correction',
    '/mobile/history',
    '/mobile/profile',
  ],
  hr: [
    '/dashboard',
    '/attendance',
    '/attendance-corrections',
    '/users',
    '/profile',
    '/mobile/attendance',
    '/mobile/correction',
    '/mobile/history',
    '/mobile/profile',
  ],
  manager: [
    '/dashboard',
    '/attendance',
    '/attendance-corrections',
    '/profile',
    '/mobile/attendance',
    '/mobile/correction',
    '/mobile/history',
    '/mobile/profile',
  ],
  spv: [
    '/dashboard',
    '/attendance',
    '/attendance-corrections',
    '/profile',
    '/mobile/attendance',
    '/mobile/correction',
    '/mobile/history',
    '/mobile/profile',
  ],
  employee: [
    '/dashboard',
    '/attendance',
    '/profile',
    '/mobile/attendance',
    '/mobile/correction',
    '/mobile/history',
    '/mobile/profile',
  ],
};

function hasAccess(role: string, pathname: string): boolean {
  const allowedRoutes = roleBasedRoutes[role] || [];
  return allowedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public routes (bisa diakses tanpa login)
  if (publicRoutes.some(route => pathname === route)) {
    return NextResponse.next();
  }

  // Skip static files
  if (pathname.includes('/_next/') || pathname.includes('/favicon.ico') || pathname.includes('/icons/') || pathname.includes('/manifest.json') || pathname.includes('/sw.js')) {
    return NextResponse.next();
  }

  const session = request.cookies.get('__session')?.value;
  
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const userData = JSON.parse(atob(session));
    const userRole = userData.role || 'employee';
    
    if (!hasAccess(userRole, pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
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