// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/components/ToastNotification";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AviaryParks System",
  description: "Attendance Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 antialiased">
        <AuthProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}