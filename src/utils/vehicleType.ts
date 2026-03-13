import { VehicleType } from '../types';

export function normalizeSourceVehicleType(rawType?: string | null) {
  return String(rawType || '')
    .trim()
    .toUpperCase();
}

export function mapSourceVehicleTypeToCategory(rawType?: string | null): VehicleType {
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

export function getSourceVehicleTypeLabel(type: VehicleType) {
  switch (type) {
    case 'motorcycle':
      return 'MOTO';
    case 'truck':
      return 'CAMINHAO';
    case 'pickup_4x4':
      return 'PICAPE MEDIA';
    case 'boat':
      return 'LANCHA';
    default:
      return 'PASSEIO';
  }
}
