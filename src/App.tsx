/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, ReactNode, useEffect, useRef } from 'react';
import {
  LayoutDashboard, 
  History,
  Settings as SettingsIcon, 
  Droplets,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from './lib/motion';
import { Screen, Service, Notification, INITIAL_SERVICE_TYPES, RoleAccessRule, VehicleCategory, VehicleType, VehicleRegistration, Product, TeamMember } from './types';
import { AppPermissionId, userHasPermission } from './lib/access';

import Sidebar from './components/Sidebar';
import Notifications from './components/Notifications';
import Scheduling, { QueueSection } from './components/Scheduling';
import {
  enqueuePendingOperationalAction,
  flushPendingOperationalActions,
  flushPendingPhotoSaves,
  getElapsedMinutes,
  getServicePreviewImage,
  getTodayDate,
  normalizeDateKey,
  PENDING_OPERATIONAL_ACTIONS_UPDATED_EVENT,
  readPendingOperationalActions,
  shouldQueuePendingPhotoSave,
} from './utils/app';
import {
  api,
  ApiError,
  Appointment,
  CompleteWashPayload,
  ServiceStageTransitionPayload,
  StartWashPayload,
  UNAUTHORIZED_SESSION_EVENT,
} from './services/api';
import { BASES, getBaseById } from './data/bases';
import { getSafeLogoSrc } from './lib/placeholders';

const LEGACY_STORAGE_KEYS = ['bootstrapCacheV2', 'bootstrapCacheV3', 'vehicleDbCacheV1', 'authUserV1', 'selectedBase', 'activeServiceId', 'access_rules', 'appCacheVersion', 'authToken'];
const ACTIVE_SCHEDULING_APPOINTMENT_STATUSES: Appointment['status'][] = ['confirmed', 'pending'];

const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const CheckIn = lazy(() => import('./components/CheckIn'));
const InspectionPre = lazy(() => import('./components/InspectionPre'));
const InspectionPost = lazy(() => import('./components/InspectionPost'));
const Payment = lazy(() => import('./components/Payment'));
const ServiceHistory = lazy(() => import('./components/ServiceHistory'));
const CustomerHistory = lazy(() => import('./components/CustomerHistory'));
const VehicleHistory = lazy(() => import('./components/VehicleHistory'));
const VehicleHistoryDetail = lazy(() => import('./components/VehicleHistory').then((module) => ({ default: module.VehicleHistoryDetail })));
const Settings = lazy(() => import('./components/Settings'));
const Inventory = lazy(() => import('./components/Inventory'));

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

const formatNotificationTime = (date = new Date()) =>
  new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

export default function App() {
  const normalizeScreen = (screen: Screen): Screen => screen === 'queue' ? 'scheduling' : screen;
  const mergeServiceTypes = (next?: Partial<Record<VehicleType, VehicleCategory>> | null): Record<VehicleType, VehicleCategory> => {
    const merged = {
      ...INITIAL_SERVICE_TYPES,
      ...(next || {}),
    };

    merged.pickup_4x4 = {
      ...merged.pickup_4x4,
      label: 'Picape Media',
    };

    return merged;
  };

  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [services, setServices] = useState<Service[]>([]);
  const [serviceTypes, setServiceTypes] = useState<Record<VehicleType, VehicleCategory>>(INITIAL_SERVICE_TYPES);
  const [vehicleDb, setVehicleDb] = useState<VehicleRegistration[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [accessRules, setAccessRules] = useState<RoleAccessRule[]>([]);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [selectedVehiclePlate, setSelectedVehiclePlate] = useState<string | null>(null);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<TeamMember | null>(null);
  const [isSessionResolved, setIsSessionResolved] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [completionPopup, setCompletionPopup] = useState<{
    title: string;
    message: string;
    synced: boolean;
  } | null>(null);
  const [paymentCompletionNotice, setPaymentCompletionNotice] = useState<{
    serviceId: string;
    plate: string;
    synced: boolean;
  } | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [currentDateKey, setCurrentDateKey] = useState(() => getTodayDate());
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isVehicleDbLoading, setIsVehicleDbLoading] = useState(false);
  const [hasLoadedVehicleDbFromApi, setHasLoadedVehicleDbFromApi] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isActiveServiceLoading, setIsActiveServiceLoading] = useState(false);
  const [appScale, setAppScale] = useState(1);
  const servicesRef = useRef<Service[]>([]);
  const appointmentsRef = useRef<Appointment[]>([]);
  const vehicleDbRef = useRef<VehicleRegistration[]>([]);
  const vehicleDbMutationVersionRef = useRef(0);
  const productsRef = useRef<Product[]>([]);
  const teamRef = useRef<TeamMember[]>([]);
  const servicesSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const appointmentsSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const vehiclesSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const productsSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const teamSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isIntentionalLogoutRef = useRef(false);
  const isRecoveringSessionRef = useRef(false);
  const completionPopupTimerRef = useRef<number | null>(null);
  const paymentCompletionNoticeTimerRef = useRef<number | null>(null);
  const isAuthenticated = Boolean(currentUser);
  const isClientUser = currentUser?.role === 'Clientes';
  const hasPermission = React.useCallback((permission: AppPermissionId) => (
    userHasPermission(currentUser, accessRules, permission)
  ), [currentUser, accessRules]);
  const canViewAnalytics = hasPermission('view_analytics');
  const canManageInventory = hasPermission('manage_inventory');
  const canManageSettings = hasPermission('manage_access') || hasPermission('manage_team') || hasPermission('edit_services');
  const canDeleteOperationalRecords = hasPermission('delete_services');

  const getHomeScreenForUser = React.useCallback((user: TeamMember | null | undefined) => {
    if (!user) {
      return 'login' as Screen;
    }

    if (user.role === 'Clientes') {
      return 'scheduling' as Screen;
    }

    return userHasPermission(user, accessRules, 'view_analytics') ? 'dashboard' : 'scheduling';
  }, [accessRules]);

  const normalizePlateKey = (plate?: string | null) => String(plate || '').trim().toUpperCase();

  const commitVehicleDbState = React.useCallback((next: VehicleRegistration[], options?: { markLoaded?: boolean }) => {
    vehicleDbMutationVersionRef.current += 1;
    setVehicleDb(next);
    vehicleDbRef.current = next;

    if (options?.markLoaded) {
      setHasLoadedVehicleDbFromApi(true);
    }
  }, []);

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

  const handleToggleNotifications = React.useCallback(() => {
    setIsNotificationsOpen((current) => !current);
  }, []);

  const handleCloseNotifications = React.useCallback(() => {
    setIsNotificationsOpen(false);
  }, []);

  const pushNotification = React.useCallback((entry: {
    id?: string;
    title: string;
    message: string;
    type: Notification['type'];
  }) => {
    const nextNotification: Notification = {
      id: entry.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: entry.title,
      message: entry.message,
      type: entry.type,
      read: false,
      time: formatNotificationTime(),
    };

    setNotifications((current) => {
      const deduped = current.filter((notification) => notification.id !== nextNotification.id);
      return [nextNotification, ...deduped].slice(0, 25);
    });
  }, []);

  const clearCompletionPopupTimer = React.useCallback(() => {
    if (completionPopupTimerRef.current !== null) {
      window.clearTimeout(completionPopupTimerRef.current);
      completionPopupTimerRef.current = null;
    }
  }, []);

  const clearPaymentCompletionNoticeTimer = React.useCallback(() => {
    if (paymentCompletionNoticeTimerRef.current !== null) {
      window.clearTimeout(paymentCompletionNoticeTimerRef.current);
      paymentCompletionNoticeTimerRef.current = null;
    }
  }, []);

  const dismissPaymentCompletionNotice = React.useCallback((serviceId?: string) => {
    setPaymentCompletionNotice((current) => {
      if (!current) {
        return current;
      }

      if (serviceId && current.serviceId !== serviceId) {
        return current;
      }

      return null;
    });
    clearPaymentCompletionNoticeTimer();
  }, [clearPaymentCompletionNoticeTimer]);

  const queuePaymentCompletionNotice = React.useCallback((service: Service, persisted: boolean) => {
    clearPaymentCompletionNoticeTimer();
    setPaymentCompletionNotice({
      serviceId: service.id,
      plate: service.plate,
      synced: persisted,
    });
    paymentCompletionNoticeTimerRef.current = window.setTimeout(() => {
      setPaymentCompletionNotice(null);
      paymentCompletionNoticeTimerRef.current = null;
    }, 10000);
  }, [clearPaymentCompletionNoticeTimer]);

  const showCompletionPopup = React.useCallback((service: Service, persisted: boolean) => {
    clearCompletionPopupTimer();
    setCompletionPopup({
      title: 'Concluido',
      message: persisted
        ? `Lavagem da placa ${service.plate} concluida com sucesso.`
        : `Lavagem da placa ${service.plate} concluida neste aparelho. A sincronizacao sera retomada automaticamente.`,
      synced: persisted,
    });
    completionPopupTimerRef.current = window.setTimeout(() => {
      setCompletionPopup(null);
      completionPopupTimerRef.current = null;
    }, 4200);
  }, [clearCompletionPopupTimer]);

  const notifyWashStarted = React.useCallback((service: Service, persisted: boolean) => {
    pushNotification({
      id: `wash-started-${service.id}-${service.timeline?.washStartedAt || service.startTime || Date.now()}`,
      title: 'Lavagem iniciada',
      message: persisted
        ? `A placa ${service.plate} entrou em lavagem.`
        : `A placa ${service.plate} entrou em lavagem e sera sincronizada automaticamente.`,
      type: persisted ? 'info' : 'warning',
    });
  }, [pushNotification]);

  const notifyWashCompleted = React.useCallback((service: Service, persisted: boolean) => {
    pushNotification({
      id: `wash-completed-${service.id}-${service.timeline?.washCompletedAt || service.endTime || Date.now()}`,
      title: 'Lavagem concluida',
      message: persisted
        ? `A placa ${service.plate} foi concluida e liberada para pagamento.`
        : `A placa ${service.plate} foi concluida neste aparelho e aguardara sincronizacao automatica.`,
      type: persisted ? 'success' : 'warning',
    });
    queuePaymentCompletionNotice(service, persisted);
    showCompletionPopup(service, persisted);
  }, [pushNotification, queuePaymentCompletionNotice, showCompletionPopup]);

  const notifyPaymentCompleted = React.useCallback((service: Service) => {
    pushNotification({
      id: `payment-completed-${service.id}-${service.timeline?.paymentCompletedAt || Date.now()}`,
      title: 'Pagamento concluido',
      message: `O atendimento da placa ${service.plate} foi encerrado com pagamento confirmado.`,
      type: 'success',
    });
  }, [pushNotification]);

  const notifyBackgroundSync = React.useCallback((options: {
    syncedActions: number;
    syncedPhotos: number;
  }) => {
    const parts: string[] = [];

    if (options.syncedActions > 0) {
      parts.push(
        options.syncedActions === 1
          ? '1 etapa operacional'
          : `${options.syncedActions} etapas operacionais`
      );
    }

    if (options.syncedPhotos > 0) {
      parts.push(
        options.syncedPhotos === 1
          ? '1 foto'
          : `${options.syncedPhotos} fotos`
      );
    }

    if (!parts.length) {
      return;
    }

    pushNotification({
      id: `background-sync-${Date.now()}`,
      title: 'Sincronizacao retomada',
      message: `${parts.join(' e ')} foram sincronizadas com o servidor.`,
      type: 'success',
    });
  }, [pushNotification]);

  useEffect(() => {
    return () => {
      clearCompletionPopupTimer();
      clearPaymentCompletionNoticeTimer();
    };
  }, [clearCompletionPopupTimer, clearPaymentCompletionNoticeTimer]);

  useEffect(() => {
    const handleUnauthorizedEvent = () => {
      handleUnauthorizedSession();
    };

    window.addEventListener(UNAUTHORIZED_SESSION_EVENT, handleUnauthorizedEvent as EventListener);

    return () => {
      window.removeEventListener(UNAUTHORIZED_SESSION_EVENT, handleUnauthorizedEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    const updateAppScale = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (width < 1024) {
        setAppScale(1);
        return;
      }

      const widthScale = width / 1760;
      const heightScale = height / 980;
      const nextScale = Math.max(0.82, Math.min(1, Math.min(widthScale, heightScale)));
      setAppScale(Number(nextScale.toFixed(2)));
    };

    updateAppScale();
    window.addEventListener('resize', updateAppScale);

    return () => window.removeEventListener('resize', updateAppScale);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--app-scale', String(isAuthenticated ? appScale : 1));

    return () => {
      document.documentElement.style.removeProperty('--app-scale');
    };
  }, [appScale, isAuthenticated]);

  useEffect(() => {
    try {
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
      window.sessionStorage.removeItem('authToken');
    } catch (error) {}
  }, []);

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
      const reconciledBootstrap = applyPendingOperationalTransitions(nextServices, nextAppointments);

      setServiceTypes(nextServiceTypes);
      setCurrentUser(data.currentUser || null);
      setAccessRules(Array.isArray(data.accessRules) ? data.accessRules : []);
      setServices(reconciledBootstrap.services);
      servicesRef.current = reconciledBootstrap.services;
      setAppointments(reconciledBootstrap.appointments);
      appointmentsRef.current = reconciledBootstrap.appointments;
      setProducts(nextProducts);
      productsRef.current = nextProducts;
      setTeam(nextTeam);
      teamRef.current = nextTeam;
      isRecoveringSessionRef.current = false;
      setIsSessionResolved(true);
      setCurrentScreen(getHomeScreenForUser(data.currentUser || null));
    } catch (error: any) {
      if (error instanceof ApiError && error.status === 401) {
        performClientLogout();
        setBackendError(null);
        setIsSessionResolved(true);
        return;
      }

      setCurrentUser(null);
      setBackendError(error.message || 'Nao foi possivel carregar os dados persistentes.');
      setIsSessionResolved(true);
    } finally {
      setIsBootstrapping(false);
    }
  };

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (isClientUser && currentScreen !== 'scheduling') {
      setCurrentScreen('scheduling');
      return;
    }

    if ((currentScreen === 'dashboard') && !canViewAnalytics) {
      setCurrentScreen('scheduling');
      return;
    }

    if ((currentScreen === 'vehicle-history' || currentScreen === 'vehicle-history-detail') && !canViewAnalytics) {
      setCurrentScreen('scheduling');
      return;
    }

    if (currentScreen === 'inventory' && !canManageInventory) {
      setCurrentScreen(getHomeScreenForUser(currentUser));
      return;
    }

    if (currentScreen === 'settings' && !canManageSettings) {
      setCurrentScreen(getHomeScreenForUser(currentUser));
    }
  }, [isAuthenticated, isClientUser, currentScreen, canViewAnalytics, canManageInventory, canManageSettings, currentUser, getHomeScreenForUser]);

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

    if (currentScreen !== 'settings') {
      return;
    }

    if (isVehicleDbLoading || hasLoadedVehicleDbFromApi) {
      return;
    }

    let cancelled = false;

    const loadVehicles = async () => {
      const loadVersion = vehicleDbMutationVersionRef.current;
      setIsVehicleDbLoading(true);
      try {
        const vehicles = await api.getVehicles();
        if (cancelled) {
          return;
        }

        if (vehicleDbMutationVersionRef.current !== loadVersion) {
          setHasLoadedVehicleDbFromApi(true);
          return;
        }

        commitVehicleDbState(vehicles, { markLoaded: true });
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
  }, [commitVehicleDbState, isAuthenticated, currentScreen, hasLoadedVehicleDbFromApi]);

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

  const mergeServiceIntoState = React.useCallback((service: Service) => {
    setServices((current) => {
      const next = normalizeServicesForPersistence(
        current.some((item) => item.id === service.id)
          ? current.map((item) => (item.id === service.id ? { ...item, ...service } : item))
          : [service, ...current]
      );
      servicesRef.current = next;
      return next;
    });
  }, []);

  const mergeServiceTransitionIntoState = React.useCallback((payload: ServiceStageTransitionPayload) => {
    mergeServiceIntoState(payload.service);

    if (!payload.appointment) {
      return;
    }

    setAppointments((current) => {
      const next = current.some((item) => item.id === payload.appointment?.id)
        ? current.map((item) => (item.id === payload.appointment?.id ? payload.appointment! : item))
        : [payload.appointment!, ...current];
      appointmentsRef.current = next;
      return next;
    });
  }, [mergeServiceIntoState]);

  const buildLocalStartWashTransition = React.useCallback((
    service: Service,
    payload: StartWashPayload
  ): ServiceStageTransitionPayload => {
    const nowIso = new Date().toISOString();
    const nextPreviewImage = payload.preInspectionPhotos?.front || getServicePreviewImage(service);
    const nextObservations = String(payload.observations || '').trim() || service.observations || '';
    const nextServiceStatus = ['waiting_payment', 'completed', 'no_show'].includes(service.status)
      ? service.status
      : 'in_progress';
    const nextService: Service = {
      ...service,
      washers: payload.washers,
      observations: nextObservations,
      preInspectionPhotos: payload.preInspectionPhotos || service.preInspectionPhotos,
      image: nextPreviewImage || service.image,
      status: nextServiceStatus,
      startTime: service.startTime || nowIso,
      timeline: {
        ...(service.timeline || {}),
        preInspectionStartedAt: service.timeline?.preInspectionStartedAt || nowIso,
        preInspectionCompletedAt: service.timeline?.preInspectionCompletedAt || nowIso,
        washStartedAt: service.timeline?.washStartedAt || service.startTime || nowIso,
      },
    };

    const currentAppointment = appointmentsRef.current.find((appointment) => appointment.id === service.id) || null;
    const nextAppointmentStatus: Appointment['status'] = currentAppointment
      ? (['in_progress', 'waiting_payment', 'completed', 'no_show'].includes(currentAppointment.status)
        ? currentAppointment.status
        : 'in_progress')
      : 'in_progress';
    return {
      service: nextService,
      appointment: currentAppointment ? {
        ...currentAppointment,
        status: nextAppointmentStatus,
      } : null,
    };
  }, []);

  const buildLocalCompleteWashTransition = React.useCallback((
    service: Service,
    payload: CompleteWashPayload
  ): ServiceStageTransitionPayload => {
    const nowIso = new Date().toISOString();
    const nextPreviewImage = payload.postInspectionPhotos?.front || getServicePreviewImage(service);
    const nextServiceStatus = ['waiting_payment', 'completed', 'no_show'].includes(service.status)
      ? service.status
      : 'waiting_payment';
    const nextService: Service = {
      ...service,
      postInspectionPhotos: payload.postInspectionPhotos || service.postInspectionPhotos,
      image: nextPreviewImage || service.image,
      status: nextServiceStatus,
      endTime: service.endTime || nowIso,
      timeline: {
        ...(service.timeline || {}),
        postInspectionStartedAt: service.timeline?.postInspectionStartedAt || nowIso,
        washCompletedAt: service.timeline?.washCompletedAt || service.endTime || nowIso,
        postInspectionCompletedAt: service.timeline?.postInspectionCompletedAt || nowIso,
      },
    };

    const currentAppointment = appointmentsRef.current.find((appointment) => appointment.id === service.id) || null;
    const nextAppointmentStatus: Appointment['status'] = currentAppointment
      ? (['waiting_payment', 'completed', 'no_show'].includes(currentAppointment.status)
        ? currentAppointment.status
        : 'waiting_payment')
      : 'waiting_payment';
    return {
      service: nextService,
      appointment: currentAppointment ? {
        ...currentAppointment,
        status: nextAppointmentStatus,
      } : null,
    };
  }, []);

  const applyPendingOperationalTransitions = React.useCallback((
    baseServices: Service[],
    baseAppointments: Appointment[]
  ) => {
    const queuedActions = readPendingOperationalActions();
    if (!queuedActions.length) {
      return {
        services: normalizeServicesForPersistence(baseServices),
        appointments: baseAppointments,
      };
    }

    let nextServices = normalizeServicesForPersistence(baseServices);
    let nextAppointments = [...baseAppointments];

    for (const queuedAction of queuedActions) {
      const currentService = nextServices.find((service) => service.id === queuedAction.serviceId);
      if (!currentService) {
        continue;
      }

      const previousAppointments = appointmentsRef.current;
      appointmentsRef.current = nextAppointments;

      const transition = queuedAction.type === 'start_wash'
        ? buildLocalStartWashTransition(currentService, {
            washers: Array.isArray(queuedAction.payload.washers) ? queuedAction.payload.washers : [],
            observations: queuedAction.payload.observations,
            preInspectionPhotos: queuedAction.payload.preInspectionPhotos,
          })
        : buildLocalCompleteWashTransition(currentService, {
            postInspectionPhotos: queuedAction.payload.postInspectionPhotos,
          });

      appointmentsRef.current = previousAppointments;

      nextServices = normalizeServicesForPersistence(
        nextServices.map((service) => (service.id === transition.service.id ? transition.service : service))
      );

      if (transition.appointment) {
        nextAppointments = nextAppointments.some((appointment) => appointment.id === transition.appointment?.id)
          ? nextAppointments.map((appointment) => (
              appointment.id === transition.appointment?.id ? transition.appointment! : appointment
            ))
          : [transition.appointment, ...nextAppointments];
      }
    }

    return {
      services: nextServices,
      appointments: nextAppointments,
    };
  }, [buildLocalCompleteWashTransition, buildLocalStartWashTransition]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const flush = async () => {
      if (!navigator.onLine) {
        return;
      }
      try {
        const operationalResult = await flushPendingOperationalActions<ServiceStageTransitionPayload>({
          startWash: (serviceId, payload) => api.startWash(serviceId, {
            washers: Array.isArray(payload.washers) ? payload.washers : [],
            observations: payload.observations,
            preInspectionPhotos: payload.preInspectionPhotos,
          }),
          completeWash: (serviceId, payload) => api.completeWash(serviceId, {
            postInspectionPhotos: payload.postInspectionPhotos,
          }),
          onSaved: (_entry, payload) => {
            mergeServiceTransitionIntoState(payload);
          },
        });

        const result = await flushPendingPhotoSaves({
          saveInspectionPhoto: api.saveInspectionPhoto,
        });
        const syncedServiceIds = Array.from(new Set(result.savedEntries.map((entry) => entry.serviceId)));
        if (!syncedServiceIds.length) {
          return;
        }

        const refreshedServices = await Promise.all(
          syncedServiceIds.map(async (serviceId) => {
            try {
              return await api.getService(serviceId);
            } catch {
              return null;
            }
          })
        );

        refreshedServices
          .filter((service): service is Service => Boolean(service))
          .forEach((service) => {
            mergeServiceIntoState(service);
          });

        if (operationalResult.savedCount || result.savedCount) {
          notifyBackgroundSync({
            syncedActions: operationalResult.savedCount,
            syncedPhotos: result.savedCount,
          });
        }
      } catch (error) {}
    };

    const handler = () => void flush();
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void flush();
      }
    };
    const intervalId = window.setInterval(() => {
      void flush();
    }, 30000);

    window.addEventListener('online', handler);
    window.addEventListener('focus', handler);
    document.addEventListener('visibilitychange', visibilityHandler);
    void flush();

    return () => {
      window.removeEventListener('online', handler);
      window.removeEventListener('focus', handler);
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, mergeServiceIntoState, mergeServiceTransitionIntoState, notifyBackgroundSync]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const reconcilePendingTransitions = () => {
      const queuedActions = readPendingOperationalActions();
      if (!queuedActions.length || (!servicesRef.current.length && !appointmentsRef.current.length)) {
        return;
      }

      const reconciled = applyPendingOperationalTransitions(servicesRef.current, appointmentsRef.current);
      if (JSON.stringify(reconciled.services) !== JSON.stringify(servicesRef.current)) {
        setServices(reconciled.services);
        servicesRef.current = reconciled.services;
      }

      if (JSON.stringify(reconciled.appointments) !== JSON.stringify(appointmentsRef.current)) {
        setAppointments(reconciled.appointments);
        appointmentsRef.current = reconciled.appointments;
      }
    };

    const handler = () => reconcilePendingTransitions();
    window.addEventListener(PENDING_OPERATIONAL_ACTIONS_UPDATED_EVENT, handler as EventListener);
    reconcilePendingTransitions();

    return () => {
      window.removeEventListener(PENDING_OPERATIONAL_ACTIONS_UPDATED_EVENT, handler as EventListener);
    };
  }, [applyPendingOperationalTransitions, appointments, isAuthenticated, services]);

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

  const flushOperationalSyncQueues = async () => {
    await Promise.allSettled([
      servicesSyncQueueRef.current,
      appointmentsSyncQueueRef.current,
    ]);
  };

  const performClientLogout = () => {
    setCurrentUser(null);
    setIsSessionResolved(true);
    setActiveServiceId(null);
    setSelectedVehiclePlate(null);
    setSelectedBase(null);
    setAccessRules([]);
    setServices([]);
    setAppointments([]);
    setProducts([]);
    setTeam([]);
    vehicleDbMutationVersionRef.current += 1;
    vehicleDbRef.current = [];
    setVehicleDb([]);
    setHasLoadedVehicleDbFromApi(false);
    setNotifications([]);
    clearCompletionPopupTimer();
    clearPaymentCompletionNoticeTimer();
    setCompletionPopup(null);
    setPaymentCompletionNotice(null);
    setBackendError(null);
    setIsBootstrapping(false);
    setIsActiveServiceLoading(false);
    setIsNotificationsOpen(false);
    setCurrentScreen('login');
  };

  const handleUnauthorizedSession = () => {
    if (isRecoveringSessionRef.current) {
      return;
    }

    isRecoveringSessionRef.current = true;
    performClientLogout();
  };

  const handlePersistenceError = async (error: any, fallbackMessage: string) => {
    console.error(error);

    if (
      (error instanceof ApiError && error.status === 401)
      || String(error?.message || '').toLowerCase().includes('sessao expirou')
    ) {
      handleUnauthorizedSession();
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
      setIsActiveServiceLoading(true);
      try {
        const service = await api.getService(activeServiceId);
        if (cancelled) {
          return;
        }

        setServices((current) => {
          const next = current.some((item) => item.id === service.id)
            ? current.map((item) => item.id === service.id ? { ...item, ...service } : item)
            : [...current, service];
          const normalized = normalizeServicesForPersistence(next);
          servicesRef.current = normalized;
          return normalized;
        });
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setIsActiveServiceLoading(false);
        }
      }
    };

    void hydrateActiveService();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, currentScreen, activeServiceId]);

  const persistVehicleDb = async (next: VehicleRegistration[]) => {
    const previous = vehicleDbRef.current;
    const nextPlateMap = new Map(next.map((vehicle) => [normalizePlateKey(vehicle.plate), vehicle]));
    const removedPlateKeys = new Set(
      previous
        .map((vehicle) => normalizePlateKey(vehicle.plate))
        .filter((plate) => !nextPlateMap.has(plate))
    );
    const orphanedServices = removedPlateKeys.size
      ? servicesRef.current.filter((service) => removedPlateKeys.has(normalizePlateKey(service.plate)) && service.status === 'pending')
      : [];
    const orphanedAppointments = removedPlateKeys.size
      ? appointmentsRef.current.filter((appointment) =>
          removedPlateKeys.has(normalizePlateKey(appointment.plate))
          && ACTIVE_SCHEDULING_APPOINTMENT_STATUSES.includes(appointment.status)
        )
      : [];

    commitVehicleDbState(next, { markLoaded: true });

    if (orphanedServices.length) {
      const nextServices = normalizeServicesForPersistence(
        servicesRef.current.filter((service) => !orphanedServices.some((item) => item.id === service.id))
      );
      setServices(nextServices);
      servicesRef.current = nextServices;
    }

    if (orphanedAppointments.length) {
      const nextAppointments = appointmentsRef.current.filter(
        (appointment) => !orphanedAppointments.some((item) => item.id === appointment.id)
      );
      setAppointments(nextAppointments);
      appointmentsRef.current = nextAppointments;
    }

    return queueVehiclesSync(async () => {
      try {
        const previousMap = new Map(previous.map((vehicle) => [vehicle.plate, vehicle]));
        const nextMap = new Map(next.map((vehicle) => [vehicle.plate, vehicle]));
        const changedVehicles = next.filter((vehicle) => {
          const previousVehicle = previousMap.get(vehicle.plate);
          return !previousVehicle || JSON.stringify(previousVehicle) !== JSON.stringify(vehicle);
        });

        if (changedVehicles.length > 0) {
          const batchSize = 250;
          for (let index = 0; index < changedVehicles.length; index += batchSize) {
            await api.bulkUpsertVehicles(changedVehicles.slice(index, index + batchSize));
          }
        }

        for (const appointment of orphanedAppointments) {
          await api.deleteAppointment(appointment.id);
        }

        for (const service of orphanedServices) {
          await api.deleteService(service.id);
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

  const registerVehicleFromScheduling = async (vehicle: VehicleRegistration) => {
    try {
      let savedVehicle: VehicleRegistration | null = null;
      await queueVehiclesSync(async () => {
        savedVehicle = await api.upsertVehicle(vehicle);
      });
      if (!savedVehicle) {
        throw new Error('Nao foi possivel confirmar o cadastro do veiculo.');
      }
      setVehicleDb((current) => {
        const next = current.some((item) => item.plate === savedVehicle.plate)
          ? current.map((item) => item.plate === savedVehicle.plate ? savedVehicle : item)
          : [...current, savedVehicle];
        vehicleDbRef.current = next;
        vehicleDbMutationVersionRef.current += 1;
        return next;
      });
      setHasLoadedVehicleDbFromApi(true);
      return savedVehicle;
    } catch (error) {
      await handlePersistenceError(error, 'Nao foi possivel cadastrar o veiculo.');
      throw error;
    }
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
    const currentService = servicesRef.current.find((service) => service.id === id);
    if (!currentService) {
      return;
    }

    const nowIso = new Date().toISOString();
    mergeServiceIntoState({
      ...currentService,
      timeline: {
        ...(currentService.timeline || {}),
        [timelineKey]: currentService.timeline?.[timelineKey] || nowIso,
      },
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

  const getRelatedAppointmentIds = (service: Service, sourceAppointments = appointmentsRef.current) => {
    const servicePlate = normalizePlateKey(service.plate);
    const serviceDate = normalizeDateKey(service.scheduledDate);
    const serviceTime = service.scheduledTime || '';

    return sourceAppointments
      .filter((appointment) =>
        appointment.id === service.id
        || (
          service.status === 'pending'
          && normalizePlateKey(appointment.plate) === servicePlate
          && normalizeDateKey(appointment.date) === serviceDate
          && (appointment.time || '') === serviceTime
          && ACTIVE_SCHEDULING_APPOINTMENT_STATUSES.includes(appointment.status)
        )
      )
      .map((appointment) => appointment.id);
  };

  const getRelatedPendingServiceIds = (appointment: Appointment, sourceServices = servicesRef.current) => {
    const appointmentPlate = normalizePlateKey(appointment.plate);
    const appointmentDate = normalizeDateKey(appointment.date);
    const appointmentTime = appointment.time || '';

    return sourceServices
      .filter((service) =>
        service.id === appointment.id
        || (
          service.status === 'pending'
          && normalizePlateKey(service.plate) === appointmentPlate
          && normalizeDateKey(service.scheduledDate) === appointmentDate
          && (service.scheduledTime || '') === appointmentTime
        )
      )
      .map((service) => service.id);
  };

  const deleteServiceRecord = async (service: Service) => {
    if (service.status === 'pending') {
      await flushOperationalSyncQueues();
      const deleted = await api.deleteSchedulingRecord(service.id);
      const deletedServiceIds = new Set(deleted.deletedServiceIds);
      const deletedAppointmentIds = new Set(deleted.deletedAppointmentIds);

      const nextServices = servicesRef.current.filter((item) => !deletedServiceIds.has(item.id));
      const nextAppointments = appointmentsRef.current.filter((item) => !deletedAppointmentIds.has(item.id));

      setServices(nextServices);
      servicesRef.current = nextServices;
      setAppointments(nextAppointments);
      appointmentsRef.current = nextAppointments;
      return;
    }

    const appointmentIds = new Set(getRelatedAppointmentIds(service));
    const nextServices = servicesRef.current.filter((item) => item.id !== service.id);
    const nextAppointments = appointmentsRef.current.filter((item) => !appointmentIds.has(item.id));

    await persistServices(nextServices);
    await persistAppointments(nextAppointments);
  };

  const deleteAppointmentRecord = async (appointment: Appointment) => {
    await flushOperationalSyncQueues();
    const deleted = await api.deleteSchedulingRecord(appointment.id);
    const deletedServiceIds = new Set(deleted.deletedServiceIds);
    const deletedAppointmentIds = new Set(deleted.deletedAppointmentIds);

    const nextAppointments = appointmentsRef.current.filter((item) => !deletedAppointmentIds.has(item.id));
    const nextServices = servicesRef.current.filter((item) => !deletedServiceIds.has(item.id));

    setAppointments(nextAppointments);
    appointmentsRef.current = nextAppointments;
    setServices(nextServices);
    servicesRef.current = nextServices;
  };

  const completePaymentForService = async (serviceId: string) => {
    try {
      const completed = await api.completePayment(serviceId);

      const nextServices = normalizeServicesForPersistence(
        servicesRef.current.map((service) => (
          service.id === completed.service.id ? completed.service : service
        ))
      );
        setServices(nextServices);
        servicesRef.current = nextServices;

      if (completed.appointment) {
        const nextAppointments = appointmentsRef.current.map((appointment) => (
          appointment.id === completed.appointment?.id ? completed.appointment : appointment
        ));
        setAppointments(nextAppointments);
        appointmentsRef.current = nextAppointments;
      }

      dismissPaymentCompletionNotice(completed.service.id);
      notifyPaymentCompleted(completed.service);
    } catch (error) {
      await handlePersistenceError(error, 'Nao foi possivel finalizar o pagamento.');
      throw error;
    }
  };

  const startWashForService = async (
    serviceId: string,
    payload: StartWashPayload
  ): Promise<{ persisted: boolean; transition: ServiceStageTransitionPayload }> => {
    const currentService = servicesRef.current.find((service) => service.id === serviceId);
    if (!currentService) {
      throw new Error('Servico nao encontrado para iniciar a lavagem.');
    }

    const fallbackTransition = buildLocalStartWashTransition(currentService, payload);

    if (!navigator.onLine) {
      enqueuePendingOperationalAction({
        serviceId,
        type: 'start_wash',
        payload,
      });
      mergeServiceTransitionIntoState(fallbackTransition);
      notifyWashStarted(fallbackTransition.service, false);
      return {
        persisted: false,
        transition: fallbackTransition,
      };
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await api.startWash(serviceId, payload);
        mergeServiceTransitionIntoState(response);
        notifyWashStarted(response.service, true);
        return {
          persisted: true,
          transition: response,
        };
      } catch (error) {
        lastError = error;
        if (!navigator.onLine) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    if (shouldQueuePendingPhotoSave(lastError)) {
      enqueuePendingOperationalAction({
        serviceId,
        type: 'start_wash',
        payload,
      });
      mergeServiceTransitionIntoState(fallbackTransition);
      notifyWashStarted(fallbackTransition.service, false);
      return {
        persisted: false,
        transition: fallbackTransition,
      };
    }

    throw lastError instanceof Error ? lastError : new Error('Nao foi possivel iniciar a lavagem.');
  };

  const completeWashForService = async (
    serviceId: string,
    payload: CompleteWashPayload
  ): Promise<{ persisted: boolean; transition: ServiceStageTransitionPayload }> => {
    const currentService = servicesRef.current.find((service) => service.id === serviceId);
    if (!currentService) {
      throw new Error('Servico nao encontrado para concluir a lavagem.');
    }

    const fallbackTransition = buildLocalCompleteWashTransition(currentService, payload);

    if (!navigator.onLine) {
      enqueuePendingOperationalAction({
        serviceId,
        type: 'complete_wash',
        payload,
      });
      mergeServiceTransitionIntoState(fallbackTransition);
      notifyWashCompleted(fallbackTransition.service, false);
      return {
        persisted: false,
        transition: fallbackTransition,
      };
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await api.completeWash(serviceId, payload);
        mergeServiceTransitionIntoState(response);
        notifyWashCompleted(response.service, true);
        return {
          persisted: true,
          transition: response,
        };
      } catch (error) {
        lastError = error;
        if (!navigator.onLine) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    if (shouldQueuePendingPhotoSave(lastError)) {
      enqueuePendingOperationalAction({
        serviceId,
        type: 'complete_wash',
        payload,
      });
      mergeServiceTransitionIntoState(fallbackTransition);
      notifyWashCompleted(fallbackTransition.service, false);
      return {
        persisted: false,
        transition: fallbackTransition,
      };
    }

    throw lastError instanceof Error ? lastError : new Error('Nao foi possivel concluir a lavagem.');
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

    if (normalized === 'dashboard' && !canViewAnalytics) {
      setCurrentScreen('scheduling');
      return;
    }

    if ((normalized === 'vehicle-history' || normalized === 'vehicle-history-detail') && !canViewAnalytics) {
      setCurrentScreen('scheduling');
      return;
    }

    if (normalized === 'inventory' && !canManageInventory) {
      setCurrentScreen(getHomeScreenForUser(currentUser));
      return;
    }

    if (normalized === 'settings' && !canManageSettings) {
      setCurrentScreen(getHomeScreenForUser(currentUser));
      return;
    }

    if (normalized !== 'vehicle-history-detail') {
      setSelectedVehiclePlate(null);
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

  const handleNavigateWithVehicle = (screen: Screen, plate?: string) => {
    if (plate) {
      setSelectedVehiclePlate(plate.toUpperCase());
    }

    setCurrentScreen(normalizeScreen(screen));
  };

  const handleLogout = async () => {
    isIntentionalLogoutRef.current = true;
    isRecoveringSessionRef.current = true;
    try {
      await api.logout();
    } catch (error) {
      console.error(error);
    }

    performClientLogout();
  };

  const handleLogin = async (identifier: string, password: string) => {
    const response = await api.login(identifier, password);
    isIntentionalLogoutRef.current = false;
    isRecoveringSessionRef.current = false;
    setCurrentUser(response.user);
    setIsSessionResolved(true);
    setSelectedBase(response.user.role === 'Clientes' ? (response.user.allowedBaseIds?.[0] || null) : null);
    setCurrentScreen(getHomeScreenForUser(response.user));
    await loadBootstrap();
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

    let hasAppointmentChanges = false;
    const serviceMap = new Map<string, Service>(services.map((service) => [service.id, service]));
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

      if (relatedService?.status === 'in_progress' && appointment.status !== 'in_progress') {
        hasAppointmentChanges = true;
        return {
          ...appointment,
          status: 'in_progress' as const,
        };
      }

      if (relatedService?.status === 'waiting_payment' && appointment.status !== 'waiting_payment') {
        hasAppointmentChanges = true;
        return {
          ...appointment,
          status: 'waiting_payment' as const,
        };
      }

      if (relatedService?.status === 'pending' && !ACTIVE_SCHEDULING_APPOINTMENT_STATUSES.includes(appointment.status)) {
        hasAppointmentChanges = true;
        return {
          ...appointment,
          status: 'confirmed' as const,
        };
      }

      return appointment;
    });

    if (!hasAppointmentChanges) {
      return;
    }

    if (hasAppointmentChanges) {
      void persistAppointments(nextAppointments);
    }
  }, [isAuthenticated, currentDateKey, services, appointments]);

  const renderScreen = () => {
    if (!isSessionResolved || isBootstrapping) return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Carregando dados persistentes...</div>;
    if (!isAuthenticated) return <Login onLogin={handleLogin} />;
    if (backendError) return <div className="min-h-screen flex items-center justify-center p-6 text-center text-rose-600 font-bold">{backendError}</div>;
    if (activeServiceId && !activeService && isActiveServiceLoading && ['inspection-pre', 'inspection-post', 'payment', 'history', 'customer-history'].includes(currentScreen)) {
      return <div className="min-h-screen flex items-center justify-center text-slate-500 font-bold">Carregando servico...</div>;
    }

    switch (currentScreen) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigateWithService} services={services} appointments={appointments} currentDateKey={currentDateKey} team={team} canManageSettings={canManageSettings} />;
      case 'checkin': return <CheckIn onNavigate={navigateTo} onAddService={addService} serviceTypes={serviceTypes} vehicleDb={vehicleDb} selectedBaseId={selectedBaseInfo?.id} selectedBaseName={selectedBaseInfo?.name} />;
      case 'inspection-pre': return <InspectionPre service={activeService} teamMembers={team} elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onServiceChange={mergeServiceIntoState} onStartWash={async (washers, photos, observations) => {
        if (activeServiceId) {
          return startWashForService(activeServiceId, {
            washers,
            observations,
            preInspectionPhotos: photos,
          });
        }
      }} />;
      case 'inspection-post': return <InspectionPost service={activeService} elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} onServiceChange={mergeServiceIntoState} onCompleteWash={async (photos) => {
        if (activeServiceId) {
          return completeWashForService(activeServiceId, {
            postInspectionPhotos: photos,
          });
        }
      }} />;
      case 'payment': return <Payment service={activeService} services={services} elapsedMinutes={activeServiceElapsedMinutes} onNavigate={navigateTo} completionNotice={paymentCompletionNotice && activeService?.id === paymentCompletionNotice.serviceId ? paymentCompletionNotice : null} onDismissCompletionNotice={() => dismissPaymentCompletionNotice(activeServiceId || undefined)} onPaymentComplete={async () => {
        if (activeServiceId) {
          await completePaymentForService(activeServiceId);
        }
      }} />;
      case 'history': return <ServiceHistory onNavigate={handleNavigateWithService} service={activeService} />;
      case 'customer-history': return <CustomerHistory onNavigate={handleNavigateWithService} selectedService={activeService} />;
      case 'vehicle-history': return <VehicleHistory onNavigate={handleNavigateWithService} onOpenVehicle={(plate) => handleNavigateWithVehicle('vehicle-history-detail', plate)} />;
      case 'vehicle-history-detail': return <VehicleHistoryDetail plate={selectedVehiclePlate} onNavigate={handleNavigateWithService} />;
      case 'queue':
      case 'scheduling': 
        return <Scheduling currentDateKey={currentDateKey} appointments={appointments} onUpdateAppointments={persistAppointments} onCreateBooking={createScheduledBooking} onNavigate={handleNavigateWithService} services={services} onReorder={reorderServices} onDeleteServiceRecord={deleteServiceRecord} onDeleteAppointmentRecord={deleteAppointmentRecord} serviceTypes={serviceTypes} vehicleDb={vehicleDb} availableBases={availableBases} isClientUser={isClientUser} currentUser={currentUser} canDeleteRecords={canDeleteOperationalRecords} onRegisterVehicle={registerVehicleFromScheduling} selectedBaseId={selectedBaseInfo?.id} selectedBaseName={selectedBaseInfo?.name} onSelectBase={(baseId) => {
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
              await deleteServiceRecord(service);
            }}
          />
        </div>
      );
      case 'settings': return <Settings onNavigate={navigateTo} currentUser={currentUser} serviceTypes={serviceTypes} onUpdateServiceTypes={persistServiceTypes} vehicleDb={vehicleDb} isVehicleDbLoading={isVehicleDbLoading} onUpdateVehicleDb={persistVehicleDb} team={team} onUpdateTeam={persistTeam} accessRules={accessRules} onUpdateAccessRules={persistAccessRules} />;
      default: return <Dashboard onNavigate={handleNavigateWithService} services={services} appointments={appointments} currentDateKey={currentDateKey} team={team} canManageSettings={canManageSettings} />;
    }
  };

  return (
    <div className={`min-h-screen bg-white ${isAuthenticated ? 'app-shell-scale' : ''}`}>
      <div className="bg-white min-h-screen flex transition-colors">
        {isAuthenticated && (
          <Sidebar 
            currentScreen={currentScreen} 
            onNavigate={navigateTo} 
            onLogout={handleLogout} 
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            currentUser={currentUser}
            canViewAnalytics={canViewAnalytics}
            canManageInventory={canManageInventory}
            canManageSettings={canManageSettings}
          />
        )}

        <div className="flex-1 flex flex-col min-h-screen relative overflow-hidden">
          {/* Header */}
          {isAuthenticated && (
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-3 lg:hidden">
                <img 
                  src={getSafeLogoSrc()} 
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
                   currentScreen === 'vehicle-history' ? 'Histórico de Veículos' :
                   currentScreen === 'vehicle-history-detail' ? 'Detalhe do Veículo' :
                   currentScreen === 'inventory' ? 'Estoque' :
                   currentScreen === 'settings' ? 'Configurações' : currentScreen.replace('-', ' ')}
                </h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gestão de Estética Automotiva</p>
              </div>

              <div className="flex items-center gap-2">
                {canManageSettings && (
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
                    onToggle={handleToggleNotifications}
                    onClose={handleCloseNotifications}
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

          <AnimatePresence>
            {completionPopup && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-none fixed left-1/2 top-20 z-[120] w-[min(92vw,360px)] -translate-x-1/2 px-2"
              >
                <div className="pointer-events-auto rounded-3xl border border-emerald-100 bg-white px-5 py-4 shadow-2xl shadow-slate-900/10">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${completionPopup.synced ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
                        {completionPopup.title}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-900">
                        {completionPopup.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        clearCompletionPopupTimer();
                        setCompletionPopup(null);
                      }}
                      className="rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Fechar aviso de conclusao"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Navigation (Mobile Only) */}
          {isAuthenticated && !isClientUser && !['checkin', 'inspection-pre', 'inspection-post', 'payment'].includes(currentScreen) && (
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-2 pb-8 pt-3 flex items-center justify-around z-50 transition-colors">
              {canViewAnalytics && (
                <NavButton 
                  active={currentScreen === 'dashboard'} 
                  onClick={() => navigateTo('dashboard')}
                  icon={<LayoutDashboard className="w-6 h-6" />}
                  label="Painel"
                />
              )}
              <NavButton 
                active={currentScreen === 'scheduling' || currentScreen === 'queue'} 
                onClick={() => navigateTo('scheduling')}
                icon={<Droplets className="w-6 h-6" />}
                label="Agenda & Fila"
              />
              {canManageInventory && (
                <NavButton 
                  active={currentScreen === 'inventory'} 
                  onClick={() => navigateTo('inventory')}
                  icon={<Package className="w-6 h-6" />}
                  label="Estoque"
                />
              )}
              {canViewAnalytics && (
                <NavButton 
                  active={currentScreen === 'vehicle-history' || currentScreen === 'vehicle-history-detail'} 
                  onClick={() => navigateTo('vehicle-history')}
                  icon={<History className="w-6 h-6" />}
                  label="Historico"
                />
              )}
            </nav>
          )}

                  
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
