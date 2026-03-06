export interface BaseInfo {
  id: string;
  name: string;
  responsible: string;
  vehicles: number;
  budget: string;
  spent: string;
  status: 'active' | 'warning' | 'critical';
}

export const BASES: BaseInfo[] = [
  { id: 'flores', name: 'Base Flores', responsible: 'Joao Silva', vehicles: 45, budget: '15.000', spent: '12.500', status: 'active' },
  { id: 'sao-jose', name: 'Base Sao Jose', responsible: 'Ana Costa', vehicles: 32, budget: '12.000', spent: '11.800', status: 'warning' },
  { id: 'cidade-nova', name: 'Base Cidade Nova', responsible: 'Pedro Santos', vehicles: 28, budget: '10.000', spent: '10.500', status: 'critical' },
  { id: 'ponta-negra', name: 'Base Ponta Negra', responsible: 'Marina Silva', vehicles: 50, budget: '20.000', spent: '15.000', status: 'active' },
  { id: 'taruma', name: 'Base Taruma', responsible: 'Carlos Eduardo', vehicles: 15, budget: '8.000', spent: '4.200', status: 'active' },
];

export const getBaseById = (id?: string | null) => BASES.find(base => base.id === id) || null;
