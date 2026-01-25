/**
 * Phrase Builder
 * Build phrases from morphological tokens based on CLAUDE.md rules
 */

import { generateId } from './songHelpers';

import type { Phrase, Token } from '@/types/models';

/**
 * Check if two tokens should be combined based on rules
 */
function shouldCombine(current: Token, next: Token | undefined): boolean {
  if (!next) return false;

  // Rule 1: 連体詞 + 名詞
  // Example: おおきな + のっぽ
  if (current.pos === '連体詞' && next.pos === '名詞') {
    return true;
  }

  // Rule 2: 名詞 + 助詞(連体化)
  // Example: のっぽ + の → のっぽの
  if (
    current.pos === '名詞' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '連体化' || next.surfaceForm === 'の')
  ) {
    return true;
  }

  // Rule 3: 接頭詞(名詞接続) + 名詞
  // Example: 古 + 時計 → 古時計
  if (
    current.pos === '接頭詞' &&
    current.posDetail1 === '名詞接続' &&
    next.pos === '名詞'
  ) {
    return true;
  }

  // Rule 4: 名詞(数) + 名詞(接尾,助数詞)
  // Example: 百 + 年 → 百年
  if (
    current.pos === '名詞' &&
    current.posDetail1 === '数' &&
    next.pos === '名詞' &&
    (next.posDetail1 === '接尾' || next.posDetail1 === '助数詞')
  ) {
    return true;
  }

  // Rule 5: 動詞 + 接続助詞
  // Example: 動い + て
  if (
    current.pos === '動詞' &&
    next.pos === '助詞' &&
    next.posDetail1 === '接続助詞'
  ) {
    return true;
  }

  // Rule 5 continued: 接続助詞 + 動詞(非自立)
  // Example: て + い
  if (
    current.pos === '助詞' &&
    current.posDetail1 === '接続助詞' &&
    next.pos === '動詞' &&
    next.posDetail1 === '非自立'
  ) {
    return true;
  }

  // Rule 5 continued: 動詞(非自立) + 助動詞
  // Example: い + た
  if (
    current.pos === '動詞' &&
    current.posDetail1 === '非自立' &&
    next.pos === '助動詞'
  ) {
    return true;
  }

  // Rule 6: 接頭詞 + サ変接続名詞
  // Example: ご + 自慢
  if (
    current.pos === '接頭詞' &&
    next.pos === '名詞' &&
    next.posDetail1 === 'サ変接続'
  ) {
    return true;
  }

  // Rule 6 continued: サ変接続名詞 + 助詞(連体化)
  // Already covered by Rule 2

  // Rule 7: 名詞 + 終助詞
  // Example: 時計 + さ → 時計さ
  if (
    current.pos === '名詞' &&
    next.pos === '助詞' &&
    next.posDetail1 === '終助詞'
  ) {
    return true;
  }

  // Additional: 助動詞 + 助動詞 (for completeness)
  // Example: た + です
  if (current.pos === '助動詞' && next.pos === '助動詞') {
    return true;
  }

  return false;
}

/**
 * Build phrases from tokens
 */
export function buildPhrases(
  tokens: Token[],
  lineIndex: number,
  baseOrder: number,
): Phrase[] {
  const phrases: Phrase[] = [];
  let currentPhrase: Token[] = [];
  let order = baseOrder;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];

    currentPhrase.push(token);

    // Check if we should combine with next token
    if (!shouldCombine(token, nextToken)) {
      // End current phrase and create a new phrase object
      if (currentPhrase.length > 0) {
        const phraseText = currentPhrase.map((t) => t.surfaceForm).join('');
        phrases.push({
          id: generateId(),
          lineIndex,
          order,
          text: phraseText,
          tokens: [...currentPhrase],
        });
        order++;
        currentPhrase = [];
      }
    }
  }

  // Add remaining phrase if any
  if (currentPhrase.length > 0) {
    const phraseText = currentPhrase.map((t) => t.surfaceForm).join('');
    phrases.push({
      id: generateId(),
      lineIndex,
      order,
      text: phraseText,
      tokens: [...currentPhrase],
    });
  }

  // Limit phrases per line to maximum of 6
  // If more than 6, merge 7th and beyond into the 6th phrase
  if (phrases.length > 6) {
    const firstSix = phrases.slice(0, 5);
    const remaining = phrases.slice(5);

    // Merge all remaining phrases into one
    const mergedText = remaining.map((p) => p.text).join('');
    const mergedTokens = remaining.flatMap((p) => p.tokens);

    const mergedPhrase: Phrase = {
      id: generateId(),
      lineIndex,
      order: baseOrder + 5,
      text: mergedText,
      tokens: mergedTokens,
    };

    return [...firstSix, mergedPhrase];
  }

  return phrases;
}

/**
 * Parse lyrics into phrases using kuromoji tokenization
 */
export async function parseLyricsWithKuromoji(
  rawLyrics: string,
  tokenizeFn: (text: string) => Promise<Token[]>,
): Promise<Phrase[]> {
  const lines = rawLyrics.split('\n');
  const allPhrases: Phrase[] = [];
  let globalOrder = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();

    if (!line) {
      // Empty line - create an empty placeholder phrase
      allPhrases.push({
        id: generateId(),
        lineIndex,
        order: globalOrder,
        text: '',
        tokens: [],
      });
      globalOrder++;
      continue;
    }

    // Tokenize the line
    const tokens = await tokenizeFn(line);

    // Build phrases from tokens
    const linePhrases = buildPhrases(tokens, lineIndex, globalOrder);
    allPhrases.push(...linePhrases);
    globalOrder += linePhrases.length;
  }

  return allPhrases;
}
