# Aviary Parks System - Security Configuration Guide

## 📋 Overview

This document describes the security measures implemented in this application.

---

## 🔐 Security Features Implemented

### 1. Session Encryption (AES-256-GCM)
**File:** `lib/crypto.ts`

- Uses Node.js `crypto` module with AES-256-GCM
- Provides authenticated encryption (confidentiality + integrity)
- Key derivation using scrypt
- Requires `SESSION_SECRET` environment variable

### 2. Rate Limiting
**File:** `lib/rate-limit.ts`

- In-memory rate limiter for API protection
- Prevents brute force attacks
- Configurable limits per endpoint:
  - `strict`: 5 requests/minute (login, user management)
  - `normal`: 10 requests/minute (general API)
  - `relaxed`: 30 requests/minute (data fetching)
  - `api`: 100 requests/minute (authenticated API)

### 3. Password Strength Validation
**File:** `lib/password.ts`

- Minimum 8 characters
- Requires uppercase, lowercase, numbers, and special characters
- Rejects common weak passwords
- Checks for sequential numbers and repeated characters
- Password strength scoring (0-100)

### 4. Centralized Role Management
**File:** `lib/roles.ts`

- Consistent role definitions across the application
- Role hierarchy for privilege escalation prevention
- Functions: `hasAdminAccess()`, `canManageUsers()`, `normalizeRole()`

### 5. Security Headers
**File:** `next.config.ts`

- Strict-Transport-Security (HSTS)
- X-Frame-Options (Clickjacking protection)
- X-Content-Type-Options (MIME sniffing protection)
- Content-Security-Policy (XSS protection)
- Referrer-Policy
- X-DNS-Prefetch-Control
- Permissions-Policy

### 6. Input Validation & Sanitization
- Email format validation
- Role validation
- XSS prevention (HTML tag stripping)
- UID format validation
- Input length limits

---

## 🔧 Environment Variables Required

### Development/Production

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID="aviary-parks-system"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@aviary-parks-system.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Security - CRITICAL
SESSION_SECRET="generate-with-openssl-rand-base64-32"

# Agora Video API
AGORA_APP_ID="your-agora-app-id"
AGORA_APP_CERTIFICATE="your-agora-certificate"

# Optional: AI Processing
GROQ_API_KEY="your-groq-api-key"
```

### Generate Secure Keys

```bash
# Generate SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
openssl rand -base64 32
```

---

## 🚀 Deployment Checklist

### Before Deployment

1. [ ] Set `SESSION_SECRET` in production environment
   ```bash
   # Generate and set securely via deployment platform
   SESSION_SECRET=<generated-secure-key>
   ```

2. [ ] Set Agora credentials
   ```bash
   AGORA_APP_ID=<from-agora-console>
   AGORA_APP_CERTIFICATE=<from-agora-console>
   ```

3. [ ] Configure Firebase Private Key (already in .env.local)
   - Ensure key is rotated regularly
   - Restrict key usage in Firebase Console

4. [ ] Verify security headers are working
   ```bash
   curl -I https://your-domain.com
   ```

### Production Hardening

1. [ ] Enable Firebase App Check
2. [ ] Configure Firebase Console API restrictions
3. [ ] Set up monitoring (Sentry, etc.)
4. [ ] Enable audit logging
5. [ ] Configure WAF rules (if using Cloudflare, etc.)
6. [ ] Set up alerting for suspicious activity

---

## 🔒 Security Headers Reference

| Header | Value | Purpose |
|--------|-------|---------|
| Strict-Transport-Security | max-age=63072000 | Force HTTPS |
| X-Frame-Options | SAMEORIGIN | Prevent clickjacking |
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| Content-Security-Policy | custom | XSS protection |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer info |
| X-XSS-Protection | 1; mode=block | Legacy browser XSS filter |

---

## ⚠️ Important Notes

### Session Cookie Settings

- `httpOnly: true` - Prevents JavaScript access
- `secure: true` - Only sent over HTTPS
- `sameSite: 'strict'` - CSRF protection
- `maxAge: 3600` - 1 hour session (shorter for better security)

### Role Hierarchy

```
super_admin (5) > admin (4) > hr (3) > spv (2) > employee (1)
```

### Rate Limit Response

When rate limited, API returns:
```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

With headers:
- `X-RateLimit-Remaining: 0`
- `X-RateLimit-Reset: 60`
- `Retry-After: 60`

---

## 📞 Security Contact

For security vulnerabilities, please report to:
- Internal: IT Security Team
- Email: security@aviarypark.co.id

---

## 📝 Changelog

### 2024-07-13
- Added AES-256-GCM encryption
- Implemented rate limiting
- Added password strength validation
- Created centralized role management
- Added comprehensive security headers
- Added input sanitization
