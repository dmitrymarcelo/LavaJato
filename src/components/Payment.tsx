/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, Clock, ChevronRight, ChevronLeft } from 'lucide-react';
import { Screen, Service } from '../types';
import { formatElapsedMinutes } from '../utils/app';

export default function Payment({ onNavigate, onPaymentComplete, elapsedMinutes = 0, service }: { onNavigate: (screen: Screen) => void, onPaymentComplete: () => Promise<void> | void, elapsedMinutes?: number, service?: Service | null }) {
  const handlePayment = async () => {
    try {
      await onPaymentComplete();
      onNavigate('dashboard');
    } catch (error) {
      console.error(error);
    }
  };

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
        <p className="text-slate-500 text-sm">Revise os servicos concluidos e agilize o fluxo de caixa.</p>
      </div>

      <div className="flex flex-col gap-1 mt-2">
        <div className="bg-white mx-4 rounded-2xl p-4 border border-blue-500/10 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="bg-center bg-no-repeat aspect-square bg-cover rounded-xl w-16 h-16 border border-slate-100"
              style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCb8-dZdrsT_iGZSplC8rBNRLR8nxhHyIHcbmE1d8PYQhjJ9serVgqF49iCtTt4YCDMWUMU87zldK4LnMiQeG6OAIRA_W0A8Q6OTsqHFHfKBRiaR1qMDB8w505yyYOnY2npVGnZCaJ6yIpK8PP5qatCELcfxi9x58dgUYf0e6I9dC9T-bbIxubEjzoPWEKDNjq225VmIWd9mKWT1CZm0Zel4nd3eHMwE0SPL0KaB1CWmRRcPt4bkgkMZRFS0bkQPNkL8UJ6ZFqmJNuY")' }}
            ></div>
            <div className="flex flex-col justify-center flex-1">
              <div className="flex justify-between items-start gap-3">
                <p className="text-slate-900 text-lg font-semibold leading-tight">{service?.model || 'Veiculo em pagamento'}</p>
                <span className="text-primary font-bold text-xl">R$ {service?.price?.toFixed(2) || '0,00'}</span>
              </div>
              <p className="text-slate-500 text-sm">{service?.type || 'Servico nao informado'}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Concluido ha 12 min
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
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handlePayment}
              className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <CheckCircle2 className="w-5 h-5" />
              Marcar como Pago
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-4 rounded-xl transition-colors active:scale-[0.98]"
            >
              Deixar Pendente
            </button>
          </div>
        </div>

        <div className="px-4 mt-8">
          <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3 px-1">Proximos na Fila</h3>
          <QueueItem
            title="Toyota RAV4 - Prata"
            subtitle="Lavagem Externa - R$ 45,00"
            price="R$ 45"
            imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuCctmuy5YFRzcOzj0tJgjVWJELS_i_fqN-XzPjQ4sijTY9mLLtnz-IGx3EyiOjt6wFR4Zm0le_pQCYsWcoWpbDWtq8DiHCBAFMmpEAkNt1fkj9bI_ho1rWB71QZ1sA5JJELjpe5hnPzl4aJZFXPJUxuQbvNq_KPOaevwV1r2Yq1x_84IgDa6EOeuX3c1UiHcd6BwTGpWggm6La1JU-8PTpEgoJhGSr2mKnY2bnRiRAicqEfb9ujoo5KoMlr0tjxru5Mqunmk-kuV0LN"
          />
          <QueueItem
            title="BMW M4 - Preto"
            subtitle="Polimento Premium - R$ 180,00"
            price="R$ 180"
            imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuCLTu-0pmD1YRgXF-_XJ9cnq9CH9_57eAWChhUV8FxMbFpKyRVhlPuiOeV67jbZOxqmluQSD01a-g0L6_Yr53UrDIjPndaPEFwX3ybEqoLZ8Cuy3nl0aZjVV85MSQ794a5gjIkMblIykGdUSkPb-_HdO5BI0FgmMLBZaKUcCetp7xhrS5lDurWgp6Wq_3FoYeDbxHKMSoQFAvjBUvJRhQK1tTw9FAjXnlQnPWW8UtvAYnupw4srtv654Ya8q1uWVZXukEqNMwepWKPZ"
          />
        </div>
      </div>
    </div>
  );
}

function QueueItem({ title, subtitle, price, imageUrl }: { title: string, subtitle: string, price: string, imageUrl: string }) {
  return (
    <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-100 mb-3 shadow-sm cursor-pointer active:scale-[0.98] active:bg-slate-50 transition-all">
      <div
        className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg w-14 h-14"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      ></div>
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
