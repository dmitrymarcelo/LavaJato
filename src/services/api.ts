import { Product, Service, TeamMember, VehicleCategory, VehicleRegistration, VehicleType } from '../types';

const AUTH_TOKEN_KEY = 'authToken';

export interface Appointment {
  id: string;
  customer: string;
  vehicle: string;
  plate: string;
  vehicleType?: VehicleType;
  service: string;
  date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';
  photo?: string;
  thirdPartyName?: string;
  thirdPartyCpf?: string;
}

export interface BootstrapPayload {
  serviceTypes: Record<VehicleType, VehicleCategory>;
  vehicleDb: VehicleRegistration[];
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
    authTokenCache = window.localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    authTokenCache = null;
  }

  return authTokenCache;
}

function storeAuthToken(token: string | null) {
  authTokenCache = token;

  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
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
    const data = await response.json().catch(() => ({ error: 'Falha na requisicao.' }));
    throw new ApiError(response.status, data.error || 'Falha na requisicao.');
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
  login: (registration: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ registration, password }),
    }),
  logout: () =>
    request<void>('/auth/logout', {
      method: 'POST',
    }),
  bootstrap: () => request<BootstrapPayload>('/bootstrap'),
  saveServiceTypes: (serviceTypes: Record<VehicleType, VehicleCategory>) =>
    request('/service-types', { method: 'PUT', body: JSON.stringify(serviceTypes) }),
  saveVehicles: (vehicles: VehicleRegistration[]) =>
    request('/vehicles', { method: 'PUT', body: JSON.stringify(vehicles) }),
  upsertVehicle: (vehicle: VehicleRegistration) =>
    request<VehicleRegistration>('/vehicles/upsert', { method: 'POST', body: JSON.stringify(vehicle) }),
  deleteVehicle: (plate: string) =>
    request<void>(`/vehicles/${encodeURIComponent(plate)}`, { method: 'DELETE' }),
  saveServices: (services: Service[]) =>
    request('/services', { method: 'PUT', body: JSON.stringify(services) }),
  upsertService: (service: Service) =>
    request<Service>('/services/upsert', { method: 'POST', body: JSON.stringify(service) }),
  bookScheduling: (payload: SchedulingBookingPayload) =>
    request<SchedulingBookingPayload>('/scheduling/book', { method: 'POST', body: JSON.stringify(payload) }),
  deleteService: (id: string) =>
    request<void>(`/services/${id}`, { method: 'DELETE' }),
  saveAppointments: (appointments: Appointment[]) =>
    request('/appointments', { method: 'PUT', body: JSON.stringify(appointments) }),
  upsertAppointment: (appointment: Appointment) =>
    request<Appointment>('/appointments/upsert', { method: 'POST', body: JSON.stringify(appointment) }),
  deleteAppointment: (id: string) =>
    request<void>(`/appointments/${id}`, { method: 'DELETE' }),
  assistantTips: (query: string) =>
    request<{ text: string }>('/assistant/tips', { method: 'POST', body: JSON.stringify({ query }) }),
  assistantWeather: (location?: string) =>
    request<{ text: string }>(`/assistant/weather${location ? `?location=${encodeURIComponent(location)}` : ''}`),
  saveProducts: (products: Product[]) =>
    request('/products', { method: 'PUT', body: JSON.stringify(products) }),
  upsertProduct: (product: Product) =>
    request<Product>('/products/upsert', { method: 'POST', body: JSON.stringify(product) }),
  deleteProduct: (id: string) =>
    request<void>(`/products/${id}`, { method: 'DELETE' }),
  saveTeam: (team: TeamMember[]) =>
    request('/team-members', { method: 'PUT', body: JSON.stringify(team) }),
  upsertTeamMember: (member: TeamMember) =>
    request<TeamMember>('/team-members/upsert', { method: 'POST', body: JSON.stringify(member) }),
  deleteTeamMember: (id: string) =>
    request<void>(`/team-members/${id}`, { method: 'DELETE' }),
};
