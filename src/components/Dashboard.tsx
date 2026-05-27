/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  Droplets,
  Gauge,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Screen, Service, TeamMember } from '../types';
import { addDays, getElapsedMinutes, getTodayDate } from '../utils/app';
import { getLifetimeWashSummary } from '../utils/dashboardMetrics.js';
import { BASES } from '../data/bases';
import { Appointment } from '../services/api';
import { getSafeAvatarImage, getSafeServiceImage } from '../lib/placeholders';

type DashboardTimeframe = 'today' | 'week' | 'month' | 'all' | 'custom';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('pt-BR');

const getServiceDateKey = (service: Service) =>
  service.scheduledDate || service.endTime?.slice(0, 10) || service.startTime?.slice(0, 10) || null;

const isWithinRange = (dateKey: string | null, start: string, end: string) => !!dateKey && dateKey >= start && dateKey <= end;

const getDateSpanDays = (start: string, end: string) => {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const diffMs = endDate.getTime() - startDate.getTime();
  return Number.isFinite(diffMs) ? Math.max(1, Math.round(diffMs / 86_400_000) + 1) : 1;
};

const formatGrowth = (current: number, previous: number) => {
  if (previous <= 0) {
    return current > 0 ? 'Novo periodo' : '0%';
  }

  const delta = ((current - previous) / previous) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`;
};

const formatAverageMinutes = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '0 min';
  }

  return `${minutes.toFixed(1)} min`;
};

export default function Dashboard({
  onNavigate,
  services,
  appointments = [],
  currentDateKey,
  team = [],
  canManageSettings = false,
}: {
  onNavigate: (screen: Screen, serviceId?: string) => void;
  services: Service[];
  appointments?: Appointment[];
  currentDateKey: string;
  team?: TeamMember[];
  canManageSettings?: boolean;
}) {
  const todayKey = currentDateKey || getTodayDate();
  const [timeframe, setTimeframe] = useState<DashboardTimeframe>('today');
  const [customStartKey, setCustomStartKey] = useState(addDays(todayKey, -6));
  const [customEndKey, setCustomEndKey] = useState(todayKey);
  const fixedWindowDays = timeframe === 'today' ? 1 : timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : null;
  const normalizedCustomStartKey = customStartKey <= customEndKey ? customStartKey : customEndKey;
  const normalizedCustomEndKey = customStartKey <= customEndKey ? customEndKey : customStartKey;
  const windowDays = timeframe === 'custom'
    ? getDateSpanDays(normalizedCustomStartKey, normalizedCustomEndKey)
    : fixedWindowDays;
  const currentStartKey = timeframe === 'custom'
    ? normalizedCustomStartKey
    : windowDays
      ? addDays(todayKey, -(windowDays - 1))
      : null;
  const currentEndKey = timeframe === 'custom' ? normalizedCustomEndKey : todayKey;
  const previousStartKey = windowDays && currentStartKey ? addDays(currentStartKey, -windowDays) : null;
  const previousEndKey = windowDays && currentStartKey ? addDays(currentStartKey, -1) : null;

  const servicesInCurrentWindow = windowDays && currentStartKey
    ? services.filter(service => isWithinRange(getServiceDateKey(service), currentStartKey, currentEndKey))
    : services.filter((service) => {
      const dateKey = getServiceDateKey(service);
      return !dateKey || dateKey <= todayKey;
    });
  const appointmentsInCurrentWindow = windowDays && currentStartKey
    ? appointments.filter(appointment => isWithinRange(appointment.date, currentStartKey, currentEndKey))
    : appointments.filter((appointment) => !appointment.date || appointment.date <= todayKey);
  const servicesInPreviousWindow = windowDays && previousStartKey && previousEndKey
    ? services.filter(service => isWithinRange(getServiceDateKey(service), previousStartKey, previousEndKey))
    : [];

  const currentRevenue = servicesInCurrentWindow
    .filter(service => service.status === 'waiting_payment' || service.status === 'completed')
    .reduce((total, service) => total + service.price, 0);

  const previousRevenue = servicesInPreviousWindow
    .filter(service => service.status === 'waiting_payment' || service.status === 'completed')
    .reduce((total, service) => total + service.price, 0);

  const completedDurations = servicesInCurrentWindow
    .filter(service => service.startTime && service.endTime)
    .map(service => getElapsedMinutes(service.startTime, new Date(service.endTime!).getTime()));

  const averageMinutes = completedDurations.length
    ? completedDurations.reduce((total, value) => total + value, 0) / completedDurations.length
    : 0;

  const pendingPayments = services.filter(service => service.status === 'waiting_payment').length;
  const lifetimeWashSummary = getLifetimeWashSummary(services);
  const selectedWashSummary = timeframe === 'all' ? lifetimeWashSummary : getLifetimeWashSummary(servicesInCurrentWindow);
  const growthLabel = timeframe === 'all' ? 'Total geral' : formatGrowth(currentRevenue, previousRevenue);
  const demandByBase = [...BASES, { id: 'sem-base', name: 'Sem base', responsible: '', vehicles: 0, budget: '0', spent: '0', status: 'warning' as const }]
    .map(base => ({
      id: base.id,
      name: base.name,
      value: services.filter(service => service.status === 'in_progress' && (service.baseId || 'sem-base') === base.id).length,
    }))
    .filter(base => base.id !== 'sem-base' || base.value > 0);
  const maxDemandValue = Math.max(1, ...demandByBase.map(item => item.value));
  const baseSummaries = BASES.map((base) => {
    const servicesForBase = servicesInCurrentWindow.filter((service) => service.baseId === base.id);
    const appointmentsForBase = appointmentsInCurrentWindow.filter((appointment) => appointment.baseId === base.id);

    return {
      id: base.id,
      name: base.name,
      scheduled: appointmentsForBase.filter((appointment) => ['confirmed', 'pending'].includes(appointment.status)).length,
      waiting: servicesForBase.filter((service) => service.status === 'pending').length,
      washing: servicesForBase.filter((service) => service.status === 'in_progress').length,
      completed: servicesForBase.filter((service) => ['waiting_payment', 'completed'].includes(service.status)).length,
      noShow: servicesForBase.filter((service) => service.status === 'no_show').length,
    };
  });

  const teamByName = new Map(
    team.map((member) => [member.name.trim().toLowerCase(), member])
  );
  const topWashers = [...services]
    .filter((service) => {
      const washDateKey =
        service.timeline?.washStartedAt?.slice(0, 10)
        || service.startTime?.slice(0, 10)
        || null;
      if (timeframe === 'all') {
        return Boolean(washDateKey);
      }

      return currentStartKey ? isWithinRange(washDateKey, currentStartKey, currentEndKey) : washDateKey === todayKey;
    })
    .flatMap((service) => {
      const washerNames = service.washers?.length
        ? service.washers
        : service.washer
          ? [service.washer]
          : [];

      return washerNames.map((washerName) => washerName.trim()).filter(Boolean);
    })
    .reduce((accumulator, washerName) => {
      const current = accumulator.get(washerName) || 0;
      accumulator.set(washerName, current + 1);
      return accumulator;
    }, new Map<string, number>());

  const topWashersList = Array.from(topWashers.entries())
    .map(([washerName, washes]) => {
      const member = teamByName.get(washerName.toLowerCase());
      return {
        id: member?.id || washerName,
        name: member?.name || washerName,
        efficiency: member?.efficiency || '0%',
        washes,
        imageUrl: getSafeAvatarImage(member?.avatar, member?.name || washerName),
      };
    })
    .sort((left, right) => right.washes - left.washes)
    .slice(0, 3);

  const recentServices = [...servicesInCurrentWindow]
    .sort((left, right) => {
      const leftKey = `${left.endTime || left.startTime || `${left.scheduledDate || ''}T${left.scheduledTime || '00:00'}`}`;
      const rightKey = `${right.endTime || right.startTime || `${right.scheduledDate || ''}T${right.scheduledTime || '00:00'}`}`;
      return rightKey.localeCompare(leftKey);
    })
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 pb-8 bg-white transition-colors">
      <div className="px-4 pt-4">
        <div className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-5">
          <button
            onClick={() => setTimeframe('today')}
            className={`flex-1 h-full rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-all ${timeframe === 'today' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
          >
            Hoje
          </button>
          <button
            onClick={() => setTimeframe('week')}
            className={`flex-1 h-full rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-all ${timeframe === 'week' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
          >
            Semana
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`flex-1 h-full rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-all ${timeframe === 'month' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
          >
            Mes
          </button>
          <button
            onClick={() => setTimeframe('all')}
            className={`flex-1 h-full rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-all ${timeframe === 'all' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
          >
            Total geral
          </button>
          <button
            onClick={() => setTimeframe('custom')}
            className={`flex-1 h-10 rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-all ${timeframe === 'custom' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
          >
            Periodo livre
          </button>
        </div>
        {timeframe === 'custom' && (
          <div className="mt-3 grid gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data inicial</span>
              <input
                type="date"
                value={customStartKey}
                onChange={(event) => setCustomStartKey(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-primary"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data final</span>
              <input
                type="date"
                value={customEndKey}
                onChange={(event) => setCustomEndKey(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-primary"
              />
            </label>
            <div className="rounded-xl bg-primary/5 px-3 py-2 text-xs font-black uppercase tracking-widest text-primary">
              {windowDays} dia{windowDays === 1 ? '' : 's'}
            </div>
          </div>
        )}
      </div>

      <div className="px-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard
            icon={<DollarSign className="text-primary w-3.5 h-3.5" />}
            label="Faturamento"
            value={currencyFormatter.format(currentRevenue)}
            secondary={growthLabel}
            secondaryClassName="text-emerald-500"
          />
          <MetricCard
            icon={<Car className="text-slate-500 w-3.5 h-3.5" />}
            label="Volume"
            value={`${servicesInCurrentWindow.length} veiculos`}
            secondary={timeframe === 'all' ? 'Total ate hoje' : 'Periodo selecionado'}
            interactive
            onClick={() => onNavigate('scheduling')}
          />
          <MetricCard
            icon={<CheckCircle2 className="text-emerald-500 w-3.5 h-3.5" />}
            label={timeframe === 'all' ? 'Lavados ate hoje' : 'Lavados no periodo'}
            value={integerFormatter.format(selectedWashSummary.totalWashed)}
            secondary={`${integerFormatter.format(selectedWashSummary.uniqueVehicles)} placas unicas`}
            secondaryClassName="text-emerald-500"
            interactive
            onClick={() => onNavigate('vehicle-history')}
          />
          <MetricCard
            icon={<Gauge className="text-primary w-3.5 h-3.5" />}
            label="Tempo medio"
            value={formatAverageMinutes(averageMinutes)}
            secondary={completedDurations.length ? `${completedDurations.length} servicos medidos` : 'Sem base no periodo'}
          />
          <MetricCard
            icon={<Clock className="text-amber-500 w-3.5 h-3.5" />}
            label="Pendentes"
            value={pendingPayments.toString().padStart(2, '0')}
            secondary={`${integerFormatter.format(lifetimeWashSummary.pendingPayment)} no historico`}
            interactive
            onClick={() => onNavigate('scheduling')}
          />
        </div>
      </div>

      <div className="px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">Picos de Demanda</h3>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <BarChart3 className="w-4 h-4" />
              Em lavagem por base
            </div>
          </div>
          <div className="space-y-4">
            {demandByBase.map(base => (
              <div key={base.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700">{base.name}</span>
                  <span className="text-xs font-black text-slate-900">{base.value} em lavagem</span>
                </div>
                <DemandBar width={`${Math.max(10, (base.value / maxDemandValue) * 100)}%`} active={base.value === maxDemandValue && base.value > 0} />
              </div>
            ))}
          </div>
          {demandByBase.every(base => base.value === 0) && (
            <p className="mt-4 text-xs text-slate-400 font-medium">Nenhum veiculo em lavagem por base neste momento.</p>
          )}
        </section>

        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">{timeframe === 'today' ? 'Bases Hoje' : 'Bases no periodo'}</h3>
            <Target className="w-5 h-5 text-slate-300" />
          </div>
          <div className="space-y-4">
            {baseSummaries.map((base) => (
              <div key={base.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-black text-slate-900">{base.name}</h4>
                  <button
                    onClick={() => onNavigate('scheduling')}
                    className="text-[10px] font-black uppercase tracking-widest text-primary active:scale-95 transition-transform"
                  >
                    Agenda
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <BaseMetricChip icon={<Clock className="w-3 h-3" />} label="Agendados" value={base.scheduled} tone="slate" />
                  <BaseMetricChip icon={<Clock className="w-3 h-3" />} label="Aguardando" value={base.waiting} tone="amber" />
                  <BaseMetricChip icon={<Droplets className="w-3 h-3" />} label="Em lavagem" value={base.washing} tone="blue" />
                  <BaseMetricChip icon={<CheckCircle2 className="w-3 h-3" />} label="Concluidos" value={base.completed} tone="emerald" />
                </div>
                <p className="mt-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Nao compareceram: {base.noShow}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="px-4">
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">Top lavadores</h3>
            {canManageSettings && (
              <button
                onClick={() => onNavigate('settings')}
                className="text-primary text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
              >
                Equipe
              </button>
            )}
          </div>
          <div className="space-y-3">
            {topWashersList.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">
                Nenhum lavador com producao registrada {timeframe === 'today' ? 'hoje' : 'no periodo'}.
              </p>
            ) : (
              topWashersList.map((member, index) => (
                <div key={member.id}>
                  <WasherRank
                    rank={`${index + 1}o`}
                    name={member.name}
                    efficiency={member.efficiency}
                    washes={member.washes}
                    imageUrl={member.imageUrl}
                  />
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="px-4">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">Servicos recentes</h3>
            <button
              onClick={() => onNavigate('queue')}
              className="text-primary text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
            >
              Ver tudo
            </button>
          </div>
          {recentServices.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400 font-medium">Nenhum servico registrado ate o momento.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentServices.map(service => (
                <div
                  key={service.id}
                  onClick={() => onNavigate('history', service.id)}
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200">
                      {service.image ? (
                        <img className="w-full h-full object-cover" src={getSafeServiceImage(service.image, service.plate || service.model)} alt={service.model} />
                      ) : (
                        <Car className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 leading-tight">{service.model} - {service.plate}</p>
                      <p className="text-xs text-slate-500 font-bold mt-0.5 uppercase tracking-tight">{service.type}</p>
                    </div>
                  </div>
                  <StatusBadge status={service.status} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  secondary,
  secondaryClassName,
  interactive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  secondary: string;
  secondaryClassName?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex flex-col justify-between min-h-[98px] ${interactive ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider truncate">{label}</span>
      </div>
      <span className="text-slate-900 text-xl font-black block">{value}</span>
      <span className={`${secondaryClassName || 'text-slate-400'} text-[10px] font-bold mt-1 uppercase flex items-center gap-1 truncate`}>
        {secondaryClassName === 'text-emerald-500' && <TrendingUp className="w-3 h-3" />}
        {secondary}
      </span>
    </div>
  );
}

function DemandBar({ width, active }: { width: string; active?: boolean }) {
  return (
    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
      <div className={`${active ? 'bg-primary' : 'bg-primary/40'} h-full rounded-full transition-all duration-500`} style={{ width }} />
    </div>
  );
}

function BaseMetricChip({
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

function WasherRank({
  rank,
  name,
  efficiency,
  washes,
  imageUrl,
}: {
  rank: string;
  name: string;
  efficiency: string;
  washes: number;
  imageUrl: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-black text-xs shrink-0">{rank}</div>
      <img className="w-10 h-10 rounded-full object-cover shrink-0" src={imageUrl} alt={name} />
      <div className="flex-1 min-w-0">
        <p className="font-black text-slate-900 text-sm truncate">{name}</p>
        <p className="text-[9px] font-bold uppercase text-slate-400">Eficiencia {efficiency}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-black text-primary text-base tracking-tighter">{washes}</p>
        <p className="text-[8px] uppercase text-slate-400 font-bold">Lavagens</p>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: Service['status'] }) {
  const configs = {
    pending: { label: 'Pendente', classes: 'bg-amber-100 text-amber-700' },
    in_progress: { label: 'Em curso', classes: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Pago', classes: 'bg-green-100 text-green-700' },
    waiting_payment: { label: 'Aguardando', classes: 'bg-amber-100 text-amber-700' },
    no_show: { label: 'Nao compareceu', classes: 'bg-rose-100 text-rose-700' },
  };

  const config = configs[status];
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${config.classes}`}>
      {config.label}
    </span>
  );
}
