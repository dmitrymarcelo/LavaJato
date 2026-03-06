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
  | 'scheduling'
  | 'team'
  | 'settings'
  | 'inventory';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'washer';
  avatar?: string;
}

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

export interface Service {
  id: string;
  plate: string;
  model: string;
  type: string;
  baseId?: string;
  baseName?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'waiting_payment';
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
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface TeamMember {
  id: string;
  name: string;
  registration: string;
  password: string;
  role: string;
  rating: number;
  servicesCount: number;
  status: 'active' | 'break' | 'offline';
  avatar: string;
  efficiency: string;
}

export const INITIAL_TEAM: TeamMember[] = [
  { 
    id: '1', 
    name: 'Lucas Ferreira', 
    registration: '1001',
    password: '123',
    role: 'Administrador', 
    rating: 4.9, 
    servicesCount: 142, 
    status: 'active', 
    avatar: 'https://i.pravatar.cc/150?u=lucas',
    efficiency: '98%'
  },
  { 
    id: '2', 
    name: 'Rafael Souza', 
    registration: '1002',
    password: '123',
    role: 'Lavador', 
    rating: 4.8, 
    servicesCount: 98, 
    status: 'active', 
    avatar: 'https://i.pravatar.cc/150?u=rafael',
    efficiency: '95%'
  },
  { 
    id: '3', 
    name: 'Bruno Lima', 
    registration: '1003',
    password: '123',
    role: 'Lavador', 
    rating: 4.7, 
    servicesCount: 215, 
    status: 'break', 
    avatar: 'https://i.pravatar.cc/150?u=bruno',
    efficiency: '92%'
  },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', title: 'Novo Agendamento', message: 'João Silva agendou uma Lavagem Completa para hoje às 14h.', time: '5 min atrás', read: false, type: 'info' },
  { id: '2', title: 'Pagamento Confirmado', message: 'Recebimento de R$ 120,00 referente ao serviço #482.', time: '1 hora atrás', read: false, type: 'success' },
  { id: '3', title: 'Estoque Baixo', message: 'O produto "Cera de Carnaúba" está com estoque crítico.', time: '3 horas atrás', read: true, type: 'warning' },
];

export interface ServiceTypeOption {
  id: string;
  label: string;
  price: number;
}

export interface VehicleCategory {
  label: string;
  services: ServiceTypeOption[];
}

export type VehicleType = 'car' | 'motorcycle' | 'truck' | 'boat';

export interface VehicleRegistration {
  plate: string;
  customer: string;
  model: string;
  type: VehicleType;
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
    ]
  },
  motorcycle: {
    label: 'Moto',
    services: [
      { id: 'simple', label: 'Lavagem Simples', price: 30 },
      { id: 'complete', label: 'Lavagem Completa', price: 50 },
    ]
  },
  truck: {
    label: 'Caminhão',
    services: [
      { id: 'simple', label: 'Lavagem Simples', price: 180 },
      { id: 'complete', label: 'Lavagem Completa', price: 250 },
    ]
  },
  boat: {
    label: 'Lancha',
    services: [
      { id: 'simple', label: 'Lavagem', price: 200 },
    ]
  }
};

export const SERVICES: Service[] = [
  {
    id: '1',
    plate: 'ABC-1234',
    model: 'Sedan Prata',
    type: 'Lavagem Externa',
    status: 'in_progress',
    price: 45,
    customer: 'Marcos Silva',
    washer: 'Lucas Oliveira',
    startTime: '2024-03-01T14:30:00',
    image: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: '2',
    plate: 'XYZ-9876',
    model: 'SUV Luxo Preto',
    type: 'Interna Completa',
    status: 'completed',
    price: 120,
    customer: 'Rafael Mendes',
    washer: 'Rafael Costa',
    startTime: '2024-03-01T13:00:00',
    endTime: '2024-03-01T14:15:00',
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: '3',
    plate: 'LUV-2024',
    model: 'Esportivo Vermelho',
    type: 'Cera Premium',
    status: 'waiting_payment',
    price: 85,
    customer: 'Bruno Alencar',
    washer: 'Bruno Santos',
    startTime: '2024-03-01T15:00:00',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: '4',
    plate: 'NEW-2026',
    model: 'SUV Familiar Branco',
    type: 'Lavagem Completa',
    status: 'pending',
    price: 65,
    customer: 'Daniela Souza',
    image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=400&auto=format&fit=crop'
  },
  {
    id: '5',
    plate: 'GHI-5566',
    model: 'Hatch Azul',
    type: 'Ducha Rápida',
    status: 'pending',
    price: 35,
    customer: 'Carlos Ferreira',
    image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=400&auto=format&fit=crop'
  }
];
