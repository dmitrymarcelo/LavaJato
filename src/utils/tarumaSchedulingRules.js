export const TARUMA_BASE_ID = 'taruma';
/** @type {'dique_leve'} */
export const TARUMA_DIQUE_LEVE_ZONE_ID = 'dique_leve';
export const TARUMA_DIQUE_LEVE_ZONE_NAME = 'Dique Leve';
export const TARUMA_DEFAULT_SLOT_CAPACITY = 3;
export const TARUMA_END_OF_SHIFT_TIME = '17:00';
export const TARUMA_END_OF_SHIFT_SLOT_CAPACITY = 2;
export const TARUMA_ACTIVE_APPOINTMENT_STATUSES = ['confirmed', 'pending'];

export const TARUMA_ZONE_RULES = [
  {
    id: TARUMA_DIQUE_LEVE_ZONE_ID,
    label: TARUMA_DIQUE_LEVE_ZONE_NAME,
    capacityLabel: '3 veiculos por horario; 2 as 17:00',
    accepts: () => true,
  },
];

const normalizeDate = (value) => String(value || '').slice(0, 10);
const normalizeTime = (value) => String(value || '').slice(0, 5);

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

export function isTarumaSlotFull(appointments, date, time, options = {}) {
  return getTarumaSlotUsage(appointments, date, time, options) >= getTarumaSlotCapacity(time);
}
