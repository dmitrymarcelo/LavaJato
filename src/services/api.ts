import { Product, Service, TeamMember, VehicleCategory, VehicleRegistration, VehicleType } from '../types';

export interface Appointment {
  id: string;
  customer: string;
  vehicle: string;
  plate: string;
  service: string;
  date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
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

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Falha na requisicao.' }));
    throw new Error(data.error || 'Falha na requisicao.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  login: (registration: string, password: string) =>
    request<{ user: TeamMember }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ registration, password }),
    }),
  bootstrap: () => request<BootstrapPayload>('/bootstrap'),
  saveServiceTypes: (serviceTypes: Record<VehicleType, VehicleCategory>) =>
    request('/service-types', { method: 'PUT', body: JSON.stringify(serviceTypes) }),
  saveVehicles: (vehicles: VehicleRegistration[]) =>
    request('/vehicles', { method: 'PUT', body: JSON.stringify(vehicles) }),
  saveServices: (services: Service[]) =>
    request('/services', { method: 'PUT', body: JSON.stringify(services) }),
  saveAppointments: (appointments: Appointment[]) =>
    request('/appointments', { method: 'PUT', body: JSON.stringify(appointments) }),
  saveProducts: (products: Product[]) =>
    request('/products', { method: 'PUT', body: JSON.stringify(products) }),
  saveTeam: (team: TeamMember[]) =>
    request('/team-members', { method: 'PUT', body: JSON.stringify(team) }),
};
