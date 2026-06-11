import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { encryptSession } from '@/lib/crypto';

export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    // Memverifikasi Firebase ID Token secara aman di server
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Mengambil data pengguna untuk mendapatkan role secara aman
    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const role = userData.role || 'employee';

    // Enkripsi session (Kunci enkripsi aman karena hanya berjalan di server)
    const sessionCookie = encryptSession({
      uid: uid,
      email: userData.email || decodedToken.email,
      role: role,
    });

    const adminRoles = ["super_admin", "admin", "hr", "spv"];
    const redirectUrl = adminRoles.includes(role) ? "/dashboard" : "/mobile/dashboard";

    const response = NextResponse.json({ success: true, redirectUrl });

    // Set HttpOnly cookie agar hacker/XSS tidak bisa membaca cookie dari document.cookie
    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400 // 1 hari
    });

    return response;

  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
