/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CreditCard, Clock, User, CheckCircle2, Share2, Verified } from 'lucide-react';
import { Screen } from '../types';

export default function ServiceHistory({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  return (
    <div className="flex flex-col min-h-full pb-24 bg-white">
      {/* Status Banner */}
      <section className="p-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500 text-white rounded-full p-2 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Status de Pagamento</p>
              <p className="text-sm font-bold">Pago e Finalizado</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-emerald-500">R$ 180,00</p>
            <p className="text-[10px] font-medium text-slate-500 uppercase">via PIX</p>
          </div>
        </div>
      </section>

      {/* Time and Info */}
      <section className="px-4 py-2 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <p className="text-[10px] font-bold uppercase text-slate-400">Horário Entrada</p>
            </div>
            <p className="text-sm font-semibold">24 Out, 10:15</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <p className="text-[10px] font-bold uppercase text-slate-400">Horário Saída</p>
            </div>
            <p className="text-sm font-semibold">24 Out, 11:05</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Duração do Serviço</span>
            <span className="text-sm font-medium">50 min</span>
          </div>
          <div className="border-t border-slate-50 pt-3 flex justify-between items-center">
            <span className="text-sm text-slate-500">Lavadores Responsáveis</span>
            <div className="flex items-center -space-x-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 border-2 border-white flex items-center justify-center text-[10px] font-bold text-primary">MC</div>
              <div className="w-7 h-7 rounded-full bg-purple-500/20 border-2 border-white flex items-center justify-center text-[10px] font-bold text-purple-600">JS</div>
              <span className="ml-3 text-sm font-medium">Marcus e João</span>
            </div>
          </div>
          <div className="border-t border-slate-50 pt-3 flex justify-between items-center">
            <span className="text-sm text-slate-500">Tipo de Serviço</span>
            <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Lavagem Premium</span>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="mt-6">
        <div className="px-4 mb-3 flex items-center justify-between">
          <h2 className="text-md font-bold">Galeria do Serviço</h2>
          <span className="text-[10px] px-2 py-1 bg-slate-100 rounded-full text-slate-500 font-bold uppercase">Total: 10 fotos</span>
        </div>
        
        <div className="space-y-6 px-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fotos de Entrada (Antes)</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              <HistoryPhoto label="Cam 1" imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuAlvs4m9AB5rOIOX0jOZe0ukJoiX54qyzbDmVy6d_9l5FOiA_Dx4xSd9vWjRXj0aKayQybiqEepPDebExI57gQKo6e4DUBEGNRn5tmoc3nbjm86FJ_tJzRQRGwCIbe0M-79sDb_5EIxirIv-UPEsrRhENs906zmBV-13QdGV9jJoPtC86m7zwUzXG82iO7BtQHgnxruL8JxJMTCjyFSBye3lYtXOiKIDGKM2U8Dn1pE1liFfLcvNqOMJbl9r3XMsm-xEXyTI9jt4E3X" />
              <HistoryPhoto label="Cam 2" imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuC-wCMJUoom0QEmi-wPaR3YJSHTEQ-JGKPMUWyOKYFcGMSbGJ0e4cTQ3s--fvdES5Wv30QIOLcTdv5V6tTiHTLPmjFCFxiD-mkpkYbmDXgUVWNm0t1b68TQUvRXmtz98qgq4_aDGWKZu0yRJtD_1EQlfADmHz3Igv9apGsfh0XqLaIou33lM68ZHIRf339POevTJL7ioiHCHpeTunWEdXj-8MJQlOaK9hJpn--QBX9kH2W9x5zZnsqP-dlfCS5l8IDuxsqd--cOG0jc" />
              <HistoryPhoto imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuDdmt-aZepDJIZiuqtFVRC6o5ZmR5GyV4zPEYGdP6iPTtp03I3nrARpLtBazfypEXy1lbvcJMU-tqyKVetDm446TIP2wqP5p_OpwXN12rNde3wrVDbc04vL9n_hP0eBvPBjpEgnDozPrqMzLkB7eQ_lreZdbgtvAjgcGDfNgUFdEjB8GCuTXBUmuZq7Q14VlZbJQhTPANfFuY_u9O2fz5XzmFiXzL8vFTONWHVgTnULSzExBw98HavY4_7jZnn2bZry1QgiaUmbrEvd" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fotos de Entrega (Depois)</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              <HistoryPhoto label="Final" imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuDyp8fl_ibYwhMShnfMYXmW-ANIyLaQG8ltHNJZmyHhHOZZ5CsJUavS5_T2w6_Rl13KfkaOO1NJCF-1ZYZSYqJFgFZPHUpB_Q-lJ9K1AEvI8MNNheCN9IVfsGC6nsvlJYU338_MBzZOqgjy9_C4KXVGVz2Dg4e5Sa8M1ysaro-NYeGeTaXocctPaexYhCLYDpekTI9hT9zDSF26rnkbDUj6j-eIeuhnbZ7eJyQWR-56SN2_ozU5YbS2lanFRMvhOm2PFTyfJhKAlQ4X" active />
              <HistoryPhoto imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuCzTCBDI28MpfvjR9vBQHcen94To0eVp3rr3qy-EWUTsg5Iqt-DyIQimSV_cXB2SSLUwWauDvKOaV6L5Hw4MFgb13tUloCAL4eYSlXncSc0995ShVcGC7D2GzwrrmRwUFjXgK1vzj3Vq9eqJziK5Vb_NzRlComBUyHm542qsKVEJcVXlfnD38XfcBxVIz3kG7CaSzO9ufWiP1YZd-EmLIl4_rCIh14u8IghhvdWp2KjfYcYiPmx9A6HgEsRgKME6m5FrBsvR4aOwlAe" />
            </div>
          </div>
        </div>
      </section>

      {/* Observations */}
      <section className="p-4 mt-4">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Observações da Equipe</h3>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm italic text-sm text-slate-600">
          "Cliente solicitou atenção especial nas rodas e caixas de roda. Aplicado selante cerâmico conforme pacote premium. Veículo sem avarias prévias identificadas."
        </div>
        <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
          <Verified className="w-3 h-3" />
          <span>Auditoria completa e aprovada pelo gerente às 11:10</span>
        </div>
      </section>
    </div>
  );
}

function HistoryPhoto({ label, imageUrl, active }: { label?: string, imageUrl: string, active?: boolean }) {
  return (
    <div className={`shrink-0 w-36 h-36 rounded-lg bg-slate-100 overflow-hidden relative border cursor-pointer active:scale-95 transition-all ${active ? 'border-emerald-500/30 ring-2 ring-emerald-500/10' : 'border-slate-200'}`}>
      <img className="w-full h-full object-cover" src={imageUrl} alt={label || 'Service photo'} />
      {label && (
        <span className={`absolute bottom-1 right-1 ${active ? 'bg-emerald-500/80' : 'bg-black/60'} text-[8px] px-1 text-white rounded`}>{label}</span>
      )}
    </div>
  );
}
