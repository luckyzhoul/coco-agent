// Unit tests for memory tiering math (pure, no Electron required).
import {
  recencyWeight,
  tierOrder,
  RECENCY_HALF_LIFE_MS,
  type MemoryTier
} from '../src/main/memory/tiering';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

const NOW = 1_800_000_000_000; // fixed clock
const DAY = 24 * 60 * 60 * 1000;

// --- recencyWeight: recent tier ---
const fresh = recencyWeight(NOW, NOW);
assert(Math.abs(fresh - 2) < 1e-9, `fresh entry weighs 2x (got ${fresh.toFixed(3)})`);

const oneDay = recencyWeight(NOW - 1 * DAY, NOW);
assert(oneDay > 1.8 && oneDay < 2, `1-day-old entry ~1.9x (got ${oneDay.toFixed(3)})`);

const atHalfLife = recencyWeight(NOW - RECENCY_HALF_LIFE_MS, NOW);
assert(Math.abs(atHalfLife - 1.5) < 0.01, `at half-life weighs 1.5x (got ${atHalfLife.toFixed(3)})`);

const old = recencyWeight(NOW - 30 * DAY, NOW);
// 0.5^(30/7) ≈ 0.051 → weight ≈ 1.051
assert(old > 1.04 && old < 1.06, `30-day-old entry ≈1.05x (got ${old.toFixed(3)})`);

// --- recencyWeight: monotonic decay ---
assert(
  recencyWeight(NOW, NOW) > recencyWeight(NOW - DAY, NOW) &&
    recencyWeight(NOW - DAY, NOW) > recencyWeight(NOW - 10 * DAY, NOW),
  'weight decays monotonically with age'
);

// --- future timestamps clamp to the max boost ---
assert(Math.abs(recencyWeight(NOW + 5 * DAY, NOW) - 2) < 1e-9, 'future timestamp clamps to 2x');

// --- tier ordering ---
const tiers: MemoryTier[] = ['long_term', 'recent', 'long_term', 'recent'];
const sorted = [...tiers].sort((a, b) => tierOrder(a) - tierOrder(b));
assert(
  sorted.join(',') === 'recent,recent,long_term,long_term',
  'recent sorts before long_term'
);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
if (failures > 0) process.exit(1);
