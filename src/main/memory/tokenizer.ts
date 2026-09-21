/**
 * Tokenizer tuned for mixed CJK / Latin text.
 *
 * Latin words are lowercased and split on non-alphanumerics. CJK runs are
 * emitted as overlapping bigrams, which gives usable recall without shipping
 * a dictionary-based segmenter.
 *
 *   "修复登录 bug" -> ["修复", "复登", "登录", "bug"]
 *   "fix the login bug" -> ["fix", "the", "login", "bug"]
 */
const CJK_RANGES: [number, number][] = [
  [0x3400, 0x4dbf], // CJK Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0x3040, 0x30ff], // Hiragana + Katakana
  [0xac00, 0xd7af] // Hangul Syllables
];

const LATIN_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'has', 'have', 'if', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or',
  'that', 'the', 'their', 'then', 'there', 'these', 'they', 'this', 'to',
  'was', 'were', 'will', 'with'
]);

function isCjk(code: number): boolean {
  for (const [lo, hi] of CJK_RANGES) {
    if (code >= lo && code <= hi) return true;
  }
  return false;
}

function isLatinWordChar(code: number): boolean {
  return (
    (code >= 0x30 && code <= 0x39) || // 0-9
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) || // a-z
    code === 0x5f // underscore
  );
}

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let latin = '';
  let cjkRun: number[] = [];

  const flushLatin = () => {
    if (!latin) return;
    const word = latin.toLowerCase();
    if (word.length > 1 && !LATIN_STOPWORDS.has(word)) {
      tokens.push(word);
    }
    latin = '';
  };

  const flushCjk = () => {
    if (cjkRun.length === 0) return;
    if (cjkRun.length === 1) {
      tokens.push(String.fromCodePoint(cjkRun[0]));
    } else {
      for (let i = 0; i < cjkRun.length - 1; i++) {
        tokens.push(
          String.fromCodePoint(cjkRun[i]) + String.fromCodePoint(cjkRun[i + 1])
        );
      }
    }
    cjkRun = [];
  };

  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (isCjk(code)) {
      flushLatin();
      cjkRun.push(code);
    } else if (isLatinWordChar(code)) {
      flushCjk();
      latin += ch;
    } else {
      flushLatin();
      flushCjk();
    }
  }
  flushLatin();
  flushCjk();

  return tokens;
}
