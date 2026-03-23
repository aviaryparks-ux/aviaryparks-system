// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Route yang bisa diakses tanpa login
const publicRoutes = ['/login'];

// Route berdasarkan role
const roleBasedRoutes: Record<string, string[]> = {
  super_admin: [
    '/dashboard',
    '/attendance',
    '/attendance-corrections',
    '/users',
    '/settings',
    '/approval-flow',
  ],
  admin: ['/dashboard', '/attendance', '/attendance-corrections'],
  hr: ['/dashboard', '/attendance', '/attendance-corrections', '/users'],
  spv: ['/dashboard', '/attendance', '/attendance-corrections'],
  employee: ['/dashboard', '/attendance'],
};

function hasAccess(role: string, pathname: string): boolean {
  const allowedRoutes = roleBasedRoutes[role] || [];
  return allowedRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Fast check untuk public routes
  if (publicRoutes.some(route => pathname === route)) {
    return NextResponse.next();
  }

  // Fast check untuk static files
  if (pathname.includes('/_next/') || pathname.includes('/favicon.ico')) {
    return NextResponse.next();
  }

  // Ambil session dari cookie
  const session = request.cookies.get('__session')?.value;
  
  if (!session) {
    const loginUrl = new URL('/login', request.url);
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
    /*
     * Match semua route kecuali:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};