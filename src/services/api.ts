import { Product, RoleAccessRule, Service, TeamMember, VehicleCategory, VehicleRegistration, VehicleType, WashingZoneId } from '../types';

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
  createdById?: string;
  createdByName?: string;
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
  token?: string;
  expiresAt: string;
}

export interface ClientSignupVehiclePayload {
  plate: string;
  model: string;
  type: VehicleType;
}

export interface ClientSignupPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  baseId: string;
  vehicles: ClientSignupVehiclePayload[];
}

export interface ClientSignupResponse extends LoginResponse {
  vehicles: VehicleRegistration[];
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface PasswordResetResponse {
  temporaryPassword: string;
  emailSent: boolean;
  emailStatus: string;
  emailConfigured: boolean;
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

export interface VehicleHistoryDateRange {
  startDate?: string;
  endDate?: string;
}

export interface WeatherForecastDay {
  dayOffset: number;
  condition: 'sun' | 'partly_cloudy' | 'cloudy' | 'rain';
  minC: number;
  maxC: number;
  rainMm: number;
  note: string;
}

export interface WeatherForecastResponse {
  days: WeatherForecastDay[];
  generatedAt: string;
}

export interface RealWeatherForecastDay {
  date: string;
  minC: number;
  maxC: number;
  rainMm: number;
  rainProbability: number;
  windKph: number;
  weatherCode: number;
}

export interface RealWeatherForecastCurrent {
  time: string;
  temperatureC: number;
  apparentC: number;
  humidity: number;
  precipitationProbability: number;
  precipitationMm: number;
  windKph: number;
  windDirectionDeg: number;
  weatherCode: number;
  isDay?: boolean;
}

export interface RealWeatherForecastHour {
  time: string;
  temperatureC: number;
  precipitationProbability: number;
  precipitationMm: number;
  windKph: number;
  weatherCode: number;
}

export interface RealWeatherForecastResponse {
  source: 'open-meteo';
  latitude: number;
  longitude: number;
  timezone: string;
  generatedAt: string;
  current: RealWeatherForecastCurrent | null;
  hours: RealWeatherForecastHour[];
  days: RealWeatherForecastDay[];
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
const AUTH_TOKEN_KEY = 'authToken';

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    return null;
  }
}

export function setStoredAuthToken(token: string) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (error) {}
}

export function clearStoredAuthToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
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

function buildDateRangeQuery(dateRange?: VehicleHistoryDateRange) {
  const startDate = String(dateRange?.startDate || '').trim();
  const endDate = String(dateRange?.endDate || '').trim();

  if (!startDate || !endDate) {
    return '';
  }

  const params = new URLSearchParams({
    startDate,
    endDate,
  });

  return `?${params.toString()}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');

  const token = getStoredAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let message = 'Falha na requisição.';

    if (response.status === 413) {
      message = 'As fotos enviadas ficaram muito grandes. Tente novamente com menos imagens ou imagens menores.';
    } else if (raw) {
      try {
        const data = JSON.parse(raw);
        message = data.error || data.message || message;
      } catch (error) {
        if (raw.includes('<html') || raw.includes('<!DOCTYPE') || raw.includes('<body')) {
          const titleMatch = raw.match(/<title>(.*?)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            const cleanTitle = titleMatch[1].replace(/^(https?:\/\/[^\s|]+|\b[\w-]+\.pages\.dev)\s*\|\s*/i, '').trim();
            message = `Servidor indisponível (${cleanTitle}). Tente novamente em instantes.`;
          } else {
            message = `Erro no servidor (${response.status}). Por favor, tente novamente em instantes.`;
          }
        } else {
          message = raw.trim() || message;
        }
      }
    }

    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/register-client' && path !== '/auth/forgot-password') {
      clearStoredAuthToken();
      dispatchUnauthorizedSession(message);
    }

    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    if (path === '/auth/logout') {
      clearStoredAuthToken();
    }
    return undefined as T;
  }

  const data = await response.json();
  if (data && typeof data === 'object' && typeof (data as any).token === 'string' && (data as any).token) {
    setStoredAuthToken((data as any).token);
  }

  return data as T;
}

export const api = {
  login: (identifier: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  logout: () =>
    request<void>('/auth/logout', {
      method: 'POST',
    }),
  registerClient: (payload: ClientSignupPayload) =>
    request<ClientSignupResponse>('/auth/register-client', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  forgotPassword: (email: string) =>
    request<ForgotPasswordResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
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
  getVehicleHistory: (dateRange?: VehicleHistoryDateRange) =>
    request<VehicleHistorySummary[]>(`/vehicle-history${buildDateRangeQuery(dateRange)}`),
  getVehicleHistoryDetail: (plate: string, dateRange?: VehicleHistoryDateRange) =>
    request<VehicleHistoryDetail>(`/vehicle-history/${encodeURIComponent(plate)}${buildDateRangeQuery(dateRange)}`),
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
  assistantWeatherForecast: (location?: string) =>
    request<WeatherForecastResponse>(`/assistant/weather-forecast${location ? `?location=${encodeURIComponent(location)}` : ''}`),
  realWeatherForecast: (options?: { lat?: number; lon?: number; days?: number; tz?: string }) => {
    const lat = typeof options?.lat === 'number' ? options.lat : undefined;
    const lon = typeof options?.lon === 'number' ? options.lon : undefined;
    const days = typeof options?.days === 'number' ? options.days : undefined;
    const tz = typeof options?.tz === 'string' ? options.tz : undefined;
    const query = new URLSearchParams();
    if (typeof lat === 'number') query.set('lat', String(lat));
    if (typeof lon === 'number') query.set('lon', String(lon));
    if (typeof days === 'number') query.set('days', String(days));
    if (typeof tz === 'string') query.set('tz', tz);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<RealWeatherForecastResponse>(`/weather/forecast${suffix}`);
  },
  upsertProduct: (product: Product) =>
    request<Product>('/products/upsert', { method: 'POST', body: JSON.stringify(product) }),
  deleteProduct: (id: string) =>
    request<void>(`/products/${id}`, { method: 'DELETE' }),
  upsertTeamMember: (member: TeamMember) =>
    request<TeamMember>('/team-members/upsert', { method: 'POST', body: JSON.stringify(member) }),
  resetTeamMemberPassword: (id: string, options?: { sendEmail?: boolean }) =>
    request<PasswordResetResponse>(`/team-members/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ sendEmail: Boolean(options?.sendEmail) }),
    }),
  deleteTeamMember: (id: string) =>
    request<void>(`/team-members/${id}`, { method: 'DELETE' }),
};
