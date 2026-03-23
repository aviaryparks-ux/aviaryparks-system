import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);