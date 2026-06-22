/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  Droplets,
  FileText,
  Gauge,
  Printer,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { Screen, Service, TeamMember } from '../types';
import { addDays, getElapsedMinutes, getTodayDate } from '../utils/app';
import { getLifetimeWashSummary } from '../utils/dashboardMetrics.js';
import { BASES } from '../data/bases';
import { Appointment } from '../services/api';
import { getSafeAvatarImage, getSafeServiceImage } from '../lib/placeholders';
import { interpolateMetricValue } from '../utils/uiMotion.js';
import ModalSurface from './ModalSurface';

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

const formatPercent = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%';
  }

  return `${value.toFixed(0)}%`;
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
  const [isReportOpen, setIsReportOpen] = useState(false);
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
  const periodLabel = timeframe === 'today'
    ? `Hoje (${todayKey})`
    : timeframe === 'week'
      ? `Semana ate ${todayKey}`
      : timeframe === 'month'
        ? `Mes ate ${todayKey}`
        : timeframe === 'custom'
          ? `${normalizedCustomStartKey} ate ${normalizedCustomEndKey}`
          : `Total geral ate ${todayKey}`;
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
      total: servicesForBase.length + appointmentsForBase.filter((appointment) => ['confirmed', 'pending'].includes(appointment.status)).length,
    };
  });

  const scheduledActiveCount = appointmentsInCurrentWindow.filter((appointment) => ['confirmed', 'pending'].includes(appointment.status)).length;
  const pendingServiceCount = servicesInCurrentWindow.filter((service) => service.status === 'pending').length;
  const washingServiceCount = servicesInCurrentWindow.filter((service) => service.status === 'in_progress').length;
  const waitingPaymentCount = servicesInCurrentWindow.filter((service) => service.status === 'waiting_payment').length;
  const noShowCount = servicesInCurrentWindow.filter((service) => service.status === 'no_show').length;
  const averageTicket = selectedWashSummary.totalWashed > 0 ? currentRevenue / selectedWashSummary.totalWashed : 0;
  const conversionRate = selectedWashSummary.totalWashed + noShowCount > 0
    ? (selectedWashSummary.totalWashed / (selectedWashSummary.totalWashed + noShowCount)) * 100
    : 0;
  const activeWorkloadCount = scheduledActiveCount + pendingServiceCount + washingServiceCount + waitingPaymentCount;
  const busiestBase = [...baseSummaries].sort((left, right) => right.total - left.total)[0];
  const bestBase = [...baseSummaries].sort((left, right) => right.completed - left.completed)[0];
  const executiveCards = [
    {
      label: 'Ticket medio',
      value: currencyFormatter.format(averageTicket),
      note: `${integerFormatter.format(selectedWashSummary.totalWashed)} lavagens`,
      icon: <DollarSign className="h-4 w-4 text-emerald-600" />,
    },
    {
      label: 'Conclusao',
      value: formatPercent(conversionRate),
      note: `${integerFormatter.format(noShowCount)} nao compareceram`,
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    },
    {
      label: 'Fluxo ativo',
      value: integerFormatter.format(activeWorkloadCount),
      note: 'agenda, fila e pagamento',
      icon: <Activity className="h-4 w-4 text-primary" />,
    },
    {
      label: 'Base destaque',
      value: bestBase?.name || 'Sem base',
      note: `${integerFormatter.format(bestBase?.completed || 0)} concluidos`,
      icon: <Target className="h-4 w-4 text-amber-600" />,
    },
  ];

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
    <div className="dashboard-motion-scope flex flex-col gap-6 pb-8 bg-white transition-colors">
      <div className="px-4 pt-4">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Periodo analisado</p>
            <p className="text-sm font-bold text-slate-600">{periodLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsReportOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-black uppercase tracking-widest text-slate-950 shadow-sm shadow-amber-500/20 transition-all hover:bg-amber-600 active:scale-95"
          >
            <FileText className="h-4 w-4" />
            Relatorio completo
          </button>
        </div>
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
        <div className="stagger-grid grid grid-cols-2 md:grid-cols-5 gap-3">
          <MetricCard
            motionIndex={0}
            icon={<DollarSign className="text-primary w-3.5 h-3.5" />}
            label="Faturamento"
            value={currentRevenue}
            formatValue={(nextValue) => currencyFormatter.format(nextValue)}
            secondary={growthLabel}
            secondaryClassName="text-emerald-500"
          />
          <MetricCard
            motionIndex={1}
            icon={<Car className="text-slate-500 w-3.5 h-3.5" />}
            label="Volume"
            value={servicesInCurrentWindow.length}
            formatValue={(nextValue) => `${integerFormatter.format(nextValue)} veiculos`}
            secondary={timeframe === 'all' ? 'Total ate hoje' : 'Periodo selecionado'}
            interactive
            onClick={() => onNavigate('scheduling')}
          />
          <MetricCard
            motionIndex={2}
            icon={<CheckCircle2 className="text-emerald-500 w-3.5 h-3.5" />}
            label={timeframe === 'all' ? 'Lavados ate hoje' : 'Lavados no periodo'}
            value={selectedWashSummary.totalWashed}
            formatValue={(nextValue) => integerFormatter.format(nextValue)}
            secondary={`${integerFormatter.format(selectedWashSummary.uniqueVehicles)} placas unicas`}
            secondaryClassName="text-emerald-500"
            interactive
            onClick={() => onNavigate('vehicle-history')}
          />
          <MetricCard
            motionIndex={3}
            icon={<Gauge className="text-primary w-3.5 h-3.5" />}
            label="Tempo medio"
            value={averageMinutes}
            formatValue={formatAverageMinutes}
            precision={1}
            secondary={completedDurations.length ? `${completedDurations.length} servicos medidos` : 'Sem base no periodo'}
          />
          <MetricCard
            motionIndex={4}
            icon={<Clock className="text-amber-500 w-3.5 h-3.5" />}
            label="Pendentes"
            value={pendingPayments}
            formatValue={(nextValue) => nextValue.toString().padStart(2, '0')}
            secondary={`${integerFormatter.format(lifetimeWashSummary.pendingPayment)} no historico`}
            interactive
            onClick={() => onNavigate('scheduling')}
          />
        </div>
      </div>

      <div className="px-4 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(520px,1.35fr)]">
        <div className="space-y-6">
          <section className="interactive-surface bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
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
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-slate-900 font-black text-lg tracking-tight">Resumo gerencial</h3>
              <CalendarDays className="h-5 w-5 text-slate-300" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {executiveCards.map((card) => (
                <div key={card.label}>
                  <ExecutiveCard
                    icon={card.icon}
                    label={card.label}
                    value={card.value}
                    note={card.note}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maior movimento</p>
                  <p className="truncate text-sm font-black text-slate-900">{busiestBase?.name || 'Sem base'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-primary">{integerFormatter.format(busiestBase?.total || 0)}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">eventos</p>
                </div>
              </div>
            </div>
          </section>

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

        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">{timeframe === 'today' ? 'Bases Hoje' : 'Bases no periodo'}</h3>
            <Target className="w-5 h-5 text-slate-300" />
          </div>
          <div className="space-y-4">
            {baseSummaries.map((base) => (
              <div key={base.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{base.name}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{base.total} eventos no periodo</p>
                  </div>
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

      {isReportOpen && (
        <ManagerReportModal
          onClose={() => setIsReportOpen(false)}
          periodLabel={periodLabel}
          currentRevenue={currentRevenue}
          servicesInCurrentWindow={servicesInCurrentWindow.length}
          selectedWashSummary={selectedWashSummary}
          averageMinutes={averageMinutes}
          averageTicket={averageTicket}
          conversionRate={conversionRate}
          scheduledActiveCount={scheduledActiveCount}
          pendingServiceCount={pendingServiceCount}
          washingServiceCount={washingServiceCount}
          waitingPaymentCount={waitingPaymentCount}
          noShowCount={noShowCount}
          activeWorkloadCount={activeWorkloadCount}
          baseSummaries={baseSummaries}
          topWashersList={topWashersList}
          recentServices={recentServices}
        />
      )}
    </div>
  );
}

function MetricCard({
  motionIndex,
  icon,
  label,
  value,
  formatValue,
  precision,
  secondary,
  secondaryClassName,
  interactive,
  onClick,
}: {
  motionIndex: number;
  icon: React.ReactNode;
  label: string;
  value: number;
  formatValue: (value: number) => string;
  precision?: number;
  secondary: string;
  secondaryClassName?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{ '--motion-index': motionIndex } as React.CSSProperties}
      className={`interactive-surface bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex flex-col justify-between min-h-[98px] ${interactive ? 'cursor-pointer active:scale-95' : ''}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider truncate">{label}</span>
      </div>
      <span className="text-slate-900 text-xl font-black block">
        <AnimatedMetricValue value={value} formatValue={formatValue} precision={precision} />
      </span>
      <span className={`${secondaryClassName || 'text-slate-400'} text-[10px] font-bold mt-1 uppercase flex items-center gap-1 truncate`}>
        {secondaryClassName === 'text-emerald-500' && <TrendingUp className="w-3 h-3" />}
        {secondary}
      </span>
    </div>
  );
}

function AnimatedMetricValue({
  value,
  formatValue,
  precision = 0,
}: {
  value: number;
  formatValue: (value: number) => string;
  precision?: number;
}) {
  const previousValueRef = useRef(0);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startValue = previousValueRef.current;
    previousValueRef.current = value;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      return;
    }

    const startedAt = window.performance.now();
    let animationFrame = 0;

    const animateValue = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 650);
      setDisplayValue(interpolateMetricValue(startValue, value, progress, precision));

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(animateValue);
      }
    };

    animationFrame = window.requestAnimationFrame(animateValue);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [precision, value]);

  return <span className="metric-value-motion">{formatValue(displayValue)}</span>;
}

function ExecutiveCard({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="min-h-[104px] rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {icon}
        <p className="truncate text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <p className="mt-3 truncate text-xl font-black tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">{note}</p>
    </div>
  );
}

function ReportMetric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black tracking-tight text-slate-900">{value}</p>
      {note && <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{note}</p>}
    </div>
  );
}

function ManagerReportModal({
  onClose,
  periodLabel,
  currentRevenue,
  servicesInCurrentWindow,
  selectedWashSummary,
  averageMinutes,
  averageTicket,
  conversionRate,
  scheduledActiveCount,
  pendingServiceCount,
  washingServiceCount,
  waitingPaymentCount,
  noShowCount,
  activeWorkloadCount,
  baseSummaries,
  topWashersList,
  recentServices,
}: {
  onClose: () => void;
  periodLabel: string;
  currentRevenue: number;
  servicesInCurrentWindow: number;
  selectedWashSummary: {
    totalWashed: number;
    uniqueVehicles: number;
    pendingPayment: number;
  };
  averageMinutes: number;
  averageTicket: number;
  conversionRate: number;
  scheduledActiveCount: number;
  pendingServiceCount: number;
  washingServiceCount: number;
  waitingPaymentCount: number;
  noShowCount: number;
  activeWorkloadCount: number;
  baseSummaries: Array<{
    id: string;
    name: string;
    scheduled: number;
    waiting: number;
    washing: number;
    completed: number;
    noShow: number;
    total: number;
  }>;
  topWashersList: Array<{
    id: string;
    name: string;
    efficiency: string;
    washes: number;
    imageUrl: string;
  }>;
  recentServices: Service[];
}) {
  const generatedAt = new Date().toLocaleString('pt-BR');

  return (
    <ModalSurface onClose={onClose} position="center" overlayClassName="z-[160]" panelClassName="max-w-6xl rounded-3xl p-0">
      <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-100 bg-white/95 p-5 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Apresentacao gerencial</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">Relatorio completo</h2>
          <p className="text-sm font-bold text-slate-500">{periodLabel} - gerado em {generatedAt}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-black uppercase tracking-widest text-slate-950 transition-all hover:bg-amber-600 active:scale-95"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:text-slate-900"
            aria-label="Fechar relatorio"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="space-y-6 p-5">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ReportMetric label="Faturamento" value={currencyFormatter.format(currentRevenue)} note={periodLabel} />
          <ReportMetric label="Volume operacional" value={`${integerFormatter.format(servicesInCurrentWindow)} veiculos`} note="servicos no periodo" />
          <ReportMetric label="Lavados" value={integerFormatter.format(selectedWashSummary.totalWashed)} note={`${integerFormatter.format(selectedWashSummary.uniqueVehicles)} placas unicas`} />
          <ReportMetric label="Ticket medio" value={currencyFormatter.format(averageTicket)} note={`${formatPercent(conversionRate)} conclusao`} />
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <ReportMetric label="Agenda ativa" value={integerFormatter.format(scheduledActiveCount)} />
          <ReportMetric label="Aguardando fila" value={integerFormatter.format(pendingServiceCount)} />
          <ReportMetric label="Em lavagem" value={integerFormatter.format(washingServiceCount)} />
          <ReportMetric label="Aguardando pagamento" value={integerFormatter.format(waitingPaymentCount)} />
          <ReportMetric label="Fluxo ativo" value={integerFormatter.format(activeWorkloadCount)} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight text-slate-900">Bases</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nao compareceram: {integerFormatter.format(noShowCount)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="py-3 pr-3">Base</th>
                    <th className="py-3 pr-3">Agendados</th>
                    <th className="py-3 pr-3">Aguardando</th>
                    <th className="py-3 pr-3">Em lavagem</th>
                    <th className="py-3 pr-3">Concluidos</th>
                    <th className="py-3 pr-3">No-show</th>
                    <th className="py-3 pr-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {baseSummaries.map((base) => (
                    <tr key={base.id} className="font-bold text-slate-700">
                      <td className="py-3 pr-3 text-slate-900">{base.name}</td>
                      <td className="py-3 pr-3">{base.scheduled}</td>
                      <td className="py-3 pr-3">{base.waiting}</td>
                      <td className="py-3 pr-3">{base.washing}</td>
                      <td className="py-3 pr-3 text-emerald-600">{base.completed}</td>
                      <td className="py-3 pr-3 text-rose-600">{base.noShow}</td>
                      <td className="py-3 pr-3 text-right text-primary">{base.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-black tracking-tight text-slate-900">Top lavadores</h3>
              <div className="space-y-3">
                {topWashersList.length === 0 ? (
                  <p className="text-sm font-bold text-slate-400">Sem producao no periodo.</p>
                ) : (
                  topWashersList.map((washer, index) => (
                    <div key={washer.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{index + 1}. {washer.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Eficiencia {washer.efficiency}</p>
                      </div>
                      <p className="text-lg font-black text-primary">{washer.washes}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-black tracking-tight text-slate-900">Tempo medio</h3>
              <p className="text-3xl font-black text-slate-900">{formatAverageMinutes(averageMinutes)}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">tempo medido em servicos com inicio e fim</p>
            </section>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-black tracking-tight text-slate-900">Servicos recentes</h3>
          {recentServices.length === 0 ? (
            <p className="text-sm font-bold text-slate-400">Nenhum servico recente no periodo.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recentServices.map((service) => (
                <div key={service.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{service.model} - {service.plate}</p>
                      <p className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">{service.type}</p>
                    </div>
                    <StatusBadge status={service.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </ModalSurface>
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
