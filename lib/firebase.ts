import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCwFnS1_lDGdY8E72d-RikRaHSnvjLEJ6w",
  authDomain: "aviary-parks-system.firebaseapp.com",
  projectId: "aviary-parks-system",
  storageBucket: "aviary-parks-system.firebasestorage.app",
  messagingSenderId: "563254318213",
  appId: "1:563254318213:web:562063b16fb85cee0e85ec",
  measurementId: "G-2EYXMW6W1E"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
import { getFirestore } from "firebase/firestore";

let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (error) {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const storage = getStorage(app);