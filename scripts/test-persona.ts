// Unit tests for the persona frontmatter splitter.
// Run via jiti so the TypeScript source is imported directly (no build step).
import { splitFrontmatter } from '../src/main/agents/frontmatter';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

// --- frontmatter present ---
const withFm = `---
name: Researcher
description: Meticulous and concise
---

You are a meticulous research assistant.
Always cite sources.`;

const a = splitFrontmatter(withFm);
assert(a.fields.name === 'Researcher', 'parses name field');
assert(a.fields.description === 'Meticulous and concise', 'parses description field');
assert(a.body.startsWith('You are a meticulous research assistant.'), 'body excludes frontmatter');
assert(!a.body.includes('---'), 'body has no leftover delimiters');

// --- no frontmatter ---
const plain = splitFrontmatter('Just a plain persona body.');
assert(Object.keys(plain.fields).length === 0, 'no fields when frontmatter absent');
assert(plain.body === 'Just a plain persona body.', 'body is whole content when no frontmatter');

// --- quoted values ---
const quoted = splitFrontmatter(`---
name: "Quoted Name"
description: 'Single Quoted'
---
Body`);
assert(quoted.fields.name === 'Quoted Name', 'strips double quotes');
assert(quoted.fields.description === 'Single Quoted', 'strips single quotes');

// --- CRLF line endings ---
const crlf = splitFrontmatter('---\r\nname: Win\r\n---\r\n\r\nBody text');
assert(crlf.fields.name === 'Win', 'handles CRLF frontmatter');
assert(crlf.body === 'Body text', 'CRLF body parsed');

// --- edge cases ---
assert(splitFrontmatter('').body === '', 'empty input yields empty body');
assert(splitFrontmatter('---\n---\n').body === '', 'empty frontmatter yields empty body');
assert(
  Object.keys(splitFrontmatter('---\nbadline\n---\nB').fields).length === 0,
  'ignores lines without colon'
);

const colonValue = splitFrontmatter('---\ndescription: speaks: with colons\n---\nB');
assert(
  colonValue.fields.description === 'speaks: with colons',
  'splits on the first colon only'
);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
if (failures > 0) process.exit(1);
