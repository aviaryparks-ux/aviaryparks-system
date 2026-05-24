// components/ProtectedRoute.tsx
"use client";

import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[]; // Legacy / Backup
  requiredFeature?: string; // New RBAC
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  allowedRoles = [],
  requiredFeature,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { user, loading: authLoading, hasPermission } = useAuth();
  const { can, loading: permLoading } = usePermissions();
  const router = useRouter();

  const loading = authLoading || permLoading;

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push(redirectTo);
        return;
      }
      
      let isAllowed = true;
      
      // 1. Check legacy allowedRoles if provided
      if (allowedRoles.length > 0 && !hasPermission(allowedRoles)) {
        isAllowed = false;
      }

      // 2. Check RBAC requiredFeature if provided
      if (requiredFeature && !can(requiredFeature)) {
        isAllowed = false;
      }

      if (!isAllowed) {
        router.push("/dashboard");
      }
    }
  }, [user, loading, router, allowedRoles, requiredFeature, hasPermission, can, redirectTo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  
  if (allowedRoles.length > 0 && !hasPermission(allowedRoles)) return null;
  if (requiredFeature && !can(requiredFeature)) return null;

  return <>{children}</>;
}