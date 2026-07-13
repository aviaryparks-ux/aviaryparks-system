import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

// Security headers configuration
const securityHeaders = [
  {
    // Prevents the browser from performing DNS prefetching beyond the explicit href
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    // Forces the browser to only connect to the site over HTTPS
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Prevents the site from being displayed in an iframe (clickjacking protection)
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    // Prevents the browser from MIME type sniffing
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Controls how much referrer information is sent with requests
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Content Security Policy - helps prevent XSS attacks
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://api.groq.com wss://*.firebaseio.com",
      "frame-src 'self' https://*.firebaseapp.com",
      "media-src 'self' https://*.firebasestorage.googleapis.com blob:",
      "worker-src 'self' blob:",
    ].join("; "),
  },
  {
    // X-XSS-Protection header (for older browsers)
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    // Permissions Policy - controls which browser features can be used
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Allow LAN testing for Next.js dev server
  allowedDevOrigins: ["10.90.103.160", "localhost"],

  // Security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes except static files
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
    ],
  },

  // Disable detailed error pages in production to prevent information disclosure
  reactStrictMode: true,

  // Compiler options for security
  compiler: {
    // Remove console.log in production (optional, uncomment if needed)
    // removeConsole: process.env.NODE_ENV === "production",
  },
};

export default withPWA(nextConfig);
