/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Camera, CheckCircle2, CreditCard, Info, PlusCircle } from 'lucide-react';
import { Screen } from '../types';

export default function InspectionPost({ onNavigate, onCompleteWash }: { onNavigate: (screen: Screen) => void, onCompleteWash: () => void }) {
  const handleComplete = () => {
    onCompleteWash();
    onNavigate('payment');
  };

  return (
    <div className="flex flex-col min-h-full bg-white">
      <div className="p-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">Tarefa Atual</p>
              <h3 className="text-lg font-bold">Exterior + Interior Premium</h3>
              <p className="text-sm text-slate-500">Sedan • Branco • ABC-1234</p>
            </div>
            <div className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase">
              ETAPA 3/3
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-6 justify-between items-center">
              <p className="text-slate-700 text-sm font-medium">Progresso da Conclusão</p>
              <p className="text-primary text-sm font-bold">80%</p>
            </div>
            <div className="rounded-full bg-slate-100 h-2 overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: '80%' }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2">
        <h3 className="text-lg font-bold leading-tight tracking-tight">Veículo Limpo: Entrega Técnica</h3>
        <p className="text-slate-500 text-sm mt-1">Capture os 5 ângulos obrigatórios para validar a qualidade do serviço.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 pb-48">
        <CapturedPhoto label="Vista Frontal" imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuBlvuNUhemTXILPRs4U0LJnNEaIoQUcNVBE9M-n4W2q-1r5xTla9vUtaq0zRKxeYA4_mBlwQUzsw_q5YoqdgzIy-5RWhaiHHF44dEfzQWqeV7iJtVCU6Mzc39i_fqJkamYxEOIHyb45WwJhuUt8xRb6GOaKPx8cmREmVZa-iKrpPjOg_CKOXmp4MT6LogTJpt2yACIHCZlhcMVm0zhqfA2SxzDCWCJE4k2a8FZ7AWTIUDRJbNLE0URnyS60AmgaAcL3ddAo1L83SSEt" />
        <CapturedPhoto label="Vista Traseira" imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuDeTcgf46qH3XxgUD8ZKGyGG28HLD2ZAWZQQF210yjTbM4GK4tTAwpe6DS9jQjfOxpZDX27zVF9vOqXgEueZnQUt1b6VLTjBCizIAMjdpFGE2aEtBpb7JoJ0XHpBF-LQHzQNeToxPzwOO_0I6l6l87SkaOSs0by5f-PPizNsgFOInpcjOFdLEBBbpRBSc4ZjB4OsEGqWUf14aAqP5TCQXsfINu9pFql32q0TLmIzlJd4K_vuDM0PHzll2dvRcd-UQ53XOp6BPtmdkO0" />
        <CapturedPhoto label="Lateral Esquerda" imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuBk_W4g5n-Hh1FFelQsF6-QvQf9qXJPCBcFvuW8cgYeM7AQZ83blcw3CM_1m5zFopAnP3PHkWOTkF8dMx7bYOxQL7lyqfMPhRttCgbKtLLFgLk3rOS8QeOV_hpo6euLLcndujOoBPlnr7TRQE1bvQO662fRgjZH0e4EdUbqhuiqthnj1AQLFJ6WyT7MdSF23SvBZ1eiEqYZz0RFpp49Cym3zN59aE2zL2molcHsMyAovvxNuTG12iOe9hYS-GMaID0VEtuKH0JZfK53" />
        <CapturedPhoto label="Lateral Direita" imageUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuBUE0FpxIyviyfIAHH1Nt0JKUwlkn_UaFOuD6Z5h8buOvl75H_X1S7DHQ0ueQjAthqRDcqcAQzACQw8y5Wpv0Ck6OBCqOr0_OQfVznsTwb1Njs0AAraV51MK-cAreX0UKm3aaniI0ynHGWJiGxBeVI4onIN95Rw1k4Mq40JNy8QKzFqXhCFZgWn80Z81KSti4e4Sex0bV-33ZNszy1CzYyEG_iXcE_ksEd9Py3CrTiRLN6OqKOMJNtnqouoQtC4-CRcb3K4C4-qGBs5" />

        <div 
          onClick={() => alert('Abrindo câmera para capturar interior...')}
          className="relative group aspect-square rounded-xl overflow-hidden border-2 border-dashed border-primary bg-primary/5 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <div className="flex flex-col items-center gap-2 text-primary">
            <Camera className="w-10 h-10" />
            <p className="text-sm font-bold">Interior Limpo</p>
          </div>
          <div className="absolute top-2 right-2">
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
          </div>
        </div>

        <div 
          onClick={() => alert('Abrindo câmera para foto extra...')}
          className="relative group aspect-square rounded-xl overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <PlusCircle className="w-10 h-10" />
            <p className="text-sm font-bold">Foto Extra</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 pb-10 bg-white/95 backdrop-blur-lg border-t border-slate-100 pt-6 z-[70]">
        <button 
          onClick={handleComplete}
          className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
        >
          <span>Concluir e Liberar</span>
          <CreditCard className="w-5 h-5" />
        </button>
        <p className="text-center text-[10px] font-bold uppercase text-slate-400 mt-2">Valide a qualidade final antes de liberar o veículo</p>
      </div>
    </div>
  );
}

function CapturedPhoto({ label, imageUrl }: { label: string, imageUrl: string }) {
  return (
    <div className="relative group aspect-square rounded-xl overflow-hidden border-2 border-blue-500 bg-slate-200">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${imageUrl}')` }}></div>
      <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-3">
        <div className="flex justify-between items-center">
          <p className="text-white text-sm font-bold">{label}</p>
          <CheckCircle2 className="text-emerald-400 w-5 h-5 font-bold" />
        </div>
      </div>
    </div>
  );
}
