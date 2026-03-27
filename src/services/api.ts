import { Product, RoleAccessRule, Service, TeamMember, VehicleCategory, VehicleRegistration, VehicleType, WashingZoneId } from '../types';

const AUTH_TOKEN_KEY = 'authToken';
export const UNAUTHORIZED_SESSION_EVENT = 'app:unauthorized-session';

export interface Appointment {
  id: string;
  customer: string;
  vehicle: string;
  plate: string;
  baseId?: string;
  baseName?: string;
  washingZoneId?: WashingZoneId;
  washingZoneName?: string;
  vehicleType?: VehicleType;
  service: string;
  date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'in_progress' | 'waiting_payment' | 'cancelled' | 'completed' | 'no_show';
  photo?: string;
  thirdPartyName?: string;
  thirdPartyCpf?: string;
}

export interface BootstrapPayload {
  currentUser: TeamMember;
  serviceTypes: Record<VehicleType, VehicleCategory>;
  accessRules: RoleAccessRule[];
  services: Service[];
  appointments: Appointment[];
  products: Product[];
  team: TeamMember[];
}

export interface LoginResponse {
  user: TeamMember;
  token: string;
  expiresAt: string;
}

export interface SchedulingBookingPayload {
  appointment: Appointment;
  service: Service;
}

export interface PaymentCompletionPayload {
  service: Service;
  appointment: Appointment | null;
}

export interface ServiceStageTransitionPayload {
  service: Service;
  appointment: Appointment | null;
}

export interface StartWashPayload {
  washers: string[];
  observations?: string;
  preInspectionPhotos?: Record<string, string>;
}

export interface CompleteWashPayload {
  postInspectionPhotos?: Record<string, string>;
}

export type InspectionPhotoStage = 'pre' | 'post';

export interface SchedulingDeletionPayload {
  deletedAppointmentIds: string[];
  deletedServiceIds: string[];
}

export interface VehicleHistorySummary {
  plate: string;
  customer: string;
  model: string;
  type?: VehicleType;
  previewImage?: string | null;
  recordCount: number;
  completedCount: number;
  noShowCount: number;
  activeCount: number;
  totalRevenue: number;
  averageTicket?: number | null;
  lastRecordedAt?: string | null;
  lastBaseName?: string | null;
  lastServiceType?: string | null;
  lastStatus?: Service['status'] | null;
  lastPrice?: number | null;
  lastWashers?: string[];
  averageWashMinutes?: number | null;
  lastWaitingMinutes?: number | null;
  lastWashMinutes?: number | null;
  lastPaymentMinutes?: number | null;
  lastTotalMinutes?: number | null;
}

export interface VehicleHistoryDetail extends VehicleHistorySummary {
  records: Service[];
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

let authTokenCache: string | null = null;

function readStoredAuthToken() {
  if (authTokenCache) {
    return authTokenCache;
  }

  try {
    authTokenCache = window.sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    authTokenCache = null;
  }

  return authTokenCache;
}

function storeAuthToken(token: string | null) {
  authTokenCache = token;

  try {
    if (token) {
      window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (error) {}
}

function dispatchUnauthorizedSession(message: string) {
  try {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_SESSION_EVENT, {
      detail: {
        message,
      },
    }));
  } catch (error) {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readStoredAuthToken();
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let message = 'Falha na requisicao.';

    if (response.status === 413) {
      message = 'As fotos enviadas ficaram muito grandes. Tente novamente com menos imagens ou imagens menores.';
    } else if (raw) {
      try {
        const data = JSON.parse(raw);
        message = data.error || message;
      } catch (error) {
        message = raw.trim() || message;
      }
    }

    if (response.status === 401 && path !== '/auth/login') {
      storeAuthToken(null);
      dispatchUnauthorizedSession(message);
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  getAuthToken: () => readStoredAuthToken(),
  setAuthToken: (token: string | null) => storeAuthToken(token),
  clearAuthToken: () => storeAuthToken(null),
  login: (identifier: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  logout: () =>
    request<void>('/auth/logout', {
      method: 'POST',
    }),
  bootstrap: () => request<BootstrapPayload>('/bootstrap'),
  getVehicles: () =>
    request<VehicleRegistration[]>('/vehicles'),
  findVehicleByPlate: (plate: string) =>
    request<VehicleRegistration>(`/vehicles/lookup?plate=${encodeURIComponent(plate)}`),
  saveServiceTypes: (serviceTypes: Record<VehicleType, VehicleCategory>) =>
    request('/service-types', { method: 'PUT', body: JSON.stringify(serviceTypes) }),
  saveAccessRules: (rules: RoleAccessRule[]) =>
    request<RoleAccessRule[]>('/access-rules', { method: 'PUT', body: JSON.stringify(rules) }),
  upsertVehicle: (vehicle: VehicleRegistration) =>
    request<VehicleRegistration>('/vehicles/upsert', { method: 'POST', body: JSON.stringify(vehicle) }),
  bulkUpsertVehicles: (vehicles: VehicleRegistration[]) =>
    request<VehicleRegistration[]>('/vehicles/bulk-upsert', { method: 'POST', body: JSON.stringify({ vehicles }) }),
  deleteVehicle: (plate: string) =>
    request<void>(`/vehicles/${encodeURIComponent(plate)}`, { method: 'DELETE' }),
  getService: (id: string) =>
    request<Service>(`/services/${encodeURIComponent(id)}`),
  getVehicleHistory: () =>
    request<VehicleHistorySummary[]>('/vehicle-history'),
  getVehicleHistoryDetail: (plate: string) =>
    request<VehicleHistoryDetail>(`/vehicle-history/${encodeURIComponent(plate)}`),
  upsertService: (service: Service) =>
    request<Service>('/services/upsert', { method: 'POST', body: JSON.stringify(service) }),
  startWash: (serviceId: string, payload: StartWashPayload) =>
    request<ServiceStageTransitionPayload>(`/services/${encodeURIComponent(serviceId)}/start-wash`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  completeWash: (serviceId: string, payload: CompleteWashPayload) =>
    request<ServiceStageTransitionPayload>(`/services/${encodeURIComponent(serviceId)}/complete-wash`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  saveInspectionPhoto: (serviceId: string, stage: InspectionPhotoStage, photoId: string, imageData: string) =>
    request<Service>(`/services/${encodeURIComponent(serviceId)}/inspection-photo`, {
      method: 'POST',
      body: JSON.stringify({ stage, photoId, imageData }),
    }),
  completePayment: (serviceId: string) =>
    request<PaymentCompletionPayload>(`/services/${encodeURIComponent(serviceId)}/complete-payment`, { method: 'POST' }),
  bookScheduling: (payload: SchedulingBookingPayload) =>
    request<SchedulingBookingPayload>('/scheduling/book', { method: 'POST', body: JSON.stringify(payload) }),
  deleteSchedulingRecord: (id: string) =>
    request<SchedulingDeletionPayload>(`/scheduling/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  deleteService: (id: string) =>
    request<void>(`/services/${id}`, { method: 'DELETE' }),
  upsertAppointment: (appointment: Appointment) =>
    request<Appointment>('/appointments/upsert', { method: 'POST', body: JSON.stringify(appointment) }),
  deleteAppointment: (id: string) =>
    request<void>(`/appointments/${id}`, { method: 'DELETE' }),
  assistantTips: (query: string) =>
    request<{ text: string }>('/assistant/tips', { method: 'POST', body: JSON.stringify({ query }) }),
  assistantWeather: (location?: string) =>
    request<{ text: string }>(`/assistant/weather${location ? `?location=${encodeURIComponent(location)}` : ''}`),
  upsertProduct: (product: Product) =>
    request<Product>('/products/upsert', { method: 'POST', body: JSON.stringify(product) }),
  deleteProduct: (id: string) =>
    request<void>(`/products/${id}`, { method: 'DELETE' }),
  upsertTeamMember: (member: TeamMember) =>
    request<TeamMember>('/team-members/upsert', { method: 'POST', body: JSON.stringify(member) }),
  deleteTeamMember: (id: string) =>
    request<void>(`/team-members/${id}`, { method: 'DELETE' }),
};
