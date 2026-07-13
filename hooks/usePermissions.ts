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

    if (!user || !user.role) {
      setPermissions({});
      setLoading(false);
      return;
    }

    const normalizedRole = user.role.toLowerCase().replace(/\s+/g, '_');

    // Super admin always has access to everything
    if (normalizedRole === "super_admin") {
      setLoading(false);
      return; // We handle this in the `can` function
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
  const can = (featureId: string | string[]): boolean => {
    if (authLoading || loading) return false;

    const normalizedRole = user?.role?.toLowerCase().replace(/\s+/g, '_');

    // Super admin bypasses all checks
    if (normalizedRole === "super_admin") return true;

    // Only super admin can manage roles
    if (featureId === "manage_roles" && normalizedRole !== "super_admin") {
      return false;
    }

    const checkFeature = (f: string) => {
      // 1. Check User-Level Overrides First (Highest Priority)
      if (user?.customPermissions && typeof user.customPermissions[f] === "boolean") {
        return user.customPermissions[f];
      }
      // 2. Check Role-Level Default (Fallback)
      return !!permissions[f];
    };

    if (Array.isArray(featureId)) {
      // Return true if ANY of the required features are allowed (OR logic)
      return featureId.some(f => checkFeature(f));
    }

    return checkFeature(featureId);
  };

  return { can, permissions, loading: authLoading || loading };
}
