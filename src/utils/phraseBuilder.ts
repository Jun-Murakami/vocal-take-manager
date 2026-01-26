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

  // Rule 7: 副詞 + 助詞(格助詞/係助詞/副助詞/連体化)
  // Example: ひんやり + と → ひんやりと / これから + も → これからも / 少し + の → 少しの
  if (
    current.pos === '副詞' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '格助詞' ||
      next.posDetail1 === '係助詞' ||
      next.posDetail1 === '副助詞' ||
      next.posDetail1 === '連体化')
  ) {
    return true;
  }

  // Rule 7 continued: 副詞 + 助詞(副詞化)
  // Example: いっぱい + に → いっぱいに
  if (
    current.pos === '副詞' &&
    next.pos === '助詞' &&
    next.posDetail1 === '副詞化'
  ) {
    return true;
  }

  // Rule 8: 動詞 + 接続助詞/連体化助詞/並立助詞
  // Example: 動い + て → 動いて / まどろみ + の → まどろみの / 行っ + たり → 行ったり
  if (
    current.pos === '動詞' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '接続助詞' ||
      next.posDetail1 === '連体化' ||
      next.posDetail1 === '並立助詞')
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

  // Rule 13 continued: 動詞 + 名詞(非自立,助動詞語幹)
  // Example: 弾む + よう → 弾むよう
  if (
    current.pos === '動詞' &&
    next.pos === '名詞' &&
    next.posDetail1 === '非自立' &&
    next.posDetail2 === '助動詞語幹'
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

  // Rule 15: 名詞(非自立) + 助詞(格助詞/係助詞/終助詞/副詞化)
  // Example: 日 + も → 日も / の + を → のを / の + さ → のさ / よう + に → ように
  if (
    current.pos === '名詞' &&
    current.posDetail1 === '非自立' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '格助詞' ||
      next.posDetail1 === '係助詞' ||
      next.posDetail1 === '終助詞' ||
      next.posDetail1 === '副詞化')
  ) {
    return true;
  }

  // Rule 15 continued: 名詞(非自立,助動詞語幹) + 助動詞
  // Example: よう + な → ような
  if (
    current.pos === '名詞' &&
    current.posDetail1 === '非自立' &&
    current.posDetail2 === '助動詞語幹' &&
    next.pos === '助動詞'
  ) {
    return true;
  }

  // Rule 21: 助詞 + 助詞（格助詞列や係助詞の連結）
  // Example: どこ + へ + で + も → どこへでも
  // NOTE: 連続する助詞がフレーズ分割を作らないようにする
  if (
    current.pos === '助詞' &&
    next.pos === '助詞' &&
    (next.posDetail1 === '格助詞' ||
      next.posDetail1 === '係助詞' ||
      next.posDetail1 === '副助詞' ||
      next.posDetail1 === '終助詞' ||
      next.posDetail1 === '連体化' ||
      next.posDetail1 === '副詞化')
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
 * 記号トークンを「直前/直後のトークン」に吸着させる前処理
 * - 目的: 単独/連続した記号がフレーズ境界を作らないようにする
 * - 仕様:
 *   - 「記号(空白以外)」は基本的に直前トークンの末尾へ連結する
 *   - 行頭など直前が存在しない場合は、直後の最初のトークンへ連結する
 * - 例:
 *   - 良い + " + 夢 + " + を → 良い" + 夢" + を
 *   - " + 夢 + " + を → "夢" + を
 * - NOTE: 空白(記号/空白)は分割境界として扱いたいので吸着しない
 */
function attachSymbolsToPrevious(tokens: Token[]): Token[] {
  const normalized: Token[] = [];
  let pendingPrefixSymbols = '';

  for (const token of tokens) {
    // kuromoji の品詞に依存せず「記号っぽいトークン」を検出する
    // NOTE: “ ” などの引用符が記号として判定されないケースを吸収するため
    const isSymbolByPos = token.pos === '記号';
    const isWhitespaceSymbolByPos = token.posDetail1 === '空白';
    const isSymbolBySurface = /^[\p{P}\p{S}]+$/u.test(token.surfaceForm);
    const isWhitespaceOnly = token.surfaceForm.trim().length === 0;

    // 空白は分割境界として扱いたいので、記号吸着の対象から除外する
    const isSymbol = (isSymbolByPos || isSymbolBySurface) && !isWhitespaceOnly;
    const isWhitespaceSymbol = isWhitespaceSymbolByPos || isWhitespaceOnly;

    // 空白以外の記号は、直前トークンに吸着させる
    if (isSymbol && !isWhitespaceSymbol) {
      if (normalized.length === 0) {
        // 先頭記号は直前が無いため、後続トークンに合体させるため保持する
        pendingPrefixSymbols += token.surfaceForm;
      } else {
        const last = normalized[normalized.length - 1];
        // 直前トークンの末尾へ記号を連結して、記号自体は独立トークンにしない
        normalized[normalized.length - 1] = {
          ...last,
          surfaceForm: `${last.surfaceForm}${token.surfaceForm}`,
        };
      }
      continue;
    }

    // 記号以外、または空白記号はそのまま保持する
    if (pendingPrefixSymbols) {
      // 先頭記号を次のトークンの先頭へ吸着させる
      normalized.push({
        ...token,
        surfaceForm: `${pendingPrefixSymbols}${token.surfaceForm}`,
      });
      pendingPrefixSymbols = '';
    } else {
      normalized.push({ ...token });
    }
  }

  // 末尾に記号だけが残った場合は、独立トークンとして扱う
  // NOTE: 直後が無いので付け先がなく、情報欠落を避けるため保持する
  if (pendingPrefixSymbols) {
    normalized.push({
      surfaceForm: pendingPrefixSymbols,
      pos: '記号',
      posDetail1: '一般',
      posDetail2: '',
      posDetail3: '',
      baseForm: pendingPrefixSymbols,
      reading: '',
      pronunciation: '',
    });
  }

  return normalized;
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

  // 記号は前の語に吸着させた上でフレーズ判定を行う
  // NOTE: これにより、記号が独立フレーズになるのを防ぐ
  const normalizedTokens = attachSymbolsToPrevious(tokens);

  for (let i = 0; i < normalizedTokens.length; i++) {
    const token = normalizedTokens[i];
    const nextToken = normalizedTokens[i + 1];

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

  // Limit phrases per line to maximum of 10
  // If more than 10, merge 11th and beyond into the 10th phrase
  if (phrases.length > 10) {
    const firstTen = phrases.slice(0, 9);
    const remaining = phrases.slice(9);

    // Merge all remaining phrases into one
    const mergedText = remaining.map((p) => p.text).join('');
    const mergedTokens = remaining.flatMap((p) => p.tokens);

    const mergedPhrase: Phrase = {
      id: generateId(),
      lineIndex,
      order: baseOrder + 9,
      text: mergedText,
      tokens: mergedTokens,
    };

    return [...firstTen, mergedPhrase];
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
