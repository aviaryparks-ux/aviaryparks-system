import * as admin from 'firebase-admin';

const initFirebase = () => {
  if (!admin.apps.length) {
    try {
      console.log('--- FIREBASE ENV DEBUG ---');
      console.log('PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'EXISTS' : 'MISSING');
      console.log('CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? 'EXISTS' : 'MISSING');
      console.log('PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'EXISTS' : 'MISSING');
      
      // Fix potential quotes from copy-paste
      let pk = process.env.FIREBASE_PRIVATE_KEY || '';
      if (pk.startsWith('"') && pk.endsWith('"')) {
        pk = pk.substring(1, pk.length - 1);
      }
      // Handle literal newline strings
      pk = pk.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: pk,
        }),
      });
      console.log('Firebase Admin initialized successfully!');
    } catch (error: any) {
      console.error('Firebase admin initialization error:', error.message);
    }
  }
};

// Lazy initialize using Proxy to prevent crashes during Vercel build phase
export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get: (target, prop) => {
    initFirebase();
    const auth = admin.auth();
    const value = (auth as any)[prop];
    return typeof value === 'function' ? value.bind(auth) : value;
  }
});

export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get: (target, prop) => {
    initFirebase();
    const db = admin.firestore();
    const value = (db as any)[prop];
    return typeof value === 'function' ? value.bind(db) : value;
  }
});
