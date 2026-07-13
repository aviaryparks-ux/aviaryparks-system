// lib/password.ts
// Password validation and strength checking utilities

/**
 * Password validation rules
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

/**
 * Password requirements configuration
 */
export interface PasswordRequirements {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
}

export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
};

/**
 * Common weak passwords to reject
 */
const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password123', 'password1234', 'qwerty', '123456', '12345678',
  '123456789', '1234567890', 'abc123', 'abcd1234', 'admin123', 'admin1234',
  'welcome', 'welcome123', 'changeme', 'letmein', 'login', 'login123',
  'test123', 'test1234', 'user123', 'user1234', 'pass123', 'pass1234',
  'passw0rd', 'p@ssw0rd', 'p@ssword', 'passw0rd123',
]);

/**
 * Validate password strength
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): PasswordValidationResult {
  const errors: string[] = [];

  // Check minimum length
  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters long`);
  }

  // Check for uppercase
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for numbers
  if (requirements.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for symbols
  if (requirements.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*...)');
  }

  // Check against common weak passwords
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a stronger password');
  }

  // Check for sequential numbers
  if (/012|123|234|345|456|567|678|789|890/.test(password)) {
    errors.push('Password should not contain sequential numbers');
  }

  // Check for repeated characters (more than 3)
  if (/(.)\1{3,}/.test(password)) {
    errors.push('Password should not contain repeated characters (more than 3 times)');
  }

  // Determine strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  if (errors.length === 0) {
    const hasAllTypes =
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (password.length >= 12 && hasAllTypes) {
      strength = 'strong';
    } else if (password.length >= 8 && hasAllTypes) {
      strength = 'medium';
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Generate a random strong password
 */
export function generatePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const allChars = uppercase + lowercase + numbers + symbols;

  // Ensure at least one of each type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Get password strength score (0-100)
 */
export function getPasswordScore(password: string): number {
  if (!password) return 0;

  let score = 0;

  // Length scoring
  score += Math.min(password.length * 4, 40); // Max 40 points for length

  // Character type scoring
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 20;

  // Bonus for mixing types
  const typesUsed = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  ].filter(Boolean).length;

  if (typesUsed >= 3) score += 10;
  if (typesUsed === 4) score += 10;

  // Penalties
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) score -= 50;
  if (/(.)\1{2,}/.test(password)) score -= 10;
  if (/012|123|234|345|456|567|678|789|890/.test(password)) score -= 10;

  return Math.max(0, Math.min(100, score));
}
