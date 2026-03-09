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
