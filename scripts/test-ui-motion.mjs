import assert from 'node:assert/strict';
import fs from 'node:fs';
import { easeOutCubic, interpolateMetricValue } from '../src/utils/uiMotion.js';

assert.equal(easeOutCubic(0), 0);
assert.equal(easeOutCubic(1), 1);
assert.equal(interpolateMetricValue(0, 100, 0.5), 88);
assert.equal(interpolateMetricValue(20, 40, 1), 40);

const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../src/components/Dashboard.tsx', import.meta.url), 'utf8');

assert.match(css, /\.screen-enter/);
assert.match(css, /\.interactive-surface/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(app, /screen-enter/);
assert.match(dashboard, /AnimatedMetricValue/);

console.log('ui motion tests passed');
