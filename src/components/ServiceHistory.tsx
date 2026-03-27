import React, { useEffect, useState } from 'react';
import { ChevronLeft, Clock, CreditCard, User, Car, MapPin, CheckCircle2 } from 'lucide-react';
import { Screen, Service } from '../types';
import { formatElapsedMinutes, getDurationMinutes, getElapsedMinutes, getServicePreviewImage } from '../utils/app';

const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('pt-BR') : 'Nao registrado';

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

  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockNow(Date.now());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  const waitingStart = service.timeline?.checkInAt || service.timeline?.createdAt;
  const waitingEnd = service.timeline?.washStartedAt || service.startTime || service.timeline?.noShowAt;
  const washStart = service.timeline?.washStartedAt || service.startTime;
  const washEnd = service.timeline?.washCompletedAt || service.endTime;
  const paymentStart = service.timeline?.paymentStartedAt || service.timeline?.washCompletedAt || service.endTime;
  const paymentEnd = service.timeline?.paymentCompletedAt || service.timeline?.completedAt;
  const totalStart = service.timeline?.checkInAt || service.timeline?.createdAt || service.timeline?.washStartedAt || service.startTime;
  const totalEnd = service.timeline?.completedAt || service.timeline?.noShowAt || service.timeline?.paymentCompletedAt || service.timeline?.washCompletedAt || service.endTime;

  const waitingMinutes = service.status === 'pending'
    ? getElapsedMinutes(waitingStart, clockNow)
    : getDurationMinutes(waitingStart, waitingEnd);
  const washMinutes = service.status === 'in_progress'
    ? getElapsedMinutes(washStart, clockNow)
    : getDurationMinutes(washStart, washEnd);
  const paymentMinutes = service.status === 'waiting_payment'
    ? getElapsedMinutes(paymentStart, clockNow)
    : getDurationMinutes(paymentStart, paymentEnd);
  const totalMinutes = ['completed', 'no_show'].includes(service.status)
    ? getDurationMinutes(
        totalStart,
        totalEnd
      )
    : getElapsedMinutes(totalStart, clockNow);

  const timelineRows = [
    { label: 'Criado', value: service.timeline?.createdAt || service.timeline?.checkInAt },
    { label: 'Entrada / fila', value: waitingStart },
    { label: 'Inspecao pre iniciada', value: service.timeline?.preInspectionStartedAt },
    { label: 'Lavagem iniciada', value: washStart },
    { label: 'Lavagem concluida', value: washEnd },
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tempo de espera</p>
            </div>
            <p className="text-lg font-black text-slate-900">{waitingMinutes ? formatElapsedMinutes(waitingMinutes) : 'Nao registrado'}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tempo de lavagem</p>
            </div>
            <p className="text-lg font-black text-slate-900">{washMinutes ? formatElapsedMinutes(washMinutes) : 'Nao registrado'}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tempo de pagamento</p>
            </div>
            <p className="text-lg font-black text-slate-900">{paymentMinutes ? formatElapsedMinutes(paymentMinutes) : 'Nao registrado'}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tempo total</p>
            </div>
            <p className="text-lg font-black text-primary">{totalMinutes ? formatElapsedMinutes(totalMinutes) : 'Nao registrado'}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm col-span-2">
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

        <PhotoSection
          title="Fotos da inspecao pre"
          photos={service.preInspectionPhotos}
          fallbackImage={getServicePreviewImage(service)}
          allowFallback={!service.postInspectionPhotos || Object.keys(service.postInspectionPhotos).length === 0}
        />
        <PhotoSection
          title="Fotos da inspecao pos"
          photos={service.postInspectionPhotos}
          fallbackImage={getServicePreviewImage(service)}
          allowFallback={['waiting_payment', 'completed'].includes(service.status)}
        />
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

function PhotoSection({
  title,
  photos,
  fallbackImage,
  allowFallback = false,
}: {
  title: string;
  photos?: Record<string, string>;
  fallbackImage?: string;
  allowFallback?: boolean;
}) {
  const entries = Object.entries(photos || {}).filter(([, value]) => !!value);
  const resolvedEntries = entries.length || !allowFallback || !fallbackImage
    ? entries
    : [['front', fallbackImage] as const];

  if (!resolvedEntries.length) {
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
        {resolvedEntries.map(([key, value]) => (
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
