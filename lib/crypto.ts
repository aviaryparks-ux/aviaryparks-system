// lib/crypto.ts
// Session encryption utility using CryptoJS (compatible with Edge Runtime & Node.js)

import CryptoJS from 'crypto-js';

// Get the secret key - MUST be set in production
const SESSION_SECRET = process.env.SESSION_SECRET || 'aviary-session-secret-key-32chars!';

/**
 * Encrypt session data using AES
 */
export function encryptSession(data: object): string {
  const jsonStr = JSON.stringify(data);
  const encrypted = CryptoJS.AES.encrypt(jsonStr, SESSION_SECRET).toString();
  return encrypted;
}

/**
 * Decrypt session data
 */
export function decryptSession(encryptedData: string): object | null {
  try {
    if (!encryptedData || encryptedData.trim() === '') {
      return null;
    }

    const bytes = CryptoJS.AES.decrypt(encryptedData, SESSION_SECRET);
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

// Sync versions (alias for compatibility)
export const encryptSessionSync = encryptSession;
export const decryptSessionSync = decryptSession;
