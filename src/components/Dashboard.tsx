/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Car,
  CloudSun,
  Clock,
  DollarSign,
  Gauge,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Screen, Service, TeamMember } from '../types';
import { addDays, getElapsedMinutes, getTodayDate } from '../utils/app';
import { getWeatherRecommendation } from '../services/geminiService';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const getServiceDateKey = (service: Service) =>
  service.scheduledDate || service.endTime?.slice(0, 10) || service.startTime?.slice(0, 10) || null;

const isWithinRange = (dateKey: string | null, start: string, end: string) => !!dateKey && dateKey >= start && dateKey <= end;

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
  team = [],
}: {
  onNavigate: (screen: Screen) => void;
  services: Service[];
  team?: TeamMember[];
}) {
  const [weatherAdvice, setWeatherAdvice] = useState<string>('Carregando recomendacao...');
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const advice = await getWeatherRecommendation();
        setWeatherAdvice(advice);
      } catch (error) {
        setWeatherAdvice('Mantenha panos secos e priorize a fila por horario para evitar atrasos entre as lavagens.');
      }
    };

    void fetchWeather();
  }, []);

  const todayKey = getTodayDate();
  const windowDays = timeframe === 'today' ? 1 : timeframe === 'week' ? 7 : 30;
  const currentStartKey = addDays(todayKey, -(windowDays - 1));
  const previousStartKey = addDays(currentStartKey, -windowDays);
  const previousEndKey = addDays(currentStartKey, -1);

  const servicesInCurrentWindow = services.filter(service => isWithinRange(getServiceDateKey(service), currentStartKey, todayKey));
  const servicesInPreviousWindow = services.filter(service => isWithinRange(getServiceDateKey(service), previousStartKey, previousEndKey));

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
  const growthLabel = formatGrowth(currentRevenue, previousRevenue);
  const chartDates = Array.from({ length: 5 }, (_, index) => addDays(todayKey, index - 4));
  const chartPoints = chartDates.map(date => ({
    date,
    label: new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    value: servicesInCurrentWindow.filter(service => getServiceDateKey(service) === date).length,
  }));
  const maxChartValue = Math.max(1, ...chartPoints.map(point => point.value));

  const topWashers = [...team]
    .filter(member => member.role.toLowerCase().includes('lavador'))
    .sort((left, right) => right.servicesCount - left.servicesCount)
    .slice(0, 3);

  const recentServices = [...services]
    .sort((left, right) => {
      const leftKey = `${left.endTime || left.startTime || `${left.scheduledDate || ''}T${left.scheduledTime || '00:00'}`}`;
      const rightKey = `${right.endTime || right.startTime || `${right.scheduledDate || ''}T${right.scheduledTime || '00:00'}`}`;
      return rightKey.localeCompare(leftKey);
    })
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6 pb-8 bg-white transition-colors">
      <div className="px-4 pt-4">
        <div className="flex h-10 w-full items-center justify-center rounded-xl bg-slate-100 p-1">
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
        </div>
      </div>

      <div className="px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
            secondary="Periodo selecionado"
            interactive
            onClick={() => onNavigate('scheduling')}
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
            secondary="Aguardando pagamento"
            interactive
            onClick={() => onNavigate('scheduling')}
          />
        </div>
      </div>

      <div className="px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">Movimento real</h3>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              <BarChart3 className="w-4 h-4" />
              Ultimos 5 dias
            </div>
          </div>
          <div className="relative h-40 w-full flex items-end justify-between gap-3 px-2">
            {chartPoints.map(point => (
              <div key={point.date} className="flex-1 flex items-end">
                <ChartBar height={`${Math.max(8, (point.value / maxChartValue) * 100)}%`} active={point.value === maxChartValue && point.value > 0} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-[10px] text-slate-400 font-black px-1 uppercase tracking-widest">
            {chartPoints.map(point => (
              <span key={point.date}>{point.label}</span>
            ))}
          </div>
          {servicesInCurrentWindow.length === 0 && (
            <p className="mt-4 text-xs text-slate-400 font-medium">Sem lavagens registradas no periodo selecionado.</p>
          )}
        </section>

        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">Metas</h3>
            <Target className="w-5 h-5 text-slate-300" />
          </div>
          <div className="space-y-4">
            <GoalCard title="Volume de lavagens" current={servicesInCurrentWindow.length} target={0} helper="Sem meta definida. Preencha depois do inicio dos testes." />
            <GoalCard title="Faturamento" current={currentRevenue} target={0} helper="Indicador usando apenas dados reais do periodo." currency />
          </div>
        </section>
      </div>

      <div className="px-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">Top lavadores</h3>
            <button
              onClick={() => onNavigate('settings')}
              className="text-primary text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
            >
              Equipe
            </button>
          </div>
          <div className="space-y-3">
            {topWashers.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium">Nenhum lavador com producao registrada ainda.</p>
            ) : (
              topWashers.map((member, index) => (
                <div key={member.id}>
                  <WasherRank
                    rank={`${index + 1}o`}
                    name={member.name}
                    efficiency={member.efficiency}
                    washes={member.servicesCount}
                    imageUrl={member.avatar}
                  />
                </div>
              ))
            )}
          </div>
        </section>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-primary to-blue-700 rounded-2xl p-6 text-white shadow-xl shadow-primary/20 flex items-center gap-5">
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md shrink-0">
              <CloudSun className="w-10 h-10" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Dica Inteligente</p>
              </div>
              <p className="text-sm font-bold leading-relaxed">{weatherAdvice}</p>
            </div>
          </div>
        </div>
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
                  onClick={() => onNavigate('history')}
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden border border-slate-200">
                      {service.image ? (
                        <img className="w-full h-full object-cover" src={service.image} alt={service.model} />
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
      className={`bg-white border border-slate-100 p-4 rounded-2xl shadow-sm ${interactive ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-slate-900 text-xl font-black block">{value}</span>
      <span className={`${secondaryClassName || 'text-slate-400'} text-[10px] font-bold mt-1 uppercase flex items-center gap-1`}>
        {secondaryClassName === 'text-emerald-500' && <TrendingUp className="w-3 h-3" />}
        {secondary}
      </span>
    </div>
  );
}

function ChartBar({ height, active }: { height: string; active?: boolean }) {
  return (
    <div className={`flex-1 ${active ? 'bg-primary' : 'bg-primary/20'} rounded-t-lg transition-all duration-500`} style={{ height }} />
  );
}

function GoalCard({
  title,
  current,
  target,
  helper,
  currency,
}: {
  title: string;
  current: number;
  target: number;
  helper: string;
  currency?: boolean;
}) {
  const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const currentLabel = currency ? currencyFormatter.format(current) : `${current}`;
  const targetLabel = currency ? currencyFormatter.format(target) : `${target}`;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-xs font-bold text-slate-900">{title}</h4>
        <span className="text-[10px] font-black text-slate-900">{target > 0 ? `${Math.round(percent)}%` : 'Sem meta'}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
        <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className="h-full bg-primary" />
      </div>
      <p className="text-[10px] text-slate-500 font-medium">
        {target > 0 ? `${currentLabel} de ${targetLabel}` : helper}
      </p>
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
  };

  const config = configs[status];
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${config.classes}`}>
      {config.label}
    </span>
  );
}
