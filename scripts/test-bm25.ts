import { tokenize } from '../src/main/memory/tokenizer';
import { Bm25Index } from '../src/main/memory/Bm25Index';

function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
  else console.log('ok  :', msg);
}

// --- tokenizer ---
assert(JSON.stringify(tokenize('修复登录 bug')) === JSON.stringify(['修复','复登','登录','bug']),
  'CJK bigrams + latin word');
assert(tokenize('the login bug').join(',') === 'login,bug', 'stopwords removed');
assert(tokenize('用户ID是123').includes('123'), 'digits kept');
assert(tokenize('').length === 0, 'empty input');

// --- BM25 ranking ---
const docs = [
  'The user prefers dark mode in all editors',
  '部署流程需要先跑测试再发布',
  'Deployment requires running tests before release',
  'The user is a data scientist working on pipelines'
];
const idx = new Bm25Index();
idx.build(docs);

const r1 = idx.search('dark mode');
assert(r1.length > 0 && r1[0].index === 0, 'latin query ranks correct doc first');

const r2 = idx.search('部署 测试');
assert(r2.length > 0 && r2[0].index === 1, 'CJK query ranks correct doc first');

const r3 = idx.search('deployment tests');
assert(r3.length > 0 && r3[0].index === 2, 'deployment query ranks correct doc first');

const r4 = idx.search('zzzzznotfound');
assert(r4.length === 0, 'no matches returns empty');

// multi-term: doc 2 matches both terms, should outrank docs matching one
const r5 = idx.search('user pipelines');
assert(r5[0].index === 3, 'multi-term overlap wins');

// empty index
const empty = new Bm25Index();
empty.build([]);
assert(empty.search('anything').length === 0, 'empty index safe');

console.log('\nBM25 score for "dark mode":', r1[0]?.score.toFixed(3));
