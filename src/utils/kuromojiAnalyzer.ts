/**
 * Kuromoji Morphological Analyzer
 * Japanese text tokenization using kuromoji.js
 */

import kuromoji from 'kuromoji';

import type { Token } from '@/types/models';

let tokenizerInstance: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null =
  null;
let tokenizerPromise: Promise<
  kuromoji.Tokenizer<kuromoji.IpadicFeatures>
> | null = null;

/**
 * Initialize kuromoji tokenizer (singleton)
 */
async function getTokenizer(): Promise<
  kuromoji.Tokenizer<kuromoji.IpadicFeatures>
> {
  if (tokenizerInstance) {
    return tokenizerInstance;
  }

  if (tokenizerPromise) {
    return tokenizerPromise;
  }

  tokenizerPromise = new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: '/dict/' }).build((err, tokenizer) => {
      if (err) {
        reject(err);
        return;
      }
      tokenizerInstance = tokenizer;
      resolve(tokenizer);
    });
  });

  return tokenizerPromise;
}

/**
 * Tokenize Japanese text using kuromoji
 */
export async function tokenize(text: string): Promise<Token[]> {
  const tokenizer = await getTokenizer();
  const kuromojiTokens = tokenizer.tokenize(text);

  return kuromojiTokens.map((token) => ({
    surfaceForm: token.surface_form,
    pos: token.pos,
    posDetail1: token.pos_detail_1,
    // 追加の詳細情報（助動詞語幹などの判定で使用）
    posDetail2: token.pos_detail_2 || '',
    posDetail3: token.pos_detail_3 || '',
    baseForm: token.basic_form,
    reading: token.reading || '',
    pronunciation: token.pronunciation || '',
  }));
}

/**
 * Check if tokenizer is ready
 */
export function isTokenizerReady(): boolean {
  return tokenizerInstance !== null;
}

/**
 * Preload tokenizer (call this on app startup for better UX)
 */
export async function preloadTokenizer(): Promise<void> {
  await getTokenizer();
}
