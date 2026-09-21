import { tokenize } from './tokenizer';

export interface Bm25Hit {
  index: number;
  score: number;
}

const K1 = 1.5;
const B = 0.75;

/**
 * In-memory BM25 (Okapi) index. Rebuilt from scratch whenever the corpus
 * changes — memory stores are small enough that incremental updates are not
 * worth the complexity.
 */
export class Bm25Index {
  private docs: string[][] = [];
  private lengths: number[] = [];
  private termFreqs: Map<string, number>[] = [];
  private docFreq = new Map<string, number>();
  private avgLength = 0;

  get size(): number {
    return this.docs.length;
  }

  build(documents: string[]): void {
    this.docs = [];
    this.lengths = [];
    this.termFreqs = [];
    this.docFreq = new Map();
    this.avgLength = 0;

    for (const doc of documents) {
      const tokens = tokenize(doc);
      this.docs.push(tokens);
      this.lengths.push(tokens.length);

      const tf = new Map<string, number>();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }
      this.termFreqs.push(tf);

      for (const term of tf.keys()) {
        this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
      }
    }

    const total = this.lengths.reduce((a, b) => a + b, 0);
    this.avgLength = this.docs.length > 0 ? total / this.docs.length : 0;
  }

  search(query: string, limit = 10): Bm25Hit[] {
    if (this.docs.length === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const unique = Array.from(new Set(queryTokens));
    const n = this.docs.length;
    const scores = new Array<number>(n).fill(0);

    for (const term of unique) {
      const df = this.docFreq.get(term);
      if (!df) continue;

      // BM25 IDF with the +1 form, which stays non-negative for common terms.
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));

      for (let i = 0; i < n; i++) {
        const tf = this.termFreqs[i].get(term);
        if (!tf) continue;

        const docLen = this.lengths[i] || 1;
        const norm = 1 - B + B * (this.avgLength > 0 ? docLen / this.avgLength : 1);
        scores[i] += idf * ((tf * (K1 + 1)) / (tf + K1 * norm));
      }
    }

    const hits: Bm25Hit[] = [];
    for (let i = 0; i < n; i++) {
      if (scores[i] > 0) {
        hits.push({ index: i, score: scores[i] });
      }
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }
}
