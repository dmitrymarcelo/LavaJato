/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Building2, DollarSign, Car, ChevronRight } from 'lucide-react';
import { Screen } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function B2B({ onNavigate, onSelectBase }: { onNavigate: (screen: Screen) => void, onSelectBase?: (baseId: string) => void }) {
  const bases = [
    { id: 'flores', name: 'Base Flores', responsible: 'João Silva', vehicles: 45, budget: '15.000', spent: '12.500', status: 'active' },
    { id: 'sao-jose', name: 'Base São José', responsible: 'Ana Costa', vehicles: 32, budget: '12.000', spent: '11.800', status: 'warning' },
    { id: 'cidade-nova', name: 'Base Cidade Nova', responsible: 'Pedro Santos', vehicles: 28, budget: '10.000', spent: '10.500', status: 'critical' },
    { id: 'ponta-negra', name: 'Base Ponta Negra', responsible: 'Marina Silva', vehicles: 50, budget: '20.000', spent: '15.000', status: 'active' },
    { id: 'taruma', name: 'Base Tarumã', responsible: 'Carlos Eduardo', vehicles: 15, budget: '8.000', spent: '4.200', status: 'active' },
  ];

  return (
    <div className="flex flex-col min-h-full bg-white pb-24">
      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 p-4 pb-2">
        <div className="metric-card bg-slate-50 border border-slate-100 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-primary text-[10px] font-bold uppercase tracking-wider">Bases Ativas</p>
            <Building2 className="text-primary w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-slate-900 leading-tight">5</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase">Filiais em operação</span>
          </div>
        </div>
        <div className="metric-card bg-slate-50 border border-slate-100 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Atendimentos (Mês)</p>
            <Car className="text-slate-500 w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-slate-900 leading-tight">842</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-emerald-500 text-[10px] font-bold uppercase">+12% vs mês anterior</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 flex items-center justify-between mt-2">
        <h2 className="text-xl font-black tracking-tight text-slate-900">Filiais</h2>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {bases.map((base) => (
          <div 
            key={base.id}
            onClick={() => onSelectBase && onSelectBase(base.id)}
            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-primary/30 transition-all cursor-pointer active:scale-[0.98] group"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  base.status === 'active' ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' :
                  base.status === 'warning' ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-100' :
                  'bg-rose-50 text-rose-600 group-hover:bg-rose-100'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">{base.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">{base.responsible}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Capacidade</p>
                  <p className="text-lg font-black text-slate-900">{base.vehicles}/dia</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors ml-2" />
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Meta Mensal</span>
                <span className="text-xs font-black text-slate-900">R$ {base.budget}</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    base.status === 'active' ? 'bg-emerald-500' :
                    base.status === 'warning' ? 'bg-amber-500' :
                    'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min((Number(base.spent.replace('.', '')) / Number(base.budget.replace('.', ''))) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] font-bold text-slate-500">Realizado: R$ {base.spent}</span>
                <span className={`text-[10px] font-bold ${
                  base.status === 'critical' ? 'text-rose-500' : 'text-slate-500'
                }`}>
                  {base.status === 'critical' ? 'Abaixo da meta' : `${Math.round((Number(base.spent.replace('.', '')) / Number(base.budget.replace('.', ''))) * 100)}% concluído`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
