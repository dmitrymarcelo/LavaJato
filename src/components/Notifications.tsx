import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, Trash2, X, Info, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Notification } from '../types';

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

export default function Notifications({ isOpen, onClose, notifications, onMarkAsRead, onClearAll }: NotificationsProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={onClose}
        className={`p-2.5 rounded-xl transition-all active:scale-95 border shadow-sm relative ${
          isOpen ? 'bg-primary text-white border-primary shadow-primary/20' : 'bg-white text-slate-500 border-slate-100 hover:text-primary'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={onClose} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden origin-top-right"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900">Notificações</h3>
                  {unreadCount > 0 && (
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/10">
                      {unreadCount} novas
                    </span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button 
                    onClick={onClearAll}
                    className="text-[10px] font-bold text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpar tudo
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center px-6">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                      <Bell className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-900">Tudo limpo por aqui!</p>
                    <p className="text-xs text-slate-500 mt-1">Você não tem novas notificações no momento.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifications.map((notification) => (
                      <motion.div 
                        layout
                        key={notification.id}
                        className={`p-4 hover:bg-slate-50 transition-colors relative group ${!notification.read ? 'bg-blue-50/30' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            !notification.read ? 'bg-white shadow-sm border border-slate-100' : 'bg-slate-100'
                          }`}>
                            {getIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className={`text-sm ${!notification.read ? 'font-black text-slate-900' : 'font-bold text-slate-600'}`}>
                                {notification.title}
                              </h4>
                              <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{notification.time}</span>
                            </div>
                            <p className={`text-xs mt-1 leading-relaxed ${!notification.read ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                              {notification.message}
                            </p>
                          </div>
                        </div>
                        
                        {!notification.read && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkAsRead(notification.id);
                            }}
                            className="absolute right-2 bottom-2 p-1.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 rounded-lg"
                            title="Marcar como lida"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
