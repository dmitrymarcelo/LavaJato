/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, ReactNode, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  MessageSquare,
  Sparkles,
  X,
  Droplets,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Screen, Service, Notification, MOCK_NOTIFICATIONS, INITIAL_SERVICE_TYPES, VehicleCategory, VehicleType, VehicleRegistration } from './types';
import { getCarCareTips } from './services/geminiService';

// Components
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Notifications from './components/Notifications';

// Screens (to be implemented in separate files or as components here)
import Dashboard from './components/Dashboard';
import CheckIn from './components/CheckIn';
import InspectionPre from './components/InspectionPre';
import InspectionPost from './components/InspectionPost';
import Payment from './components/Payment';
import Filiais from './components/Filiais';
import ServiceHistory from './components/ServiceHistory';
import CustomerHistory from './components/CustomerHistory';
import Scheduling, { QueueSection } from './components/Scheduling';
import Settings from './components/Settings';
import Inventory from './components/Inventory';
import { getElapsedMinutes, getTodayDate } from './utils/app';
import { DEFAULT_VEHICLE_DB } from './data/vehicleSeed';

const DEMO_DATA_VERSION = '2026-03-06-seed-v1';

export default function App() {
  const normalizeScreen = (screen: Screen): Screen => screen === 'queue' ? 'scheduling' : screen;

  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    try {
      const saved = localStorage.getItem('currentScreen');
      return saved ? normalizeScreen(saved as Screen) : 'dashboard';
    } catch (e) {
      return 'dashboard';
    }
  });
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [services, setServices] = useState<Service[]>(() => {
    try {
      const saved = localStorage.getItem('services');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [serviceTypes, setServiceTypes] = useState<Record<VehicleType, VehicleCategory>>(() => {
    try {
      const saved = localStorage.getItem('service_types');
      return saved ? JSON.parse(saved) : INITIAL_SERVICE_TYPES;
    } catch (e) {
      return INITIAL_SERVICE_TYPES;
    }
  });
  const [vehicleDb, setVehicleDb] = useState<VehicleRegistration[]>(() => {
    try {
      const saved = localStorage.getItem('vehicle_db');
      return saved ? JSON.parse(saved) : DEFAULT_VEHICLE_DB;
    } catch (e) {
      return DEFAULT_VEHICLE_DB;
    }
  });

  useEffect(() => {
    try {
      const currentVersion = localStorage.getItem('demo_data_version');
      if (currentVersion !== DEMO_DATA_VERSION) {
        localStorage.setItem('services', JSON.stringify([]));
        localStorage.setItem('service_types', JSON.stringify(INITIAL_SERVICE_TYPES));
        localStorage.setItem('vehicle_db', JSON.stringify(DEFAULT_VEHICLE_DB));
        localStorage.setItem('team_members', JSON.stringify([]));
        localStorage.setItem('inventory_products', JSON.stringify([]));
        localStorage.setItem('service_appointments', JSON.stringify([]));
        localStorage.setItem('currentScreen', 'dashboard');
        localStorage.setItem('isAuthenticated', 'false');
        localStorage.setItem('demo_data_version', DEMO_DATA_VERSION);

        setServices([]);
        setServiceTypes(INITIAL_SERVICE_TYPES);
        setVehicleDb(DEFAULT_VEHICLE_DB);
        setCurrentScreen('dashboard');
        setIsAuthenticated(false);
        setActiveServiceId(null);
        setSelectedBase(null);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('service_types', JSON.stringify(serviceTypes));
    } catch (e) {}
  }, [serviceTypes]);

  useEffect(() => {
    try {
      localStorage.setItem('vehicle_db', JSON.stringify(vehicleDb));
    } catch (e) {}
  }, [vehicleDb]);

  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return localStorage.getItem('isAuthenticated') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [currentDateKey, setCurrentDateKey] = useState(() => getTodayDate());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockNow(Date.now());
      setCurrentDateKey(getTodayDate());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setServices(prev =>
      prev
        .map(service => {
          const scheduledDate = service.scheduledDate
            || service.startTime?.slice(0, 10)
            || service.endTime?.slice(0, 10)
            || currentDateKey;
          const scheduledTime = service.scheduledTime
            || service.startTime?.slice(11, 16)
            || '08:00';

          return {
            ...service,
            scheduledDate,
            scheduledTime,
          };
        })
        .filter(service => (service.scheduledDate || currentDateKey) >= currentDateKey)
    );
  }, [currentDateKey]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  useEffect(() => {
    try {
      localStorage.setItem('isAuthenticated', isAuthenticated.toString());
    } catch (e) {}
  }, [isAuthenticated]);

  useEffect(() => {
    try {
      localStorage.setItem('services', JSON.stringify(services));
    } catch (e) {}
  }, [services]);

  useEffect(() => {
    try {
      localStorage.setItem('currentScreen', currentScreen);
    } catch (e) {}
  }, [currentScreen]);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);
    
    try {
      const aiResponse = await getCarCareTips(userMsg);
      setChatHistory(prev => [...prev, { role: 'ai', text: aiResponse }]);
    } catch (error: any) {
      setChatHistory(prev => [...prev, { role: 'ai', text: error.message || 'Erro ao conectar com o assistente.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const updateServiceStatus = (id: string, status: Service['status']) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const updateServiceWashers = (id: string, washers: string[]) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, washers } : s));
  };

  const addService = (service: Service) => {
    setServices(prev => [service, ...prev]);
  };

  const reorderServices = (newServices: Service[]) => {
    setServices(newServices);
  };

  const navigateTo = (screen: Screen) => {
    setCurrentScreen(normalizeScreen(screen));
  };

  const handleNavigateWithService = (screen: Screen, serviceId?: string) => {
    if (serviceId) setActiveServiceId(serviceId);
    navigateTo(screen);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveServiceId(null);
    setSelectedBase(null);
    navigateTo('login');
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    navigateTo('dashboard');
  };

  const updateActiveServiceStatus = (status: Service['status']) => {
    if (!activeServiceId) {
      navigateTo('scheduling');
      return;
    }

    updateServiceStatus(activeServiceId, status);
  };

  const activeService = services.find((service) => service.id === activeServiceId) || null;
  const activeServiceElapsedMinutes = getElapsedMinutes(activeService?.startTime, clockNow);

  const renderScreen = () => {
    if (!isAuthenticated) return <Login onLogin={handleLogin} />;

    switch (currentScreen) {
      case 'dashboard': return <Dashboard onNavigate={navigateTo} services={services} />;
      case 'checkin': return <CheckIn onNavigate={navigateTo} onAddService={addService} serviceTypes={serviceTypes} vehicleDb={vehicleDb} />;
      case 'inspection-pre': return <InspectionPre elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onStartWash={(washers) => {
        if (activeServiceId) {
          updateServiceWashers(activeServiceId, washers);
          updateServiceStatus(activeServiceId, 'in_progress');
        }
      }} />;
      case 'inspection-post': return <InspectionPost elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onCompleteWash={() => updateActiveServiceStatus('waiting_payment')} />;
      case 'payment': return <Payment elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onPaymentComplete={() => updateActiveServiceStatus('completed')} />;
      case 'history': return <ServiceHistory onNavigate={navigateTo} />;
      case 'customer-history': return <CustomerHistory onNavigate={navigateTo} />;
      case 'queue':
      case 'scheduling': 
        if (!selectedBase) {
          return <Filiais onNavigate={navigateTo} onSelectBase={(baseId) => {
            setSelectedBase(baseId);
          }} />;
        }
        return <Scheduling currentDateKey={currentDateKey} onNavigate={handleNavigateWithService} services={services} onAddService={addService} onReorder={reorderServices} serviceTypes={serviceTypes} vehicleDb={vehicleDb} onClearBase={() => {
          setSelectedBase(null);
        }} />;
      case 'inventory': return <Inventory onNavigate={navigateTo} />;
      case 'washing': return (
        <div className="p-4">
          <QueueSection 
            title="Em Lavagem" 
            services={services.filter(s => s.status === 'in_progress')} 
            timers={{}} 
            onAction={(s) => {
              if (s.status === 'in_progress') {
                handleNavigateWithService('inspection-post', s.id);
              }
            }} 
            onMove={() => {}} 
          />
        </div>
      );
      case 'settings': return <Settings onNavigate={navigateTo} serviceTypes={serviceTypes} onUpdateServiceTypes={setServiceTypes} vehicleDb={vehicleDb} onUpdateVehicleDb={setVehicleDb} />;
      default: return <Dashboard onNavigate={navigateTo} services={services} />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white min-h-screen flex transition-colors">
        {isAuthenticated && (
          <Sidebar 
            currentScreen={currentScreen} 
            onNavigate={navigateTo} 
            onLogout={handleLogout} 
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />
        )}

        <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden">
          {/* Header */}
          {isAuthenticated && (
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-3 lg:hidden">
                <img 
                  src="https://teslaeventos.com.br/assets/logos/NORTETECH-CIRCLE.png" 
                  alt="Norte Tech Logo" 
                  className="w-8 h-8 object-contain"
                  referrerPolicy="no-referrer"
                />
                <h1 className="text-lg font-black text-slate-900 tracking-tight">Norte Tech</h1>
              </div>
              
              <div className="hidden lg:block">
                <h2 className="text-xl font-black text-slate-900 tracking-tight capitalize">
                  {currentScreen === 'dashboard' ? 'Painel' : 
                   currentScreen === 'checkin' ? 'Check-in' :
                   currentScreen === 'queue' || currentScreen === 'scheduling' ? 'Agenda & Fila' :
                   currentScreen === 'inspection-pre' ? 'Inspeção Pré' :
                   currentScreen === 'inspection-post' ? 'Inspeção Pós' :
                   currentScreen === 'payment' ? 'Pagamento' :
                   currentScreen === 'history' ? 'Histórico' :
                   currentScreen === 'customer-history' ? 'Histórico Clientes' :
                   currentScreen === 'inventory' ? 'Estoque' :
                   currentScreen === 'settings' ? 'Configurações' : currentScreen.replace('-', ' ')}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gestão de Estética Automotiva</p>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigateTo('settings')}
                  className="p-2.5 rounded-xl bg-white text-slate-500 hover:text-primary transition-all active:scale-95 border border-slate-100 shadow-sm"
                >
                  <SettingsIcon className="w-5 h-5" />
                </button>
                <Notifications 
                  isOpen={isNotificationsOpen}
                  onClose={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  notifications={notifications}
                  onMarkAsRead={handleMarkAsRead}
                  onClearAll={handleClearNotifications}
                />
              </div>
            </header>
          )}

          <main className={`flex-1 overflow-y-auto ${isAuthenticated ? 'pb-24 lg:pb-8' : ''}`}>
            <div className="mx-auto h-full w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentScreen + (isAuthenticated ? 'auth' : 'noauth')}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  {renderScreen()}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {/* Bottom Navigation (Mobile Only) */}
          {isAuthenticated && !['checkin', 'inspection-pre', 'inspection-post', 'payment'].includes(currentScreen) && (
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-2 pb-8 pt-3 flex items-center justify-around z-50 transition-colors">
              <NavButton 
                active={currentScreen === 'dashboard'} 
                onClick={() => navigateTo('dashboard')}
                icon={<LayoutDashboard className="w-6 h-6" />}
                label="Painel"
              />
              <NavButton 
                active={currentScreen === 'scheduling' || currentScreen === 'queue'} 
                onClick={() => navigateTo('scheduling')}
                icon={<Droplets className="w-6 h-6" />}
                label="Agenda & Fila"
              />
              <NavButton 
                active={currentScreen === 'inventory'} 
                onClick={() => navigateTo('inventory')}
                icon={<Package className="w-6 h-6" />}
                label="Estoque"
              />
            </nav>
          )}

          {/* Floating AI Assistant Button */}
          {isAuthenticated && (
            <button 
              onClick={() => setIsAssistantOpen(true)}
              className="fixed bottom-24 lg:bottom-8 right-6 w-14 h-14 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group"
            >
              <Sparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" />
              <div className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
                Assistente IA
              </div>
            </button>
          )}

          {/* AI Assistant Modal */}
          <AnimatePresence>
            {isAssistantOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="fixed inset-0 z-[60] flex items-end justify-center p-4 bg-black/20 backdrop-blur-sm"
              >
                <div className="bg-white w-full max-w-[400px] rounded-3xl shadow-2xl flex flex-col h-[70vh] overflow-hidden border border-slate-100">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-primary text-white">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <span className="font-bold">Assistente Pro</span>
                    </div>
                    <button onClick={() => setIsAssistantOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatHistory.length === 0 && (
                      <div className="text-center py-10 text-slate-400">
                        <p className="text-sm">Olá! Sou seu assistente especialista em estética automotiva. Como posso ajudar hoje?</p>
                      </div>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                          msg.role === 'user' 
                            ? 'bg-primary text-white rounded-tr-none' 
                            : 'bg-slate-100 text-slate-800 rounded-tl-none'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-slate-100">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Pergunte sobre limpeza..."
                        className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary outline-none text-slate-900 placeholder:text-slate-400"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={isTyping}
                        className="bg-primary text-white p-3 rounded-xl hover:bg-blue-600 active:scale-95 transition-all"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${active ? 'text-primary' : 'text-slate-400'}`}
    >
      {icon}
      <p className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</p>
    </button>
  );
}
