export function getClientCustomerLabel(user) {
  return String(user?.name || user?.email || 'Cliente').trim() || 'Cliente';
}

export function normalizeClientCustomerKey(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isClientScopedRole(user) {
  return String(user?.role || '').trim() === 'Clientes';
}

export function rowBelongsToClientUser(user, row) {
  if (!isClientScopedRole(user)) {
    return true;
  }

  return normalizeClientCustomerKey(row?.customer) === normalizeClientCustomerKey(getClientCustomerLabel(user));
}

export function rowIsVisibleToUser(user, row, baseFilter = null) {
  const baseAllowed = !baseFilter || baseFilter.includes(row?.base_id);
  return baseAllowed && rowBelongsToClientUser(user, row);
}

export function clientVehicleBelongsToUser(user, vehicleRow) {
  if (!isClientScopedRole(user)) {
    return true;
  }

  return rowBelongsToClientUser(user, vehicleRow);
}
