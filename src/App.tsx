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
import { Screen, Service, Notification, INITIAL_SERVICE_TYPES, VehicleCategory, VehicleType, VehicleRegistration, Product, TeamMember } from './types';
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
import { api, Appointment } from './services/api';
import { getBaseById } from './data/bases';

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
  const [services, setServices] = useState<Service[]>([]);
  const [serviceTypes, setServiceTypes] = useState<Record<VehicleType, VehicleCategory>>(INITIAL_SERVICE_TYPES);
  const [vehicleDb, setVehicleDb] = useState<VehicleRegistration[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);

  const [activeServiceId, setActiveServiceId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('activeServiceId');
    } catch (e) {
      return null;
    }
  });
  const [selectedBase, setSelectedBase] = useState<string | null>(() => {
    try {
      return localStorage.getItem('selectedBase');
    } catch (e) {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return localStorage.getItem('isAuthenticated') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [currentDateKey, setCurrentDateKey] = useState(() => getTodayDate());
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

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
      localStorage.setItem('currentScreen', currentScreen);
    } catch (e) {}
  }, [currentScreen]);

  useEffect(() => {
    try {
      if (selectedBase) {
        localStorage.setItem('selectedBase', selectedBase);
      } else {
        localStorage.removeItem('selectedBase');
      }
    } catch (e) {}
  }, [selectedBase]);

  useEffect(() => {
    try {
      if (activeServiceId) {
        localStorage.setItem('activeServiceId', activeServiceId);
      } else {
        localStorage.removeItem('activeServiceId');
      }
    } catch (e) {}
  }, [activeServiceId]);

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

  const loadBootstrap = async () => {
    setIsBootstrapping(true);
    setBackendError(null);
    try {
      const data = await api.bootstrap();
      setServiceTypes(data.serviceTypes || INITIAL_SERVICE_TYPES);
      setVehicleDb(data.vehicleDb || []);
      setServices(data.services || []);
      setAppointments(data.appointments || []);
      setProducts(data.products || []);
      setTeam(data.team || []);
    } catch (error: any) {
      setBackendError(error.message || 'Nao foi possivel carregar os dados persistentes.');
    } finally {
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadBootstrap();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (activeServiceId && !services.some((service) => service.id === activeServiceId)) {
      setActiveServiceId(null);
    }
  }, [services, activeServiceId]);

  const persistServiceTypes = async (next: Record<VehicleType, VehicleCategory>) => {
    setServiceTypes(next);
    await api.saveServiceTypes(next);
  };

  const persistVehicleDb = async (next: VehicleRegistration[]) => {
    setVehicleDb(next);
    await api.saveVehicles(next);
  };

  const persistServices = async (next: Service[]) => {
    setServices(next);
    await api.saveServices(next);
  };

  const persistServicesWithUpdater = (updater: (current: Service[]) => Service[]) => {
    setServices(current => {
      const next = updater(current);
      void api.saveServices(next);
      return next;
    });
  };

  const persistAppointments = async (next: Appointment[]) => {
    setAppointments(next);
    await api.saveAppointments(next);
  };

  const persistProducts = async (next: Product[]) => {
    setProducts(next);
    await api.saveProducts(next);
  };

  const persistTeam = async (next: TeamMember[]) => {
    setTeam(next);
    await api.saveTeam(next);
  };

  const updateServiceRecord = (id: string, updater: (service: Service) => Service) => {
    persistServicesWithUpdater(current => current.map(service => (service.id === id ? updater(service) : service)));
  };

  const touchServiceTimeline = (id: string, timelineKey: keyof NonNullable<Service['timeline']>) => {
    updateServiceRecord(id, (service) => {
      const nowIso = new Date().toISOString();
      return {
        ...service,
        timeline: {
          ...(service.timeline || {}),
          [timelineKey]: service.timeline?.[timelineKey] || nowIso,
        },
      };
    });
  };

  const addService = (service: Service) => {
    persistServicesWithUpdater(current => [service, ...current]);
  };

  const reorderServices = (newServices: Service[]) => {
    void persistServices(newServices);
  };

  const navigateTo = (screen: Screen) => {
    setCurrentScreen(normalizeScreen(screen));
  };

  const handleNavigateWithService = (screen: Screen, serviceId?: string) => {
    if (serviceId) {
      setActiveServiceId(serviceId);
    }

    if (serviceId && screen === 'inspection-pre') {
      touchServiceTimeline(serviceId, 'preInspectionStartedAt');
    }

    if (serviceId && screen === 'inspection-post') {
      touchServiceTimeline(serviceId, 'postInspectionStartedAt');
    }

    if (serviceId && screen === 'payment') {
      touchServiceTimeline(serviceId, 'paymentStartedAt');
    }

    navigateTo(screen);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveServiceId(null);
    setSelectedBase(null);
    navigateTo('login');
  };

  const handleLogin = async (registration: string, password: string) => {
    await api.login(registration, password);
    setIsAuthenticated(true);
    navigateTo('dashboard');
  };

  const activeService = services.find((service) => service.id === activeServiceId) || null;
  const activeServiceElapsedMinutes = getElapsedMinutes(activeService?.startTime, clockNow);
  const selectedBaseInfo = getBaseById(selectedBase);

  useEffect(() => {
    if (!isAuthenticated || !services.length || !appointments.length) {
      return;
    }

    const nowIso = new Date().toISOString();
    let hasServiceChanges = false;
    let hasAppointmentChanges = false;

    const nextServices = services.map((service) => {
      if ((service.scheduledDate || currentDateKey) < currentDateKey && service.status === 'pending') {
        hasServiceChanges = true;
        return {
          ...service,
          status: 'no_show' as const,
          timeline: {
            ...(service.timeline || {}),
            noShowAt: service.timeline?.noShowAt || nowIso,
          },
        };
      }

      return service;
    });

    const nextAppointments = appointments.map((appointment) => {
      if (appointment.date < currentDateKey && !['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
        hasAppointmentChanges = true;
        return {
          ...appointment,
          status: 'no_show' as const,
        };
      }

      return appointment;
    });

    if (!hasServiceChanges && !hasAppointmentChanges) {
      return;
    }

    if (hasServiceChanges) {
      setServices(nextServices);
      void api.saveServices(nextServices);
    }

    if (hasAppointmentChanges) {
      setAppointments(nextAppointments);
      void api.saveAppointments(nextAppointments);
    }
  }, [isAuthenticated, currentDateKey, services, appointments]);

  const renderScreen = () => {
    if (!isAuthenticated) return <Login onLogin={handleLogin} />;
    if (isBootstrapping) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Carregando dados persistentes...</div>;
    if (backendError) return <div className="min-h-screen flex items-center justify-center p-6 text-center text-rose-600 font-bold">{backendError}</div>;

    switch (currentScreen) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigateWithService} services={services} team={team} />;
      case 'checkin': return <CheckIn onNavigate={navigateTo} onAddService={addService} serviceTypes={serviceTypes} vehicleDb={vehicleDb} selectedBaseId={selectedBaseInfo?.id} selectedBaseName={selectedBaseInfo?.name} />;
      case 'inspection-pre': return <InspectionPre service={activeService} teamMembers={team} elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onStartWash={(washers) => {
        if (activeServiceId) {
          updateServiceRecord(activeServiceId, (service) => {
            const nowIso = new Date().toISOString();
            return {
              ...service,
              washers,
              status: 'in_progress',
              startTime: nowIso,
              timeline: {
                ...(service.timeline || {}),
                preInspectionStartedAt: service.timeline?.preInspectionStartedAt || nowIso,
                preInspectionCompletedAt: nowIso,
                washStartedAt: nowIso,
              },
            };
          });
        }
      }} />;
      case 'inspection-post': return <InspectionPost service={activeService} elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onCompleteWash={() => {
        if (activeServiceId) {
          updateServiceRecord(activeServiceId, (service) => {
            const nowIso = new Date().toISOString();
            return {
              ...service,
              status: 'waiting_payment',
              endTime: nowIso,
              timeline: {
                ...(service.timeline || {}),
                postInspectionStartedAt: service.timeline?.postInspectionStartedAt || nowIso,
                washCompletedAt: nowIso,
                postInspectionCompletedAt: nowIso,
              },
            };
          });
        }
      }} />;
      case 'payment': return <Payment service={activeService} elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onPaymentComplete={() => {
        if (activeServiceId) {
          updateServiceRecord(activeServiceId, (service) => {
            const nowIso = new Date().toISOString();
            return {
              ...service,
              status: 'completed',
              timeline: {
                ...(service.timeline || {}),
                paymentStartedAt: service.timeline?.paymentStartedAt || nowIso,
                paymentCompletedAt: nowIso,
                completedAt: nowIso,
              },
            };
          });
        }
      }} />;
      case 'history': return <ServiceHistory onNavigate={handleNavigateWithService} service={activeService} />;
      case 'customer-history': return <CustomerHistory onNavigate={handleNavigateWithService} selectedService={activeService} services={services} />;
      case 'queue':
      case 'scheduling': 
        if (!selectedBase) {
          return <Filiais onNavigate={navigateTo} onSelectBase={(baseId) => {
            setSelectedBase(baseId);
          }} />;
        }
        return <Scheduling currentDateKey={currentDateKey} appointments={appointments} onUpdateAppointments={persistAppointments} onNavigate={handleNavigateWithService} services={services} onAddService={addService} onReorder={reorderServices} serviceTypes={serviceTypes} vehicleDb={vehicleDb} selectedBaseId={selectedBaseInfo?.id} selectedBaseName={selectedBaseInfo?.name} onClearBase={() => {
          setSelectedBase(null);
        }} />;
      case 'inventory': return <Inventory onNavigate={navigateTo} products={products} onUpdateProducts={persistProducts} />;
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
      case 'settings': return <Settings onNavigate={navigateTo} serviceTypes={serviceTypes} onUpdateServiceTypes={persistServiceTypes} vehicleDb={vehicleDb} onUpdateVehicleDb={persistVehicleDb} team={team} onUpdateTeam={persistTeam} />;
      default: return <Dashboard onNavigate={handleNavigateWithService} services={services} team={team} />;
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
