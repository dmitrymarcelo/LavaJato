import assert from 'node:assert/strict';
import { getLifetimeWashSummary } from '../src/utils/dashboardMetrics.js';

const services = [
  {
    id: 'paid-1',
    plate: 'ABC1D23',
    status: 'completed',
  },
  {
    id: 'waiting-1',
    plate: 'ABC1D23',
    status: 'waiting_payment',
  },
  {
    id: 'wash-finished',
    plate: 'XYZ9A87',
    status: 'in_progress',
    timeline: { washCompletedAt: '2026-05-26T12:00:00.000Z' },
  },
  {
    id: 'no-show',
    plate: 'NOO0S00',
    status: 'no_show',
  },
  {
    id: 'pending',
    plate: 'PEN0D00',
    status: 'pending',
  },
];

const summary = getLifetimeWashSummary(services);

assert.equal(summary.totalWashed, 3);
assert.equal(summary.uniqueVehicles, 2);
assert.equal(summary.pendingPayment, 1);
assert.equal(summary.lastWashedAt, '2026-05-26T12:00:00.000Z');
