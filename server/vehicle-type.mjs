export function normalizeSourceVehicleType(rawType = '') {
  return String(rawType || '')
    .trim()
    .toUpperCase();
}

export function mapSourceVehicleTypeToCategory(rawType = '') {
  const normalizedType = normalizeSourceVehicleType(rawType);

  if (normalizedType.includes('MOTO')) {
    return 'motorcycle';
  }

  if (normalizedType.includes('CAMINHAO') || normalizedType.includes('CAMINHÃO')) {
    return 'truck';
  }

  if (
    normalizedType.includes('PICAPE MEDIA')
    || normalizedType.includes('CAMINHONETE')
    || normalizedType.includes('4X4')
  ) {
    return 'pickup_4x4';
  }

  if (normalizedType.includes('LANCHA') || normalizedType.includes('BARCO')) {
    return 'boat';
  }

  return 'car';
}
