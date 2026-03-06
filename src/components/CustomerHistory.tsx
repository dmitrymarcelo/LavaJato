/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronLeft, Calendar, Clock, DollarSign, CheckCircle2, Car } from 'lucide-react';
import { Screen } from '../types';
import { motion } from 'motion/react';

const MOCK_HISTORY = [
  { id: 'h1', date: '15/02/2024', model: 'Sedan Prata', type: 'Lavagem Completa', price: 'R$ 85,00', status: 'Concluído' },
  { id: 'h2', date: '02/02/2024', model: 'Sedan Prata', type: 'Lavagem Simples', price: 'R$ 50,00', status: 'Concluído' },
  { id: 'h3', date: '18/01/2024', model: 'Sedan Prata', type: 'Lavagem Detalhada', price: 'R$ 220,00', status: 'Concluído' },
  { id: 'h4', date: '05/01/2024', model: 'Sedan Prata', type: 'Lavagem Simples', price: 'R$ 50,00', status: 'Concluído' },
];

export default function CustomerHistory({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="flex flex-col min-h-full bg-white">
      <main className="p-4 space-y-6">
        {/* Customer Profile Summary */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Car className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">Marcos Oliveira</h2>
            <p className="text-sm text-slate-500">Cliente desde Jan 2024 • 12 Serviços</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Últimos Serviços</h3>
          
          {MOCK_HISTORY.map((item, index) => (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onNavigate('history')}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3 cursor-pointer active:scale-[0.98] active:bg-slate-50 transition-all"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-slate-700">{item.date}</span>
                </div>
                <div className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 uppercase">
                  <CheckCircle2 className="w-3 h-3" />
                  {item.status}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-base font-black text-slate-900">{item.type}</p>
                  <p className="text-xs text-slate-500">{item.model}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-primary">{item.price}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
