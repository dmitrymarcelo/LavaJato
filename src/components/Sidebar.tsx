import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  History,
  ChevronRight,
  ChevronLeft,
  Package,
  Droplets,
  Cloud,
  CloudRain,
  CloudSun,
  Sun
} from 'lucide-react';
import { motion } from '../lib/motion';
import { Screen, TeamMember } from '../types';
import { getSafeLogoSrc } from '../lib/placeholders';
import { getRealWeatherForecast, getWeatherForecast } from '../services/geminiService';
import { WeatherForecastResponse } from '../services/api';

const SMART_TIP_WEATHER_CACHE_KEY = 'smartTipWeatherForecastV1';
const SMART_TIP_WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const MANAUS_COORDINATES = { lat: -3.119, lon: -60.021, tz: 'America/Manaus' };
const formatTemperature = (minC: number, maxC: number) => `${Math.round(minC)}°C / ${Math.round(maxC)}°C`;
const formatRain = (rainMm: number) => {
  if (!Number.isFinite(rainMm) || rainMm <= 0) return '0 mm';
  const rounded = Math.round(rainMm * 10) / 10;
  return `${rounded.toFixed(1)} mm`;
};
type WeatherCondition = 'sun' | 'partly_cloudy' | 'cloudy' | 'rain';
const renderConditionIcon = (condition: WeatherCondition) => {
  if (condition === 'sun') return <Sun className="w-6 h-6 text-amber-300" />;
  if (condition === 'rain') return <CloudRain className="w-6 h-6 text-sky-200" />;
  if (condition === 'partly_cloudy') return <CloudSun className="w-6 h-6 text-amber-200" />;
  if (condition === 'cloudy') return <Cloud className="w-6 h-6 text-slate-200" />;
  return <Cloud className="w-6 h-6 text-slate-200" />;
};

const getWeekdayLabelFromDate = (isoDate: string) => {
  const date = new Date(`${isoDate}T12:00:00`);
  const raw = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  return raw.replace('-feira', '').trim().toUpperCase();
};

const getWeekdayLabelFromOffset = (dayOffset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  const raw = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  return raw.replace('-feira', '').trim().toUpperCase();
};

const mapOpenMeteoCodeToCondition = (code: number): WeatherCondition => {
  if (code === 0) return 'sun';
  if (code === 1 || code === 2) return 'partly_cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'cloudy';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain';
  return 'partly_cloudy';
};

const buildOperationalNote = (rainMm: number) => {
  if (Number.isFinite(rainMm) && rainMm >= 1) {
    return 'Risco de chuva: priorize interna e entrega por horario.';
  }
  return 'Dia bom: acelere a fila e finalize com secagem completa.';
};

type WeatherWidget = {
  source: 'open-meteo' | 'assistant';
  generatedAt: string;
  days: Array<{
    key: string;
    label: string;
    condition: WeatherCondition;
    minC: number;
    maxC: number;
    rainMm: number;
    note: string;
  }>;
};

interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
  currentUser?: TeamMember | null;
  canViewAnalytics?: boolean;
  canManageInventory?: boolean;
  canManageSettings?: boolean;
}

export default function Sidebar({
  currentScreen,
  onNavigate,
  onLogout,
  isOpen,
  onToggle,
  currentUser,
  canViewAnalytics = false,
  canManageInventory = false,
  canManageSettings = false,
}: SidebarProps) {
  const [forecast, setForecast] = useState<WeatherWidget | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const readCache = () => {
      try {
        const raw = window.sessionStorage.getItem(SMART_TIP_WEATHER_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.payload || !parsed?.expiresAt || Number(parsed.expiresAt) <= Date.now()) {
          window.sessionStorage.removeItem(SMART_TIP_WEATHER_CACHE_KEY);
          return null;
        }
        return parsed.payload as WeatherWidget;
      } catch (error) {
        return null;
      }
    };

    const writeCache = (payload: WeatherWidget) => {
      try {
        window.sessionStorage.setItem(
          SMART_TIP_WEATHER_CACHE_KEY,
          JSON.stringify({ payload, expiresAt: Date.now() + SMART_TIP_WEATHER_CACHE_TTL_MS })
        );
      } catch (error) {}
    };

    const refresh = async () => {
      const cached = readCache();
      if (cached) {
        if (!isCancelled) setForecast(cached);
        return;
      }

      try {
        const real = await getRealWeatherForecast({ ...MANAUS_COORDINATES, days: 7 });
        const widget: WeatherWidget = {
          source: 'open-meteo',
          generatedAt: real.generatedAt,
          days: real.days.slice(0, 7).map((day) => ({
            key: day.date,
            label: getWeekdayLabelFromDate(day.date),
            condition: mapOpenMeteoCodeToCondition(day.weatherCode),
            minC: day.minC,
            maxC: day.maxC,
            rainMm: day.rainMm,
            note: buildOperationalNote(day.rainMm),
          })),
        };
        if (isCancelled) return;
        setForecast(widget);
        writeCache(widget);
      } catch (error) {
        try {
          const assistant = await getWeatherForecast();
          const widget: WeatherWidget = {
            source: 'assistant',
            generatedAt: assistant.generatedAt,
            days: assistant.days.slice(0, 7).map((day) => ({
              key: String(day.dayOffset),
              label: getWeekdayLabelFromOffset(day.dayOffset),
              condition: day.condition,
              minC: day.minC,
              maxC: day.maxC,
              rainMm: day.rainMm,
              note: day.note,
            })),
          };
          if (isCancelled) return;
          setForecast(widget);
          writeCache(widget);
        } catch (innerError) {
          if (isCancelled) return;
          setForecast(null);
        }
      }
    };

    if (typeof window !== 'undefined') {
      void refresh();
      const interval = window.setInterval(() => void refresh(), SMART_TIP_WEATHER_CACHE_TTL_MS);
      return () => {
        isCancelled = true;
        window.clearInterval(interval);
      };
    }

    return () => {
      isCancelled = true;
    };
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Painel', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'scheduling', label: 'Agenda & Fila', icon: <Droplets className="w-5 h-5" /> },
    { id: 'vehicle-history', label: 'Historico de Veiculos', icon: <History className="w-5 h-5" /> },
    { id: 'inventory', label: 'Estoque', icon: <Package className="w-5 h-5" /> },
    { id: 'settings', label: 'Configuracoes', icon: <Settings className="w-5 h-5" /> },
  ];

  const visibleMenuItems = currentUser?.role === 'Clientes'
    ? menuItems.filter((item) => item.id === 'scheduling')
    : menuItems.filter((item) => {
      if (item.id === 'dashboard' || item.id === 'vehicle-history') {
        return canViewAnalytics;
      }

      if (item.id === 'inventory') {
        return canManageInventory;
      }

      if (item.id === 'settings') {
        return canManageSettings;
      }

      return true;
    });

  return (
    <div className="hidden lg:flex relative h-screen sticky top-0 z-50">
      <motion.aside
        initial={{ width: 288 }}
        animate={{ width: isOpen ? 288 : 88 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white border-r border-slate-100 h-full overflow-hidden flex flex-col"
      >
        <div className={`p-6 xl:p-8 flex items-center gap-3 transition-all duration-300 ${isOpen ? 'min-w-[288px]' : 'min-w-[88px] justify-center px-0'}`}>
          <img
            src={getSafeLogoSrc()}
            alt="Norte Tech Logo"
            className="w-10 h-10 object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
          {isOpen && <h1 className="text-xl font-black text-slate-900 tracking-tight whitespace-nowrap">Norte <span className="text-primary">Tech</span></h1>}
        </div>

        <nav className={`flex-1 space-y-2 py-4 transition-all duration-300 ${isOpen ? 'px-4 min-w-[288px]' : 'px-3 min-w-[88px]'}`}>
          {visibleMenuItems.map((item) => {
            const isActive = currentScreen === item.id || (item.id === 'vehicle-history' && currentScreen === 'vehicle-history-detail');

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as Screen)}
                title={!isOpen ? item.label : undefined}
                className={`w-full flex items-center rounded-2xl transition-all group ${
                  isOpen ? 'justify-between px-4 py-3.5' : 'justify-center p-3.5'
                } ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  {isOpen && <span className="font-bold text-sm whitespace-nowrap">{item.label}</span>}
                </div>
                {isOpen && <ChevronRight className={`w-4 h-4 transition-transform shrink-0 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1'}`} />}
              </button>
            );
          })}

          {isOpen ? (
            <div className="mt-4 rounded-3xl overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-xl">
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/75">Clima</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
                      {forecast?.generatedAt
                        ? `Atualizado ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(forecast.generatedAt))}`
                        : 'Carregando...'}
                    </p>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                    {forecast?.source === 'open-meteo' ? 'Open-Meteo' : 'Assistente'}
                  </p>
                </div>
              </div>

              <div className="px-4 pb-4 space-y-2">
                {forecast?.days?.length ? (
                  forecast.days.slice(0, 7).map((day) => (
                    <div key={day.key} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 flex items-center justify-center rounded-xl bg-white/10 border border-white/10 shrink-0">
                            {renderConditionIcon(day.condition)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/85">
                              {day.label}
                            </p>
                            <p className="text-xs font-black text-white">
                              {formatTemperature(day.minC, day.maxC)}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] font-bold text-white/70 shrink-0">
                          {formatRain(day.rainMm)}
                        </p>
                      </div>
                      <p className="mt-2 text-[10px] font-bold text-white/80">
                        {day.note}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-center text-xs font-bold text-white/70">
                    Sem previsao no momento.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-2">
              {(forecast?.days?.length ? forecast.days.slice(0, 4) : []).map((day) => (
                <div
                  key={day.key}
                  title={`${day.label} • ${formatTemperature(day.minC, day.maxC)} • ${formatRain(day.rainMm)} • ${day.note}`}
                  className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-slate-900 shadow-sm"
                >
                  <div className="text-slate-900">{renderConditionIcon(day.condition)}</div>
                  <span className="text-[9px] font-black leading-none -mt-1">{Math.round(day.maxC)}°</span>
                </div>
              ))}
            </div>
          )}
        </nav>

        <div className={`border-t border-slate-100 transition-all duration-300 ${isOpen ? 'p-6 min-w-[288px]' : 'p-4 min-w-[88px] flex flex-col items-center'}`}>
          <div className={`bg-slate-50 rounded-2xl flex items-center gap-3 ${isOpen ? 'p-4 mb-4' : 'p-2 mb-4 justify-center'}`}>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
              {(currentUser?.name || 'U').slice(0, 2).toUpperCase()}
            </div>
            {isOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{currentUser?.name || 'Usuario'}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{currentUser?.role || 'Perfil'}</p>
              </div>
            )}
          </div>

          <button
            onClick={onLogout}
            title={!isOpen ? 'Sair da Conta' : undefined}
            className={`flex items-center text-rose-500 hover:bg-rose-50 transition-colors font-bold text-sm rounded-xl ${
              isOpen ? 'w-full gap-3 px-4 py-3' : 'justify-center p-3'
            }`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isOpen && <span className="whitespace-nowrap">Sair da Conta</span>}
          </button>
        </div>
      </motion.aside>

      <button
        onClick={onToggle}
        className="absolute top-8 -right-3 w-6 h-6 bg-white border border-slate-100 shadow-md rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors z-50"
      >
        <ChevronLeft className={`w-3 h-3 transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
