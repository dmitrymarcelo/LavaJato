import assert from 'node:assert/strict';
import {
  canTarumaBookSlot,
  getDefaultTarumaZone,
  getTarumaSlotCapacity,
  getTarumaSlotUsageByType,
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
assert.equal(getTarumaSlotCapacity('17:00'), 1);
assert.equal(getTarumaSlotUsage(tarumaAppointments, '2026-05-26', '15:00'), 3);
assert.deepEqual(getTarumaSlotUsageByType(tarumaAppointments, '2026-05-26', '15:00'), { total: 3, truck: 1, other: 2 });
assert.equal(isTarumaSlotFull(tarumaAppointments, '2026-05-26', '15:00'), true);
assert.equal(isTarumaSlotFull(tarumaAppointments.slice(0, 2), '2026-05-26', '15:00'), false);
assert.equal(isTarumaSlotFull([{ ...tarumaAppointments[0], time: '17:00' }], '2026-05-26', '17:00'), true);
assert.equal(
  isTarumaSlotFull(
    tarumaAppointments.slice(0, 2).map((appointment) => ({ ...appointment, time: '17:00' })),
    '2026-05-26',
    '17:00'
  ),
  true
);

assert.deepEqual(
  canTarumaBookSlot(tarumaAppointments, '2026-05-26', '15:00', { nextVehicleType: 'car' }),
  {
    ok: false,
    reason: 'slot_other_full',
    limits: { total: 3, truck: 1, other: 2 },
    usage: { total: 3, truck: 1, other: 2 },
  }
);
assert.deepEqual(
  canTarumaBookSlot(tarumaAppointments, '2026-05-26', '15:00', { nextVehicleType: 'truck' }),
  {
    ok: false,
    reason: 'slot_truck_full',
    limits: { total: 3, truck: 1, other: 2 },
    usage: { total: 3, truck: 1, other: 2 },
  }
);

const tarumaOnlyLightSlot = tarumaAppointments.filter((appointment) => appointment.id !== 'truck-1');
assert.equal(
  canTarumaBookSlot(tarumaOnlyLightSlot, '2026-05-26', '15:00', { nextVehicleType: 'truck' }).ok,
  true
);
assert.equal(
  canTarumaBookSlot(tarumaOnlyLightSlot, '2026-05-26', '15:00', { nextVehicleType: 'car' }).ok,
  false
);

const tarumaEndShiftWithCar = [{ ...tarumaAppointments[0], time: '17:00' }];
assert.equal(canTarumaBookSlot(tarumaEndShiftWithCar, '2026-05-26', '17:00', { nextVehicleType: 'car' }).ok, false);
assert.equal(canTarumaBookSlot(tarumaEndShiftWithCar, '2026-05-26', '17:00', { nextVehicleType: 'truck' }).reason, 'truck_not_allowed_17');

const tarumaEndShiftWithTruck = [{ ...tarumaAppointments[1], time: '17:00' }];
assert.equal(canTarumaBookSlot(tarumaEndShiftWithTruck, '2026-05-26', '17:00', { nextVehicleType: 'car' }).ok, false);
assert.equal(canTarumaBookSlot(tarumaEndShiftWithTruck, '2026-05-26', '17:00', { nextVehicleType: 'truck' }).reason, 'truck_not_allowed_17');

const tarumaTruckSpacing = [
  { ...tarumaAppointments[1], id: 'truck-11', time: '11:00' },
];
assert.equal(canTarumaBookSlot(tarumaTruckSpacing, '2026-05-26', '09:00', { nextVehicleType: 'truck' }).reason, 'truck_interval');
assert.equal(canTarumaBookSlot(tarumaTruckSpacing, '2026-05-26', '13:00', { nextVehicleType: 'truck' }).reason, 'truck_interval');
assert.equal(canTarumaBookSlot(tarumaTruckSpacing, '2026-05-26', '15:00', { nextVehicleType: 'truck' }).ok, true);
