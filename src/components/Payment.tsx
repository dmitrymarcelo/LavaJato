/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CheckCircle2, Clock, ChevronRight, ChevronLeft, Camera } from 'lucide-react';
import { Screen, Service } from '../types';
import { formatElapsedMinutes, getElapsedMinutes, getServicePreviewImage } from '../utils/app';

export default function Payment({
  onNavigate,
  onPaymentComplete,
  completionNotice = null,
  onDismissCompletionNotice,
  elapsedMinutes = 0,
  service,
  services = [],
}: {
  onNavigate: (screen: Screen, serviceId?: string) => void;
  onPaymentComplete: () => Promise<void> | void;
  completionNotice?: {
    serviceId: string;
    plate: string;
    synced: boolean;
  } | null;
  onDismissCompletionNotice?: () => void;
  elapsedMinutes?: number;
  service?: Service | null;
  services?: Service[];
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handlePayment = async () => {
    if (isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await onPaymentComplete();
      onNavigate('scheduling');
    } catch (error: any) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Nao foi possivel finalizar o pagamento.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const completedAgoMinutes = service?.endTime ? getElapsedMinutes(service.endTime, Date.now()) : 0;
  const paymentQueue = services
    .filter((item) => item.status === 'waiting_payment' && item.id !== service?.id)
    .slice(0, 3);
  const previewImage = getServicePreviewImage(service);

  return (
    <div className="flex flex-col min-h-full pb-24 bg-white">
      <div className="px-4 pt-6 pb-2">
        <button
          onClick={() => onNavigate('scheduling')}
          className="mb-4 flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-sm"
        >
          <ChevronLeft className="w-5 h-5" />
          Voltar
        </button>
        <h2 className="text-slate-900 text-2xl font-bold tracking-tight">Aguardando Pagamento</h2>
        <p className="text-slate-500 text-sm">Revise os servicos concluidos e registre o recebimento final.</p>
      </div>

      <div className="flex flex-col gap-1 mt-2">
        {completionNotice && (
          <div className={`mx-4 mb-3 rounded-2xl border px-4 py-3 shadow-sm ${completionNotice.synced ? 'border-emerald-100 bg-emerald-50/80' : 'border-amber-100 bg-amber-50/80'}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${completionNotice.synced ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-black uppercase tracking-[0.18em] ${completionNotice.synced ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Lavagem concluida
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {completionNotice.synced
                    ? `A placa ${completionNotice.plate} ja esta pronta para pagamento.`
                    : `A placa ${completionNotice.plate} foi concluida neste aparelho e a sincronizacao seguira automaticamente.`}
                </p>
              </div>
              {onDismissCompletionNotice && (
                <button
                  type="button"
                  onClick={onDismissCompletionNotice}
                  className="rounded-xl px-2 py-1 text-xs font-bold text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-700"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        )}
        <div className="bg-white mx-4 rounded-2xl p-4 border border-blue-500/10 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center bg-slate-100 aspect-square rounded-xl w-16 h-16 border border-slate-100 overflow-hidden">
              {previewImage ? (
                <img src={previewImage} alt={service?.model || 'Veiculo'} className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-7 h-7 text-slate-400" />
              )}
            </div>
            <div className="flex flex-col justify-center flex-1">
              <div className="flex justify-between items-start gap-3">
                <p className="text-slate-900 text-lg font-semibold leading-tight">{service?.model || 'Veiculo em pagamento'}</p>
                <span className="text-primary font-bold text-xl">R$ {service?.price?.toFixed(2) || '0,00'}</span>
              </div>
              <p className="text-slate-500 text-sm">{service?.type || 'Servico nao informado'}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {service?.endTime ? `Concluido ha ${formatElapsedMinutes(completedAgoMinutes)}` : 'Concluido agora'}
                </p>
                <span className="bg-amber-500 text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase">
                  {formatElapsedMinutes(elapsedMinutes)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-3 border border-slate-50">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Cliente</span>
              <span className="text-slate-900 font-semibold">{service?.customer || 'Nao informado'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Placa</span>
              <span className="text-slate-900 font-bold uppercase tracking-widest">{service?.plate || '---'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Lavador</span>
              <span className="text-slate-900 font-medium">{service?.washers?.length ? service.washers.join(', ') : 'Nao definido'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Base</span>
              <span className="text-slate-900 font-medium">{service?.baseName || 'Nao informada'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handlePayment}
              disabled={isSubmitting}
              className={`w-full font-bold py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition-transform ${
                isSubmitting
                  ? 'bg-primary/70 text-white cursor-wait'
                  : 'bg-primary hover:bg-blue-600 text-white active:scale-[0.98]'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              {isSubmitting ? 'Finalizando pagamento...' : 'Marcar como Pago'}
            </button>
            <button
              onClick={() => onNavigate('scheduling')}
              disabled={isSubmitting}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-4 rounded-xl transition-colors active:scale-[0.98] disabled:opacity-60"
            >
              Deixar Pendente
            </button>
            {submitError && (
              <p className="text-xs font-bold text-rose-500 text-center">{submitError}</p>
            )}
          </div>
        </div>

        <div className="px-4 mt-8">
          <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3 px-1">Proximos na fila</h3>
          {paymentQueue.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-400">
              Nenhum outro servico aguardando pagamento.
            </div>
          ) : (
            paymentQueue.map((item) => (
              <QueueItem
                key={item.id}
                title={`${item.model} - ${item.plate}`}
                subtitle={`${item.type} - ${item.customer}`}
                price={`R$ ${item.price.toFixed(2)}`}
                imageUrl={getServicePreviewImage(item)}
                onClick={() => onNavigate('payment', item.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function QueueItem({
  title,
  subtitle,
  price,
  imageUrl,
  onClick,
}: {
  key?: React.Key;
  title: string;
  subtitle: string;
  price: string;
  imageUrl?: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-100 mb-3 shadow-sm cursor-pointer active:scale-[0.98] active:bg-slate-50 transition-all"
    >
      <div className="flex items-center justify-center bg-slate-100 aspect-square rounded-lg w-14 h-14 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <Camera className="w-5 h-5 text-slate-400" />
        )}
      </div>
      <div className="flex flex-col justify-center flex-1">
        <p className="text-slate-900 text-base font-medium leading-tight">{title}</p>
        <p className="text-slate-500 text-xs mt-1">{subtitle}</p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <span className="text-slate-400 font-medium text-sm">{price}</span>
        <ChevronRight className="w-4 h-4 text-slate-300" />
      </div>
    </div>
  );
}
