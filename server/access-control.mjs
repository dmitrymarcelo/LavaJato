export const APP_PERMISSION_IDS = [
  'view_scheduling',
  'manage_scheduling',
  'operate_wash',
  'manage_payments',
  'view_analytics',
  'manage_vehicle_base',
  'manage_inventory',
  'manage_team',
  'edit_services',
  'delete_services',
  'bypass_inspection',
  'manage_access',
  'manage_b2b',
];

const APP_PERMISSION_SET = new Set(APP_PERMISSION_IDS);
const NEW_ACCESS_MODEL_PERMISSION_SET = new Set([
  'view_scheduling',
  'manage_scheduling',
  'operate_wash',
  'manage_payments',
  'manage_vehicle_base',
]);

export const ADMIN_ROLES = new Set(['Administrador']);

export function normalizePermissionList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter((item) => APP_PERMISSION_SET.has(item))
    )
  );
}

export function buildDefaultAccessRules() {
  return [
    {
      role: 'Colaboradores',
      permissions: [
        'view_scheduling',
        'manage_scheduling',
        'manage_payments',
        'view_analytics',
        'manage_vehicle_base',
      ],
    },
    { role: 'Administrador', permissions: [...APP_PERMISSION_IDS] },
    { role: 'Lavador', permissions: ['view_scheduling', 'operate_wash'] },
    { role: 'Clientes', permissions: ['manage_b2b'] },
  ];
}

export function normalizeAccessRules(value) {
  const providedRules = Array.isArray(value)
    ? value
        .map((rule) => ({
          role: String(rule?.role || '').trim(),
          permissions: normalizePermissionList(rule?.permissions),
        }))
        .filter((rule) => rule.role)
    : [];

  const rulesByRole = new Map(providedRules.map((rule) => [rule.role, rule.permissions]));
  const usesNewAccessModel = providedRules.some((rule) =>
    rule.role === 'Colaboradores'
    || rule.permissions.some((permission) => NEW_ACCESS_MODEL_PERMISSION_SET.has(permission))
  );

  const normalizedDefaults = buildDefaultAccessRules().map((rule) => {
    if (ADMIN_ROLES.has(rule.role)) {
      return { role: rule.role, permissions: [...APP_PERMISSION_IDS] };
    }

    if (rule.role === 'Clientes') {
      return { role: rule.role, permissions: ['manage_b2b'] };
    }

    if (rule.role === 'Lavador' && !usesNewAccessModel && rulesByRole.has(rule.role)) {
      return { role: rule.role, permissions: normalizePermissionList(rule.permissions) };
    }

    const overridePermissions = rulesByRole.has(rule.role)
      ? rulesByRole.get(rule.role)
      : rule.permissions;

    return {
      role: rule.role,
      permissions: normalizePermissionList(overridePermissions),
    };
  });

  const extraRules = providedRules
    .filter((rule) => !normalizedDefaults.some((item) => item.role === rule.role))
    .map((rule) => ({
      role: rule.role,
      permissions: normalizePermissionList(rule.permissions),
    }));

  return [...normalizedDefaults, ...extraRules];
}

export function getPermissionsForRole(role, accessRules = []) {
  const normalizedRole = String(role || '').trim();
  if (!normalizedRole) {
    return [];
  }

  if (ADMIN_ROLES.has(normalizedRole)) {
    return [...APP_PERMISSION_IDS];
  }

  if (normalizedRole === 'Clientes') {
    return ['manage_b2b'];
  }

  const matchingRule = (accessRules || []).find((rule) => String(rule?.role || '').trim() === normalizedRole);
  return normalizePermissionList(matchingRule?.permissions || []);
}
