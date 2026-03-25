import type { Service } from '../types';

export function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getTodayDate() {
  return new Date().toLocaleDateString('en-CA');
}

export function addDays(baseDate: string, days: number) {
  const date = new Date(`${baseDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('en-CA');
}

export function normalizeDateKey(value?: string | Date | null) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized.slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
}

export function toSortableDateTime(value?: string | Date | null) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return '';
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return normalized;
}

export function formatDateTimeValue(value?: string | Date | null, locale = 'pt-BR') {
  const sortable = toSortableDateTime(value);
  if (!sortable) {
    return 'Nao registrado';
  }

  const parsed = new Date(sortable);
  if (Number.isNaN(parsed.getTime())) {
    return sortable;
  }

  return parsed.toLocaleString(locale);
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export function formatCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function isValidCpf(value: string) {
  const cpf = digitsOnly(value);

  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const calcDigit = (base: string, factor: number) => {
    let total = 0;

    for (const digit of base) {
      total += Number(digit) * factor--;
    }

    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstDigit = calcDigit(cpf.slice(0, 9), 10);
  const secondDigit = calcDigit(cpf.slice(0, 10), 11);

  return firstDigit === Number(cpf[9]) && secondDigit === Number(cpf[10]);
}

export function validateStrongPassword(password: string) {
  if (password.length < 12) {
    return 'A senha deve ter no minimo 12 caracteres.';
  }

  if (!/[a-z]/.test(password)) {
    return 'A senha deve ter pelo menos uma letra minuscula.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'A senha deve ter pelo menos uma letra maiuscula.';
  }

  if (!/\d/.test(password)) {
    return 'A senha deve ter pelo menos um numero.';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'A senha deve ter pelo menos um caractere especial.';
  }

  return null;
}

export function isValidEmail(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function getElapsedMinutes(startTime?: string, now = Date.now()) {
  if (!startTime) {
    return 0;
  }

  const startedAt = new Date(startTime).getTime();

  if (Number.isNaN(startedAt)) {
    return 0;
  }

  return Math.max(0, Math.floor((now - startedAt) / 60000));
}

export function getDurationMinutes(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) {
    return 0;
  }

  const startedAt = new Date(startTime).getTime();
  const finishedAt = new Date(endTime).getTime();

  if (Number.isNaN(startedAt) || Number.isNaN(finishedAt) || finishedAt <= startedAt) {
    return 0;
  }

  return Math.floor((finishedAt - startedAt) / 60000);
}

export function formatElapsedMinutes(minutes: number) {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  if (!hours) {
    return `${remainingMinutes} min`;
  }

  return `${hours}h ${remainingMinutes.toString().padStart(2, '0')}min`;
}

export function getServicePreviewImage(service?: Service | null) {
  return (
    service?.postInspectionPhotos?.front
    || service?.preInspectionPhotos?.front
    || service?.image
    || ''
  );
}

export async function optimizeImageFile(
  file: File,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  }
) {
  const maxWidth = options?.maxWidth ?? 1024;
  const maxHeight = options?.maxHeight ?? 1024;
  const quality = options?.quality ?? 0.6;

  const fileDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem selecionada.'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined') {
    return fileDataUrl;
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Nao foi possivel processar a imagem selecionada.'));
    element.src = fileDataUrl;
  });

  let { width, height } = image;
  if (!width || !height) {
    return fileDataUrl;
  }

  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) {
    return fileDataUrl;
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export type PendingPhotoStage = 'pre' | 'post';

export type PendingPhotoSaveEntry = {
  id: string;
  createdAt: number;
  serviceId: string;
  stage: PendingPhotoStage;
  photoId: string;
  imageData: string;
};

const PENDING_PHOTO_SAVES_KEY = 'pendingPhotoSavesV2';
const LEGACY_PENDING_PHOTO_SAVES_KEY = 'pendingPhotoSaves';

function safeReadJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizePendingPhotoList(value: unknown): PendingPhotoSaveEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: PendingPhotoSaveEntry[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<PendingPhotoSaveEntry> & {
      payload?: Partial<Service> & { preInspectionPhotos?: Record<string, string>; postInspectionPhotos?: Record<string, string> };
    };

    const serviceId = typeof candidate.serviceId === 'string' ? candidate.serviceId : '';
    const stage = candidate.stage === 'pre' || candidate.stage === 'post' ? candidate.stage : null;
    const photoId = typeof candidate.photoId === 'string' ? candidate.photoId : '';
    const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now();
    const id = typeof candidate.id === 'string' ? candidate.id : generateId();

    let imageData = typeof candidate.imageData === 'string' ? candidate.imageData : '';
    if (!imageData && candidate.payload && stage && photoId) {
      const payloadPhotos = stage === 'pre' ? candidate.payload.preInspectionPhotos : candidate.payload.postInspectionPhotos;
      imageData = (payloadPhotos || {})[photoId] || '';
    }

    if (!serviceId || !stage || !photoId || !imageData) continue;
    items.push({ id, createdAt, serviceId, stage, photoId, imageData });
  }

  return items;
}

function dedupePendingPhotoList(items: PendingPhotoSaveEntry[]) {
  const seen = new Map<string, PendingPhotoSaveEntry>();
  for (const item of items) {
    const key = `${item.serviceId}:${item.stage}:${item.photoId}`;
    const existing = seen.get(key);
    if (!existing || existing.createdAt < item.createdAt) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function readPendingPhotoSaves() {
  const raw = typeof window !== 'undefined' ? window.localStorage.getItem(PENDING_PHOTO_SAVES_KEY) : null;
  const parsed = raw ? safeReadJson(raw) : null;
  const normalized = normalizePendingPhotoList(parsed);
  if (normalized.length) {
    return normalized;
  }

  const legacyRaw = typeof window !== 'undefined' ? window.localStorage.getItem(LEGACY_PENDING_PHOTO_SAVES_KEY) : null;
  const legacyParsed = legacyRaw ? safeReadJson(legacyRaw) : null;
  const legacyNormalized = normalizePendingPhotoList(legacyParsed);
  if (legacyNormalized.length) {
    writePendingPhotoSaves(legacyNormalized);
    try {
      window.localStorage.removeItem(LEGACY_PENDING_PHOTO_SAVES_KEY);
    } catch {}
  }
  return legacyNormalized;
}

export function writePendingPhotoSaves(items: PendingPhotoSaveEntry[]) {
  const normalized = dedupePendingPhotoList(items);
  try {
    window.localStorage.setItem(PENDING_PHOTO_SAVES_KEY, JSON.stringify(normalized));
  } catch {}
}

export function enqueuePendingPhotoSave(
  entry: Omit<PendingPhotoSaveEntry, 'id' | 'createdAt'>,
  options?: {
    maxEntries?: number;
    maxAgeMs?: number;
  }
) {
  const maxEntries = options?.maxEntries ?? 15;
  const maxAgeMs = options?.maxAgeMs ?? 1000 * 60 * 60 * 24 * 3;
  const now = Date.now();

  const existing = readPendingPhotoSaves();
  const candidate: PendingPhotoSaveEntry = {
    ...entry,
    id: generateId(),
    createdAt: now,
  };

  const combined = dedupePendingPhotoList([candidate, ...existing])
    .filter((item) => now - item.createdAt <= maxAgeMs)
    .slice(0, Math.max(1, maxEntries));

  writePendingPhotoSaves(combined);
  return candidate;
}

export function listPendingPhotoIds(serviceId: string, stage: PendingPhotoStage) {
  if (!serviceId) return [];
  return readPendingPhotoSaves()
    .filter((item) => item.serviceId === serviceId && item.stage === stage)
    .map((item) => item.photoId);
}

export async function flushPendingPhotoSaves(options: {
  stage?: PendingPhotoStage;
  serviceId?: string;
  saveInspectionPhoto: (serviceId: string, stage: PendingPhotoStage, photoId: string, imageData: string) => Promise<unknown>;
  onSaved?: (entry: PendingPhotoSaveEntry) => void;
}) {
  const list = readPendingPhotoSaves();
  const remaining: PendingPhotoSaveEntry[] = [];
  let savedCount = 0;

  for (const entry of list) {
    if (options.stage && entry.stage !== options.stage) {
      remaining.push(entry);
      continue;
    }
    if (options.serviceId && entry.serviceId !== options.serviceId) {
      remaining.push(entry);
      continue;
    }
    try {
      await options.saveInspectionPhoto(entry.serviceId, entry.stage, entry.photoId, entry.imageData);
      savedCount += 1;
      options.onSaved?.(entry);
    } catch {
      remaining.push(entry);
    }
  }

  writePendingPhotoSaves(remaining);
  return {
    savedCount,
    remainingCount: remaining.length,
  };
}
