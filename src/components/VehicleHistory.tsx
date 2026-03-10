import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Car,
  ChevronLeft,
  Clock3,
  CreditCard,
  History,
  MapPin,
  Search,
  User,
  WashingMachine,
} from 'lucide-react';
import { Screen, Service, VehicleRegistration, VehicleType } from '../types';
import { formatElapsedMinutes, getDurationMinutes } from '../utils/app';

type VehicleHistoryScope = 'history' | 'all';

type VehicleHistoryGroup = {
  plate: string;
  customer: string;
  model: string;
  type?: VehicleType;
  previewImage?: string;
  records: Service[];
  completedCount: number;
  noShowCount: number;
  activeCount: number;
  totalRevenue: number;
  lastRecordedAt?: string;
  lastBaseName?: string;
};

const formatDateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('pt-BR') : 'Nao registrado';

const getVehicleTypeLabel = (type?: VehicleType) => {
  if (!type) return 'Nao informado';
  if (type === 'motorcycle') return 'Moto';
  if (type === 'truck') return 'Caminhao';
  if (type === 'boat') return 'Lancha';
  if (type === 'pickup_4x4') return 'Caminhonete 4X4';
  return 'Carro';
};

const getServiceEventDate = (service: Service) =>
  service.timeline?.completedAt
  || service.timeline?.noShowAt
  || service.timeline?.paymentCompletedAt
  || service.timeline?.washCompletedAt
  || service.endTime
  || service.startTime
  || `${service.scheduledDate || ''}T${service.scheduledTime || '00:00'}`;

const getStatusLabel = (status: Service['status']) => {
  if (status === 'completed') return 'Finalizado';
  if (status === 'no_show') return 'Nao compareceu';
  if (status === 'waiting_payment') return 'Aguardando pagamento';
  if (status === 'in_progress') return 'Em lavagem';
  return 'Aguardando';
};

const getStatusClassName = (status: Service['status']) => {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  if (status === 'no_show') return 'bg-rose-50 text-rose-600 border-rose-100';
  if (status === 'waiting_payment') return 'bg-sky-50 text-sky-600 border-sky-100';
  if (status === 'in_progress') return 'bg-amber-50 text-amber-600 border-amber-100';
  return 'bg-slate-50 text-slate-600 border-slate-100';
};

export default function VehicleHistory({
  onNavigate,
  services,
  vehicleDb,
}: {
  onNavigate: (screen: Screen, serviceId?: string) => void;
  services: Service[];
  vehicleDb: VehicleRegistration[];
}) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<VehicleHistoryScope>('history');
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);

  const groups = useMemo<VehicleHistoryGroup[]>(() => {
    const serviceMap = new Map<string, Service[]>();

    services.forEach((service) => {
      const key = service.plate.toUpperCase();
      const current = serviceMap.get(key) || [];
      current.push(service);
      serviceMap.set(key, current);
    });

    const knownPlates = new Set<string>();
    const result: VehicleHistoryGroup[] = [];

    vehicleDb.forEach((vehicle) => {
      const plate = vehicle.plate.toUpperCase();
      knownPlates.add(plate);
      const records = [...(serviceMap.get(plate) || [])].sort((left, right) =>
        getServiceEventDate(right).localeCompare(getServiceEventDate(left))
      );
      const latestRecord = records[0];

      result.push({
        plate,
        customer: latestRecord?.customer || vehicle.customer || 'Nao informado',
        model: latestRecord?.model || vehicle.model || 'Veiculo nao informado',
        type: latestRecord?.type === undefined ? vehicle.type : vehicle.type,
        previewImage: latestRecord?.image,
        records,
        completedCount: records.filter((item) => item.status === 'completed').length,
        noShowCount: records.filter((item) => item.status === 'no_show').length,
        activeCount: records.filter((item) => ['pending', 'in_progress', 'waiting_payment'].includes(item.status)).length,
        totalRevenue: records.filter((item) => item.status === 'completed').reduce((total, item) => total + item.price, 0),
        lastRecordedAt: latestRecord ? getServiceEventDate(latestRecord) : undefined,
        lastBaseName: latestRecord?.baseName,
      });
    });

    serviceMap.forEach((records, plate) => {
      if (knownPlates.has(plate)) {
        return;
      }

      const sortedRecords = [...records].sort((left, right) =>
        getServiceEventDate(right).localeCompare(getServiceEventDate(left))
      );
      const latestRecord = sortedRecords[0];

      result.push({
        plate,
        customer: latestRecord?.customer || 'Nao informado',
        model: latestRecord?.model || 'Veiculo nao informado',
        previewImage: latestRecord?.image,
        records: sortedRecords,
        completedCount: sortedRecords.filter((item) => item.status === 'completed').length,
        noShowCount: sortedRecords.filter((item) => item.status === 'no_show').length,
        activeCount: sortedRecords.filter((item) => ['pending', 'in_progress', 'waiting_payment'].includes(item.status)).length,
        totalRevenue: sortedRecords.filter((item) => item.status === 'completed').reduce((total, item) => total + item.price, 0),
        lastRecordedAt: latestRecord ? getServiceEventDate(latestRecord) : undefined,
        lastBaseName: latestRecord?.baseName,
      });
    });

    return result.sort((left, right) => {
      const rightDate = right.lastRecordedAt || '';
      const leftDate = left.lastRecordedAt || '';
      if (rightDate !== leftDate) {
        return rightDate.localeCompare(leftDate);
      }
      return left.plate.localeCompare(right.plate);
    });
  }, [services, vehicleDb]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return groups.filter((group) => {
      if (scope === 'history' && group.records.length === 0) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        group.plate,
        group.customer,
        group.model,
        group.lastBaseName || '',
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [groups, query, scope]);

  useEffect(() => {
    if (!filteredGroups.length) {
      setSelectedPlate(null);
      return;
    }

    if (selectedPlate && filteredGroups.some((group) => group.plate === selectedPlate)) {
      return;
    }

    setSelectedPlate(filteredGroups[0].plate);
  }, [filteredGroups, selectedPlate]);

  const selectedVehicle = filteredGroups.find((group) => group.plate === selectedPlate) || filteredGroups[0] || null;

  const totalVehiclesWithHistory = groups.filter((group) => group.records.length > 0).length;
  const totalRecords = groups.reduce((total, group) => total + group.records.length, 0);
  const totalCompleted = groups.reduce((total, group) => total + group.completedCount, 0);
  const totalNoShow = groups.reduce((total, group) => total + group.noShowCount, 0);

  return (
    <div className="min-h-full bg-white p-4 pb-24 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-sm"
        >
          <ChevronLeft className="w-5 h-5" />
          Voltar
        </button>
      </div>

      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Area dedicada</p>
        <h1 className="text-2xl font-black text-slate-900">Historico de Veiculos</h1>
        <p className="text-sm text-slate-500 max-w-3xl">
          Consulte todo o historico operacional de cada veiculo em um unico lugar, com status, tempos, base, valor, responsaveis e os registros de atendimento.
        </p>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Veiculos com historico" value={String(totalVehiclesWithHistory)} icon={<Car className="w-4 h-4 text-primary" />} />
        <MetricCard label="Registros totais" value={String(totalRecords)} icon={<History className="w-4 h-4 text-primary" />} />
        <MetricCard label="Finalizados" value={String(totalCompleted)} icon={<WashingMachine className="w-4 h-4 text-emerald-500" />} />
        <MetricCard label="Nao compareceram" value={String(totalNoShow)} icon={<AlertTriangle className="w-4 h-4 text-rose-500" />} />
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por placa, cliente, modelo ou base"
              className="w-full h-12 rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-primary"
            />
          </div>
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            <ScopeButton active={scope === 'history'} onClick={() => setScope('history')} label="Com historico" />
            <ScopeButton active={scope === 'all'} onClick={() => setScope('all')} label="Todos os veiculos" />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {filteredGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-400 font-medium">
                Nenhum veiculo encontrado para o filtro atual.
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isSelected = selectedVehicle?.plate === group.plate;
                return (
                  <button
                    key={group.plate}
                    onClick={() => setSelectedPlate(group.plate)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-slate-900">{group.plate}</p>
                        <p className="text-sm font-bold text-slate-700">{group.model}</p>
                        <p className="text-xs text-slate-500">{group.customer}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Registros</p>
                        <p className="text-xl font-black text-primary">{group.records.length}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge label={`${group.completedCount} finalizados`} className="bg-emerald-50 text-emerald-600 border-emerald-100" />
                      <Badge label={`${group.noShowCount} no-show`} className="bg-rose-50 text-rose-600 border-rose-100" />
                      {group.activeCount > 0 && (
                        <Badge label={`${group.activeCount} ativos`} className="bg-amber-50 text-amber-600 border-amber-100" />
                      )}
                    </div>

                    <div className="mt-3 space-y-1 text-[11px] text-slate-500 font-medium">
                      <p>Ultimo registro: {group.lastRecordedAt ? formatDateTime(group.lastRecordedAt) : 'Sem historico'}</p>
                      <p>Ultima base: {group.lastBaseName || 'Nao registrada'}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="rounded-3xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5">
            {!selectedVehicle ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-400 font-medium">
                Selecione um veiculo para visualizar o historico consolidado.
              </div>
            ) : (
              <VehicleDetail group={selectedVehicle} onNavigate={onNavigate} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function VehicleDetail({
  group,
  onNavigate,
}: {
  group: VehicleHistoryGroup;
  onNavigate: (screen: Screen, serviceId?: string) => void;
}) {
  const averageWashMinutes = group.records
    .map((record) => getDurationMinutes(record.timeline?.washStartedAt || record.startTime, record.timeline?.washCompletedAt || record.endTime))
    .filter((value): value is number => typeof value === 'number' && value > 0);
  const averageWash = averageWashMinutes.length
    ? Math.round(averageWashMinutes.reduce((total, value) => total + value, 0) / averageWashMinutes.length)
    : null;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl overflow-hidden bg-slate-100 border border-slate-100 shrink-0">
              {group.previewImage ? (
                <img src={group.previewImage} alt={group.model} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary">
                  <Car className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Veiculo selecionado</p>
              <h2 className="text-2xl font-black text-slate-900">{group.plate}</h2>
              <p className="text-sm font-bold text-slate-700">{group.model}</p>
              <p className="text-sm text-slate-500">{group.customer}</p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{getVehicleTypeLabel(group.type)}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-primary/5 border border-primary/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Faturamento realizado</p>
            <p className="text-xl font-black text-primary">R$ {group.totalRevenue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Total de registros" value={String(group.records.length)} icon={<History className="w-4 h-4 text-primary" />} compact />
        <MetricCard label="Finalizados" value={String(group.completedCount)} icon={<WashingMachine className="w-4 h-4 text-emerald-500" />} compact />
        <MetricCard label="Nao compareceram" value={String(group.noShowCount)} icon={<AlertTriangle className="w-4 h-4 text-rose-500" />} compact />
        <MetricCard label="Media de lavagem" value={averageWash ? formatElapsedMinutes(averageWash) : 'Sem base'} icon={<Clock3 className="w-4 h-4 text-sky-500" />} compact />
      </div>

      {group.records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-400 font-medium">
          Este veiculo esta cadastrado, mas ainda nao possui historico operacional registrado.
        </div>
      ) : (
        <div className="space-y-4">
          {group.records.map((record) => {
            const waitingMinutes = getDurationMinutes(record.timeline?.checkInAt || record.timeline?.createdAt, record.timeline?.washStartedAt || record.startTime || record.timeline?.noShowAt);
            const washMinutes = getDurationMinutes(record.timeline?.washStartedAt || record.startTime, record.timeline?.washCompletedAt || record.endTime);
            const paymentMinutes = getDurationMinutes(record.timeline?.paymentStartedAt, record.timeline?.paymentCompletedAt);
            const totalMinutes = getDurationMinutes(
              record.timeline?.checkInAt || record.timeline?.createdAt || record.timeline?.washStartedAt || record.startTime,
              record.timeline?.completedAt || record.timeline?.noShowAt || record.timeline?.paymentCompletedAt || record.timeline?.washCompletedAt || record.endTime
            );

            return (
              <div key={record.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge label={getStatusLabel(record.status)} className={getStatusClassName(record.status)} />
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{record.type}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{formatDateTime(getServiceEventDate(record))}</p>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 font-medium">
                      <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{record.baseName || 'Base nao registrada'}</span>
                      <span className="inline-flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" />R$ {record.price.toFixed(2)}</span>
                      <span className="inline-flex items-center gap-1"><User className="w-3.5 h-3.5" />{record.washers?.length ? record.washers.join(', ') : 'Sem responsavel'}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('history', record.id)}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:border-primary hover:text-primary transition-colors"
                  >
                    Abrir servico
                  </button>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <MiniMetric label="Agendado em" value={formatDateTime(record.timeline?.createdAt)} />
                  <MiniMetric label="Entrada / fila" value={formatDateTime(record.timeline?.checkInAt || record.timeline?.createdAt)} />
                  <MiniMetric label="Tempo de espera" value={waitingMinutes ? formatElapsedMinutes(waitingMinutes) : 'Nao registrado'} />
                  <MiniMetric label="Tempo de lavagem" value={washMinutes ? formatElapsedMinutes(washMinutes) : 'Nao registrado'} />
                  <MiniMetric label="Tempo de pagamento" value={paymentMinutes ? formatElapsedMinutes(paymentMinutes) : 'Nao registrado'} />
                  <MiniMetric label="Tempo total" value={totalMinutes ? formatElapsedMinutes(totalMinutes) : 'Nao registrado'} emphasis="text-primary" />
                  <MiniMetric label="Inicio do servico" value={formatDateTime(record.timeline?.washStartedAt || record.startTime)} />
                  <MiniMetric label="Fim do servico" value={formatDateTime(record.timeline?.completedAt || record.timeline?.noShowAt || record.endTime)} />
                </div>

                {record.observations && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Observacoes</p>
                    <p className="mt-1 text-sm text-slate-600">{record.observations}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScopeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${active ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
    >
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  icon,
  compact = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-3xl border border-slate-100 bg-white shadow-sm ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <p className={`mt-2 font-black text-slate-900 ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
    </div>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${className}`}>
      {label}
    </span>
  );
}

function MiniMetric({
  label,
  value,
  emphasis = 'text-slate-900',
}: {
  label: string;
  value: string;
  emphasis?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-xs font-black ${emphasis}`}>{value}</p>
    </div>
  );
}
