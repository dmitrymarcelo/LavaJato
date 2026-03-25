/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ChevronLeft, CreditCard, RefreshCw, Upload, X, AlertCircle } from 'lucide-react';
import { Screen, Service } from '../types';
import { formatElapsedMinutes, optimizeImageFile } from '../utils/app';
import ModalSurface from './ModalSurface';
import { api } from '../services/api';

const PHOTO_TYPES = [
  { id: 'front', label: 'Frente' },
  { id: 'back', label: 'Traseira' },
  { id: 'left', label: 'Lateral Esq.' },
  { id: 'right', label: 'Lateral Dir.' },
  { id: 'interior', label: 'Interior' },
];

export default function InspectionPost({
  onNavigate,
  onCompleteWash,
  elapsedMinutes = 0,
  service,
}: {
  onNavigate: (screen: Screen) => void;
  onCompleteWash: (photos: Record<string, string>) => Promise<void> | void;
  elapsedMinutes?: number;
  service?: Service | null;
}) {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [isPhotoSourceOpen, setIsPhotoSourceOpen] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhotos(service?.postInspectionPhotos || {});
  }, [service?.id, service?.postInspectionPhotos]);

  const handlePhotoClick = (photoId: string) => {
    setActivePhotoId(photoId);
    setIsPhotoSourceOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activePhotoId) {
      return;
    }

    setIsProcessingPhoto(true);
    (async () => {
      try {
        const imageData = await optimizeImageFile(file);
        setPhotos((current) => ({
          ...current,
          [activePhotoId]: imageData,
        }));
        setIsPhotoSourceOpen(false);
        const nextPhotos: Record<string, string> = { ...(service?.postInspectionPhotos || {}), [activePhotoId]: imageData };
        const nextImage = nextPhotos.front || service?.image || '';
        if (service?.id) {
          await api.upsertService({
            ...(service as Service),
            postInspectionPhotos: nextPhotos,
            image: nextImage,
            timeline: {
              ...(service.timeline || {}),
            },
          });
        }
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? error.message : 'Nao foi possivel processar a foto.');
      } finally {
        setIsProcessingPhoto(false);
      }
    })();

    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }

    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
  };

  const completedCount = Object.keys(photos).length;
  const progress = (completedCount / PHOTO_TYPES.length) * 100;
  const canComplete = completedCount >= 1;

  const handleComplete = async () => {
    if (!canComplete) {
      return;
    }

    try {
      await onCompleteWash(photos);
      onNavigate('payment');
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-white">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
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

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Entrega Tecnica</h2>
          <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 w-14 h-14 overflow-hidden">
              {service?.image ? <img src={service.image} alt={service.model} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8" />}
            </div>
            <div className="flex flex-col justify-center flex-1">
              <p className="text-lg font-bold leading-tight">{service?.model || 'Veiculo nao identificado'}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-slate-50 px-2 py-0.5 rounded text-xs font-bold tracking-wider text-slate-700 border border-slate-100">{service?.plate || 'Sem placa'}</span>
                <span className="text-slate-400 text-[10px] uppercase font-bold">Servico {service?.type || 'nao informado'}</span>
              </div>
            </div>
            <div className="shrink-0 bg-amber-500 text-white px-3 py-2 rounded-xl shadow-lg">
              <p className="text-[10px] font-black uppercase tracking-widest">Tempo</p>
              <p className="text-sm font-black">{formatElapsedMinutes(elapsedMinutes)}</p>
            </div>
          </div>
        </section>

        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Estado Final</h2>
          <p className="text-sm text-slate-500 leading-relaxed">Capture pelo menos 1 foto para documentar a entrega do veiculo apos a lavagem. As demais sao opcionais.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PHOTO_TYPES.map((type) => (
            <PhotoItem
              key={type.id}
              label={type.label}
              image={photos[type.id]}
              onClick={() => handlePhotoClick(type.id)}
              required={!completedCount}
            />
          ))}
        </div>

        <div className="pt-2">
          <div className="flex justify-between items-end mb-2">
            <div>
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Progresso da Captura</span>
              <span className={`text-lg font-black italic ${canComplete ? 'text-emerald-500' : 'text-primary'}`}>
                {completedCount}/{PHOTO_TYPES.length} Concluido
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {canComplete ? 'Entrega pronta' : 'Capture ao menos 1 foto'}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full ${canComplete ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </main>

      {isPhotoSourceOpen && (
        <ModalSurface onClose={() => setIsPhotoSourceOpen(false)} overlayClassName="z-[80]" panelClassName="max-w-md rounded-[28px] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Adicionar foto final</h3>
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

      <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] p-4 bg-white/95 backdrop-blur-lg border-t border-slate-100 pb-6 z-[70]">
        <div className="space-y-3">
          <button
            disabled={!canComplete}
            onClick={handleComplete}
            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${
              canComplete
                ? 'bg-primary text-white shadow-lg shadow-primary/20 active:scale-[0.98]'
                : 'text-slate-400 bg-slate-50 border border-slate-100 cursor-not-allowed'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span>Salvar e Liberar para Pagamento</span>
          </button>
          <div className="flex items-center justify-center gap-2 px-6">
            <AlertCircle className={`w-4 h-4 ${canComplete ? 'text-emerald-500' : 'text-amber-500'}`} />
            <p className="text-center text-[10px] uppercase font-bold tracking-wider text-slate-500">
              {canComplete ? 'Tudo pronto para finalizar a lavagem' : 'Capture ao menos 1 foto final para habilitar'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PhotoItem({
  label,
  image,
  onClick,
  required,
}: {
  key?: React.Key;
  label: string;
  image?: string;
  onClick: () => void;
  required?: boolean;
}) {
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
          <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-lg ring-2 ring-white/20">
            <CheckCircle2 className="w-4 h-4" />
          </div>
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
