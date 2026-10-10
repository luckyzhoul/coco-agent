import { buildCompactionSettings, benignCompactionNotice } from '../src/main/agent/compaction';

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
  else console.log('ok  :', msg);
}

// --- 无窗口信息：回退 SDK 默认值 ---
const fallback = buildCompactionSettings(undefined);
assert(fallback.enabled === true, 'fallback: auto-compaction enabled');
assert(fallback.reserveTokens === 16384, 'fallback: reserveTokens 16384');
assert(fallback.keepRecentTokens === 20000, 'fallback: keepRecentTokens 20000');

// --- 非法窗口（0/负数）也回退默认 ---
assert(buildCompactionSettings(0).reserveTokens === 16384, 'invalid window 0 falls back');
assert(buildCompactionSettings(-100).reserveTokens === 16384, 'negative window falls back');

// --- 大窗口：封顶在 SDK 默认值 ---
const large = buildCompactionSettings(200_000);
assert(large.reserveTokens === 16384, 'large window: reserveTokens capped at 16384');
assert(large.keepRecentTokens === 20000, 'large window: keepRecentTokens capped at 20000');

// --- 中等窗口（32k）：按比例缩小 ---
const mid = buildCompactionSettings(32_000);
assert(mid.reserveTokens === 3_200, '32k window: reserveTokens = 10% = 3200');
assert(mid.keepRecentTokens === 8_000, '32k window: keepRecentTokens = 25% = 8000');

// --- 小窗口（8k）：仍然按比例，reserve 远小于窗口 ---
const tiny = buildCompactionSettings(8_000);
assert(tiny.reserveTokens === 800, '8k window: reserveTokens = 800');
assert(tiny.keepRecentTokens === 2_000, '8k window: keepRecentTokens = 2000');
assert(tiny.reserveTokens < 8_000 && tiny.keepRecentTokens < 8_000,
  '8k window: both budgets stay below the window');

// --- keepRecentTokens 不低于 reserveTokens 的合理关系（保留空间 > 响应空间） ---
for (const w of [8_000, 32_000, 128_000, 1_000_000]) {
  const s = buildCompactionSettings(w);
  assert(s.keepRecentTokens >= s.reserveTokens, `${w} window: keepRecent >= reserve`);
}

// --- 良性压缩错误识别（SDK 把「无需压缩」也当错误抛出） ---
assert(benignCompactionNotice('Compaction failed: Nothing to compact (session too small)') === '会话较短，暂无需压缩',
  'nothing-to-compact is benign with friendly notice');
assert(benignCompactionNotice('Compaction failed: Already compacted') === '上下文已压缩过，暂无需再次压缩',
  'already-compacted is benign with friendly notice');
assert(benignCompactionNotice('Compaction failed: 模型请求 401') === null,
  'real errors are not benign');
assert(benignCompactionNotice('') === null, 'empty message is not benign');

console.log('\ncompaction settings tests done');
