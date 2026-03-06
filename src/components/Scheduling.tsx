/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  History,
  PlayCircle,
  Plus,
  User,
  WashingMachine,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Screen, Service, VehicleCategory, VehicleType, VehicleRegistration } from '../types';
import { Appointment } from '../services/api';
import { addDays, digitsOnly, formatCpf, generateId, getElapsedMinutes, getTodayDate, normalizeDateKey } from '../utils/app';

const TIME_SLOTS = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00'];
const ACTIVE_APPOINTMENT_STATUSES: Appointment['status'][] = ['confirmed', 'pending'];
const SLOT_LIMITS = {
  total: 5,
  truck: 2,
  other: 3,
};
const DEFAULT_SERVICE_IMAGE = 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=400&auto=format&fit=crop';

const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');
const isActiveAppointment = (appointment: Appointment) => ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status);
const isWeekendDate = (date: string) => {
  const weekDay = new Date(`${date}T12:00:00`).getDay();
  return weekDay === 0 || weekDay === 6;
};
const getNextBusinessDate = (date: string) => {
  let nextDate = date;
  while (isWeekendDate(nextDate)) {
    nextDate = addDays(nextDate, 1);
  }
  return nextDate;
};

const getVehicleTypeLabel = (type: VehicleType) => {
  if (type === 'motorcycle') return 'Moto';
  if (type === 'truck') return 'Caminhao';
  if (type === 'boat') return 'Embarcacao';
  return 'Carro';
};

const isTruckType = (type?: VehicleType) => type === 'truck';

const getServiceStartReference = (service: Service, currentDateKey: string) => {
  if (service.startTime) {
    return service.startTime;
  }

  if (service.scheduledDate && service.scheduledTime) {
    return `${service.scheduledDate}T${service.scheduledTime}:00`;
  }

  return `${currentDateKey}T00:00:00`;
};

export default function Scheduling({
  currentDateKey,
  appointments: appointmentsProp,
  onUpdateAppointments,
  onNavigate,
  services,
  onAddService,
  onReorder,
  serviceTypes,
  vehicleDb,
  selectedBaseId,
  selectedBaseName,
  onClearBase,
}: {
  currentDateKey: string;
  appointments: Appointment[];
  onUpdateAppointments: (appointments: Appointment[]) => Promise<void> | void;
  onNavigate: (screen: Screen, serviceId?: string) => void;
  services: Service[];
  onAddService: (service: Service) => Promise<void> | void;
  onReorder: (newServices: Service[]) => Promise<void> | void;
  serviceTypes: Record<VehicleType, VehicleCategory>;
  vehicleDb?: VehicleRegistration[];
  selectedBaseId?: string | null;
  selectedBaseName?: string | null;
  onClearBase?: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>(appointmentsProp);
  const [filterDate, setFilterDate] = useState(currentDateKey);
  const [appointmentDate, setAppointmentDate] = useState(getNextBusinessDate(currentDateKey));
  const [activeTab, setActiveTab] = useState<'appointments' | 'waiting' | 'washing' | 'completed'>('appointments');
  const [clockNow, setClockNow] = useState(() => Date.now());

  const [plate, setPlate] = useState('');
  const [customer, setCustomer] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isThirdParty, setIsThirdParty] = useState(false);
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyCpf, setThirdPartyCpf] = useState('');
  const [isVehicleFound, setIsVehicleFound] = useState(false);

  const resetAppointmentForm = () => {
    setIsAdding(false);
    setAppointmentDate(getNextBusinessDate(currentDateKey));
    setSelectedTime(null);
    setPlate('');
    setCustomer('');
    setVehicleModel('');
    setVehicleType('car');
    setIsThirdParty(false);
    setThirdPartyName('');
    setThirdPartyCpf('');
    setIsVehicleFound(false);
  };

  useEffect(() => {
    setSelectedTime(null);
  }, [appointmentDate]);

  useEffect(() => {
    setAppointments(appointmentsProp);
  }, [appointmentsProp]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockNow(Date.now());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  const pendingAppointmentsForDate = appointments.filter(appointment => {
    const relatedService = services.find(service => service.id === appointment.id);
    return normalizeDateKey(appointment.date) === filterDate && isActiveAppointment(appointment) && (!relatedService || relatedService.status === 'pending');
  });

  const waitingServices = services.filter(service => service.status === 'pending' && normalizeDateKey(service.scheduledDate) === currentDateKey);
  const washingServices = services.filter(service => service.status === 'in_progress' && normalizeDateKey(service.scheduledDate) === currentDateKey);
  const completedServices = services.filter(
    service => (service.status === 'waiting_payment' || service.status === 'completed') && normalizeDateKey(service.scheduledDate) === currentDateKey
  );

  const timers = Object.fromEntries(
    services.map(service => [
      service.id,
      getElapsedMinutes(getServiceStartReference(service, currentDateKey), clockNow),
    ])
  );

  const nextDays = Array.from({ length: 7 }, (_, index) => addDays(currentDateKey, index));
  const isDateInNextDays = nextDays.includes(filterDate);
  const isPastDate = filterDate < currentDateKey;

  const handlePlateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextPlate = event.target.value.toUpperCase();
    setPlate(nextPlate);

    const matchedVehicle = vehicleDb?.find(vehicle => normalizePlate(vehicle.plate) === normalizePlate(nextPlate));

    if (!matchedVehicle) {
      setIsVehicleFound(false);
      setCustomer('');
      setVehicleModel('');
      setVehicleType('car');
      setIsThirdParty(false);
      setThirdPartyName('');
      setThirdPartyCpf('');
      return;
    }

    setIsVehicleFound(true);
    setCustomer(matchedVehicle.customer);
    setVehicleModel(matchedVehicle.model);
    setVehicleType(matchedVehicle.type);

    if (matchedVehicle.thirdPartyName || matchedVehicle.thirdPartyCpf) {
      setIsThirdParty(true);
      setThirdPartyName(matchedVehicle.thirdPartyName || '');
      setThirdPartyCpf(matchedVehicle.thirdPartyCpf || '');
    } else {
      setIsThirdParty(false);
      setThirdPartyName('');
      setThirdPartyCpf('');
    }
  };

  const handleAction = (service: Service) => {
    if (service.status === 'pending') {
      onNavigate('inspection-pre', service.id);
      return;
    }

    if (service.status === 'in_progress') {
      onNavigate('inspection-post', service.id);
      return;
    }

    if (service.status === 'waiting_payment') {
      onNavigate('payment', service.id);
    }
  };

  const moveService = async (id: string, direction: 'up' | 'down') => {
    const index = services.findIndex(service => service.id === id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= services.length) return;
    if (services[index].status !== services[targetIndex].status) return;

    const nextServices = [...services];
    const [moved] = nextServices.splice(index, 1);
    nextServices.splice(targetIndex, 0, moved);
    try {
      await onReorder(nextServices);
    } catch (error) {
      console.error(error);
    }
  };

  const handleStatusChange = async (id: string, newStatus: Appointment['status']) => {
    const nextAppointments = appointments.map(appointment =>
      appointment.id === id ? { ...appointment, status: newStatus } : appointment
    );
    setAppointments(nextAppointments);
    try {
      await onUpdateAppointments(nextAppointments);
    } catch (error) {
      console.error(error);
    }
  };

  const resolveAppointmentVehicleType = (appointment: Appointment): VehicleType => {
    if (appointment.vehicleType) {
      return appointment.vehicleType;
    }

    return vehicleDb?.find(vehicle => normalizePlate(vehicle.plate) === normalizePlate(appointment.plate))?.type || 'car';
  };

  const getSlotStatus = (date: string, time: string, nextVehicleType?: VehicleType) => {
    const sameSlotAppointments = appointments.filter(
      appointment => normalizeDateKey(appointment.date) === date && appointment.time === time && isActiveAppointment(appointment)
    );
    const truckCount = sameSlotAppointments.filter(appointment => isTruckType(resolveAppointmentVehicleType(appointment))).length;
    const otherCount = sameSlotAppointments.length - truckCount;
    const totalCount = sameSlotAppointments.length;
    const nextIsTruck = isTruckType(nextVehicleType);
    const isFull =
      totalCount >= SLOT_LIMITS.total ||
      (nextVehicleType
        ? nextIsTruck
          ? truckCount >= SLOT_LIMITS.truck
          : otherCount >= SLOT_LIMITS.other
        : false);

    const todayStr = getTodayDate();
    const isPastSlotDate = date < todayStr;

    return {
      count: totalCount,
      truckCount,
      otherCount,
      isFull,
      isPast: isPastSlotDate,
    };
  };

  const handleAddAppointment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isVehicleFound) {
      alert('Cadastre a placa na base de veiculos antes de criar o agendamento.');
      return;
    }

    if (!selectedTime) {
      alert('Selecione um horario.');
      return;
    }

    if (isWeekendDate(appointmentDate)) {
      alert('Nao trabalhamos aos finais de semana. Selecione um dia util.');
      return;
    }

    const duplicatePlateInSlot = appointments.some(
      appointment =>
        normalizePlate(appointment.plate) === normalizePlate(plate) &&
        normalizeDateKey(appointment.date) === appointmentDate &&
        appointment.time === selectedTime &&
        isActiveAppointment(appointment)
    );

    if (duplicatePlateInSlot) {
      alert('Ja existe um agendamento para esta placa neste mesmo horario.');
      return;
    }

    const { isFull, isPast } = getSlotStatus(appointmentDate, selectedTime, vehicleType);
    if (isFull) {
      alert('Este horario esta lotado.');
      return;
    }

    if (isPast) {
      alert('Nao e possivel agendar em horarios passados.');
      return;
    }

    const formData = new FormData(event.target as HTMLFormElement);
    const selectedService = formData.get('service') as string;

    const newAppointment: Appointment = {
      id: generateId(),
      customer,
      vehicle: vehicleModel,
      plate,
      vehicleType,
      service: selectedService,
      date: appointmentDate,
      time: selectedTime,
      status: 'confirmed',
      thirdPartyName: isThirdParty ? thirdPartyName : undefined,
      thirdPartyCpf: isThirdParty ? digitsOnly(thirdPartyCpf) : undefined,
    };

    const newService: Service = {
      id: newAppointment.id,
      plate: newAppointment.plate,
      model: newAppointment.vehicle,
      type: newAppointment.service,
      baseId: selectedBaseId || undefined,
      baseName: selectedBaseName || undefined,
      scheduledDate: newAppointment.date,
      scheduledTime: newAppointment.time,
      status: 'pending',
      price: serviceTypes[vehicleType].services.find(service => service.label === newAppointment.service)?.price || 0,
      customer: newAppointment.customer,
      thirdPartyName: newAppointment.thirdPartyName,
      thirdPartyCpf: newAppointment.thirdPartyCpf,
      image: DEFAULT_SERVICE_IMAGE,
      timeline: {
        createdAt: new Date().toISOString(),
      },
    };

    const nextAppointments = [...appointments, newAppointment];
    setAppointments(nextAppointments);

    try {
      await onUpdateAppointments(nextAppointments);
      await onAddService(newService);
      setFilterDate(appointmentDate);
      setActiveTab(appointmentDate === currentDateKey ? 'waiting' : 'appointments');
      alert('Agendamento realizado com sucesso.');
      resetAppointmentForm();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Nao foi possivel salvar o agendamento.');
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-white pb-24">
      <div className="px-4 pt-6 pb-2 flex justify-between items-center">
        <button
          onClick={() => onClearBase?.()}
          className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-sm"
        >
          <ChevronLeft className="w-5 h-5" />
          Voltar
        </button>
        {!isPastDate && (
          <button
            onClick={() => {
              resetAppointmentForm();
              setIsAdding(true);
            }}
            className="bg-primary text-white p-3 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-transform"
          >
            <Plus className="w-7 h-7" />
          </button>
        )}
      </div>

      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="flex px-4 gap-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`flex flex-col items-center justify-center border-b-4 pb-3 pt-4 transition-all active:scale-95 shrink-0 ${activeTab === 'appointments' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            <p className="text-sm font-bold">Agendamentos ({pendingAppointmentsForDate.length})</p>
          </button>
          <button
            onClick={() => setActiveTab('waiting')}
            className={`flex flex-col items-center justify-center border-b-4 pb-3 pt-4 transition-all active:scale-95 shrink-0 ${activeTab === 'waiting' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            <p className="text-sm font-bold">Aguardando ({waitingServices.length})</p>
          </button>
          <button
            onClick={() => setActiveTab('washing')}
            className={`flex flex-col items-center justify-center border-b-4 pb-3 pt-4 transition-all active:scale-95 shrink-0 ${activeTab === 'washing' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            <p className="text-sm font-bold">Em Lavagem ({washingServices.length})</p>
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex flex-col items-center justify-center border-b-4 pb-3 pt-4 transition-all active:scale-95 shrink-0 ${activeTab === 'completed' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}
          >
            <p className="text-sm font-bold">Concluido ({completedServices.length})</p>
          </button>
        </div>
      </nav>

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
                  {new Date(`${filterDate}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })}
                </span>
                <span className="text-xl font-black">{new Date(`${filterDate}T00:00:00`).getDate()}</span>
              </>
            ) : (
              <>
                <CalendarIcon className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Outro</span>
              </>
            )}
          </button>

          {nextDays.map((date, index) => (
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
                {index === 0 ? 'Hoje' : new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short' })}
              </span>
              <span className="text-xl font-black">
                {index === 0
                  ? new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  : new Date(`${date}T00:00:00`).getDate()}
              </span>
            </button>
          ))}
        </div>
      )}

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
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Horarios agendados</h3>
                <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-1 rounded-full uppercase border border-primary/10">
                  {pendingAppointmentsForDate.length} Servicos
                </span>
              </div>

              {pendingAppointmentsForDate.map((appointment, index) => (
                <motion.div
                  key={appointment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onNavigate('customer-history', appointment.id)}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex gap-4 items-center group cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl min-w-[75px] h-[75px] border border-slate-100 overflow-hidden relative">
                    {appointment.photo ? (
                      <img src={appointment.photo} alt="Veiculo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-primary mb-1" />
                        <span className="text-base font-black text-slate-900 tracking-tight">{appointment.time}</span>
                      </>
                    )}
                    {appointment.photo && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 flex justify-center">
                        <span className="text-[9px] font-black text-white">{appointment.time}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-slate-900 truncate text-base">{appointment.customer}</h4>
                      <StatusSelector
                        status={isPastDate ? 'completed' : appointment.status}
                        onStatusChange={newStatus => handleStatusChange(appointment.id, newStatus)}
                        readOnly
                      />
                    </div>

                    {appointment.thirdPartyName && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <p className="text-[10px] text-slate-500 font-medium">
                          Terceiro: <span className="font-bold text-slate-700">{appointment.thirdPartyName}</span>
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      <Car className="w-3 h-3 text-slate-400" />
                      <p className="text-xs text-slate-500 truncate font-medium">
                        {appointment.vehicle} • <span className="font-bold text-slate-900">{appointment.plate}</span>
                      </p>
                    </div>

                    <div className="mt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/5">
                        {appointment.service}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                </motion.div>
              ))}

              {pendingAppointmentsForDate.length === 0 && (
                <div className="py-12 text-center space-y-3">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                    <CalendarIcon className="w-8 h-8" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">Nenhum agendamento para este dia.</p>
                  {!isPastDate && (
                    <button
                      onClick={() => {
                        resetAppointmentForm();
                        setIsAdding(true);
                      }}
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
            <motion.div key="waiting-tab" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <QueueSection title="Aguardando" services={waitingServices} timers={timers} onAction={handleAction} onMove={moveService} />
            </motion.div>
          )}

          {activeTab === 'washing' && (
            <motion.div key="washing-tab" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <QueueSection title="Em Lavagem" services={washingServices} timers={timers} onAction={handleAction} onMove={moveService} />
            </motion.div>
          )}

          {activeTab === 'completed' && (
            <motion.div key="completed-tab" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <QueueSection title="Concluido" services={completedServices} timers={timers} onAction={handleAction} onMove={moveService} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center p-4"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-[400px] rounded-t-[32px] p-6 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">Novo Agendamento</h3>
                <button onClick={resetAppointmentForm} className="text-slate-400 hover:text-slate-600 font-bold">
                  Fechar
                </button>
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
                </div>

                {plate && !isVehicleFound && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-700">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-bold text-sm">Placa nao cadastrada</span>
                    </div>
                    <p className="text-xs font-medium leading-relaxed">
                      Centro de custo, veiculo e tipo so aparecem automaticamente para placas ja cadastradas.
                    </p>
                  </div>
                )}

                {isVehicleFound && (
                  <>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-600 mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-bold text-sm">Veiculo encontrado</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">Centro de Custo</p>
                          <p className="font-bold text-emerald-900">{customer}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">Veiculo</p>
                          <p className="font-bold text-emerald-900">{vehicleModel}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">Tipo de Veiculo</p>
                          <p className="font-bold text-emerald-900">{getVehicleTypeLabel(vehicleType)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">Placa Base</p>
                          <p className="font-bold text-emerald-900">{plate}</p>
                        </div>
                      </div>

                      {isThirdParty && (
                        <div className="pt-3 border-t border-emerald-200/50">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 mb-1">Dados do Terceiro</p>
                          <p className="font-bold text-emerald-900 text-sm">
                            {thirdPartyName}
                            {thirdPartyCpf && <span className="text-emerald-700 font-medium ml-2">{formatCpf(thirdPartyCpf)}</span>}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Data</label>
                        <input
                          name="date"
                          type="date"
                          value={appointmentDate}
                          min={currentDateKey}
                          onChange={event => {
                            const nextDate = event.target.value;
                            if (isWeekendDate(nextDate)) {
                              alert('Nao trabalhamos aos finais de semana. Selecione um dia util.');
                              return;
                            }
                            setAppointmentDate(nextDate);
                          }}
                          className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none text-slate-900"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Hora</label>
                        <div className="grid grid-cols-3 gap-2">
                          {TIME_SLOTS.map(time => {
                            const { isFull, isPast, count, truckCount, otherCount } = getSlotStatus(appointmentDate, time, vehicleType);
                            const isSelected = selectedTime === time;

                            return (
                              <button
                                key={time}
                                type="button"
                                onClick={() => {
                                  if (isWeekendDate(appointmentDate)) {
                                    alert('Nao trabalhamos aos finais de semana. Selecione um dia util.');
                                    return;
                                  }

                                  if (isFull) {
                                    alert(
                                      vehicleType === 'truck'
                                        ? 'Horario sem vaga para caminhao. Limite: 2 caminhoes e 5 veiculos no total por horario.'
                                        : 'Horario sem vaga para este tipo de veiculo. Limite: 3 veiculos leves e 5 veiculos no total por horario.'
                                    );
                                    return;
                                  }

                                  if (isPast) {
                                    alert('Nao e possivel agendar em horarios passados.');
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
                                <span className="block">{time}</span>
                                <span className="block text-[8px] font-medium opacity-70">C{truckCount}/2 O{otherCount}/3</span>
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

                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Capacidade por horario: 2 caminhoes, 3 outros veiculos, 5 vagas totais.
                    </div>

                    {isWeekendDate(appointmentDate) && (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                        Nao trabalhamos aos finais de semana. Selecione um dia util para concluir o agendamento.
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Servico</label>
                      <select
                        name="service"
                        className="w-full h-14 px-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-primary outline-none appearance-none text-slate-900"
                      >
                        {serviceTypes[vehicleType].services.map(service => (
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
                  </>
                )}
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

function CalendarModal({
  isOpen,
  onClose,
  onSelect,
  selectedDate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  selectedDate: string;
}) {
  const [currentDate, setCurrentDate] = useState(new Date(`${selectedDate}T00:00:00`));

  useEffect(() => {
    if (isOpen) {
      setCurrentDate(new Date(`${selectedDate}T00:00:00`));
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
    const safeDay = String(day).padStart(2, '0');
    onSelect(`${year}-${month}-${safeDay}`);
    onClose();
  };

  const months = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
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
          {Array.from({ length: firstDay }).map((_, index) => (
            <div key={`empty-${index}`} />
          ))}
          {Array.from({ length: days }).map((_, index) => {
            const day = index + 1;
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isPast = new Date(dateStr) < new Date(new Date().setHours(0, 0, 0, 0));

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
  onMove,
}: {
  title: string;
  services: Service[];
  timers: Record<string, number>;
  onAction: (service: Service) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</h3>
        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase border border-slate-100">
          {services.length} Veiculos
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {services.length === 0 ? (
            <div className="col-span-full py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
              <p className="text-xs text-slate-400 font-medium">Nenhum veiculo nesta etapa</p>
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
                  {service.image ? (
                    <img alt={service.model} className="w-full h-full object-cover" src={service.image} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Car className="w-10 h-10" />
                    </div>
                  )}

                  {title === 'Aguardando' && (
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
                      <button
                        onClick={event => {
                          event.stopPropagation();
                          onMove(service.id, 'up');
                        }}
                        className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all disabled:opacity-30"
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4 text-slate-600" />
                      </button>
                      <button
                        onClick={event => {
                          event.stopPropagation();
                          onMove(service.id, 'down');
                        }}
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
                        <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">Servico</p>
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
                      service.status === 'pending'
                        ? 'bg-primary text-white shadow-primary/20'
                        : service.status === 'in_progress'
                          ? 'bg-emerald-500 text-white shadow-emerald-200'
                          : service.status === 'waiting_payment'
                            ? 'bg-amber-500 text-white shadow-amber-200'
                            : 'bg-slate-100 text-slate-400 shadow-none cursor-default'
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

function StatusSelector({
  status,
  onStatusChange,
  readOnly,
}: {
  status: Appointment['status'];
  onStatusChange: (newStatus: Appointment['status']) => void;
  readOnly?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const configs = {
    confirmed: { color: 'text-emerald-500', bg: 'bg-emerald-50', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Confirmado' },
    pending: { color: 'text-amber-500', bg: 'bg-amber-50', icon: <Clock className="w-3 h-3" />, label: 'Pendente' },
    cancelled: { color: 'text-rose-500', bg: 'bg-rose-50', icon: <AlertCircle className="w-3 h-3" />, label: 'Cancelado' },
    completed: { color: 'text-blue-500', bg: 'bg-blue-50', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Finalizado' },
    no_show: { color: 'text-rose-500', bg: 'bg-rose-50', icon: <AlertCircle className="w-3 h-3" />, label: 'Nao compareceu' },
  };

  const config = configs[status];

  return (
    <div className="relative">
      <button
        onClick={event => {
          event.stopPropagation();
          if (!readOnly) {
            setIsOpen(!isOpen);
          }
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
              {(Object.keys(configs) as Array<Appointment['status']>).map(nextStatus => (
                <button
                  key={nextStatus}
                  type="button"
                  onClick={event => {
                    event.stopPropagation();
                    onStatusChange(nextStatus);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors ${
                    status === nextStatus ? configs[nextStatus].color : 'text-slate-500'
                  }`}
                >
                  {configs[nextStatus].icon}
                  {configs[nextStatus].label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
