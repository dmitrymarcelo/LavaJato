/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Car, 
  Plus, 
  ChevronRight, 
  CloudSun, 
  Sparkles,
  AlertCircle,
  Clock,
  Target,
  Medal,
  Gauge,
  DollarSign,
  BarChart3
} from 'lucide-react';
import { Screen, Service } from '../types';
import { getWeatherRecommendation } from '../services/geminiService';
import { motion } from 'motion/react';

export default function Dashboard({ onNavigate, services }: { onNavigate: (screen: Screen) => void, services: Service[] }) {
  const [weatherAdvice, setWeatherAdvice] = useState<string>('Carregando recomendação...');
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('week');

  const stats = {
    today: { time: '21.2m', revenue: 'R$ 1.2k', growth: '+5%' },
    week: { time: '22.4m', revenue: 'R$ 4.2k', growth: '+12%' },
    month: { time: '23.1m', revenue: 'R$ 18.5k', growth: '+8%' }
  };

  const currentStats = stats[timeframe];

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const advice = await getWeatherRecommendation();
        setWeatherAdvice(advice);
      } catch (error: any) {
        setWeatherAdvice('Mantenha panos de microfibra secos e priorize a lavagem pela manha para evitar marcas na pintura.');
      }
    };
    fetchWeather();
  }, []);

  return (
    <div className="flex flex-col gap-6 pb-8 bg-white transition-colors">
      {/* Timeframe Selector */}
      <div className="px-4 pt-4">
        <div className="flex h-10 w-full items-center justify-center rounded-xl bg-slate-100 p-1">
          <button 
            onClick={() => setTimeframe('today')}
            className={`flex-1 h-full rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-all ${
              timeframe === 'today' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'
            }`}
          >
            Hoje
          </button>
          <button 
            onClick={() => setTimeframe('week')}
            className={`flex-1 h-full rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-all ${
              timeframe === 'week' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'
            }`}
          >
            Semana
          </button>
          <button 
            onClick={() => setTimeframe('month')}
            className={`flex-1 h-full rounded-lg text-xs font-bold uppercase tracking-wider active:scale-95 transition-all ${
              timeframe === 'month' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'
            }`}
          >
            Mês
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="text-primary w-3.5 h-3.5" />
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Faturamento</span>
            </div>
            <span className="text-slate-900 text-xl font-black block">{currentStats.revenue}</span>
            <span className="text-emerald-500 text-[10px] flex items-center gap-0.5 font-bold mt-1">
              <TrendingUp className="w-3 h-3" /> {currentStats.growth}
            </span>
          </div>
          <div 
            onClick={() => onNavigate('scheduling')}
            className="bg-white border border-slate-100 cursor-pointer active:scale-95 transition-transform p-4 rounded-2xl shadow-sm"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Car className="text-slate-500 w-3.5 h-3.5" />
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Volume</span>
            </div>
            <span className="text-slate-900 text-xl font-black block">{timeframe === 'today' ? '14' : timeframe === 'week' ? '82' : '342'} Veículos</span>
            <span className="text-slate-400 text-[10px] font-bold mt-1 uppercase">Meta: {timeframe === 'today' ? '20' : timeframe === 'week' ? '100' : '400'}</span>
          </div>
          <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Gauge className="text-primary w-3.5 h-3.5" />
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Tempo Médio</span>
            </div>
            <span className="text-slate-900 text-xl font-black block">{currentStats.time}</span>
            <span className="text-slate-400 text-[10px] font-bold mt-1 uppercase">Eficiência: 94%</span>
          </div>
          <div 
            onClick={() => onNavigate('scheduling')}
            className="bg-white border border-slate-100 cursor-pointer active:scale-95 transition-transform p-4 rounded-2xl shadow-sm"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="text-amber-500 w-3.5 h-3.5" />
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Pendentes</span>
            </div>
            <span className="text-slate-900 text-xl font-black block">{services.filter(s => s.status === 'waiting_payment').length.toString().padStart(2, '0')}</span>
            <span className="text-amber-600 text-[10px] font-bold mt-1 uppercase">Aguardando Pgto.</span>
          </div>
        </div>
      </div>

      <div className="px-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
        {/* Weekly Revenue Chart */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">Picos de Demanda</h3>
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-bold uppercase tracking-wider">{currentStats.growth} vs ant.</span>
          </div>
          <div className="relative h-40 w-full flex items-end justify-between gap-3 px-2">
            <ChartBar height={timeframe === 'today' ? "80%" : "40%"} active={timeframe === 'today'} />
            <ChartBar height={timeframe === 'today' ? "30%" : "60%"} active={timeframe === 'week'} />
            <ChartBar height="95%" active={timeframe === 'month'} />
            <ChartBar height={timeframe === 'month' ? "90%" : "75%"} />
            <ChartBar height="50%" />
          </div>
          <div className="flex justify-between mt-4 text-[10px] text-slate-400 font-black px-1 uppercase tracking-widest">
            <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span>
          </div>
        </section>

        <div className="space-y-6">
          {/* Monthly Goals */}
          <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-slate-900 font-black text-lg tracking-tight">Metas Mensais</h3>
              <Target className="w-5 h-5 text-slate-300" />
            </div>
            <div className="space-y-4">
              <GoalCard title="Volume de Lavagens" current={850} target={1000} unit="lavagens" color="bg-primary" />
              <GoalCard title="Faturamento Filiais" current={45000} target={60000} unit="reais" color="bg-emerald-500" />
            </div>
          </section>
        </div>
      </div>

      <div className="px-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
        {/* Top Washers */}
        <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">Top Lavadores</h3>
            <button 
              onClick={() => onNavigate('settings')}
              className="text-primary text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
            >
              Equipe
            </button>
          </div>
          <div className="space-y-3">
            <WasherRank 
              rank="1º" 
              name="Ricardo Gomez" 
              avgTime="18 min" 
              washes={timeframe === 'month' ? "542" : "142"} 
              color="bg-yellow-500/20 text-yellow-600"
              imageUrl="https://i.pravatar.cc/150?u=ricardo"
            />
            <WasherRank 
              rank="2º" 
              name="Marco Chen" 
              avgTime="21 min" 
              washes={timeframe === 'month' ? "488" : "128"} 
              color="bg-slate-100 text-slate-400"
              imageUrl="https://i.pravatar.cc/150?u=marco"
            />
          </div>
        </section>

        <div className="space-y-6">
          {/* Weather Tip */}
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

      {/* Recent Services */}
      <div className="px-4">
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">Serviços Recentes</h3>
            <button 
              onClick={() => onNavigate('queue')} 
              className="text-primary text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
            >
              Ver tudo
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {services.slice(0, 5).map((service) => (
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
        </section>
      </div>
    </div>
  );
}

function ChartBar({ height, active }: { height: string, active?: boolean }) {
  return (
    <div className={`flex-1 ${active ? 'bg-primary' : 'bg-primary/20'} rounded-t-lg relative group transition-all duration-500`} style={{ height }}>
      {active && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg uppercase">Pico</div>
      )}
    </div>
  );
}

function GoalCard({ title, current, target, unit, color }: { title: string, current: number, target: number, unit: string, color: string }) {
  const percent = Math.min((current / target) * 100, 100);
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-xs font-bold text-slate-900">{title}</h4>
        <span className="text-[10px] font-black text-slate-900">{Math.round(percent)}%</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full ${color}`}
        />
      </div>
      <p className="text-[9px] text-slate-500 font-medium">
        {unit === 'reais' ? `R$ ${current.toLocaleString()}` : current} de {unit === 'reais' ? `R$ ${target.toLocaleString()}` : target} {unit}
      </p>
    </div>
  );
}

function WasherRank({ rank, name, avgTime, washes, color, imageUrl }: { rank: string, name: string, avgTime: string, washes: string, color: string, imageUrl: string }) {
  return (
    <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${color} font-black text-xs shrink-0`}>{rank}</div>
      <img className="w-10 h-10 rounded-full object-cover shrink-0" src={imageUrl} alt={name} />
      <div className="flex-1 min-w-0">
        <p className="font-black text-slate-900 text-sm truncate">{name}</p>
        <p className="text-[9px] font-bold uppercase text-slate-400">Média {avgTime}</p>
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
    in_progress: { label: 'Em Curso', classes: 'bg-blue-100 text-blue-700' },
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
