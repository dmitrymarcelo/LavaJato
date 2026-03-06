import React from 'react';
import { ChevronLeft, Clock, CreditCard, User, Car, MapPin, CheckCircle2 } from 'lucide-react';
import { Screen, Service } from '../types';
import { formatElapsedMinutes } from '../utils/app';

const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('pt-BR') : 'Nao registrado';

const getDurationMinutes = (start?: string, end?: string) => {
  if (!start || !end) return 0;

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
    return 0;
  }

  return Math.floor((endMs - startMs) / 60000);
};

export default function ServiceHistory({
  onNavigate,
  service,
}: {
  onNavigate: (screen: Screen, serviceId?: string) => void;
  service?: Service | null;
}) {
  if (!service) {
    return (
      <div className="min-h-full bg-white p-4">
        <button
          onClick={() => onNavigate('dashboard')}
          className="mb-4 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-sm"
        >
          <ChevronLeft className="w-5 h-5" />
          Voltar
        </button>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-400 font-medium">
          Nenhum servico selecionado para historico.
        </div>
      </div>
    );
  }

  const washMinutes = getDurationMinutes(service.startTime, service.endTime);
  const timelineRows = [
    { label: 'Criado', value: service.timeline?.createdAt || service.timeline?.checkInAt },
    { label: 'Inspecao pre iniciada', value: service.timeline?.preInspectionStartedAt },
    { label: 'Lavagem iniciada', value: service.timeline?.washStartedAt || service.startTime },
    { label: 'Lavagem concluida', value: service.timeline?.washCompletedAt || service.endTime },
    { label: 'Inspecao pos concluida', value: service.timeline?.postInspectionCompletedAt },
    { label: 'Pagamento iniciado', value: service.timeline?.paymentStartedAt },
    { label: 'Pagamento concluido', value: service.timeline?.paymentCompletedAt },
    { label: 'Servico finalizado', value: service.timeline?.completedAt },
    { label: 'Nao comparecimento', value: service.timeline?.noShowAt },
  ];

  return (
    <div className="flex flex-col min-h-full pb-24 bg-white">
      <section className="p-4 space-y-4">
        <button
          onClick={() => onNavigate('customer-history', service.id)}
          className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-sm"
        >
          <ChevronLeft className="w-5 h-5" />
          Voltar
        </button>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Historico do servico</p>
              <h2 className="text-xl font-black text-slate-900">{service.model}</h2>
              <p className="text-sm font-medium text-slate-500">{service.type}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Status</p>
              <p className="text-sm font-black text-emerald-700">{service.status === 'completed' ? 'Finalizado' : service.status === 'no_show' ? 'Nao compareceu' : 'Em andamento'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InfoCard icon={<Car className="w-4 h-4 text-slate-400" />} label="Placa" value={service.plate} />
            <InfoCard icon={<User className="w-4 h-4 text-slate-400" />} label="Cliente" value={service.customer} />
            <InfoCard icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Base" value={service.baseName || 'Nao informada'} />
            <InfoCard icon={<CreditCard className="w-4 h-4 text-slate-400" />} label="Valor" value={`R$ ${service.price.toFixed(2)}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tempo de lavagem</p>
            </div>
            <p className="text-lg font-black text-slate-900">{washMinutes ? formatElapsedMinutes(washMinutes) : 'Nao medido'}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Responsaveis</p>
            </div>
            <p className="text-sm font-black text-slate-900">{service.washers?.length ? service.washers.join(', ') : 'Nao definido'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-lg font-black text-slate-900">Linha do tempo</h3>
            <p className="text-xs text-slate-500 mt-1">Todos os marcos registrados do servico ate a finalizacao.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {timelineRows.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 p-4">
                <p className="text-sm font-bold text-slate-700">{item.label}</p>
                <p className="text-sm text-slate-500 text-right">{formatDateTime(item.value)}</p>
              </div>
            ))}
          </div>
        </div>

        <PhotoSection title="Fotos da inspecao pre" photos={service.preInspectionPhotos} />
        <PhotoSection title="Fotos da inspecao pos" photos={service.postInspectionPhotos} />
      </section>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <p className="text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function PhotoSection({ title, photos }: { title: string; photos?: Record<string, string> }) {
  const entries = Object.entries(photos || {}).filter(([, value]) => !!value);

  if (!entries.length) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
        {title}: nenhuma foto registrada.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        {entries.map(([key, value]) => (
          <div key={key} className="space-y-2">
            <div className="aspect-square rounded-2xl overflow-hidden border border-slate-100 bg-slate-100">
              <img src={value} alt={key} className="w-full h-full object-cover" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{key}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
