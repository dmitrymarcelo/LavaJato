import React from 'react';
import {
  LayoutDashboard,
  Settings,
  LogOut,
  History,
  ChevronRight,
  ChevronLeft,
  Package,
  Droplets
} from 'lucide-react';
import { motion } from '../lib/motion';
import { Screen, TeamMember } from '../types';
import { getSafeLogoSrc } from '../lib/placeholders';

interface SidebarProps {
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
  currentUser?: TeamMember | null;
}

export default function Sidebar({ currentScreen, onNavigate, onLogout, isOpen, onToggle, currentUser }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Painel', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'scheduling', label: 'Agenda & Fila', icon: <Droplets className="w-5 h-5" /> },
    { id: 'vehicle-history', label: 'Historico de Veiculos', icon: <History className="w-5 h-5" /> },
    { id: 'inventory', label: 'Estoque', icon: <Package className="w-5 h-5" /> },
    { id: 'settings', label: 'Configuracoes', icon: <Settings className="w-5 h-5" /> },
  ];

  const visibleMenuItems = currentUser?.role === 'Clientes'
    ? menuItems.filter((item) => item.id === 'scheduling')
    : menuItems.filter((item) => item.id !== 'settings' || currentUser?.role === 'Administrador');

  return (
    <div className="hidden lg:flex relative h-screen sticky top-0 z-50">
      <motion.aside
        initial={{ width: 288 }}
        animate={{ width: isOpen ? 288 : 88 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white border-r border-slate-100 h-full overflow-hidden flex flex-col"
      >
        <div className={`p-6 xl:p-8 flex items-center gap-3 transition-all duration-300 ${isOpen ? 'min-w-[288px]' : 'min-w-[88px] justify-center px-0'}`}>
          <img
            src={getSafeLogoSrc()}
            alt="Norte Tech Logo"
            className="w-10 h-10 object-contain shrink-0"
            referrerPolicy="no-referrer"
          />
          {isOpen && <h1 className="text-xl font-black text-slate-900 tracking-tight whitespace-nowrap">Norte <span className="text-primary">Tech</span></h1>}
        </div>

        <nav className={`flex-1 space-y-2 py-4 transition-all duration-300 ${isOpen ? 'px-4 min-w-[288px]' : 'px-3 min-w-[88px]'}`}>
          {visibleMenuItems.map((item) => {
            const isActive = currentScreen === item.id || (item.id === 'vehicle-history' && currentScreen === 'vehicle-history-detail');

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as Screen)}
                title={!isOpen ? item.label : undefined}
                className={`w-full flex items-center rounded-2xl transition-all group ${
                  isOpen ? 'justify-between px-4 py-3.5' : 'justify-center p-3.5'
                } ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  {isOpen && <span className="font-bold text-sm whitespace-nowrap">{item.label}</span>}
                </div>
                {isOpen && <ChevronRight className={`w-4 h-4 transition-transform shrink-0 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1'}`} />}
              </button>
            );
          })}
        </nav>

        <div className={`border-t border-slate-100 transition-all duration-300 ${isOpen ? 'p-6 min-w-[288px]' : 'p-4 min-w-[88px] flex flex-col items-center'}`}>
          <div className={`bg-slate-50 rounded-2xl flex items-center gap-3 ${isOpen ? 'p-4 mb-4' : 'p-2 mb-4 justify-center'}`}>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
              {(currentUser?.name || 'U').slice(0, 2).toUpperCase()}
            </div>
            {isOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{currentUser?.name || 'Usuario'}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{currentUser?.role || 'Perfil'}</p>
              </div>
            )}
          </div>

          <button
            onClick={onLogout}
            title={!isOpen ? 'Sair da Conta' : undefined}
            className={`flex items-center text-rose-500 hover:bg-rose-50 transition-colors font-bold text-sm rounded-xl ${
              isOpen ? 'w-full gap-3 px-4 py-3' : 'justify-center p-3'
            }`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isOpen && <span className="whitespace-nowrap">Sair da Conta</span>}
          </button>
        </div>
      </motion.aside>

      <button
        onClick={onToggle}
        className="absolute top-8 -right-3 w-6 h-6 bg-white border border-slate-100 shadow-md rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors z-50"
      >
        <ChevronLeft className={`w-3 h-3 transition-transform duration-300 ${!isOpen ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
