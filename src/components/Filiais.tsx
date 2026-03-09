/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Building2, Car, ChevronRight, Clock3, Droplets, CheckCircle2 } from 'lucide-react';
import { Screen, Service } from '../types';
import { BASES } from '../data/bases';
import { Appointment } from '../services/api';
import { normalizeDateKey } from '../utils/app';

export default function B2B({
  onNavigate,
  onSelectBase,
  services = [],
  appointments = [],
  currentDateKey,
}: {
  onNavigate: (screen: Screen) => void;
  onSelectBase?: (baseId: string) => void;
  services?: Service[];
  appointments?: Appointment[];
  currentDateKey: string;
}) {
  const bases = BASES;
  const baseSummaries = bases.map((base) => {
    const servicesToday = services.filter(
      (service) => service.baseId === base.id && normalizeDateKey(service.scheduledDate) === currentDateKey
    );
    const appointmentsToday = appointments.filter(
      (appointment) => appointment.baseId === base.id && normalizeDateKey(appointment.date) === currentDateKey
    );

    const waiting = servicesToday.filter((service) => service.status === 'pending').length;
    const washing = servicesToday.filter((service) => service.status === 'in_progress').length;
    const payment = servicesToday.filter((service) => service.status === 'waiting_payment').length;
    const completed = servicesToday.filter((service) => service.status === 'completed').length;
    const noShow = servicesToday.filter((service) => service.status === 'no_show').length;
    const scheduled = appointmentsToday.filter((appointment) => ['confirmed', 'pending'].includes(appointment.status)).length;
    const movement = servicesToday.length;

    return {
      ...base,
      waiting,
      washing,
      payment,
      completed,
      noShow,
      scheduled,
      movement,
    };
  });

  const totalMovementToday = baseSummaries.reduce((total, base) => total + base.movement, 0);
  const totalScheduledToday = baseSummaries.reduce((total, base) => total + base.scheduled, 0);

  return (
    <div className="flex flex-col min-h-full bg-white pb-24">
      <div className="grid grid-cols-2 gap-3 p-4 pb-2">
        <div className="metric-card bg-slate-50 border border-slate-100 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-primary text-[10px] font-bold uppercase tracking-wider">Bases Ativas</p>
            <Building2 className="text-primary w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-slate-900 leading-tight">{bases.length}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-slate-400 text-[10px] font-bold uppercase">Filiais em operacao</span>
          </div>
        </div>
        <div className="metric-card bg-slate-50 border border-slate-100 p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Operacao Hoje</p>
            <Car className="text-slate-500 w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-slate-900 leading-tight">{totalMovementToday}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-emerald-500 text-[10px] font-bold uppercase">{totalScheduledToday} agendados para hoje</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 flex items-center justify-between mt-2">
        <h2 className="text-xl font-black tracking-tight text-slate-900">Filiais</h2>
      </div>

      <div className="px-4 mt-4 space-y-3">
        {baseSummaries.map(base => (
          <div
            key={base.id}
            onClick={() => onSelectBase?.(base.id)}
            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-primary/30 transition-all cursor-pointer active:scale-[0.98] group"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    base.washing > 0
                      ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
                      : base.scheduled > 0 || base.waiting > 0
                        ? 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'
                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">{base.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">{base.responsible}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Movimento Hoje</p>
                  <p className="text-lg font-black text-slate-900">{base.movement}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors ml-2" />
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Resumo Real do Dia</span>
                <span className="text-xs font-black text-slate-900">{base.vehicles}/dia capacidade</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <MetricChip icon={<Clock3 className="w-3 h-3" />} label="Agendados" value={base.scheduled} tone="slate" />
                <MetricChip icon={<Clock3 className="w-3 h-3" />} label="Aguardando" value={base.waiting} tone="amber" />
                <MetricChip icon={<Droplets className="w-3 h-3" />} label="Em lavagem" value={base.washing} tone="blue" />
                <MetricChip icon={<CheckCircle2 className="w-3 h-3" />} label="Concluidos" value={base.completed + base.payment} tone="emerald" />
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-[10px] font-bold text-slate-500">Nao compareceram: {base.noShow}</span>
                <span className="text-[10px] font-bold text-slate-500">Base: {base.name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'slate' | 'amber' | 'blue' | 'emerald';
}) {
  const toneClass = {
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  }[tone];

  return (
    <div className={`rounded-xl px-3 py-2 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
          {icon}
          {label}
        </span>
        <span className="text-sm font-black">{value}</span>
      </div>
    </div>
  );
}
