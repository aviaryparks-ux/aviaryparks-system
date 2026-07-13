// lib/roles.ts
// Centralized role definitions for the application
// All role checks should use these constants to ensure consistency

/**
 * Role hierarchy (higher number = more privileges)
 */
export const RoleHierarchy = {
  employee: 1,
  spv: 2,
  manager: 3,
  hr: 4,
  admin: 5,
  super_admin: 6,
} as const;

/**
 * All roles in the system
 */
export const ALL_ROLES = Object.keys(RoleHierarchy) as RoleLevel[];

/**
 * Type for valid role levels
 */
export type RoleLevel = keyof typeof RoleHierarchy;

/**
 * Roles that have admin panel access (dashboard, settings, etc.)
 * These roles can access /dashboard, /users, /settings, etc.
 */
export const ADMIN_ROLES: RoleLevel[] = ['super_admin', 'admin', 'hr', 'manager', 'spv'];

/**
 * Roles that can manage users (create, update, delete)
 * These roles can access /api/users endpoint
 */
export const USER_MANAGER_ROLES: RoleLevel[] = ['super_admin', 'admin', 'hr', 'manager'];

/**
 * Roles that have full system access
 */
export const SUPER_ADMIN_ROLES: RoleLevel[] = ['super_admin'];

/**
 * Check if a role has admin panel access
 */
export function hasAdminAccess(role: string): boolean {
  const normalizedRole = normalizeRole(role);
  return ADMIN_ROLES.includes(normalizedRole);
}

/**
 * Check if a role can manage users
 */
export function canManageUsers(role: string): boolean {
  const normalizedRole = normalizeRole(role);
  return USER_MANAGER_ROLES.includes(normalizedRole);
}

/**
 * Check if a role has super admin access
 */
export function isSuperAdmin(role: string): boolean {
  const normalizedRole = normalizeRole(role);
  return SUPER_ADMIN_ROLES.includes(normalizedRole);
}

/**
 * Get the hierarchy level of a role
 * Returns 0 for unknown roles
 */
export function getRoleLevel(role: string): number {
  const normalizedRole = normalizeRole(role);
  return RoleHierarchy[normalizedRole] || 0;
}

/**
 * Check if role A has equal or higher privilege than role B
 */
export function hasEqualOrHigherPrivilege(roleA: string, roleB: string): boolean {
  return getRoleLevel(roleA) >= getRoleLevel(roleB);
}

/**
 * Normalize role string (handle case variations and spaces)
 */
export function normalizeRole(role: string): RoleLevel {
  if (!role) return 'employee';
  
  const lowerRole = role.toLowerCase();
  
  if (lowerRole.includes('super admin') || lowerRole.includes('super_admin')) return 'super_admin';
  if (lowerRole.includes('admin')) return 'admin';
  if (lowerRole.includes('hr')) return 'hr';
  if (lowerRole.includes('manager')) return 'manager';
  if (lowerRole.includes('spv') || lowerRole.includes('supervisor')) return 'spv';
  
  const normalized = lowerRole.replace(/\s+/g, '_');
  if (normalized in RoleHierarchy) {
    return normalized as RoleLevel;
  }
  return 'employee'; // Default fallback
}

/**
 * Get display name for a role
 */
export function getRoleDisplayName(role: string): string {
  const roleDisplayNames: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Administrator',
    hr: 'Human Resources',
    manager: 'Manager',
    spv: 'Supervisor',
    employee: 'Employee',
  };
  return roleDisplayNames[normalizeRole(role)] || role;
}

/**
 * Validate if a role is valid in the system
 */
export function isValidRole(role: string): boolean {
  return normalizeRole(role) in RoleHierarchy;
}
