import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { decryptSession } from '@/lib/crypto';
import { cookies } from 'next/headers';
import { USER_MANAGER_ROLES, normalizeRole, isValidRole } from '@/lib/roles';
import { validatePassword, getPasswordScore } from '@/lib/password';
import { getClientIdentifier, checkRateLimit, createRateLimitHeaders, RateLimitConfigs } from '@/lib/rate-limit';

async function checkAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return null;
  const session = decryptSession(sessionCookie) as any;
  if (!session || !session.uid) return null;
  // Use centralized role check
  const normalizedRole = normalizeRole(session.role || 'employee');
  if (!USER_MANAGER_ROLES.includes(normalizedRole)) {
    return null;
  }
  return session;
}

export async function POST(request: Request) {
  try {
    // ============================================
    // RATE LIMITING - Protect against abuse
    // ============================================
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(clientId, RateLimitConfigs.strict);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const adminSession = await checkAdmin();
    if (!adminSession) {
      return NextResponse.json({ error: 'Unauthorized. Only super_admin or hr can create users.' }, { status: 403 });
    }

    const data = await request.json();
    const { name, email, password, role, department, position, division, jobLevel, employeeStatus, dailyRate, company, location, joinDate, bankName, bankAccountNumber, bankAccountName } = data;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    // ============================================
    // PASSWORD VALIDATION - Enforce password strength
    // ============================================
    const passwordValidation = validatePassword(password);

    if (!passwordValidation.isValid) {
      return NextResponse.json({
        error: 'Password does not meet security requirements',
        details: passwordValidation.errors,
        strength: passwordValidation.strength,
        score: getPasswordScore(password),
      }, { status: 400 });
    }

    // ============================================
    // INPUT VALIDATION - Additional sanitization
    // ============================================

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate role if provided
    if (role && !isValidRole(role)) {
      return NextResponse.json({ error: 'Invalid role specified' }, { status: 400 });
    }

    // Sanitize name - remove potential XSS
    const sanitizedName = String(name)
      .replace(/[<>]/g, '')
      .trim()
      .substring(0, 100); // Limit length

    let uid = '';

    // 1. Create or Update user in Firebase Auth
    try {
      const userRecord = await adminAuth.createUser({
        email: email.toLowerCase().trim(),
        password: String(password),
        displayName: sanitizedName,
      });
      uid = userRecord.uid;
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        // Fetch existing user
        const existingUser = await adminAuth.getUserByEmail(email);
        uid = existingUser.uid;

        // Update their password if provided and validated
        if (password) {
          await adminAuth.updateUser(uid, { password: String(password), displayName: sanitizedName });
        }
      } else {
        throw authError;
      }
    }

    // 2. Save or Update user profile in Firestore
    const normalizedRole = normalizeRole(role || 'employee');
    const userDoc = {
      name: sanitizedName,
      email: email.toLowerCase().trim(),
      role: normalizedRole,
      department: String(department || '').replace(/[<>]/g, '').trim().substring(0, 100),
      position: String(position || '').replace(/[<>]/g, '').trim().substring(0, 100),
      division: String(division || '').replace(/[<>]/g, '').trim().substring(0, 100),
      jobLevel: String(jobLevel || '').replace(/[<>]/g, '').trim().substring(0, 50),
      employeeStatus: String(employeeStatus || '').replace(/[<>]/g, '').trim().substring(0, 50),
      dailyRate: dailyRate ? Number(dailyRate) : null,
      company: String(company || '').replace(/[<>]/g, '').trim().substring(0, 100),
      location: String(location || '').replace(/[<>]/g, '').trim().substring(0, 100),
      joinDate: String(joinDate || '').trim().substring(0, 20),
      isActive: true,
      bankName: String(bankName || '').replace(/[<>]/g, '').trim().substring(0, 100),
      bankAccountNumber: String(bankAccountNumber || '').replace(/[<>]/g, '').trim().substring(0, 50),
      bankAccountName: String(bankAccountName || '').replace(/[<>]/g, '').trim().substring(0, 100),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: adminSession.uid,
    };

    // Use set with merge: true to update if exists, or create if new
    await adminDb.collection('users').doc(uid).set(userDoc, { merge: true });

    return NextResponse.json({
      success: true,
      uid,
      passwordStrength: passwordValidation.strength,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating user via API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    // ============================================
    // RATE LIMITING
    // ============================================
    const clientId = getClientIdentifier(request);
    const rateLimitResult = checkRateLimit(clientId, RateLimitConfigs.strict);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    const adminSession = await checkAdmin();
    if (!adminSession) {
      return NextResponse.json({ error: 'Unauthorized. Only super_admin or hr can delete users.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    // Sanitize UID - should be alphanumeric
    const sanitizedUid = String(uid).replace(/[^a-zA-Z0-9]/g, '');

    if (uid.length !== sanitizedUid.length) {
      return NextResponse.json({ error: 'Invalid UID format' }, { status: 400 });
    }

    // Protect against self-deletion
    if (uid === adminSession.uid) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Check if trying to delete a super_admin
    const targetUserDoc = await adminDb.collection('users').doc(uid).get();
    if (targetUserDoc.exists) {
      const targetRole = normalizeRole(targetUserDoc.data()?.role || '');
      if (targetRole === 'super_admin' && adminSession.uid !== uid) {
        return NextResponse.json({ error: 'Cannot delete a super_admin account' }, { status: 403 });
      }
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
