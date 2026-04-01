import type { RoleAccessRule, TeamMember } from '../types';

export const APP_PERMISSION_IDS = [
  'view_analytics',
  'manage_team',
  'edit_services',
  'delete_services',
  'bypass_inspection',
  'manage_b2b',
  'manage_inventory',
  'manage_access',
] as const;

export type AppPermissionId = typeof APP_PERMISSION_IDS[number];

const APP_PERMISSION_SET = new Set<string>(APP_PERMISSION_IDS);

const normalizePermissionId = (value: string) => String(value || '').trim();

export function normalizePermissions(value: unknown): AppPermissionId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const permissions = value
    .map((item) => normalizePermissionId(String(item || '')))
    .filter((item): item is AppPermissionId => APP_PERMISSION_SET.has(item));

  return Array.from(new Set(permissions));
}

export function getPermissionsForRole(role: string, accessRules: RoleAccessRule[] = []): AppPermissionId[] {
  const normalizedRole = String(role || '').trim();
  if (!normalizedRole) {
    return [];
  }

  if (normalizedRole === 'Administrador') {
    return [...APP_PERMISSION_IDS];
  }

  const matchingRule = (accessRules || []).find((rule) => String(rule?.role || '').trim() === normalizedRole);
  return normalizePermissions(matchingRule?.permissions || []);
}

export function getUserPermissions(user?: TeamMember | null, accessRules: RoleAccessRule[] = []): AppPermissionId[] {
  if (!user) {
    return [];
  }

  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return normalizePermissions(user.permissions);
  }

  return getPermissionsForRole(user.role, accessRules);
}

export function userHasPermission(
  user: TeamMember | null | undefined,
  accessRules: RoleAccessRule[] = [],
  permission: AppPermissionId
) {
  if (!user) {
    return false;
  }

  return getUserPermissions(user, accessRules).includes(permission);
}
