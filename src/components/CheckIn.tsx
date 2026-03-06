/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Info, ChevronDown, Car, PlayCircle, Camera, Calendar, X, Zap, Truck, Bike, Ship } from 'lucide-react';
import { Screen, Service, VehicleCategory, VehicleType, VehicleRegistration } from '../types';

export default function CheckIn({ 
  onNavigate, 
  onAddService, 
  serviceTypes,
  vehicleDb
}: { 
  onNavigate: (screen: Screen) => void, 
  onAddService: (service: Service) => void, 
  serviceTypes: Record<VehicleType, VehicleCategory>,
  vehicleDb?: VehicleRegistration[]
}) {
  const [plate, setPlate] = useState('');
  const [customer, setCustomer] = useState('');
  const [model, setModel] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [washType, setWashType] = useState('simple');
  const [isPriority, setIsPriority] = useState(false);
  const [observations, setObservations] = useState('');
  const [isThirdParty, setIsThirdParty] = useState(false);
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyCpf, setThirdPartyCpf] = useState('');

  const currentServices = serviceTypes[vehicleType].services;
  const selectedService = currentServices.find(s => s.id === washType) || currentServices[0];

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPlate = e.target.value.toUpperCase();
    setPlate(newPlate);
    
    if (vehicleDb) {
      const vehicle = vehicleDb.find(v => v.plate === newPlate);
      if (vehicle) {
        setCustomer(vehicle.customer);
        setModel(vehicle.model);
        setVehicleType(vehicle.type);
      }
    }
  };

  const handleStartCheckIn = () => {
    if (!plate || !model) {
      alert('Por favor, preencha a placa e o modelo do veículo.');
      return;
    }

    const newService: Service = {
      id: Math.random().toString(36).substr(2, 9),
      plate: plate.toUpperCase(),
      model: model,
      type: selectedService.label,
      status: 'pending',
      price: selectedService.price + (isPriority ? 20 : 0),
      priority: isPriority,
      customer: customer || 'Cliente Particular',
      thirdPartyName: isThirdParty ? thirdPartyName : undefined,
      thirdPartyCpf: isThirdParty ? thirdPartyCpf : undefined,
      observations: observations,
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      image: 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&q=80&w=400'
    };

    onAddService(newService);
    onNavigate('queue');
  };

  return (
    <div className="p-4 space-y-6 bg-white min-h-full transition-colors">
      {/* Plate Input */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Placa do Veículo</label>
        <div className="flex w-full items-stretch rounded-2xl overflow-hidden border border-slate-200 bg-white focus-within:border-primary transition-all shadow-sm">
          <input 
            className="flex w-full min-w-0 flex-1 border-none bg-transparent h-16 px-5 text-2xl font-black tracking-widest placeholder:text-slate-300 focus:ring-0 uppercase text-slate-900" 
            placeholder="BRA2E19" 
            type="text" 
            value={plate}
            onChange={handlePlateChange}
          />
          <button 
            onClick={() => alert('Buscando placa nos sistemas do DETRAN...')}
            className="bg-primary text-white px-6 flex items-center justify-center hover:bg-blue-600 active:bg-blue-700 active:scale-95 transition-all"
          >
            <Search className="w-6 h-6" />
          </button>
        </div>
        <p className="text-[10px] text-primary font-bold ml-1 flex items-center gap-1 uppercase tracking-tight">
          <Info className="w-3 h-3" />
          Busca automática habilitada
        </p>
      </div>

      {/* Customer Select */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center ml-1">
          <label className="text-sm font-bold text-slate-600 uppercase tracking-wider">Cliente / Contrato</label>
          <button 
            onClick={() => onNavigate('customer-history')}
            className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline active:scale-95 transition-transform"
          >
            Ver Histórico
          </button>
        </div>
        <div className="relative">
          <input 
            type="text"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Nome do Cliente"
            className="w-full rounded-2xl border border-slate-200 bg-white h-16 px-5 text-slate-900 font-bold focus:border-primary focus:ring-0 transition-all shadow-sm"
          />
        </div>

        <label className="flex items-center gap-2 mt-2 ml-1 cursor-pointer">
          <input 
            type="checkbox" 
            checked={isThirdParty}
            onChange={(e) => setIsThirdParty(e.target.checked)}
            className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
          />
          <span className="text-sm font-bold text-slate-600">Lavagem para Terceiro</span>
        </label>

        {isThirdParty && (
          <div className="grid grid-cols-2 gap-3 mt-2">
            <input 
              type="text"
              value={thirdPartyName}
              onChange={(e) => setThirdPartyName(e.target.value)}
              placeholder="Nome do Terceiro"
              className="w-full rounded-xl border border-slate-200 bg-white h-12 px-4 text-slate-900 font-medium focus:border-primary focus:ring-0 transition-all shadow-sm text-sm"
            />
            <input 
              type="text"
              value={thirdPartyCpf}
              onChange={(e) => setThirdPartyCpf(e.target.value)}
              placeholder="CPF do Terceiro"
              className="w-full rounded-xl border border-slate-200 bg-white h-12 px-4 text-slate-900 font-medium focus:border-primary focus:ring-0 transition-all shadow-sm text-sm"
            />
          </div>
        )}
      </div>

      {/* Model Select */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Modelo do Carro</label>
        <div className="relative">
          <input 
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Ex: Corolla"
            className="w-full rounded-2xl border border-slate-200 bg-white h-16 px-5 text-slate-900 font-bold focus:border-primary focus:ring-0 transition-all shadow-sm"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-slate-400">
            <Car className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Vehicle Type */}
      <div className="flex flex-col gap-3">
        <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Tipo de Veículo</label>
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => { setVehicleType('car'); setWashType('simple'); }}
            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all active:scale-95 ${
              vehicleType === 'car' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <Car className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Carro</span>
          </button>
          <button
            onClick={() => { setVehicleType('motorcycle'); setWashType('simple'); }}
            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all active:scale-95 ${
              vehicleType === 'motorcycle' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <Bike className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Moto</span>
          </button>
          <button
            onClick={() => { setVehicleType('truck'); setWashType('simple'); }}
            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all active:scale-95 ${
              vehicleType === 'truck' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <Truck className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Caminhão</span>
          </button>
          <button
            onClick={() => { setVehicleType('boat'); setWashType('simple'); }}
            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all active:scale-95 ${
              vehicleType === 'boat' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <Ship className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Lancha</span>
          </button>
        </div>
      </div>

      {/* Wash Type */}
      <div className="flex flex-col gap-3">
        <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Tipo de Lavagem</label>
        {serviceTypes[vehicleType].services.map((service) => (
          <WashOption 
            key={service.id}
            id={service.id} 
            name="wash_type" 
            label={service.label} 
            price={`R$ ${service.price},00`} 
            description={service.id === 'simple' ? "Lavagem externa básica." : "Lavagem completa e detalhada."} 
            checked={washType === service.id}
            onChange={() => setWashType(service.id)}
          />
        ))}
      </div>

      {/* Observations */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-slate-600 ml-1 uppercase tracking-wider">Observações</label>
        <textarea 
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Ex: Cuidado com o retrovisor esquerdo, cliente solicitou limpeza extra nos tapetes..."
          className="w-full min-h-[120px] rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 font-medium focus:border-primary focus:ring-0 transition-all shadow-sm resize-none placeholder:text-slate-300"
        />
      </div>

      {/* Priority Toggle */}
      <div className="flex items-center justify-between p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isPriority ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
            <Zap className={`w-5 h-5 ${isPriority ? 'fill-amber-500' : ''}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Serviço Prioritário</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">Fura-fila (+ R$ 20,00)</p>
          </div>
        </div>
        <button 
          onClick={() => setIsPriority(!isPriority)}
          className={`w-12 h-6 rounded-full transition-all relative ${isPriority ? 'bg-primary' : 'bg-slate-200'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPriority ? 'left-7' : 'left-1'}`} />
        </button>
      </div>

      {/* Action Button */}
      <div className="pt-4 pb-12">
        <button 
          onClick={handleStartCheckIn}
          className="w-full bg-primary hover:bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
        >
          <span>Iniciar Check-in</span>
          <PlayCircle className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

const WashOption: React.FC<{ id: string, name: string, label: string, price: string, description: string, checked: boolean, onChange: () => void }> = ({ id, name, label, price, description, checked, onChange }) => {
  return (
    <label className={`relative flex items-center p-5 rounded-2xl border transition-all cursor-pointer active:scale-[0.98] ${
      checked ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-slate-200 bg-white'
    }`}>
      <input className="hidden" name={name} type="radio" checked={checked} onChange={onChange} />
      <div className="flex-1 pr-2">
        <div className="flex justify-between items-center">
          <span className="font-black text-slate-900 text-lg tracking-tight">{label}</span>
          <span className="text-primary font-black">{price}</span>
        </div>
        <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">{description}</p>
      </div>
    </label>
  );
};
