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

  // Rule 1: 名詞 + 助詞(連体化)
  // Example: のっぽ + の → のっぽの / おじいさん + の → おじいさんの
  if (
    current.pos === '名詞' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '連体化' || next.surfaceForm === 'の')
  ) {
    return true;
  }

  // Rule 2: 接頭詞(名詞接続) + 名詞
  // Example: 古 + 時計 → 古時計 / お + 別れ → お別れ
  if (
    current.pos === '接頭詞' &&
    current.posDetail1 === '名詞接続' &&
    next.pos === '名詞'
  ) {
    return true;
  }

  // Rule 3: 名詞(数) + 名詞(接尾,助数詞)
  // Example: 百 + 年 → 百年
  if (
    current.pos === '名詞' &&
    current.posDetail1 === '数' &&
    next.pos === '名詞' &&
    (next.posDetail1 === '接尾' || next.posDetail1 === '助数詞')
  ) {
    return true;
  }

  // Rule 4: 名詞(形容動詞語幹) + 助動詞
  // Example: きれい + な → きれいな
  if (
    current.pos === '名詞' &&
    current.posDetail1 === '形容動詞語幹' &&
    next.pos === '助動詞'
  ) {
    return true;
  }

  // Rule 5: 名詞(接尾) + 助動詞
  // Example: おぼろげ + な → おぼろげな（接尾が語幹として使われる場合）
  if (
    current.pos === '名詞' &&
    current.posDetail1 === '接尾' &&
    next.pos === '助動詞'
  ) {
    return true;
  }

  // Rule 6: 形容詞 + 助詞(終助詞)
  // Example: いい + な → いいな / いい + よ → いいよ
  if (
    current.pos === '形容詞' &&
    next.pos === '助詞' &&
    next.posDetail1 === '終助詞'
  ) {
    return true;
  }

  // Rule 7: 副詞 + 助詞(格助詞/係助詞/副助詞)
  // Example: ひんやり + と → ひんやりと / これから + も → これからも
  if (
    current.pos === '副詞' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '格助詞' ||
      next.posDetail1 === '係助詞' ||
      next.posDetail1 === '副助詞')
  ) {
    return true;
  }

  // Rule 8: 動詞 + 接続助詞/連体化助詞
  // Example: 動い + て → 動いて / まどろみ + の → まどろみの
  if (
    current.pos === '動詞' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '接続助詞' || next.posDetail1 === '連体化')
  ) {
    return true;
  }

  // Rule 8 continued: 接続助詞 + 動詞(非自立)
  // Example: て + い → てい
  if (
    current.pos === '助詞' &&
    current.posDetail1 === '接続助詞' &&
    next.pos === '動詞' &&
    next.posDetail1 === '非自立'
  ) {
    return true;
  }

  // Rule 8 continued: 動詞(非自立) + 助動詞
  // Example: い + た → いた
  if (
    current.pos === '動詞' &&
    current.posDetail1 === '非自立' &&
    next.pos === '助動詞'
  ) {
    return true;
  }

  // Rule 9: 動詞(自立) + 助動詞
  // Example: 生まれ + た → 生まれた / 動か + ない → 動かない
  if (current.pos === '動詞' && next.pos === '助動詞') {
    return true;
  }

  // Rule 10: 動詞(自立) + 動詞(接尾)
  // Example: 許さ + れ → 許され（受身/可能の接尾）
  if (
    current.pos === '動詞' &&
    next.pos === '動詞' &&
    next.posDetail1 === '接尾'
  ) {
    return true;
  }

  // Rule 11: 動詞(接尾) + 助動詞
  // Example: 許され + た → 許された
  if (
    current.pos === '動詞' &&
    current.posDetail1 === '接尾' &&
    next.pos === '助動詞'
  ) {
    return true;
  }

  // Rule 12: 助動詞 + 助詞(格助詞/接続助詞/終助詞)
  // Example: ず + に → ずに（休まずに） / なく + て → なくて / た + よ → たよ
  if (
    current.pos === '助動詞' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '格助詞' ||
      next.posDetail1 === '接続助詞' ||
      next.posDetail1 === '終助詞')
  ) {
    return true;
  }

  // Rule 13: 動詞(自立) + 動詞(非自立)
  // Example: 知っ + てる → 知ってる / 動い + て(非自立) → 動いて
  if (
    current.pos === '動詞' &&
    next.pos === '動詞' &&
    next.posDetail1 === '非自立'
  ) {
    return true;
  }

  // Rule 14: 助動詞 + 名詞(非自立)
  // Example: きた + の → きたの
  if (
    current.pos === '助動詞' &&
    next.pos === '名詞' &&
    next.posDetail1 === '非自立'
  ) {
    return true;
  }

  // Rule 15: 名詞(非自立) + 助詞(格助詞/係助詞/終助詞)
  // Example: 日 + も → 日も / の + を → のを / の + さ → のさ
  if (
    current.pos === '名詞' &&
    current.posDetail1 === '非自立' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '格助詞' ||
      next.posDetail1 === '係助詞' ||
      next.posDetail1 === '終助詞')
  ) {
    return true;
  }

  // Rule 16: 名詞 + 助詞(格助詞/係助詞/並立助詞/副助詞/終助詞)
  // Example: いま + は → いまは / ベル + が → ベルが / 何 + でも → 何でも / 時計 + さ → 時計さ
  if (
    current.pos === '名詞' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '格助詞' ||
      next.posDetail1 === '係助詞' ||
      next.posDetail1 === '並立助詞' ||
      next.posDetail1 === '副助詞' ||
      next.posDetail1 === '終助詞')
  ) {
    return true;
  }

  // Rule 17: 名詞 + 名詞(接尾/特殊)
  // Example: 時計 + さ → 時計さ
  if (
    current.pos === '名詞' &&
    next.pos === '名詞' &&
    (next.posDetail1 === '接尾' || next.posDetail1 === '特殊')
  ) {
    return true;
  }

  // Rule 18: 接頭詞 + サ変接続名詞
  // Example: ご + 自慢 → ご自慢
  if (
    current.pos === '接頭詞' &&
    next.pos === '名詞' &&
    next.posDetail1 === 'サ変接続'
  ) {
    return true;
  }

  // Rule 18 continued: サ変接続名詞 + 助詞(連体化) は Rule 1 で対応

  // Rule 19: 助動詞 + 助動詞（補助的な連結）
  // Example: た + です → たです
  if (current.pos === '助動詞' && next.pos === '助動詞') {
    return true;
  }

  // Rule 20: 空白（全角/半角/連続）を前の語に吸着させる
  // Example: チク + "　" → チク　 / タク + "  " → タク  （拍の区切りを保持）
  if (
    next.pos === '記号' &&
    next.posDetail1 === '空白' &&
    /^\s+$/.test(next.surfaceForm)
  ) {
    return true;
  }

  // Rule 21: 空白以外の記号は前の語に吸着させる
  // Example: 夢 + "」" → 夢」 / 夢 + "」" → 夢」
  if (
    next.pos === '記号' &&
    next.posDetail1 !== '空白'
  ) {
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
