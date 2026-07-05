import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const analyticsSource = readFileSync(new URL('../src/pages/Analytics.tsx', import.meta.url), 'utf8');

test('analytics page requests shift dynamics and renders two shift charts', () => {
  assert.match(analyticsSource, /interface\s+ShiftDynamics/);
  assert.match(analyticsSource, /bookingsByShiftResponse/);
  assert.match(analyticsSource, /\/api\/analytics\/shift-dynamics/);
  assert.match(analyticsSource, /Динамика записей по сменам/);
  assert.match(analyticsSource, /Динамика кубов по сменам/);
  assert.match(analyticsSource, /Смена 1 \(08:00–20:00\)/);
  assert.match(analyticsSource, /Смена 2 \(20:00–08:00\)/);
});
