// hooks/usePermissions.ts
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export function usePermissions() {
  const { user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    // Super admin always has access to everything
    if (user?.role === "super_admin") {
      setLoading(false);
      return; // We handle this in the `can` function
    }

    if (!user || !user.role) {
      setPermissions({});
      setLoading(false);
      return;
    }

    // Subscribe to the role's permissions
    const unsubscribe = onSnapshot(
      doc(db, "role_permissions", user.role),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPermissions(data.features || {});
        } else {
          setPermissions({});
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching permissions:", error);
        setPermissions({});
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  // The main authorization function
  const can = (featureId: string): boolean => {
    if (authLoading || loading) return false;
    
    // Super admin bypasses all checks
    if (user?.role === "super_admin") return true;

    // 1. Check User-Level Overrides First (Highest Priority)
    // We assume user.customPermissions is a Record<string, boolean>
    if (user?.customPermissions && typeof user.customPermissions[featureId] === "boolean") {
      return user.customPermissions[featureId];
    }

    // 2. Check Role-Level Default (Fallback)
    return !!permissions[featureId];
  };

  return { can, permissions, loading: authLoading || loading };
}
