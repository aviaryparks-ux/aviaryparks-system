import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { decryptSession } from '@/lib/crypto';
import { cookies } from 'next/headers';

async function checkAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;
  const session = decryptSession(sessionCookie) as any;
  if (!session || !session.uid || !['super_admin', 'hr'].includes(session.role)) {
    return null;
  }
  return session;
}

export async function POST(request: Request) {
  try {
    const adminSession = await checkAdmin();
    if (!adminSession) {
      return NextResponse.json({ error: 'Unauthorized. Only super_admin or hr can create users.' }, { status: 403 });
    }

    const data = await request.json();
    const { name, email, password, role, department, position, division, jobLevel, employeeStatus, dailyRate, company, location, joinDate, bankName, bankAccountNumber, bankAccountName } = data;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    let uid = '';

    // 1. Create or Update user in Firebase Auth
    try {
      const userRecord = await adminAuth.createUser({
        email,
        password: String(password),
        displayName: String(name),
      });
      uid = userRecord.uid;
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        // Fetch existing user
        const existingUser = await adminAuth.getUserByEmail(email);
        uid = existingUser.uid;
        
        // Optionally update their password if provided
        if (password) {
          await adminAuth.updateUser(uid, { password: String(password), displayName: String(name) });
        }
      } else {
        throw authError;
      }
    }

    // 2. Save or Update user profile in Firestore
    const userDoc = {
      name: String(name),
      email: String(email),
      role: role || 'employee',
      department: department || '',
      position: position || '',
      division: division || '',
      jobLevel: jobLevel || '',
      employeeStatus: employeeStatus || '',
      dailyRate: dailyRate ? Number(dailyRate) : null,
      company: company || '',
      location: location || '',
      joinDate: joinDate || '',
      isActive: true,
      bankName: bankName || '',
      bankAccountNumber: bankAccountNumber || '',
      bankAccountName: bankAccountName || '',
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Use set with merge: true to update if exists, or create if new
    await adminDb.collection('users').doc(uid).set(userDoc, { merge: true });

    return NextResponse.json({ success: true, uid }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user via API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const adminSession = await checkAdmin();
    if (!adminSession) {
      return NextResponse.json({ error: 'Unauthorized. Only super_admin or hr can delete users.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    // Protect against self-deletion or super_admin deletion if needed, but let's trust the role check
    if (uid === adminSession.uid) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // 1. Delete user from Firestore
    await adminDb.collection('users').doc(uid).delete();

    // 2. Delete user from Firebase Auth
    try {
      await adminAuth.deleteUser(uid);
    } catch (authError: any) {
      // If user is not found in auth, that's okay, just proceed
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting user via API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
