export const FLORES_BASE_ID = 'flores';
export const FLORES_ACTIVE_APPOINTMENT_STATUSES = ['confirmed', 'pending'];
export const FLORES_CAR_DURATION_MINUTES = 90;
export const FLORES_TRUCK_DURATION_MINUTES = 120;
export const FLORES_SLOT_GRANULARITY_MINUTES = 30;

export const FLORES_WEEKDAY_WORK_WINDOWS = [
  { start: '08:00', end: '12:00' },
  { start: '14:00', end: '18:00' },
];

export const FLORES_SATURDAY_WORK_WINDOWS = [
  { start: '08:00', end: '12:00' },
];

const normalizeDate = (value) => String(value || '').slice(0, 10);
const normalizeTime = (value) => String(value || '').slice(0, 5);
const isTruckVehicleType = (vehicleType) => String(vehicleType || '') === 'truck';

const getWeekDay = (date) => {
  const weekDay = new Date(`${normalizeDate(date)}T12:00:00`).getDay();
  return Number.isFinite(weekDay) ? weekDay : -1;
};

const timeToMinutes = (value) => {
  const normalized = normalizeTime(value);
  const hours = Number.parseInt(normalized.slice(0, 2), 10);
  const minutes = Number.parseInt(normalized.slice(3, 5), 10);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  return (hours * 60) + minutes;
};

const minutesToTime = (value) => {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const addDaysToDateKey = (date, amount) => {
  const baseDate = new Date(`${normalizeDate(date)}T12:00:00`);
  if (Number.isNaN(baseDate.getTime())) {
    return normalizeDate(date);
  }

  baseDate.setDate(baseDate.getDate() + amount);
  return baseDate.toISOString().slice(0, 10);
};

const intervalsOverlap = (firstStart, firstEnd, secondStart, secondEnd) => (
  firstStart < secondEnd && secondStart < firstEnd
);

export function isFloresBase(baseId) {
  return baseId === FLORES_BASE_ID;
}

export function getFloresServiceDurationMinutes(vehicleType) {
  return isTruckVehicleType(vehicleType)
    ? FLORES_TRUCK_DURATION_MINUTES
    : FLORES_CAR_DURATION_MINUTES;
}

export function getFloresWorkWindows(date) {
  const weekDay = getWeekDay(date);

  if (weekDay === 2 || weekDay === 4) {
    return FLORES_WEEKDAY_WORK_WINDOWS;
  }

  if (weekDay === 6) {
    return FLORES_SATURDAY_WORK_WINDOWS;
  }

  return [];
}

export function isFloresWorkingDay(date) {
  return getFloresWorkWindows(date).length > 0;
}

export function getNextFloresWorkingDate(date, options = {}) {
  const maxDays = options.maxDays || 60;

  for (let offset = 0; offset <= maxDays; offset += 1) {
    const candidate = addDaysToDateKey(date, offset);
    if (isFloresWorkingDay(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function getFloresWorkingDateStrip(startDate, count = 7) {
  const dates = [];

  for (let offset = 0; dates.length < count && offset < 90; offset += 1) {
    const candidate = addDaysToDateKey(startDate, offset);
    if (isFloresWorkingDay(candidate)) {
      dates.push(candidate);
    }
  }

  return dates;
}

export function getFloresTimeSlots(date, vehicleType) {
  const durationMinutes = getFloresServiceDurationMinutes(vehicleType);
  const slots = [];

  for (const window of getFloresWorkWindows(date)) {
    const start = timeToMinutes(window.start);
    const end = timeToMinutes(window.end);

    if (start === null || end === null) {
      continue;
    }

    for (let cursor = start; cursor + durationMinutes <= end; cursor += FLORES_SLOT_GRANULARITY_MINUTES) {
      slots.push(minutesToTime(cursor));
    }
  }

  return slots;
}

export function isActiveFloresAppointment(appointment) {
  return FLORES_ACTIVE_APPOINTMENT_STATUSES.includes(appointment?.status);
}

export function getFloresAppointmentInterval(appointment) {
  const start = timeToMinutes(appointment?.time);
  const durationMinutes = getFloresServiceDurationMinutes(appointment?.vehicleType);

  if (start === null) {
    return null;
  }

  return {
    start,
    end: start + durationMinutes,
  };
}

export function canFloresBookSlot(appointments, date, time, options = {}) {
  const targetBaseId = options.baseId || FLORES_BASE_ID;
  const excludedId = options.excludeId || null;
  const targetDate = normalizeDate(date);
  const targetTime = normalizeTime(time);
  const nextVehicleType = options.nextVehicleType;
  const durationMinutes = getFloresServiceDurationMinutes(nextVehicleType);
  const start = timeToMinutes(targetTime);

  if (!targetDate || start === null) {
    return {
      ok: false,
      reason: 'invalid_time',
      usage: { total: 0 },
      durationMinutes,
    };
  }

  const workWindows = getFloresWorkWindows(targetDate);
  if (workWindows.length === 0) {
    return {
      ok: false,
      reason: 'closed_day',
      usage: { total: 0 },
      durationMinutes,
    };
  }

  const end = start + durationMinutes;
  const fitsWorkWindow = workWindows.some((window) => {
    const windowStart = timeToMinutes(window.start);
    const windowEnd = timeToMinutes(window.end);
    return windowStart !== null && windowEnd !== null && start >= windowStart && end <= windowEnd;
  });

  if (!fitsWorkWindow || !getFloresTimeSlots(targetDate, nextVehicleType).includes(targetTime)) {
    return {
      ok: false,
      reason: 'outside_hours',
      usage: { total: 0 },
      durationMinutes,
    };
  }

  const conflicts = appointments.filter((appointment) => {
    if (
      appointment?.id === excludedId
      || appointment?.baseId !== targetBaseId
      || normalizeDate(appointment?.date) !== targetDate
      || !isActiveFloresAppointment(appointment)
    ) {
      return false;
    }

    const appointmentInterval = getFloresAppointmentInterval(appointment);
    return appointmentInterval
      ? intervalsOverlap(start, end, appointmentInterval.start, appointmentInterval.end)
      : false;
  });

  if (conflicts.length > 0) {
    return {
      ok: false,
      reason: 'overlap',
      usage: { total: conflicts.length },
      durationMinutes,
    };
  }

  return {
    ok: true,
    usage: { total: 0 },
    durationMinutes,
  };
}
