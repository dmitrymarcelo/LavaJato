/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Screen =
  | 'login'
  | 'dashboard'
  | 'checkin'
  | 'queue'
  | 'washing'
  | 'inspection-pre'
  | 'inspection-post'
  | 'payment'
  | 'analytics'
  | 'history'
  | 'customer-history'
  | 'vehicle-history'
  | 'vehicle-history-detail'
  | 'scheduling'
  | 'team'
  | 'settings'
  | 'inventory';

export interface Product {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  price: number;
  lastRestock: string;
  status: 'ok' | 'low' | 'critical';
  image?: string;
  manualEntries?: ProductMovement[];
  manualOutputs?: ProductMovement[];
}

export interface ProductMovement {
  id: string;
  quantity: number;
  note?: string;
  createdAt: string;
}

export interface ServiceTimeline {
  createdAt?: string;
  checkInAt?: string;
  preInspectionStartedAt?: string;
  preInspectionCompletedAt?: string;
  washStartedAt?: string;
  washCompletedAt?: string;
  postInspectionStartedAt?: string;
  postInspectionCompletedAt?: string;
  paymentStartedAt?: string;
  paymentCompletedAt?: string;
  completedAt?: string;
  noShowAt?: string;
}

export interface Service {
  id: string;
  sortOrder?: number;
  plate: string;
  model: string;
  type: string;
  baseId?: string;
  baseName?: string;
  washingZoneId?: WashingZoneId;
  washingZoneName?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'waiting_payment' | 'no_show';
  price: number;
  priority?: boolean;
  customer: string;
  thirdPartyName?: string;
  thirdPartyCpf?: string;
  observations?: string;
  washer?: string;
  washers?: string[];
  startTime?: string;
  endTime?: string;
  image?: string;
  timeline?: ServiceTimeline;
  preInspectionPhotos?: Record<string, string>;
  postInspectionPhotos?: Record<string, string>;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface RoleAccessRule {
  role: string;
  permissions: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  registration: string;
  email?: string;
  password?: string;
  passwordHash?: string;
  role: string;
  permissions?: string[];
  allowedBaseIds?: string[];
  rating: number;
  servicesCount: number;
  status: 'active' | 'break' | 'offline';
  avatar: string;
  efficiency: string;
}

export interface ServiceTypeOption {
  id: string;
  label: string;
  price: number;
}

export interface VehicleCategory {
  label: string;
  services: ServiceTypeOption[];
}

export type VehicleType = 'car' | 'motorcycle' | 'truck' | 'boat' | 'pickup_4x4';
export type WashingZoneId = 'dique_leve' | 'dique_pesada' | 'estacionamento';

export interface VehicleRegistration {
  plate: string;
  customer: string;
  model: string;
  type: VehicleType;
  sourceVehicleType?: string;
  city?: string;
  state?: string;
  lastService?: string;
  thirdPartyName?: string;
  thirdPartyCpf?: string;
}

export const INITIAL_SERVICE_TYPES: Record<VehicleType, VehicleCategory> = {
  car: {
    label: 'Carro',
    services: [
      { id: 'simple', label: 'Lavagem Simples', price: 70 },
      { id: 'complete', label: 'Lavagem Completa / Motor', price: 90 },
    ],
  },
  motorcycle: {
    label: 'Moto',
    services: [
      { id: 'simple', label: 'Lavagem Simples', price: 30 },
      { id: 'complete', label: 'Lavagem Completa', price: 50 },
    ],
  },
  truck: {
    label: 'Caminhao',
    services: [
      { id: 'simple', label: 'Lavagem Simples', price: 180 },
      { id: 'complete', label: 'Lavagem Completa', price: 250 },
    ],
  },
  pickup_4x4: {
    label: 'Picape Media',
    services: [
      { id: 'simple', label: 'Lavagem Simples', price: 95 },
      { id: 'complete', label: 'Lavagem Completa', price: 130 },
    ],
  },
  boat: {
    label: 'Lancha',
    services: [{ id: 'simple', label: 'Lavagem', price: 200 }],
  },
};
