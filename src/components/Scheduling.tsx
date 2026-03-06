/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Car, Plus, ChevronRight, ChevronLeft, Search, Filter, CheckCircle2, AlertCircle, Camera, Image as ImageIcon, PlayCircle, History, Zap, WashingMachine, ChevronUp, ChevronDown, Truck, Bike, Ship, Building2 } from 'lucide-react';
import { Screen, Service, VehicleCategory, VehicleType, VehicleRegistration } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface Appointment {
  id: string;
  customer: string;
  vehicle: string;
  plate: string;
  service: string;
  date: string;
  time: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  photo?: string;
  thirdPartyName?: string;
  thirdPartyCpf?: string;
}

const MOCK_APPOINTMENTS: Appointment[] = [
  { id: '1', customer: 'João Silva', vehicle: 'Toyota Corolla', plate: 'ABC-1234', service: 'Lavagem Completa', date: '2026-03-01', time: '09:00', status: 'confirmed', photo: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&q=80' },
  { id: '2', customer: 'Maria Santos', vehicle: 'Honda Civic', plate: 'XYZ-9876', service: 'Lavagem Simples', date: '2026-03-01', time: '10:30', status: 'confirmed' },
  { id: '3', customer: 'Pedro Oliveira', vehicle: 'Jeep Compass', plate: 'LUV-2024', service: 'Lavagem Detalhada', date: '2026-03-01', time: '14:00', status: 'pending', photo: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=400&q=80' },
  { id: '4', customer: 'Ana Costa', vehicle: 'VW Polo', plate: 'DEF-5678', service: 'Lavagem Completa', date: '2026-03-02', time: '08:30', status: 'confirmed' },
];

export default function Scheduling({ 
  onNavigate,
  services,
  onUpdateStatus,
  onReorder,
  serviceTypes,
  vehicleDb,
  selectedBase,
  onClearBase
}: { 
  onNavigate: (screen: Screen, serviceId?: string) => void,
  services: Service[],
  onUpdateStatus: (id: string, status: Service['status']) => void,
  onReorder: (newServices: Service[]) => void,
  serviceTypes: Record<VehicleType, VehicleCategory>,
  vehicleDb?: VehicleRegistration[],
  selectedBase?: string | null,
  onClearBase?: () => void
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'appointments' | 'waiting' | 'washing' | 'completed'>('appointments');
  const [timers, setTimers] = useState<Record<string, number>>({
    '1': 12,
    '2': 45,
    '3': 8,
    '4': 22
  });

  // Form State
  const [plate, setPlate] = useState('');
  const [customer, setCustomer] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isThirdParty, setIsThirdParty] = useState(false);
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyCpf, setThirdPartyCpf] = useState('');
  const [isVehicleFound, setIsVehicleFound] = useState(false);

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPlate = e.target.value.toUpperCase();
    setPlate(newPlate);
    
    if (vehicleDb) {
      const vehicle = vehicleDb.find(v => v.plate === newPlate);
      if (vehicle) {
        setIsVehicleFound(true);
        setCustomer(vehicle.customer);
        setVehicleModel(vehicle.model);
        setVehicleType(vehicle.type);
        if (vehicle.thirdPartyName || vehicle.thirdPartyCpf) {
          setIsThirdParty(true);
          setThirdPartyName(vehicle.thirdPartyName || '');
          setThirdPartyCpf(vehicle.thirdPartyCpf || '');
        } else {
          setIsThirdParty(false);
          setThirdPartyName('');
          setThirdPartyCpf('');
        }
      } else {
        setIsVehicleFound(false);
        setIsThirdParty(false);
        setThirdPartyName('');
        setThirdPartyCpf('');
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          next[key] = next[key] + 1;
        });
        return next;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = (service: Service) => {
    if (service.status === 'pending') {
      onNavigate('inspection-pre', service.id);
    } else if (service.status === 'in_progress') {
      onNavigate('inspection-post', service.id);
    } else if (service.status === 'waiting_payment') {
      onNavigate('payment', service.id);
    }
  };

  const moveService = (id: string, direction: 'up' | 'down') => {
    const index = services.findIndex(s => s.id === id);
    if (index === -1) return;

    const newServices = [...services];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= services.length) return;
    if (services[index].status !== services[targetIndex].status) return;

    const [moved] = newServices.splice(index, 1);
    newServices.splice(targetIndex, 0, moved);
    onReorder(newServices);
  };

  // Generate next 7 days
  const nextDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date('2026-03-01T00:00:00');
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const isDateInNextDays = nextDays.includes(filterDate);

  const handleStatusChange = (id: string, newStatus: Appointment['status']) => {
    setAppointments(prev => prev.map(apt => apt.id === id ? { ...apt, status: newStatus } : apt));
  };

  const TIME_SLOTS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00'];
  const MAX_CAPACITY = 2;

  const getSlotStatus = (date: string, time: string) => {
    const count = appointments.filter(a => a.date === date && a.time === time && a.status !== 'cancelled').length;
    const isFull = count >= MAX_CAPACITY;
    
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const isPastDate = date < todayStr;
    const isToday = date === todayStr;
    
    const [slotHour, slotMinute] = time.split(':').map(Number);
    const isPastTime = isToday && (now.getHours() > slotHour || (now.getHours() === slotHour && now.getMinutes() >= slotMinute));
    
    const isPast = isPastDate || isPastTime;

    return { isFull, isPast, count };
  };

  const handleAddAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    if (!selectedTime) {
      alert('Por favor, selecione um horário.');
      return;
    }

    const date = formData.get('date') as string;
    const { isFull, isPast } = getSlotStatus(date, selectedTime);

    if (isFull) {
      alert('Este horário está lotado.');
      return;
    }

    if (isPast) {
      alert('Não é possível agendar em horários passados.');
      return;
    }
    
    const newApt: Appointment = {
      id: Math.random().toString(36).substr(2, 9),
      customer: customer,
      vehicle: vehicleModel,
      plate: plate,
      service: formData.get('service') as string,
      date: date,
      time: selectedTime,
      status: 'confirmed',
      thirdPartyName: isThirdParty ? thirdPartyName : undefined,
      thirdPartyCpf: isThirdParty ? thirdPartyCpf : undefined
    };

    setAppointments(prev => [...prev, newApt]);
    alert('Agendamento realizado com sucesso!');
    setIsAdding(false);
    setSelectedTime(null);
    setPlate('');
    setCustomer('');
    setVehicleModel('');
    setVehicleType('car');
    setIsThirdParty(false);
    setThirdPartyName('');
    setThirdPartyCpf('');
  };

  const isPastDate = filterDate < new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col min-h-full bg-white pb-24">
      {/* Header Info */}
      <div className="px-4 pt-6 pb-2 flex justify-between items-center">
        <button 
          onClick={onClearBase}
          className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-sm"
        >
          <ChevronLeft className="w-5 h-5" />
          Voltar
        </button>
        {!isPastDate && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-primary text-white p-3 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-transform"
          >
            <Plus className="w-7 h-7" />
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex px-4 gap-6 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('appointments')}
            className={`flex flex-col items-center justify-center border-b-4 pb-3 pt-4 transition-all active:scale-95 shrink-0 ${activeTab === 'appointments' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            <p className="text-sm font-bold">Agendamentos ({appointments.filter(a => a.date === filterDate).length})</p>
          </button>
          <button 
            onClick={() => setActiveTab('waiting')}
            className={`flex flex-col items-center justify-center border-b-4 pb-3 pt-4 transition-all active:scale-95 shrink-0 ${activeTab === 'waiting' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            <p className="text-sm font-bold">Aguardando ({services.filter(s => s.status === 'pending' || s.status === 'waiting_payment').length})</p>
          </button>
          <button 
            onClick={() => setActiveTab('washing')}
            className={`flex flex-col items-center justify-center border-b-4 pb-3 pt-4 transition-all active:scale-95 shrink-0 ${activeTab === 'washing' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            <p className="text-sm font-bold">Em Lavagem ({services.filter(s => s.status === 'in_progress').length})</p>
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={`flex flex-col items-center justify-center border-b-4 pb-3 pt-4 transition-all active:scale-95 shrink-0 ${activeTab === 'completed' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            <p className="text-sm font-bold">Concluído ({services.filter(s => s.status === 'completed').length})</p>
          </button>
        </div>
      </nav>

      {/* Date Selector (Only for Appointments) */}
      {activeTab === 'appointments' && (
        <div className="flex items-center gap-3 px-4 py-4 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setIsCalendarOpen(true)}
            className={`relative shrink-0 flex flex-col items-center justify-center min-w-[72px] h-[84px] p-4 rounded-2xl border transition-all active:scale-95 ${
              !isDateInNextDays 
                ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' 
                : 'bg-white border-slate-100 text-primary shadow-sm'
            }`}
          >
              {!isDateInNextDays ? (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">
                    {new Date(filterDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </span>
                  <span className="text-xl font-black">{new Date(filterDate + 'T00:00:00').getDate()}</span>
                </>
              ) : (
                <>
                  <CalendarIcon className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Outro</span>
                </>
              )}
          </button>

          {nextDays.map((date, idx) => (
            <button
              key={date}
              onClick={() => setFilterDate(date)}
              className={`flex flex-col items-center min-w-[72px] p-4 rounded-2xl border transition-all active:scale-95 ${
                filterDate === date 
                  ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' 
                  : 'bg-white border-slate-100 text-slate-600 shadow-sm'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">
                {idx === 0 ? 'Hoje' : new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short' })}
              </span>
              <span className="text-xl font-black">{idx === 0 ? new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : new Date(date + 'T00:00:00').getDate()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content Area */}
      <div className="px-4 space-y-4 mt-2">
        <AnimatePresence mode="wait">
          {activeTab === 'appointments' && (
            <motion.div
              key="appointments-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Horários Agendados</h3>
                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded-full uppercase border border-primary/10">
                  {appointments.filter(a => a.date === filterDate).length} Serviços
                </span>
              </div>

              {appointments.filter(a => a.date === filterDate).map((apt, index) => (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onNavigate('customer-history')}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex gap-4 items-center group cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl min-w-[75px] h-[75px] border border-slate-100 overflow-hidden relative">
                    {apt.photo ? (
                      <img src={apt.photo} alt="Veículo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-primary mb-1" />
                        <span className="text-base font-black text-slate-900 tracking-tight">{apt.time}</span>
                      </>
                    )}
                    {apt.photo && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 flex justify-center">
                        <span className="text-[9px] font-black text-white">{apt.time}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-slate-900 truncate text-base">{apt.customer}</h4>
                      <StatusSelector 
                        status={isPastDate ? 'completed' : apt.status} 
                        onStatusChange={(newStatus) => handleStatusChange(apt.id, newStatus)} 
                        readOnly={isPastDate}
                      />
                    </div>
                    {apt.thirdPartyName && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <p className="text-[10px] text-slate-500 font-medium">Terceiro: <span className="font-bold text-slate-700">{apt.thirdPartyName}</span></p>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Car className="w-3 h-3 text-slate-400" />
                      <p className="text-xs text-slate-500 truncate font-medium">{apt.vehicle} • <span className="font-bold text-slate-900">{apt.plate}</span></p>
                    </div>
                    <div className="mt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/5">
                        {apt.service}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                </motion.div>
              ))}

              {appointments.filter(a => a.date === filterDate).length === 0 && (
                <div className="py-12 text-center space-y-3">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                    <CalendarIcon className="w-8 h-8" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">Nenhum agendamento para este dia.</p>
                  {!isPastDate && (
                    <button 
                      onClick={() => setIsAdding(true)}
                      className="text-primary text-sm font-bold hover:underline active:scale-95 transition-transform"
                    >
                      Agendar agora
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'waiting' && (
            <motion.div
              key="waiting-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <QueueSection 
                title="Aguardando" 
                services={services.filter(s => s.status === 'pending' || s.status === 'waiting_payment')} 
                timers={timers}
                onAction={handleAction}
                onMove={moveService}
              />
            </motion.div>
          )}

          {activeTab === 'washing' && (
            <motion.div
              key="washing-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <QueueSection 
                title="Em Lavagem" 
                services={services.filter(s => s.status === 'in_progress')} 
                timers={timers}
                onAction={handleAction}
                onMove={moveService}
              />
            </motion.div>
          )}

          {activeTab === 'completed' && (
            <motion.div
              key="completed-tab"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <QueueSection 
                title="Concluído" 
                services={services.filter(s => s.status === 'completed')} 
                timers={timers}
                onAction={handleAction}
                onMove={moveService}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Appointment Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-[400px] rounded-t-[32px] p-6 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">Novo Agendamento</h3>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 font-bold">Fechar</button>
              </div>

              <form onSubmit={handleAddAppointment} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Placa</label>
                  <input 
                    name="plate"
                    type="text" 
                    placeholder="ABC-1234"
                    value={plate}
                    onChange={handlePlateChange}
                    className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none text-slate-900 font-bold uppercase"
                    required
                  />
                         {isVehicleFound ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-600 mb-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-bold text-sm">Veículo Encontrado</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">Centro de Custo</p>
                        <p className="font-bold text-emerald-900">{customer}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">Veículo</p>
                        <p className="font-bold text-emerald-900">{vehicleModel}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">Tipo</p>
                        <p className="font-bold text-emerald-900 capitalize">{
                          vehicleType === 'car' ? 'Carro' : 
                          vehicleType === 'motorcycle' ? 'Moto' : 
                          vehicleType === 'truck' ? 'Caminhão' : 'Embarcação'
                        }</p>
                      </div>
                    </div>
                    {isThirdParty && (
                      <div className="pt-3 border-t border-emerald-200/50">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 mb-1">Dados do Terceiro</p>
                        <p className="font-bold text-emerald-900 text-sm">{thirdPartyName} <span className="text-emerald-700 font-medium ml-2">{thirdPartyCpf}</span></p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Centro de Custo</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                          name="customer"
                          type="text" 
                          placeholder="Nome do cliente"
                          value={customer}
                          onChange={(e) => setCustomer(e.target.value)}
                          className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary focus:ring-0 transition-all outline-none text-slate-900"
                          required
                        />
                      </div>

                      {isThirdParty && (
                        <div className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Dados do Terceiro</p>
                          <div className="grid grid-cols-2 gap-3">
                            <input 
                              type="text"
                              value={thirdPartyName}
                              onChange={(e) => setThirdPartyName(e.target.value)}
                              placeholder="Nome do Terceiro"
                              className="w-full rounded-xl border border-slate-200 bg-white h-10 px-3 text-slate-900 font-medium focus:border-primary focus:ring-0 transition-all shadow-sm text-sm"
                            />
                            <input 
                              type="text"
                              value={thirdPartyCpf}
                              onChange={(e) => setThirdPartyCpf(e.target.value)}
                              placeholder="CPF do Terceiro"
                              className="w-full rounded-xl border border-slate-200 bg-white h-10 px-3 text-slate-900 font-medium focus:border-primary focus:ring-0 transition-all shadow-sm text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Veículo</label>
                      <div className="relative">
                        <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                          name="vehicle"
                          type="text" 
                          placeholder="Ex: Corolla"
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                          className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none text-slate-900"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Tipo de Veículo</label>
                      <div className="grid grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={() => setVehicleType('car')}
                          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                            vehicleType === 'car' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          <Car className="w-5 h-5" />
                          <span className="text-[8px] font-bold uppercase">Carro</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVehicleType('motorcycle')}
                          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                            vehicleType === 'motorcycle' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          <Bike className="w-5 h-5" />
                          <span className="text-[8px] font-bold uppercase">Moto</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVehicleType('truck')}
                          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                            vehicleType === 'truck' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          <Truck className="w-5 h-5" />
                          <span className="text-[8px] font-bold uppercase">Caminhão</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVehicleType('boat')}
                          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${
                            vehicleType === 'boat' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          <Ship className="w-5 h-5" />
                          <span className="text-[8px] font-bold uppercase">Barco</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}            </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Data</label>
                    <input 
                      name="date"
                      type="date" 
                      defaultValue={new Date().toLocaleDateString('en-CA')}
                      min={new Date().toLocaleDateString('en-CA')}
                      className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none text-slate-900"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Hora</label>
                    <div className="grid grid-cols-3 gap-2">
                      {TIME_SLOTS.map(time => {
                        const date = (document.querySelector('input[name="date"]') as HTMLInputElement)?.value || new Date().toISOString().split('T')[0];
                        const { isFull, isPast, count } = getSlotStatus(date, time);
                        const isSelected = selectedTime === time;
                        const isDisabled = isFull || isPast;

                        return (
                          <button
                            key={time}
                            type="button"
                            onClick={() => {
                              if (isFull) {
                                alert('Horário cheio! Não é possível agendar mais veículos neste horário.');
                                return;
                              }
                              if (isPast) {
                                alert('Não é possível agendar em horários passados.');
                                return;
                              }
                              setSelectedTime(time);
                            }}
                            className={`py-2 rounded-xl text-xs font-bold transition-all relative ${
                              isSelected 
                                ? 'bg-primary text-white shadow-lg shadow-primary/30 scale-105' 
                                : isFull
                                  ? 'bg-rose-50 text-rose-300 border border-rose-100 cursor-not-allowed'
                                  : isPast
                                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary'
                            }`}
                          >
                            {time}
                            {isFull && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border border-white shadow-sm">
                                !
                              </span>
                            )}
                            {!isFull && !isPast && count > 0 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[8px] flex items-center justify-center rounded-full border border-white">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Serviço</label>
                  <select name="service" className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none appearance-none text-slate-900">
                    {serviceTypes[vehicleType].services.map((service) => (
                      <option key={service.id} value={service.label}>
                        {service.label} - R$ {service.price},00
                      </option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Confirmar Agendamento</span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <CalendarModal 
        isOpen={isCalendarOpen} 
        onClose={() => setIsCalendarOpen(false)} 
        onSelect={setFilterDate} 
        selectedDate={filterDate} 
      />
    </div>
  );
}

function CalendarModal({ isOpen, onClose, onSelect, selectedDate }: { isOpen: boolean, onClose: () => void, onSelect: (date: string) => void, selectedDate: string }) {
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate + 'T00:00:00'));

  useEffect(() => {
    if (isOpen) {
      setCurrentDate(new Date(selectedDate + 'T00:00:00'));
    }
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const { days, firstDay } = getDaysInMonth(currentDate);
  
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onSelect(`${year}-${month}-${d}`);
    onClose();
  };

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-100"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-slate-900">Selecionar Data</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ChevronDown className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-6 bg-slate-50 p-2 rounded-2xl">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <span className="font-bold text-slate-900 uppercase tracking-wider text-sm">
            {months[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          <button onClick={handleNextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all">
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-[10px] font-bold text-slate-400 uppercase">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isPast = new Date(dateStr) < new Date(new Date().setHours(0,0,0,0));

            return (
              <button
                key={day}
                onClick={() => !isPast && handleSelectDay(day)}
                disabled={isPast}
                className={`aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all active:scale-90 ${
                  isSelected 
                    ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                    : isToday
                      ? 'bg-slate-100 text-primary border border-primary/20'
                      : isPast
                        ? 'text-slate-200 cursor-not-allowed'
                        : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

export function QueueSection({ 
  title, 
  services, 
  timers, 
  onAction, 
  onMove 
}: { 
  title: string, 
  services: Service[], 
  timers: Record<string, number>,
  onAction: (s: Service) => void,
  onMove: (id: string, dir: 'up' | 'down') => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</h3>
        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase border border-slate-100">
          {services.length} Veículos
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {services.length === 0 ? (
            <div className="col-span-full py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
              <p className="text-xs text-slate-400 font-medium">Nenhum veículo nesta etapa</p>
            </div>
          ) : (
            services.map((service, index) => (
              <motion.div 
                key={service.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col rounded-2xl overflow-hidden shadow-sm bg-white border border-slate-100 transition-transform hover:shadow-md"
              >
                <div className="relative h-32 w-full bg-slate-100">
                  <img alt={service.model} className="w-full h-full object-cover" src={service.image} />
                  
                  {title === 'Aguardando' && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onMove(service.id, 'up'); }}
                        className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all disabled:opacity-30"
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4 text-slate-600" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onMove(service.id, 'down'); }}
                        className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all disabled:opacity-30"
                        disabled={index === services.length - 1}
                      >
                        <ChevronDown className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 bg-slate-900/90 backdrop-blur-md text-white px-2 py-1 rounded-lg shadow-lg border border-white/20">
                    <p className="text-[8px] uppercase font-bold tracking-widest opacity-70 leading-none">Placa</p>
                    <p className="text-sm font-black tracking-tighter mt-0.5">{service.plate}</p>
                  </div>

                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                    {service.priority && (
                      <div className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5 fill-white" />
                      </div>
                    )}
                    <div className={`flex items-center gap-1 ${timers[service.id] > 30 ? 'bg-rose-500' : 'bg-amber-500'} backdrop-blur-md text-white px-2 py-1 rounded-full shadow-lg`}>
                      <History className="w-3 h-3" />
                      <span className="text-[10px] font-bold">{timers[service.id] || 0}m</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 space-y-3 flex-1 flex flex-col">
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {service.model.includes('SUV') ? <Zap className="text-primary w-4 h-4 shrink-0" /> : <Car className="text-primary w-4 h-4 shrink-0" />}
                        <h3 className="text-sm font-black text-slate-900 truncate">{service.model}</h3>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">Cliente</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{service.customer}</p>
                        {service.thirdPartyName && (
                          <p className="text-[10px] font-medium text-slate-500 truncate mt-0.5">
                            Terceiro: {service.thirdPartyName}
                          </p>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">Serviço</p>
                        <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                          <WashingMachine className="text-primary w-3.5 h-3.5" />
                          <p className="text-[10px] font-bold text-slate-600 truncate">{service.type}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => onAction(service)}
                    className={`w-full font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md mt-auto ${
                      service.status === 'pending' ? 'bg-primary text-white shadow-primary/20' :
                      service.status === 'in_progress' ? 'bg-emerald-500 text-white shadow-emerald-200' :
                      service.status === 'waiting_payment' ? 'bg-amber-500 text-white shadow-amber-200' :
                      'bg-slate-100 text-slate-400 shadow-none cursor-default'
                    }`}
                  >
                    <PlayCircle className="w-5 h-5" />
                    <span className="text-xs uppercase tracking-wide truncate">
                      {service.status === 'pending' && 'Iniciar'}
                      {service.status === 'in_progress' && 'Finalizar'}
                      {service.status === 'waiting_payment' && 'Pagar'}
                      {service.status === 'completed' && 'Fim'}
                    </span>
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatusSelector({ status, onStatusChange, readOnly }: { status: Appointment['status'], onStatusChange: (newStatus: Appointment['status']) => void, readOnly?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  const configs = {
    confirmed: { color: 'text-emerald-500', bg: 'bg-emerald-50', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Confirmado' },
    pending: { color: 'text-amber-500', bg: 'bg-amber-50', icon: <Clock className="w-3 h-3" />, label: 'Pendente' },
    cancelled: { color: 'text-rose-500', bg: 'bg-rose-50', icon: <AlertCircle className="w-3 h-3" />, label: 'Cancelado' },
    completed: { color: 'text-blue-500', bg: 'bg-blue-50', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Finalizado' },
  };

  const config = configs[status];

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!readOnly) setIsOpen(!isOpen);
        }}
        disabled={readOnly}
        className={`flex items-center gap-1 ${config.color} ${config.bg} px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-current/10 ${!readOnly ? 'active:scale-95 transition-all' : 'cursor-default opacity-80'}`}
      >
        {config.icon}
        {config.label}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[110]" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-slate-100 z-[120] overflow-hidden"
            >
              {(Object.keys(configs) as Array<Appointment['status']>).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(s);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors ${
                    status === s ? configs[s].color : 'text-slate-500'
                  }`}
                >
                  {configs[s].icon}
                  {configs[s].label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
