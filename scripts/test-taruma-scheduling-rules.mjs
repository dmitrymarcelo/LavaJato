import assert from 'node:assert/strict';
import {
  getDefaultTarumaZone,
  getTarumaSlotCapacity,
  getTarumaSlotUsage,
  isTarumaSlotFull,
} from '../src/utils/tarumaSchedulingRules.js';

const tarumaAppointments = [
  {
    id: 'car-1',
    baseId: 'taruma',
    date: '2026-05-26',
    time: '15:00',
    status: 'confirmed',
    vehicleType: 'car',
    washingZoneId: 'dique_leve',
  },
  {
    id: 'truck-1',
    baseId: 'taruma',
    date: '2026-05-26',
    time: '15:00',
    status: 'confirmed',
    vehicleType: 'truck',
    washingZoneId: 'dique_pesada',
  },
  {
    id: 'boat-1',
    baseId: 'taruma',
    date: '2026-05-26',
    time: '15:00',
    status: 'pending',
    vehicleType: 'boat',
    washingZoneId: 'estacionamento',
  },
  {
    id: 'completed-1',
    baseId: 'taruma',
    date: '2026-05-26',
    time: '15:00',
    status: 'completed',
    vehicleType: 'car',
  },
  {
    id: 'other-base',
    baseId: 'flores',
    date: '2026-05-26',
    time: '15:00',
    status: 'confirmed',
    vehicleType: 'car',
  },
];

assert.equal(getDefaultTarumaZone('truck'), 'dique_leve');
assert.equal(getDefaultTarumaZone('boat'), 'dique_leve');
assert.equal(getTarumaSlotCapacity('15:00'), 3);
assert.equal(getTarumaSlotCapacity('17:00'), 2);
assert.equal(getTarumaSlotUsage(tarumaAppointments, '2026-05-26', '15:00'), 3);
assert.equal(isTarumaSlotFull(tarumaAppointments, '2026-05-26', '15:00'), true);
assert.equal(isTarumaSlotFull(tarumaAppointments.slice(0, 2), '2026-05-26', '15:00'), false);
assert.equal(isTarumaSlotFull(tarumaAppointments.slice(0, 2), '2026-05-26', '17:00'), false);
assert.equal(
  isTarumaSlotFull(
    tarumaAppointments.slice(0, 2).map((appointment) => ({ ...appointment, time: '17:00' })),
    '2026-05-26',
    '17:00'
  ),
  true
);
