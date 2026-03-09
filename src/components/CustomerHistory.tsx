import React from 'react';
import { ChevronLeft, Calendar, Car, Clock } from 'lucide-react';
import { Screen, Service } from '../types';
import { formatElapsedMinutes, getDurationMinutes } from '../utils/app';

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString('pt-BR') : 'Nao registrado');

export default function CustomerHistory({
  onNavigate,
  selectedService,
  services,
}: {
  onNavigate: (screen: Screen, serviceId?: string) => void;
  selectedService?: Service | null;
  services: Service[];
}) {
  if (!selectedService) {
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
          Nenhum veiculo selecionado para historico.
        </div>
      </div>
    );
  }

  const vehicleHistory = [...services]
    .filter((service) => service.plate === selectedService.plate && ['completed', 'no_show'].includes(service.status))
    .sort((left, right) => {
      const leftKey = left.timeline?.completedAt || left.timeline?.noShowAt || left.endTime || left.startTime || `${left.scheduledDate || ''}T${left.scheduledTime || '00:00'}`;
      const rightKey = right.timeline?.completedAt || right.timeline?.noShowAt || right.endTime || right.startTime || `${right.scheduledDate || ''}T${right.scheduledTime || '00:00'}`;
      return rightKey.localeCompare(leftKey);
    });

  return (
    <div className="flex flex-col min-h-full bg-white">
      <main className="p-4 space-y-6">
        <button
          onClick={() => onNavigate('scheduling', selectedService.id)}
          className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-sm"
        >
          <ChevronLeft className="w-5 h-5" />
          Voltar
        </button>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Car className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">{selectedService.model}</h2>
            <p className="text-sm text-slate-500">
              Placa {selectedService.plate} • {vehicleHistory.length} registro(s)
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Historico do veiculo</h3>

          {vehicleHistory.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-400 font-medium">
              Nenhum historico registrado para este veiculo.
            </div>
          ) : (
            vehicleHistory.map((item) => {
              const waitingMinutes = getDurationMinutes(item.timeline?.checkInAt || item.timeline?.createdAt, item.timeline?.washStartedAt || item.startTime || item.timeline?.noShowAt);
              const washMinutes = getDurationMinutes(item.timeline?.washStartedAt || item.startTime, item.timeline?.washCompletedAt || item.endTime);
              const paymentMinutes = getDurationMinutes(item.timeline?.paymentStartedAt, item.timeline?.paymentCompletedAt);
              const totalMinutes = getDurationMinutes(
                item.timeline?.checkInAt || item.timeline?.createdAt || item.timeline?.washStartedAt || item.startTime,
                item.timeline?.completedAt || item.timeline?.noShowAt || item.timeline?.paymentCompletedAt || item.timeline?.washCompletedAt || item.endTime
              );

              return (
                <div
                  key={item.id}
                  onClick={() => onNavigate('history', item.id)}
                  className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3 cursor-pointer active:scale-[0.98] active:bg-slate-50 transition-all"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-sm font-bold text-slate-700">
                        {formatDateTime(item.timeline?.completedAt || item.timeline?.noShowAt || item.endTime || item.startTime)}
                      </span>
                    </div>
                    <div className="bg-emerald-500/10 text-emerald-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">
                      {item.status === 'completed' ? 'Finalizado' : 'Nao compareceu'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-base font-black text-slate-900">{item.type}</p>
                      <p className="text-xs text-slate-500">{item.customer}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-primary">R$ {item.price.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <Clock className="w-3 h-3" />
                    {item.status === 'no_show' ? 'Nao compareceu ate o fim do dia' : washMinutes ? formatElapsedMinutes(washMinutes) : 'Lavagem sem tempo final registrado'}
                    <span className="text-slate-300">•</span>
                    {item.washers?.length ? item.washers.join(', ') : 'Sem lavador registrado'}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <HistoryMetric label="Agendado em" value={formatDateTime(item.timeline?.createdAt)} emphasis="text-slate-700" />
                    <HistoryMetric label="Entrada / fila" value={formatDateTime(item.timeline?.checkInAt || item.timeline?.createdAt)} emphasis="text-slate-700" />
                    <HistoryMetric label="Tempo de espera" value={waitingMinutes ? formatElapsedMinutes(waitingMinutes) : 'Nao registrado'} />
                    <HistoryMetric label="Tempo de lavagem" value={washMinutes ? formatElapsedMinutes(washMinutes) : 'Nao registrado'} />
                    <HistoryMetric label="Tempo de pagamento" value={paymentMinutes ? formatElapsedMinutes(paymentMinutes) : 'Nao registrado'} />
                    <HistoryMetric label="Tempo total" value={totalMinutes ? formatElapsedMinutes(totalMinutes) : 'Nao registrado'} emphasis="text-primary" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

function HistoryMetric({
  label,
  value,
  emphasis = 'text-slate-900',
}: {
  label: string;
  value: string;
  emphasis?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-xs font-black ${emphasis}`}>{value}</p>
    </div>
  );
}
