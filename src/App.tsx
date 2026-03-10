/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, ReactNode, useEffect, useRef } from 'react';
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
import { Screen, Service, Notification, INITIAL_SERVICE_TYPES, RoleAccessRule, VehicleCategory, VehicleType, VehicleRegistration, Product, TeamMember } from './types';
import { getCarCareTips } from './services/geminiService';

import Sidebar from './components/Sidebar';
import Notifications from './components/Notifications';
import Scheduling, { QueueSection } from './components/Scheduling';
import { getElapsedMinutes, getServicePreviewImage, getTodayDate, normalizeDateKey } from './utils/app';
import { api, ApiError, Appointment } from './services/api';
import { BASES, getBaseById } from './data/bases';

const LEGACY_STORAGE_KEYS = ['bootstrapCacheV2', 'bootstrapCacheV3', 'vehicleDbCacheV1', 'authUserV1', 'selectedBase', 'activeServiceId', 'access_rules', 'appCacheVersion', 'authToken'];

const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const CheckIn = lazy(() => import('./components/CheckIn'));
const InspectionPre = lazy(() => import('./components/InspectionPre'));
const InspectionPost = lazy(() => import('./components/InspectionPost'));
const Payment = lazy(() => import('./components/Payment'));
const ServiceHistory = lazy(() => import('./components/ServiceHistory'));
const CustomerHistory = lazy(() => import('./components/CustomerHistory'));
const Settings = lazy(() => import('./components/Settings'));
const Inventory = lazy(() => import('./components/Inventory'));

export default function App() {
  const normalizeScreen = (screen: Screen): Screen => screen === 'queue' ? 'scheduling' : screen;
  const mergeServiceTypes = (next?: Partial<Record<VehicleType, VehicleCategory>> | null): Record<VehicleType, VehicleCategory> => ({
    ...INITIAL_SERVICE_TYPES,
    ...(next || {}),
  });

  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
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
  const [accessRules, setAccessRules] = useState<RoleAccessRule[]>([]);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => api.getAuthToken());
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [currentDateKey, setCurrentDateKey] = useState(() => getTodayDate());
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isVehicleDbLoading, setIsVehicleDbLoading] = useState(false);
  const [hasLoadedVehicleDbFromApi, setHasLoadedVehicleDbFromApi] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const servicesRef = useRef<Service[]>([]);
  const appointmentsRef = useRef<Appointment[]>([]);
  const vehicleDbRef = useRef<VehicleRegistration[]>([]);
  const productsRef = useRef<Product[]>([]);
  const teamRef = useRef<TeamMember[]>([]);
  const servicesSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const appointmentsSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const vehiclesSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const productsSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const teamSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isAuthenticated = Boolean(authToken);
  const isClientUser = currentUser?.role === 'Clientes';

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

  useEffect(() => {
    servicesRef.current = services;
  }, [services]);

  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);

  useEffect(() => {
    vehicleDbRef.current = vehicleDb;
  }, [vehicleDb]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    teamRef.current = team;
  }, [team]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  useEffect(() => {
    api.setAuthToken(authToken);
  }, [authToken]);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    try {
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch (error) {}
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
      const nextServiceTypes = mergeServiceTypes(data.serviceTypes);
      const nextServices = (data.services || []).map(service => ({
        ...service,
        scheduledDate: normalizeDateKey(service.scheduledDate),
      }));
      const nextAppointments = (data.appointments || []).map(appointment => ({
        ...appointment,
        date: normalizeDateKey(appointment.date),
      }));
      const nextProducts = data.products || [];
      const nextTeam = data.team || [];

      setServiceTypes(nextServiceTypes);
      setCurrentUser(data.currentUser || null);
      setAccessRules(Array.isArray(data.accessRules) ? data.accessRules : []);
      setServices(nextServices);
      setAppointments(nextAppointments);
      setProducts(nextProducts);
      setTeam(nextTeam);
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 401) {
        performClientLogout();
        setBackendError(null);
        return;
      }

      setBackendError(error.message || 'Nao foi possivel carregar os dados persistentes.');
    } finally {
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadBootstrap();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && isClientUser && currentScreen !== 'scheduling') {
      setCurrentScreen('scheduling');
    }
  }, [isAuthenticated, isClientUser, currentScreen]);

  useEffect(() => {
    if (!currentUser) {
      setSelectedBase(null);
      return;
    }

    if (currentUser.role !== 'Clientes') {
      if (selectedBase && !getBaseById(selectedBase)) {
        setSelectedBase(null);
      }
      return;
    }

    const allowedBaseIds = (currentUser.allowedBaseIds || []).filter((baseId) => Boolean(getBaseById(baseId)));
    const nextBaseId = selectedBase && allowedBaseIds.includes(selectedBase)
      ? selectedBase
      : (allowedBaseIds[0] || null);

    if (nextBaseId !== selectedBase) {
      setSelectedBase(nextBaseId);
    }
  }, [currentUser, selectedBase]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!['checkin', 'settings'].includes(currentScreen)) {
      return;
    }

    if (isVehicleDbLoading || hasLoadedVehicleDbFromApi) {
      return;
    }

    let cancelled = false;

    const loadVehicles = async () => {
      setIsVehicleDbLoading(true);
      try {
        const vehicles = await api.getVehicles();
        if (cancelled) {
          return;
        }

        setVehicleDb(vehicles);
        vehicleDbRef.current = vehicles;
        setHasLoadedVehicleDbFromApi(true);
      } catch (error: any) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setIsVehicleDbLoading(false);
        }
      }
    };

    void loadVehicles();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, currentScreen, isVehicleDbLoading, hasLoadedVehicleDbFromApi]);

  useEffect(() => {
    if (activeServiceId && !services.some((service) => service.id === activeServiceId)) {
      setActiveServiceId(null);
    }
  }, [services, activeServiceId]);

  const persistServiceTypes = async (next: Record<VehicleType, VehicleCategory>) => {
    const merged = mergeServiceTypes(next);
    setServiceTypes(merged);
    await api.saveServiceTypes(merged);
  };

  const persistAccessRules = async (next: RoleAccessRule[]) => {
    setAccessRules(next);
    await api.saveAccessRules(next);
  };

  const normalizeServicesForPersistence = (next: Service[]) => {
    const counters = new Map<string, number>();
    return next.map((service) => {
      const nextOrder = counters.get(service.status) || 0;
      counters.set(service.status, nextOrder + 1);
      return {
        ...service,
        sortOrder: nextOrder,
      };
    });
  };

  const queueServicesSync = (task: () => Promise<void>) => {
    servicesSyncQueueRef.current = servicesSyncQueueRef.current
      .catch(() => undefined)
      .then(task);
    return servicesSyncQueueRef.current;
  };

  const queueAppointmentsSync = (task: () => Promise<void>) => {
    appointmentsSyncQueueRef.current = appointmentsSyncQueueRef.current
      .catch(() => undefined)
      .then(task);
    return appointmentsSyncQueueRef.current;
  };

  const queueVehiclesSync = (task: () => Promise<void>) => {
    vehiclesSyncQueueRef.current = vehiclesSyncQueueRef.current
      .catch(() => undefined)
      .then(task);
    return vehiclesSyncQueueRef.current;
  };

  const queueProductsSync = (task: () => Promise<void>) => {
    productsSyncQueueRef.current = productsSyncQueueRef.current
      .catch(() => undefined)
      .then(task);
    return productsSyncQueueRef.current;
  };

  const queueTeamSync = (task: () => Promise<void>) => {
    teamSyncQueueRef.current = teamSyncQueueRef.current
      .catch(() => undefined)
      .then(task);
    return teamSyncQueueRef.current;
  };

  const performClientLogout = () => {
    api.clearAuthToken();
    setAuthToken(null);
    setCurrentUser(null);
    setActiveServiceId(null);
    setSelectedBase(null);
    setAccessRules([]);
    setServices([]);
    setAppointments([]);
    setProducts([]);
    setTeam([]);
    setVehicleDb([]);
    setHasLoadedVehicleDbFromApi(false);
    setNotifications([]);
    navigateTo('login');
  };

  const handlePersistenceError = async (error: any, fallbackMessage: string) => {
    console.error(error);

    if (error instanceof ApiError && error.status === 401) {
      alert('Sua sessao expirou. Faca login novamente.');
      performClientLogout();
      return;
    }

    alert(error?.message || fallbackMessage);
    await loadBootstrap();
  };

  useEffect(() => {
    if (!isAuthenticated || !activeServiceId) {
      return;
    }

    if (!['inspection-pre', 'inspection-post', 'payment', 'history', 'customer-history'].includes(currentScreen)) {
      return;
    }

    let cancelled = false;

    const hydrateActiveService = async () => {
      try {
        const service = await api.getService(activeServiceId);
        if (cancelled) {
          return;
        }

        setServices((current) => normalizeServicesForPersistence(
          current.map((item) => item.id === service.id ? { ...item, ...service } : item)
        ));
      } catch (error) {
        console.error(error);
      }
    };

    void hydrateActiveService();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, currentScreen, activeServiceId]);

  const persistVehicleDb = async (next: VehicleRegistration[]) => {
    const previous = vehicleDbRef.current;
    setVehicleDb(next);
    vehicleDbRef.current = next;
    setHasLoadedVehicleDbFromApi(true);

    return queueVehiclesSync(async () => {
      try {
        const previousMap = new Map(previous.map((vehicle) => [vehicle.plate, vehicle]));
        const nextMap = new Map(next.map((vehicle) => [vehicle.plate, vehicle]));

        for (const vehicle of next) {
          const previousVehicle = previousMap.get(vehicle.plate);
          if (!previousVehicle || JSON.stringify(previousVehicle) !== JSON.stringify(vehicle)) {
            await api.upsertVehicle(vehicle);
          }
        }

        for (const vehicle of previous) {
          if (!nextMap.has(vehicle.plate)) {
            await api.deleteVehicle(vehicle.plate);
          }
        }
      } catch (error) {
        await handlePersistenceError(error, 'Nao foi possivel salvar os veiculos.');
        throw error;
      }
    });
  };

  const persistProducts = async (next: Product[]) => {
    const previous = productsRef.current;
    setProducts(next);
    productsRef.current = next;

    return queueProductsSync(async () => {
      try {
        const previousMap = new Map(previous.map((product) => [product.id, product]));
        const nextMap = new Map(next.map((product) => [product.id, product]));

        for (const product of next) {
          const previousProduct = previousMap.get(product.id);
          if (!previousProduct || JSON.stringify(previousProduct) !== JSON.stringify(product)) {
            await api.upsertProduct(product);
          }
        }

        for (const product of previous) {
          if (!nextMap.has(product.id)) {
            await api.deleteProduct(product.id);
          }
        }
      } catch (error) {
        await handlePersistenceError(error, 'Nao foi possivel salvar os produtos.');
        throw error;
      }
    });
  };

  const persistTeam = async (next: TeamMember[]) => {
    const previous = teamRef.current;
    setTeam(next);
    teamRef.current = next;

    return queueTeamSync(async () => {
      try {
        const previousMap = new Map(previous.map((member) => [member.id, member]));
        const nextMap = new Map(next.map((member) => [member.id, member]));

        for (const member of next) {
          const previousMember = previousMap.get(member.id);
          if (!previousMember || JSON.stringify(previousMember) !== JSON.stringify(member)) {
            await api.upsertTeamMember(member);
          }
        }

        for (const member of previous) {
          if (!nextMap.has(member.id)) {
            await api.deleteTeamMember(member.id);
          }
        }
      } catch (error) {
        await handlePersistenceError(error, 'Nao foi possivel salvar a equipe.');
        throw error;
      }
    });
  };

  const persistServices = async (next: Service[]) => {
    const previous = servicesRef.current;
    const normalizedNext = normalizeServicesForPersistence(next);
    setServices(normalizedNext);
    servicesRef.current = normalizedNext;

    return queueServicesSync(async () => {
      try {
        const previousMap = new Map(previous.map((service) => [service.id, service]));
        const nextMap = new Map(normalizedNext.map((service) => [service.id, service]));

        for (const service of normalizedNext) {
          const previousService = previousMap.get(service.id);
          if (!previousService || JSON.stringify(previousService) !== JSON.stringify(service)) {
            await api.upsertService(service);
          }
        }

        for (const service of previous) {
          if (!nextMap.has(service.id)) {
            await api.deleteService(service.id);
          }
        }
      } catch (error) {
        await handlePersistenceError(error, 'Nao foi possivel salvar os servicos.');
        throw error;
      }
    });
  };

  const persistAppointments = async (next: Appointment[]) => {
    const previous = appointmentsRef.current;
    setAppointments(next);
    appointmentsRef.current = next;

    return queueAppointmentsSync(async () => {
      try {
        const previousMap = new Map(previous.map((appointment) => [appointment.id, appointment]));
        const nextMap = new Map(next.map((appointment) => [appointment.id, appointment]));

        for (const appointment of next) {
          const previousAppointment = previousMap.get(appointment.id);
          if (!previousAppointment || JSON.stringify(previousAppointment) !== JSON.stringify(appointment)) {
            await api.upsertAppointment(appointment);
          }
        }

        for (const appointment of previous) {
          if (!nextMap.has(appointment.id)) {
            await api.deleteAppointment(appointment.id);
          }
        }
      } catch (error) {
        await handlePersistenceError(error, 'Nao foi possivel salvar os agendamentos.');
        throw error;
      }
    });
  };

  const updateServiceRecord = async (id: string, updater: (service: Service) => Service) => {
    await persistServices(
      servicesRef.current.map((service) => (service.id === id ? updater(service) : service))
    );
  };

  const touchServiceTimeline = (id: string, timelineKey: keyof NonNullable<Service['timeline']>) => {
    void updateServiceRecord(id, (service) => {
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

  const addService = async (service: Service) => {
    await persistServices([service, ...servicesRef.current]);
  };

  const createScheduledBooking = async (appointment: Appointment, service: Service) => {
    try {
      const created = await api.bookScheduling({ appointment, service });

      const nextServices = normalizeServicesForPersistence([
        created.service,
        ...servicesRef.current.filter((currentService) => currentService.id !== created.service.id),
      ]);
      setServices(nextServices);
      servicesRef.current = nextServices;

      const nextAppointments = [
        created.appointment,
        ...appointmentsRef.current.filter((currentAppointment) => currentAppointment.id !== created.appointment.id),
      ];
      setAppointments(nextAppointments);
      appointmentsRef.current = nextAppointments;
    } catch (error) {
      await handlePersistenceError(error, 'Nao foi possivel salvar o agendamento.');
      throw error;
    }
  };

  const reorderServices = async (newServices: Service[]) => {
    await persistServices(newServices);
  };

  const navigateTo = (screen: Screen) => {
    const normalized = normalizeScreen(screen);
    if (isClientUser) {
      setCurrentScreen('scheduling');
      return;
    }

    setCurrentScreen(normalized);
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

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error(error);
    }

    performClientLogout();
  };

  const handleLogin = async (registration: string, password: string) => {
    const response = await api.login(registration, password);
    setCurrentUser(response.user);
    setAuthToken(response.token);
    setSelectedBase(response.user.role === 'Clientes' ? (response.user.allowedBaseIds?.[0] || null) : null);
    setCurrentScreen(response.user.role === 'Clientes' ? 'scheduling' : 'dashboard');
  };

  const activeService = services.find((service) => service.id === activeServiceId) || null;
  const activeServiceElapsedMinutes = getElapsedMinutes(activeService?.startTime, clockNow);
  const availableBases = currentUser?.role === 'Clientes'
    ? BASES.filter((base) => (currentUser.allowedBaseIds || []).includes(base.id))
    : BASES;
  const selectedBaseInfo = getBaseById(selectedBase);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const nowIso = new Date().toISOString();
    let hasServiceChanges = false;
    let hasAppointmentChanges = false;

    const nextServices = services.map((service) => {
      if (normalizeDateKey(service.scheduledDate || currentDateKey) < currentDateKey && service.status === 'pending') {
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

    const serviceMap = new Map<string, Service>(nextServices.map((service) => [service.id, service]));
    const nextAppointments = appointments.map((appointment) => {
      const relatedService = serviceMap.get(appointment.id);
      if (relatedService?.status === 'completed' && appointment.status !== 'completed') {
        hasAppointmentChanges = true;
        return {
          ...appointment,
          status: 'completed' as const,
        };
      }

      if (relatedService?.status === 'no_show' && appointment.status !== 'no_show') {
        hasAppointmentChanges = true;
        return {
          ...appointment,
          status: 'no_show' as const,
        };
      }

      if (relatedService && ['in_progress', 'waiting_payment'].includes(relatedService.status) && appointment.status !== 'pending') {
        hasAppointmentChanges = true;
        return {
          ...appointment,
          status: 'pending' as const,
        };
      }

      if (normalizeDateKey(appointment.date) < currentDateKey && !['completed', 'cancelled', 'no_show'].includes(appointment.status)) {
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
      void persistServices(nextServices);
    }

    if (hasAppointmentChanges) {
      void persistAppointments(nextAppointments);
    }
  }, [isAuthenticated, currentDateKey, services, appointments]);

  const renderScreen = () => {
    if (!isAuthenticated) return <Login onLogin={handleLogin} />;
    if (isBootstrapping) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Carregando dados persistentes...</div>;
    if (backendError) return <div className="min-h-screen flex items-center justify-center p-6 text-center text-rose-600 font-bold">{backendError}</div>;

    switch (currentScreen) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigateWithService} services={services} appointments={appointments} currentDateKey={currentDateKey} team={team} />;
      case 'checkin': return <CheckIn onNavigate={navigateTo} onAddService={addService} serviceTypes={serviceTypes} vehicleDb={vehicleDb} selectedBaseId={selectedBaseInfo?.id} selectedBaseName={selectedBaseInfo?.name} />;
      case 'inspection-pre': return <InspectionPre service={activeService} teamMembers={team} elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onStartWash={async (washers, photos) => {
        if (activeServiceId) {
          await updateServiceRecord(activeServiceId, (service) => {
            const nowIso = new Date().toISOString();
            const nextPreviewImage = photos.front || getServicePreviewImage(service);
            return {
              ...service,
              washers,
              preInspectionPhotos: photos,
              image: nextPreviewImage || service.image,
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
      case 'inspection-post': return <InspectionPost service={activeService} elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onCompleteWash={async (photos) => {
        if (activeServiceId) {
          await updateServiceRecord(activeServiceId, (service) => {
            const nowIso = new Date().toISOString();
            const nextPreviewImage = photos.front || getServicePreviewImage(service);
            return {
              ...service,
              postInspectionPhotos: photos,
              image: nextPreviewImage || service.image,
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
      case 'payment': return <Payment service={activeService} services={services} elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onPaymentComplete={async () => {
        if (activeServiceId) {
          const nowIso = new Date().toISOString();
          await updateServiceRecord(activeServiceId, (service) => {
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

          await persistAppointments(
            appointmentsRef.current.map((appointment) =>
              appointment.id === activeServiceId
                ? {
                    ...appointment,
                    status: 'completed',
                  }
                : appointment
            )
          );
        }
      }} />;
      case 'history': return <ServiceHistory onNavigate={handleNavigateWithService} service={activeService} />;
      case 'customer-history': return <CustomerHistory onNavigate={handleNavigateWithService} selectedService={activeService} services={services} />;
      case 'queue':
      case 'scheduling': 
        return <Scheduling currentDateKey={currentDateKey} appointments={appointments} onUpdateAppointments={persistAppointments} onCreateBooking={createScheduledBooking} onNavigate={handleNavigateWithService} services={services} onReorder={reorderServices} serviceTypes={serviceTypes} vehicleDb={vehicleDb} availableBases={availableBases} isClientUser={isClientUser} selectedBaseId={selectedBaseInfo?.id} selectedBaseName={selectedBaseInfo?.name} onSelectBase={(baseId) => {
          setSelectedBase(baseId);
        }} onResetBaseFilter={() => {
          if (!isClientUser) {
            setSelectedBase(null);
          }
        }} onClearBase={() => {
          if (isClientUser) {
            setSelectedBase(availableBases[0]?.id || null);
            return;
          }

          setSelectedBase(null);
          navigateTo('dashboard');
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
            onEdit={(service) => {
              if (service.status === 'in_progress') {
                handleNavigateWithService('inspection-post', service.id);
              }
            }}
            onDelete={async (service) => {
              await persistServices(servicesRef.current.filter((item) => item.id !== service.id));
              await persistAppointments(appointmentsRef.current.filter((item) => item.id !== service.id));
            }}
          />
        </div>
      );
      case 'settings': return <Settings onNavigate={navigateTo} serviceTypes={serviceTypes} onUpdateServiceTypes={persistServiceTypes} vehicleDb={vehicleDb} onUpdateVehicleDb={persistVehicleDb} team={team} onUpdateTeam={persistTeam} accessRules={accessRules} onUpdateAccessRules={persistAccessRules} />;
      default: return <Dashboard onNavigate={handleNavigateWithService} services={services} appointments={appointments} currentDateKey={currentDateKey} team={team} />;
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
            currentUser={currentUser}
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
                {!isClientUser && (
                  <button 
                    onClick={() => navigateTo('settings')}
                    className="p-2.5 rounded-xl bg-white text-slate-500 hover:text-primary transition-all active:scale-95 border border-slate-100 shadow-sm"
                  >
                    <SettingsIcon className="w-5 h-5" />
                  </button>
                )}
                {!isClientUser && (
                  <Notifications 
                    isOpen={isNotificationsOpen}
                    onClose={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    notifications={notifications}
                    onMarkAsRead={handleMarkAsRead}
                    onClearAll={handleClearNotifications}
                  />
                )}
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
                  <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Carregando tela...</div>}>
                    {renderScreen()}
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {/* Bottom Navigation (Mobile Only) */}
          {isAuthenticated && !isClientUser && !['checkin', 'inspection-pre', 'inspection-post', 'payment'].includes(currentScreen) && (
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
          {isAuthenticated && !isClientUser && (
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
