// app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Removed parallax for split screen

  const login = async () => {
    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email.trim(), password.trim());
      const idToken = await res.user.getIdToken();

      const apiRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      if (!apiRes.ok) {
        throw new Error("Gagal menginisialisasi sesi aman di server");
      }

      const data = await apiRes.json();
      
      const userDoc = await getDoc(doc(db, "users", res.user.uid));
      const userData = userDoc.exists() ? userDoc.data() : { name: "User" };
      
      toast.success(`Welcome back, ${userData.name}!`);
      router.push(data.redirectUrl);

    } catch (e: any) {
      let errorMessage = "";
      switch (e.code) {
        case "auth/invalid-email":
          errorMessage = "Invalid email format";
          break;
        case "auth/user-disabled":
          errorMessage = "Account has been disabled";
          break;
        case "auth/user-not-found":
          errorMessage = "Email not registered";
          break;
        case "auth/wrong-password":
          errorMessage = "Wrong password";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many attempts. Try again later";
          break;
        default:
          errorMessage = e.message;
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast.error("Email is required");
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success("Password reset email sent! Check your inbox.");
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetEmail("");
      }, 3000);
    } catch (error: any) {
      let errorMessage = "";
      switch (error.code) {
        case "auth/user-not-found":
          errorMessage = "Email not registered";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email format";
          break;
        default:
          errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setResetLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      login();
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white font-sans overflow-hidden">
      
      {/* ==================== LEFT SIDE: IMAGE & LOGO ==================== */}
      <div className="w-full md:w-1/2 relative min-h-[40vh] md:min-h-screen flex flex-col items-center justify-center p-8">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/login-bg.webp')" }}
        />
        {/* Gradient Overlay to make logo text readable if needed */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
        
        <div className="relative z-10 flex flex-col items-center text-center mt-[-20px]">
          {/* Logo */}
          <div className="mb-4">
            <Image
              src="/images/myaviary-logo.png"
              alt="MyAviary Logo"
              width={400}
              height={400}
              className="w-56 sm:w-72 h-auto drop-shadow-2xl"
            />
          </div>
          
          <p className="text-white/90 text-base mt-2 font-medium drop-shadow-md bg-black/20 px-4 py-1.5 rounded-full backdrop-blur-sm">Empowering People, Growing Together</p>
        </div>
      </div>

      {/* ==================== RIGHT SIDE: LOGIN FORM ==================== */}
      <div className="w-full md:w-1/2 p-8 sm:p-14 lg:p-24 bg-white relative flex flex-col justify-center min-h-[60vh] md:min-h-screen">
        
        {/* Decorative small leaves corner (Top Right) */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-20 pointer-events-none hidden sm:block">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M100 0C100 0 80 10 70 30C60 50 70 80 70 80C70 80 90 70 100 50V0Z" fill="#2E7D32"/>
            <path d="M100 40C100 40 85 45 80 60C75 75 85 95 85 95C85 95 100 85 100 70V40Z" fill="#4CAF50"/>
          </svg>
        </div>

        <div className="max-w-[420px] w-full mx-auto relative z-10">
          {!showForgotPassword ? (
            <>
              <h2 className="text-4xl font-bold text-gray-800 flex items-center gap-2 mb-3">
                Welcome Back! <span className="text-green-600">🌿</span>
              </h2>
              <p className="text-gray-500 text-base mb-10">Sign in to your account to continue</p>

              <form onSubmit={(e) => { e.preventDefault(); login(); }} className="space-y-6">
                
                {/* Email Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full pl-11 pr-4 py-4 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      placeholder="Enter your email address"
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="w-full pl-11 pr-12 py-4 rounded-xl border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      placeholder="Enter your password"
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between mt-4">
                  <label className="flex items-center cursor-pointer">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="w-5 h-5 bg-white border-2 border-gray-300 rounded peer-checked:bg-green-600 peer-checked:border-green-600 transition-colors flex items-center justify-center">
                        <svg className={`w-3.5 h-3.5 text-white ${rememberMe ? 'opacity-100' : 'opacity-0'} transition-opacity`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <span className="ml-2 text-sm text-gray-600">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm font-semibold text-green-600 hover:text-green-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 mt-6 rounded-xl text-white font-semibold text-lg flex items-center justify-center gap-2 transition-all ${
                    loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#2E7D32] hover:bg-[#1B5E20] shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Sign In →
                    </>
                  )}
                </button>

              </form>
            </>
          ) : (
            // ==================== FORGOT PASSWORD FORM ====================
            <div className="animate-fade-down">
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail("");
                }}
                className="mb-6 text-sm font-semibold text-green-600 hover:text-green-700 flex items-center gap-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Login
              </button>

              <h2 className="text-3xl font-bold text-gray-800 mb-2">Reset Password</h2>
              <p className="text-gray-500 text-sm mb-8">
                Enter your email and we'll send you a link to reset your password.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                      placeholder="Enter your email address"
                      disabled={resetLoading}
                      required
                    />
                  </div>
                </div>

                <button
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className={`w-full py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2 transition-all ${
                    resetLoading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-[#2E7D32] hover:bg-[#1B5E20] shadow-md hover:shadow-lg"
                  }`}
                >
                  {resetLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Reset Link
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Bottom Security Info Box */}
          <div className="mt-10 bg-green-50/50 rounded-xl p-4 border border-green-100 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-green-700 mb-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs font-semibold">Secure access for authorized personnel only</span>
            </div>
            <p className="text-[11px] text-gray-500">AviaryParks System</p>
          </div>
          
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 left-0 right-0 text-center z-10 pointer-events-none hidden sm:block">
          <p className="text-gray-400 text-xs sm:text-sm font-medium">
            © {new Date().getFullYear()} Aviary Park Indonesia. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}