import { formatTokens, formatPercent, ringProgress } from '../src/renderer/components/chat/usageFormat';

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
  else console.log('ok  :', msg);
}

// --- formatTokens ---
assert(formatTokens(800) === '800', 'below 1k shows raw number');
assert(formatTokens(1000) === '1k', 'exactly 1k');
assert(formatTokens(1536) === '1.5k', '1.5k keeps one decimal');
assert(formatTokens(15000) === '15k', '15k drops trailing .0');
assert(formatTokens(128000) === '128k', '128k');
assert(formatTokens(0) === '0', 'zero');
assert(formatTokens(null as any) === '—', 'null shows placeholder dash');

// --- formatPercent ---
assert(formatPercent(12.4) === '12%', 'percent rounds to integer');
assert(formatPercent(0) === '0%', 'zero percent');
assert(formatPercent(null as any) === '—', 'null percent shows dash');

// --- ringProgress ---
assert(ringProgress(0) === 0, '0% -> 0 progress');
assert(ringProgress(50) === 0.5, '50% -> half');
assert(ringProgress(100) === 1, '100% -> full');
assert(ringProgress(150) === 1, 'over 100 clamps to 1');
assert(ringProgress(-5) === 0, 'negative clamps to 0');
assert(ringProgress(null as any) === 0, 'null -> 0 (empty ring)');

console.log('\ncontext usage format tests done');
