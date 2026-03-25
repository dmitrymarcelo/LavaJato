/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, Lock, Info, RefreshCw, ChevronLeft, PlayCircle, AlertCircle, Upload, X, Clock3 } from 'lucide-react';
import { motion } from '../lib/motion';
import { Screen, Service, TeamMember } from '../types';
import {
  enqueuePendingPhotoSave,
  flushPendingPhotoSaves,
  formatElapsedMinutes,
  listPendingPhotoIds,
  normalizeDateKey,
  optimizeImageFile,
  PENDING_PHOTO_SAVES_UPDATED_EVENT,
  shouldQueuePendingPhotoSave,
} from '../utils/app';
import ModalSurface from './ModalSurface';
import { api } from '../services/api';

type InspectionPreProps = {
  onNavigate: (screen: Screen) => void;
  onStartWash: (washers: string[], photos: Record<string, string>, observations: string) => Promise<void> | void;
  elapsedMinutes?: number;
  teamMembers?: TeamMember[];
  service?: Service | null;
  onServiceChange?: (service: Service) => void;
};

const PHOTO_TYPES = [
  { id: 'front', label: 'Frente' },
  { id: 'back', label: 'Traseira' },
  { id: 'left', label: 'Lateral Esq.' },
  { id: 'right', label: 'Lateral Dir.' },
  { id: 'interior', label: 'Interior' }
];

export default function InspectionPre({
  onNavigate,
  onStartWash,
  elapsedMinutes = 0,
  teamMembers: teamMembersProp = [],
  service,
  onServiceChange,
}: InspectionPreProps) {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedWashers, setSelectedWashers] = useState<string[]>([]);
  const [isPhotoSourceOpen, setIsPhotoSourceOpen] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [observations, setObservations] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTeamMembers(
      teamMembersProp.filter(
        (m: TeamMember) => m.role.toLowerCase() === 'lavador'
      )
    );
  }, [teamMembersProp]);

  useEffect(() => {
    setPhotos(service?.preInspectionPhotos || {});
  }, [service?.id, service?.preInspectionPhotos]);

  useEffect(() => {
    setObservations(service?.observations || '');
  }, [service?.id, service?.observations]);

  useEffect(() => {
    if (!teamMembers.length) {
      setSelectedWashers([]);
      return;
    }

    const selectedIds = teamMembers
      .filter((member) => service?.washers?.includes(member.name))
      .map((member) => member.id);

    setSelectedWashers(selectedIds);
  }, [service?.id, service?.washers, teamMembers]);

  const handlePhotoClick = (id: string) => {
    setActivePhotoId(id);
    setIsPhotoSourceOpen(true);
  };

  const toggleWasher = (washerId: string) => {
    setSelectedWashers(prev => 
      prev.includes(washerId) 
        ? prev.filter(id => id !== washerId)
        : [...prev, washerId]
    );
  };

  const [lastSavedInfo, setLastSavedInfo] = useState<string | null>(null);
  const [isFlushingPending, setIsFlushingPending] = useState(false);
  const [pendingVersion, setPendingVersion] = useState(0);

  const pendingPhotoIds = useMemo(() => {
    return new Set(listPendingPhotoIds(service?.id || '', 'pre'));
  }, [service?.id, pendingVersion]);

  const pendingCount = pendingPhotoIds.size;

  const flushNow = async () => {
    if (!navigator.onLine) {
      setLastSavedInfo('Sem internet. Fotos pendentes serao reenviadas automaticamente.');
      setTimeout(() => setLastSavedInfo(null), 3000);
      return;
    }

    setIsFlushingPending(true);
    try {
      const result = await flushPendingPhotoSaves({
        stage: 'pre',
        saveInspectionPhoto: api.saveInspectionPhoto,
        onSaved: (entry) => {
          if (entry.serviceId === service?.id) {
            setPendingVersion((value) => value + 1);
          }
        },
      });

      setPendingVersion((value) => value + 1);
      if (result.savedCount) {
        if (service?.id) {
          const refreshedService = await api.getService(service.id);
          setPhotos(refreshedService.preInspectionPhotos || {});
          onServiceChange?.(refreshedService);
        }
        setLastSavedInfo(`${result.savedCount} foto(s) reenviada(s)`);
        setTimeout(() => setLastSavedInfo(null), 3000);
      }
    } finally {
      setIsFlushingPending(false);
    }
  };

  async function upsertWithRetry(
    payload: Service,
    saveInfo: { photoId: string; imageData: string },
    fallbackService?: Service | null,
    attempts = 3
  ) {
    if (!navigator.onLine) {
      enqueuePendingPhotoSave({
        serviceId: payload.id,
        stage: 'pre',
        photoId: saveInfo.photoId,
        imageData: saveInfo.imageData,
      });
      setPendingVersion((value) => value + 1);
      setLastSavedInfo('Sem internet. Foto sera reenviada automaticamente.');
      setTimeout(() => setLastSavedInfo(null), 3000);
      return { service: fallbackService || null, persisted: false };
    }
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const savedService = await api.saveInspectionPhoto(
          payload.id,
          'pre',
          saveInfo.photoId,
          saveInfo.imageData
        );
        setPhotos(savedService.preInspectionPhotos || {});
        return { service: savedService, persisted: true };
      } catch (error) {
        lastError = error;
        if (!navigator.onLine) {
          enqueuePendingPhotoSave({
            serviceId: payload.id,
            stage: 'pre',
            photoId: saveInfo.photoId,
            imageData: saveInfo.imageData,
          });
          setPendingVersion((value) => value + 1);
          setLastSavedInfo('A internet caiu. Foto sera reenviada automaticamente.');
          setTimeout(() => setLastSavedInfo(null), 3000);
          return { service: fallbackService || null, persisted: false };
        }
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
    if (shouldQueuePendingPhotoSave(lastError)) {
      enqueuePendingPhotoSave({
        serviceId: payload.id,
        stage: 'pre',
        photoId: saveInfo.photoId,
        imageData: saveInfo.imageData,
      });
      setPendingVersion((value) => value + 1);
      setLastSavedInfo('Houve instabilidade. Foto sera reenviada automaticamente.');
      setTimeout(() => setLastSavedInfo(null), 3000);
      return { service: fallbackService || null, persisted: false };
    }
    throw lastError instanceof Error ? lastError : new Error('Falha ao salvar a foto no servidor.');
  }

  useEffect(() => {
    const handler = () => void flushNow();
    window.addEventListener('online', handler);
    void flushNow();
    return () => window.removeEventListener('online', handler);
  }, []);

  useEffect(() => {
    const handler = () => setPendingVersion((value) => value + 1);
    window.addEventListener(PENDING_PHOTO_SAVES_UPDATED_EVENT, handler as EventListener);
    return () => window.removeEventListener(PENDING_PHOTO_SAVES_UPDATED_EVENT, handler as EventListener);
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activePhotoId) {
      setIsProcessingPhoto(true);
      try {
        const imageData = await optimizeImageFile(file);
        setPhotos(prev => ({
          ...prev,
          [activePhotoId]: imageData
        }));
        setIsPhotoSourceOpen(false);
        const nowIso = new Date().toISOString();
        const nextPhotos: Record<string, string> = { ...(service?.preInspectionPhotos || {}), [activePhotoId]: imageData };
        const nextImage = nextPhotos.front || service?.image || '';
        const optimisticService = service ? {
          ...service,
          preInspectionPhotos: nextPhotos,
          image: nextImage,
          timeline: {
            ...(service.timeline || {}),
            preInspectionStartedAt: service.timeline?.preInspectionStartedAt || nowIso,
          },
        } : null;
        if (service?.id) {
          const saveResult = await upsertWithRetry({
            ...(service as Service),
            preInspectionPhotos: nextPhotos,
            image: nextImage,
            timeline: {
              ...(service.timeline || {}),
              preInspectionStartedAt: service.timeline?.preInspectionStartedAt || nowIso,
            },
          }, { photoId: activePhotoId, imageData }, optimisticService);
          if (saveResult.service) {
            onServiceChange?.(saveResult.service);
          }
          if (saveResult.persisted) {
            setLastSavedInfo(`Foto ${activePhotoId} salva`);
            setTimeout(() => setLastSavedInfo(null), 3000);
          }
        }
      } catch (error) {
        console.error(error);
        if (!navigator.onLine) {
          setLastSavedInfo('Sem internet. Foto sera reenviada automaticamente.');
          setTimeout(() => setLastSavedInfo(null), 3000);
        } else {
          alert(error instanceof Error ? error.message : 'Nao foi possivel salvar a foto agora.');
        }
      } finally {
        setIsProcessingPhoto(false);
      }
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
  };

  const completedCount = Object.keys(photos).length;
  const progress = (completedCount / PHOTO_TYPES.length) * 100;
  const isPhotosComplete = completedCount >= 1;
  const isWashersSelected = selectedWashers.length > 0;
  const createdDateKey = normalizeDateKey(service?.timeline?.createdAt);
  const scheduledDateKey = normalizeDateKey(service?.scheduledDate);
  const requiresCarryOverObservation = Boolean(createdDateKey && scheduledDateKey && createdDateKey < scheduledDateKey);
  const hasValidObservation = !requiresCarryOverObservation || observations.trim().length >= 10;
  const canStart = isPhotosComplete && isWashersSelected && hasValidObservation;

  const handleStartWash = async () => {
    if (canStart) {
      const washerNames = teamMembers
        .filter(m => selectedWashers.includes(m.id))
        .map(m => m.name);
      try {
        await onStartWash(washerNames, photos, observations.trim());
        onNavigate('queue');
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-white">
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        ref={cameraInputRef}
        onChange={onFileChange}
      />
      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={galleryInputRef}
        onChange={onFileChange}
      />

      <main className="max-w-md mx-auto p-4 space-y-6 pb-40">
        <div className="flex items-center">
          <button
            onClick={() => onNavigate('scheduling')}
            className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-sm"
          >
            <ChevronLeft className="w-5 h-5" />
            Voltar
          </button>
        </div>

        {/* Vehicle Details Card */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Detalhes do Veículo</h2>
          <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 w-14 h-14">
              <Camera className="w-8 h-8" />
            </div>
            <div className="flex flex-col justify-center flex-1">
              <p className="text-lg font-bold leading-tight">{service?.model || 'Veiculo nao identificado'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-slate-50 px-2 py-0.5 rounded text-xs font-bold tracking-wider text-slate-700 border border-slate-100">{service?.plate || 'Sem placa'}</span>
                <span className="text-slate-400 text-[10px] uppercase font-bold">• Agenda {service?.scheduledTime || '--:--'}</span>
              </div>
            </div>
            <div className="shrink-0 bg-amber-500 text-white px-3 py-2 rounded-xl shadow-lg">
              <p className="text-[10px] font-black uppercase tracking-widest">Tempo</p>
              <p className="text-sm font-black">{formatElapsedMinutes(elapsedMinutes)}</p>
            </div>
          </div>
        </section>

        {/* Washer Selection */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Responsáveis</h2>
            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
              {selectedWashers.length} selecionado(s)
            </span>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">Selecione quem irá realizar o serviço neste veículo.</p>
          
          <div className="grid grid-cols-2 gap-3">
            {teamMembers.length === 0 ? (
              <div className="col-span-2 p-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
                Nenhum lavador disponível no momento.
              </div>
            ) : (
              teamMembers.map(member => (
                <button
                  key={member.id}
                  onClick={() => toggleWasher(member.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] ${
                    selectedWashers.includes(member.id)
                      ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="relative">
                    <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full bg-slate-100 object-cover" />
                    {selectedWashers.includes(member.id) && (
                      <div className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-0.5 border-2 border-white">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-bold leading-tight ${selectedWashers.includes(member.id) ? 'text-primary' : 'text-slate-900'}`}>
                      {member.name}
                    </p>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">{member.role}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Observacao operacional</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                {requiresCarryOverObservation
                  ? 'Este veiculo foi agendado em dia anterior. Antes de iniciar a lavagem, registre uma observacao descritiva.'
                  : 'Use este campo para registrar contexto adicional do atendimento, quando necessario.'}
              </p>
            </div>
            {requiresCarryOverObservation && (
              <span className="shrink-0 rounded-full bg-amber-50 border border-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-600">
                Obrigatoria
              </span>
            )}
          </div>

          <textarea
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
            rows={4}
            placeholder={requiresCarryOverObservation ? 'Descreva o contexto do atendimento deste agendamento anterior.' : 'Observacoes adicionais do veiculo ou do atendimento.'}
            className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none resize-none ${
              requiresCarryOverObservation && !hasValidObservation
                ? 'border-amber-300 focus:border-amber-500'
                : 'border-slate-100 focus:border-primary'
            }`}
          />

          {requiresCarryOverObservation && !hasValidObservation && (
            <p className="text-xs font-bold text-amber-600">
              Informe pelo menos 10 caracteres para liberar o inicio da lavagem.
            </p>
          )}
        </section>

        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Estado Inicial</h2>
          <p className="text-sm text-slate-500 leading-relaxed">Capture pelo menos 1 foto para documentar o estado do veiculo antes de iniciar o servico. As demais sao opcionais.</p>
        </div>

        {/* Photo Grid */}
        <div className="grid grid-cols-2 gap-3">
          {PHOTO_TYPES.map((type) => (
            <PhotoItem 
              key={type.id}
              label={type.label}
              image={photos[type.id]}
              status={photos[type.id] ? (pendingPhotoIds.has(type.id) ? 'pending' : 'saved') : undefined}
              onClick={() => handlePhotoClick(type.id)}
              required={!completedCount}
            />
          ))}
        </div>

        {/* Progress */}
        <div className="pt-2">
          <div className="flex justify-between items-end mb-2">
            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progresso da Captura</span>
              <span className={`text-lg font-black italic ${isPhotosComplete ? 'text-emerald-500' : 'text-primary'}`}>
                {completedCount}/{PHOTO_TYPES.length} Concluído
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {isPhotosComplete ? 'Tudo pronto!' : 'Capture ao menos 1 foto'}
            </span>
          </div>
          {pendingCount > 0 && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2">
              <div className="flex items-center gap-2 text-[12px] font-bold text-amber-800">
                <Clock3 className="w-4 h-4" />
                <span>{pendingCount} foto(s) pendente(s) de envio</span>
              </div>
              <button
                type="button"
                disabled={!navigator.onLine || isFlushingPending}
                onClick={flushNow}
                className="rounded-xl bg-amber-600 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                Reenviar agora
              </button>
            </div>
          )}
          {lastSavedInfo && (
            <div className="mb-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-bold text-emerald-700">
              {lastSavedInfo}
            </div>
          )}
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ 
                width: `${progress}%`,
                backgroundColor: isPhotosComplete ? '#10b981' : '#137fec' 
              }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              className="h-full rounded-full"
            />
          </div>
        </div>
      </main>

      {isPhotoSourceOpen && (
        <ModalSurface onClose={() => setIsPhotoSourceOpen(false)} overlayClassName="z-[80]" panelClassName="max-w-md rounded-[28px] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Adicionar foto</h3>
                <p className="text-sm text-slate-500">Escolha como deseja capturar ou enviar a imagem.</p>
              </div>
              <button
                onClick={() => setIsPhotoSourceOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                disabled={isProcessingPhoto}
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-slate-900 active:scale-[0.98] disabled:opacity-50"
              >
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold">Abrir camera</span>
              </button>
              <button
                disabled={isProcessingPhoto}
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-slate-900 active:scale-[0.98] disabled:opacity-50"
              >
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold">Enviar do dispositivo</span>
              </button>
            </div>
            {isProcessingPhoto && (
              <p className="text-xs font-bold text-slate-500 text-center">Processando foto...</p>
            )}
        </ModalSurface>
      )}

      {/* Footer Action */}
      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] p-4 bg-white/95 backdrop-blur-lg border-t border-slate-100 pb-6 z-[70]">
        <div className="space-y-3">
          <button 
            disabled={!canStart}
            onClick={handleStartWash}
            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${
              canStart 
                ? 'bg-primary text-white shadow-lg shadow-primary/20 active:scale-[0.98]' 
                : 'text-slate-400 bg-slate-50 border border-slate-100 cursor-not-allowed'
            }`}
          >
            {canStart ? <PlayCircle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            <span>Salvar e Iniciar Lavagem</span>
          </button>
          <div className="flex items-center justify-center gap-2 px-6">
            <Info className={`w-4 h-4 ${canStart ? 'text-emerald-500' : 'text-amber-500'}`} />
            <p className="text-center text-[10px] uppercase font-bold tracking-wider text-slate-500">
              {!isPhotosComplete 
                ? 'Capture ao menos 1 foto para habilitar'
                : !isWashersSelected 
                  ? 'Selecione pelo menos um responsável'
                  : !hasValidObservation
                    ? 'Registre a observacao obrigatoria para continuar'
                    : 'Tudo pronto para iniciar'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PhotoItem({ label, image, status, onClick, required }: { label: string, image?: string, status?: 'saved' | 'pending', onClick: () => void, required?: boolean, key?: string }) {
  if (image) {
    return (
      <div className="relative group" onClick={onClick}>
        <div 
          className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border-2 border-primary ring-4 ring-primary/10 bg-cover bg-center transition-all active:scale-95" 
          style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.1), rgba(0,0,0,0.4)), url('${image}')` }}
        >
          <div className="absolute inset-0 flex flex-col justify-end p-3">
            <p className="text-white text-[10px] font-black uppercase tracking-widest drop-shadow-md">{label}</p>
          </div>
          {status === 'pending' ? (
            <div className="absolute top-2 right-2 bg-amber-500 text-white rounded-full p-1 shadow-lg ring-2 ring-white/20">
              <Clock3 className="w-4 h-4" />
            </div>
          ) : (
            <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-lg ring-2 ring-white/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          <div className="absolute top-2 left-2 bg-black/40 backdrop-blur-sm text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <RefreshCw className="w-3 h-3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`relative aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all hover:border-primary/50 ${
        required ? 'animate-blink-red border-red-500/30' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className={`p-4 rounded-full border ${
        required ? 'bg-red-50 text-red-500 border-red-200/50' : 'bg-slate-200 text-slate-400 border-slate-300/50'
      }`}>
        <Camera className="w-8 h-8" />
      </div>
      <span className={`text-[10px] font-black uppercase tracking-widest ${
        required ? 'text-red-500' : 'text-slate-500'
      }`}>{label}</span>
      {required && (
        <div className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 bg-red-500 text-white rounded-full shadow-lg animate-pulse">
          <AlertCircle className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
