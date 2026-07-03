import assert from 'node:assert/strict';
import {
  canFloresBookSlot,
  getFloresWorkingDateStrip,
  getNextFloresWorkingDate,
  getFloresServiceDurationMinutes,
  getFloresTimeSlots,
  isFloresWorkingDay,
} from '../src/utils/floresSchedulingRules.js';

assert.equal(getFloresServiceDurationMinutes('car'), 90);
assert.equal(getFloresServiceDurationMinutes('motorcycle'), 90);
assert.equal(getFloresServiceDurationMinutes('truck'), 120);

assert.equal(isFloresWorkingDay('2026-07-06'), false);
assert.equal(isFloresWorkingDay('2026-07-07'), true);
assert.equal(isFloresWorkingDay('2026-07-08'), false);
assert.equal(isFloresWorkingDay('2026-07-09'), true);
assert.equal(isFloresWorkingDay('2026-07-10'), false);
assert.equal(isFloresWorkingDay('2026-07-11'), true);
assert.equal(isFloresWorkingDay('2026-07-12'), false);

assert.equal(getNextFloresWorkingDate('2026-07-03'), '2026-07-04');
assert.equal(getNextFloresWorkingDate('2026-07-06'), '2026-07-07');
assert.deepEqual(getFloresWorkingDateStrip('2026-07-03', 7), [
  '2026-07-04',
  '2026-07-07',
  '2026-07-09',
  '2026-07-11',
  '2026-07-14',
  '2026-07-16',
  '2026-07-18',
]);

assert.deepEqual(getFloresTimeSlots('2026-07-07', 'car'), ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']);
assert.deepEqual(getFloresTimeSlots('2026-07-07', 'truck'), ['08:00', '08:30', '09:00', '09:30', '10:00', '14:00', '14:30', '15:00', '15:30', '16:00']);
assert.deepEqual(getFloresTimeSlots('2026-07-11', 'car'), ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30']);
assert.deepEqual(getFloresTimeSlots('2026-07-11', 'truck'), ['08:00', '08:30', '09:00', '09:30', '10:00']);
assert.deepEqual(getFloresTimeSlots('2026-07-12', 'car'), []);

assert.equal(canFloresBookSlot([], '2026-07-06', '08:00', { nextVehicleType: 'car' }).reason, 'closed_day');
assert.equal(canFloresBookSlot([], '2026-07-07', '11:00', { nextVehicleType: 'car' }).reason, 'outside_hours');
assert.equal(canFloresBookSlot([], '2026-07-07', '17:00', { nextVehicleType: 'truck' }).reason, 'outside_hours');
assert.equal(canFloresBookSlot([], '2026-07-07', '15:30', { nextVehicleType: 'car' }).ok, true);
assert.equal(canFloresBookSlot([], '2026-07-07', '16:00', { nextVehicleType: 'truck' }).ok, true);

const existingTruck = [
  {
    id: 'truck-1',
    baseId: 'flores',
    date: '2026-07-07',
    time: '08:00',
    status: 'confirmed',
    vehicleType: 'truck',
  },
];

assert.equal(canFloresBookSlot(existingTruck, '2026-07-07', '09:30', { nextVehicleType: 'car' }).reason, 'overlap');
assert.equal(canFloresBookSlot(existingTruck, '2026-07-07', '10:00', { nextVehicleType: 'truck' }).ok, true);
assert.equal(canFloresBookSlot(existingTruck, '2026-07-07', '10:00', { nextVehicleType: 'car' }).ok, true);

const existingCar = [
  {
    id: 'car-1',
    baseId: 'flores',
    date: '2026-07-07',
    time: '08:00',
    status: 'confirmed',
    vehicleType: 'car',
  },
];

assert.equal(canFloresBookSlot(existingCar, '2026-07-07', '09:30', { nextVehicleType: 'car' }).ok, true);

const ignoredAppointments = [
  { ...existingTruck[0], baseId: 'taruma' },
  { ...existingTruck[0], id: 'completed-1', status: 'completed' },
];

assert.equal(canFloresBookSlot(ignoredAppointments, '2026-07-07', '09:30', { nextVehicleType: 'car' }).ok, true);
