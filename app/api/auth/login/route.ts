import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { encryptSession } from '@/lib/crypto';
import { ADMIN_ROLES, normalizeRole } from '@/lib/roles';
import { getClientIdentifier, checkRateLimit, createRateLimitHeaders, RateLimitConfigs } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(clientId, RateLimitConfigs.strict);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    // Verify Firebase token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Get user from Firestore
    const userDoc = await adminDb.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const role = normalizeRole(userData.role || 'employee');

    // Create encrypted session
    const sessionCookie = encryptSession({
      uid: uid,
      email: userData.email || decodedToken.email,
      role: role,
    });

    const redirectUrl = ADMIN_ROLES.includes(role) ? "/dashboard" : "/mobile/dashboard";

    const response = NextResponse.json({ success: true, redirectUrl });

    // Set cookie
    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      maxAge: 3600,
    });

    return response;

  } catch (error: any) {
    console.error('[LOGIN] Error:', error.message);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
