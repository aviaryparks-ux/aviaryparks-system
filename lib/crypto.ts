// lib/crypto.ts
// Session encryption utility using AES-256-CBC (works in both client and server)

import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.SESSION_SECRET || 'aviary-session-secret-key-32chars!';

export function encryptSession(data: object): string {
  const jsonStr = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(jsonStr, ENCRYPTION_KEY).toString();
  return encrypted;
}

export function decryptSession(encryptedData: string): object | null {
  try {
    if (!encryptedData || encryptedData.trim() === '') {
      return null;
    }

    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedStr || decryptedStr.trim() === '') {
      return null;
    }

    return JSON.parse(decryptedStr);
  } catch (error) {
    console.error('Failed to decrypt session:', error);
    return null;
  }
}