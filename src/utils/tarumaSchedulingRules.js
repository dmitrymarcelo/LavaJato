export const TARUMA_BASE_ID = 'taruma';
/** @type {'dique_leve'} */
export const TARUMA_DIQUE_LEVE_ZONE_ID = 'dique_leve';
export const TARUMA_DIQUE_LEVE_ZONE_NAME = 'Dique Leve';
export const TARUMA_DEFAULT_SLOT_CAPACITY = 3;
export const TARUMA_END_OF_SHIFT_TIME = '17:00';
export const TARUMA_END_OF_SHIFT_SLOT_CAPACITY = 2;
export const TARUMA_END_OF_SHIFT_TRUCK_SLOT_CAPACITY = 1;
export const TARUMA_MAX_TRUCKS_PER_SLOT = 1;
export const TARUMA_MAX_OTHERS_PER_SLOT = 2;
export const TARUMA_TRUCK_MIN_INTERVAL_MINUTES = 180;
export const TARUMA_ACTIVE_APPOINTMENT_STATUSES = ['confirmed', 'pending'];

export const TARUMA_ZONE_RULES = [
  {
    id: TARUMA_DIQUE_LEVE_ZONE_ID,
    label: TARUMA_DIQUE_LEVE_ZONE_NAME,
    capacityLabel: '3 veiculos (2 leves + 1 caminhao); 17:00: 2 (ou 1 se caminhao)',
    accepts: () => true,
  },
];

const normalizeDate = (value) => String(value || '').slice(0, 10);
const normalizeTime = (value) => String(value || '').slice(0, 5);
const isTruckVehicleType = (vehicleType) => String(vehicleType || '') === 'truck';
const timeToMinutes = (value) => {
  const normalized = normalizeTime(value);
  const hours = Number.parseInt(normalized.slice(0, 2), 10);
  const minutes = Number.parseInt(normalized.slice(3, 5), 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 0;
  }
  return (hours * 60) + minutes;
};

export function isTarumaBase(baseId) {
  return baseId === TARUMA_BASE_ID;
}

/**
 * @param {unknown} [_vehicleType]
 * @returns {'dique_leve'}
 */
export function getDefaultTarumaZone(_vehicleType) {
  return TARUMA_DIQUE_LEVE_ZONE_ID;
}

export function getTarumaZoneLabel(zoneId) {
  return zoneId === TARUMA_DIQUE_LEVE_ZONE_ID ? TARUMA_DIQUE_LEVE_ZONE_NAME : 'Nao definido';
}

export function getTarumaSlotCapacity(time) {
  return normalizeTime(time) === TARUMA_END_OF_SHIFT_TIME
    ? TARUMA_END_OF_SHIFT_SLOT_CAPACITY
    : TARUMA_DEFAULT_SLOT_CAPACITY;
}

export function isActiveTarumaAppointment(appointment) {
  return TARUMA_ACTIVE_APPOINTMENT_STATUSES.includes(appointment?.status);
}

export function getTarumaSlotUsageByType(appointments, date, time, options = {}) {
  const targetBaseId = options.baseId || TARUMA_BASE_ID;
  const excludedId = options.excludeId || null;
  const targetDate = normalizeDate(date);
  const targetTime = normalizeTime(time);

  const filtered = appointments.filter((appointment) => (
    appointment?.id !== excludedId
    && appointment?.baseId === targetBaseId
    && normalizeDate(appointment?.date) === targetDate
    && normalizeTime(appointment?.time) === targetTime
    && isActiveTarumaAppointment(appointment)
  ));

  const truck = filtered.filter((appointment) => isTruckVehicleType(appointment?.vehicleType)).length;
  const total = filtered.length;

  return {
    total,
    truck,
    other: total - truck,
  };
}

export function getTarumaSlotUsage(appointments, date, time, options = {}) {
  const targetBaseId = options.baseId || TARUMA_BASE_ID;
  const excludedId = options.excludeId || null;
  const targetDate = normalizeDate(date);
  const targetTime = normalizeTime(time);

  return appointments.filter((appointment) => (
    appointment?.id !== excludedId
    && appointment?.baseId === targetBaseId
    && normalizeDate(appointment?.date) === targetDate
    && normalizeTime(appointment?.time) === targetTime
    && isActiveTarumaAppointment(appointment)
  )).length;
}

export function canTarumaBookSlot(appointments, date, time, options = {}) {
  const targetBaseId = options.baseId || TARUMA_BASE_ID;
  const excludedId = options.excludeId || null;
  const targetDate = normalizeDate(date);
  const targetTime = normalizeTime(time);
  const nextVehicleType = options.nextVehicleType;
  const nextIsTruck = isTruckVehicleType(nextVehicleType);

  const usage = getTarumaSlotUsageByType(appointments, targetDate, targetTime, { baseId: targetBaseId, excludeId: excludedId });
  const hasTruckInSlot = usage.truck > 0 || nextIsTruck;

  const isEndOfShiftSlot = targetTime === TARUMA_END_OF_SHIFT_TIME;
  const slotTotalLimit = isEndOfShiftSlot
    ? (hasTruckInSlot ? TARUMA_END_OF_SHIFT_TRUCK_SLOT_CAPACITY : TARUMA_END_OF_SHIFT_SLOT_CAPACITY)
    : TARUMA_DEFAULT_SLOT_CAPACITY;

  const limits = {
    total: slotTotalLimit,
    truck: TARUMA_MAX_TRUCKS_PER_SLOT,
    other: Math.min(TARUMA_MAX_OTHERS_PER_SLOT, slotTotalLimit),
  };

  if (nextIsTruck) {
    if (usage.truck >= limits.truck) {
      return { ok: false, reason: 'slot_truck_full', limits, usage };
    }

    const hasTruckIntervalConflict = appointments.some((appointment) => (
      appointment?.id !== excludedId
      && appointment?.baseId === targetBaseId
      && normalizeDate(appointment?.date) === targetDate
      && isActiveTarumaAppointment(appointment)
      && isTruckVehicleType(appointment?.vehicleType)
      && Math.abs(timeToMinutes(appointment?.time) - timeToMinutes(targetTime)) > 0
      && Math.abs(timeToMinutes(appointment?.time) - timeToMinutes(targetTime)) < TARUMA_TRUCK_MIN_INTERVAL_MINUTES
    ));

    if (hasTruckIntervalConflict) {
      return { ok: false, reason: 'truck_interval', limits, usage };
    }
  } else {
    if (usage.other >= limits.other) {
      return { ok: false, reason: 'slot_other_full', limits, usage };
    }
  }

  if (usage.total >= limits.total) {
    return { ok: false, reason: 'slot_total_full', limits, usage };
  }

  return { ok: true, limits, usage };
}

export function isTarumaSlotFull(appointments, date, time, options = {}) {
  return getTarumaSlotUsage(appointments, date, time, options) >= getTarumaSlotCapacity(time);
}
