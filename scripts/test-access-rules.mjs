import assert from 'node:assert/strict';
import {
  APP_PERMISSION_IDS,
  buildDefaultAccessRules,
  getPermissionsForRole,
  normalizeAccessRules,
} from '../server/access-control.mjs';

const defaults = buildDefaultAccessRules();
assert.deepEqual(defaults.map((rule) => rule.role), ['Colaboradores', 'Administrador', 'Lavador', 'Clientes']);

assert.deepEqual(getPermissionsForRole('Administrador', defaults), APP_PERMISSION_IDS);
assert.deepEqual(getPermissionsForRole('Clientes', defaults), ['manage_b2b']);
assert.deepEqual(getPermissionsForRole('Lavador', defaults), ['view_scheduling', 'operate_wash']);

const normalized = normalizeAccessRules([
  { role: 'Administrador', permissions: [] },
  { role: 'Colaboradores', permissions: ['view_analytics', 'manage_inventory', 'unknown_permission'] },
  { role: 'Clientes', permissions: ['view_analytics', 'manage_access'] },
]);

const admin = normalized.find((rule) => rule.role === 'Administrador');
const collaborators = normalized.find((rule) => rule.role === 'Colaboradores');
const clients = normalized.find((rule) => rule.role === 'Clientes');

assert.deepEqual(admin.permissions, APP_PERMISSION_IDS);
assert.deepEqual(collaborators.permissions, ['view_analytics', 'manage_inventory']);
assert.deepEqual(clients.permissions, ['manage_b2b']);

const migratedLegacyRules = normalizeAccessRules([
  { role: 'Administrador', permissions: ['view_analytics', 'manage_team', 'edit_services', 'delete_services', 'bypass_inspection', 'manage_b2b', 'manage_inventory', 'manage_access'] },
  { role: 'Lavador', permissions: [] },
  { role: 'Clientes', permissions: ['manage_b2b'] },
]);

assert.deepEqual(
  migratedLegacyRules.find((rule) => rule.role === 'Lavador')?.permissions,
  ['view_scheduling', 'operate_wash']
);

console.log('access rules tests passed');
