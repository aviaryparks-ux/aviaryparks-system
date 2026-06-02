// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const inter = Inter({
  variable: "--font-inter",
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
    <html lang="en" className={`${inter.variable} h-full`} style={{ colorScheme: 'light' }}>
      <body className="min-h-full bg-[#f8fafc] text-slate-800 antialiased font-sans">
        <AuthProvider>
          {children}
          {/* Toast Notification Provider */}
          <Toaster
            position="top-right"
            reverseOrder={false}
            gutter={8}
            toastOptions={{
              duration: 3000,
              style: {
                background: "#1a2a24",
                color: "#fff",
                borderRadius: "12px",
                padding: "12px 16px",
                fontSize: "14px",
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: "#10b981",
                  secondary: "#fff",
                },
                style: {
                  background: "#1a2a24",
                  border: "1px solid #10b981",
                },
              },
              error: {
                duration: 4000,
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#fff",
                },
                style: {
                  background: "#1a2a24",
                  border: "1px solid #ef4444",
                },
              },
              loading: {
                duration: Infinity,
                style: {
                  background: "#1a2a24",
                  border: "1px solid #f59e0b",
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}