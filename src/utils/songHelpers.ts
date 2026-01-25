/**
 * Song Helper Functions
 * Utilities for creating and manipulating Song objects
 */

import { tokenize } from './kuromojiAnalyzer';
import { parseLyricsWithKuromoji } from './phraseBuilder';

import type { MarkSetting, NewSongInput, Phrase, Song } from '@/types/models';

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 手動分割: 文字位置でフレーズを2つに分割する
 * - 既存フレーズのIDは左側に保持して、マーク/採用情報を温存する
 * - 右側は新しいIDで追加し、tokensは再解析しないため空配列にする
 * - order は配列順に再採番して整合性を保つ
 */
export function splitPhraseByChar(
  song: Song,
  phraseId: string,
  splitIndex: number,
): Song {
  const phraseIndex = song.phrases.findIndex((phrase) => phrase.id === phraseId);
  if (phraseIndex < 0) {
    return song;
  }

  const phrase = song.phrases[phraseIndex];
  const phraseText = phrase.text;

  // 同一行の分割数が12以上の場合は、これ以上分割しない
  const linePhraseCount = song.phrases.filter(
    (item) => item.lineIndex === phrase.lineIndex && item.text.length > 0,
  ).length;
  if (linePhraseCount >= 12) {
    return song;
  }

  // 無効な分割（空や末尾）は何もしない
  if (splitIndex <= 0 || splitIndex >= phraseText.length) {
    return song;
  }

  const leftText = phraseText.slice(0, splitIndex);
  const rightText = phraseText.slice(splitIndex);

  // 左側は既存IDを維持して内容のみ更新する
  const leftPhrase: Phrase = {
    ...phrase,
    text: leftText,
  };

  // 右側は新規IDで追加する（tokens は再解析しないため空）
  const rightPhrase: Phrase = {
    ...phrase,
    id: generateId(),
    text: rightText,
    tokens: [],
  };

  const updatedPhrases = [...song.phrases];
  updatedPhrases[phraseIndex] = leftPhrase;
  updatedPhrases.splice(phraseIndex + 1, 0, rightPhrase);

  // order は配列順で再採番して整合性を維持する
  const reorderedPhrases = updatedPhrases.map((phraseItem, index) => ({
    ...phraseItem,
    order: index,
  }));

  return {
    ...song,
    phrases: reorderedPhrases,
    updatedAt: Date.now(),
  };
}

/**
 * 手動分割: 隣接フレーズと結合して分割線を削除する
 * - 同一行の「次のフレーズ」があれば、現在フレーズと結合する
 * - 次が無い場合は、同一行の「前のフレーズ」と結合する
 * - 結合後は右側フレーズを削除し、order を再採番する
 * - 削除したフレーズのマーク/採用設定は破棄する
 */
export function mergePhraseWithNeighbor(
  song: Song,
  phraseId: string,
): { song: Song; mergedPhraseId: string } | null {
  const phraseIndex = song.phrases.findIndex((phrase) => phrase.id === phraseId);
  if (phraseIndex < 0) {
    return null;
  }

  const currentPhrase = song.phrases[phraseIndex];
  const nextPhrase = song.phrases[phraseIndex + 1];
  const prevPhrase = song.phrases[phraseIndex - 1];

  // 同一行の次があれば優先して結合する
  if (
    nextPhrase &&
    nextPhrase.lineIndex === currentPhrase.lineIndex &&
    nextPhrase.text.trim().length > 0
  ) {
    const mergedPhrase: Phrase = {
      ...currentPhrase,
      text: `${currentPhrase.text}${nextPhrase.text}`,
      // tokens は可能な限り保持して結合する
      tokens: [...currentPhrase.tokens, ...nextPhrase.tokens],
    };

    const updatedPhrases = [...song.phrases];
    updatedPhrases[phraseIndex] = mergedPhrase;
    updatedPhrases.splice(phraseIndex + 1, 1);

    const reorderedPhrases = updatedPhrases.map((phraseItem, index) => ({
      ...phraseItem,
      order: index,
    }));

    const filteredMarks = song.marks.filter(
      (mark) => mark.phraseId !== nextPhrase.id,
    );
    const updatedSelectedTakeByPhraseId = {
      ...song.comping.selectedTakeByPhraseId,
    };
    delete updatedSelectedTakeByPhraseId[nextPhrase.id];

    return {
      song: {
        ...song,
        phrases: reorderedPhrases,
        marks: filteredMarks,
        comping: {
          ...song.comping,
          selectedTakeByPhraseId: updatedSelectedTakeByPhraseId,
        },
        updatedAt: Date.now(),
      },
      mergedPhraseId: currentPhrase.id,
    };
  }

  // 次が無い場合は前のフレーズと結合する
  if (
    prevPhrase &&
    prevPhrase.lineIndex === currentPhrase.lineIndex &&
    prevPhrase.text.trim().length > 0
  ) {
    const mergedPhrase: Phrase = {
      ...prevPhrase,
      text: `${prevPhrase.text}${currentPhrase.text}`,
      tokens: [...prevPhrase.tokens, ...currentPhrase.tokens],
    };

    const updatedPhrases = [...song.phrases];
    updatedPhrases[phraseIndex - 1] = mergedPhrase;
    updatedPhrases.splice(phraseIndex, 1);

    const reorderedPhrases = updatedPhrases.map((phraseItem, index) => ({
      ...phraseItem,
      order: index,
    }));

    const filteredMarks = song.marks.filter(
      (mark) => mark.phraseId !== currentPhrase.id,
    );
    const updatedSelectedTakeByPhraseId = {
      ...song.comping.selectedTakeByPhraseId,
    };
    delete updatedSelectedTakeByPhraseId[currentPhrase.id];

    return {
      song: {
        ...song,
        phrases: reorderedPhrases,
        marks: filteredMarks,
        comping: {
          ...song.comping,
          selectedTakeByPhraseId: updatedSelectedTakeByPhraseId,
        },
        updatedAt: Date.now(),
      },
      mergedPhraseId: prevPhrase.id,
    };
  }

  return null;
}

/**
 * 手動分割: 指定した境界（左/右フレーズ）を結合して分割線を削除する
 * - 左/右が同一行かつ隣接している場合のみ結合
 * - 右側フレーズのマーク/採用設定は破棄する
 */
export function mergePhraseAtDivider(
  song: Song,
  leftPhraseId: string,
  rightPhraseId: string,
): { song: Song; mergedPhraseId: string } | null {
  const leftIndex = song.phrases.findIndex(
    (phrase) => phrase.id === leftPhraseId,
  );
  if (leftIndex < 0) {
    return null;
  }

  const leftPhrase = song.phrases[leftIndex];
  const rightPhrase = song.phrases[leftIndex + 1];
  if (!rightPhrase || rightPhrase.id !== rightPhraseId) {
    return null;
  }

  if (leftPhrase.lineIndex !== rightPhrase.lineIndex) {
    return null;
  }

  const mergedPhrase: Phrase = {
    ...leftPhrase,
    text: `${leftPhrase.text}${rightPhrase.text}`,
    tokens: [...leftPhrase.tokens, ...rightPhrase.tokens],
  };

  const updatedPhrases = [...song.phrases];
  updatedPhrases[leftIndex] = mergedPhrase;
  updatedPhrases.splice(leftIndex + 1, 1);

  const reorderedPhrases = updatedPhrases.map((phraseItem, index) => ({
    ...phraseItem,
    order: index,
  }));

  const filteredMarks = song.marks.filter(
    (mark) => mark.phraseId !== rightPhrase.id,
  );
  const updatedSelectedTakeByPhraseId = {
    ...song.comping.selectedTakeByPhraseId,
  };
  delete updatedSelectedTakeByPhraseId[rightPhrase.id];

  return {
    song: {
      ...song,
      phrases: reorderedPhrases,
      marks: filteredMarks,
      comping: {
        ...song.comping,
        selectedTakeByPhraseId: updatedSelectedTakeByPhraseId,
      },
      updatedAt: Date.now(),
    },
    mergedPhraseId: leftPhrase.id,
  };
}

/**
 * Get default mark settings (keys 1-5)
 */
export function getDefaultMarkSettings(): MarkSetting[] {
  return [
    { key: 1, symbol: '◎', color: '#FF0000' }, // 赤
    { key: 2, symbol: '〇', color: '#0000FF' }, // 青
    { key: 3, symbol: '△', color: '#FFA500' }, // オレンジ
    { key: 4, symbol: null, color: null },
    { key: 5, symbol: null, color: null },
  ];
}

/**
 * HSL色空間からRGBに変換するヘルパー関数
 * @param h 色相（0-360）
 * @param s 彩度（0-100）
 * @param l 明度（0-100）
 * @returns RGBカラーコード（例: #FF0000）
 */
function hslToRgb(h: number, s: number, l: number): string {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;

  let r: number;
  let g: number;
  let b: number;

  if (sNorm === 0) {
    r = g = b = lNorm; // 無彩色
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;
    r = hue2rgb(p, q, hNorm + 1 / 3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1 / 3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Get default take colors (for visual distinction)
 * 16色のパレットをHSL色空間で均等に分散させ、視覚的な区別を向上
 * 色相（Hue）を360度を16等分（22.5度ずつ）して、彩度と明度を適切に設定
 * 使用頻度の高い順に色を並べ替え：1,9,2,10,3,11,4,12,5,13,6,14,7,15,8,16
 * 1と16が近すぎないように、色相の開始位置を調整
 */
const TAKE_COLORS = (() => {
  const colors: string[] = [];
  const saturation = 65; // 彩度（鮮やかさ）：60-70%で視認性と落ち着きのバランス
  const lightness = 80; // 明度：80%で背景として見やすい

  // まず、16色を均等に生成（色相を360度を16等分、22.5度ずつ）
  // 1と16が近すぎないように、開始位置を11.25度ずらす（22.5度の半分）
  const baseColors: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    const hue = (i * 22.5 + 11.25) % 360; // 11.25度から開始（赤とピンクの間を避ける）
    baseColors.push(hslToRgb(hue, saturation, lightness));
  }

  // 使用頻度の高い順に並べ替え：1,9,2,10,3,11,4,12,5,13,6,14,7,15,8,16
  // インデックス: 0,8,1,9,2,10,3,11,4,12,5,13,6,14,7,15
  const reorderMap = [0, 8, 2, 10, 4, 12, 6, 14, 8, 15, 1, 9, 3, 11, 5, 13];
  for (let i = 0; i < 16; i += 1) {
    colors.push(baseColors[reorderMap[i]]);
  }

  return colors;
})();

/**
 * Get color for a take by order
 */
export function getTakeColor(order: number): string {
  const index = (order - 1) % TAKE_COLORS.length;
  return TAKE_COLORS[index];
}

/**
 * Create a new Song with default values
 */
export function createNewSong(input: NewSongInput): Song {
  const now = Date.now();
  const id = generateId();

  // 初期状態では1テイクを作成
  const takes = Array.from({ length: 1 }, (_, i) => ({
    id: generateId(),
    order: i + 1,
    label: `${i + 1}`,
    color: getTakeColor(i + 1),
  }));

  return {
    id,
    title: input.title,
    credits: input.credits,
    rawLyrics: input.rawLyrics,
    createdAt: now,
    updatedAt: now,
    phrases: [], // 歌詞解析後に設定
    takes,
    marks: [],
    comping: {
      currentPhraseIndex: 0,
      selectedTakeByPhraseId: {},
    },
    // markSettings は削除（アプリ全体の設定として管理）
    freeMemo: '',
  };
}

/**
 * Parse lyrics into phrases (simple fallback without kuromoji)
 * This is used as a fallback when kuromoji fails to load
 */
export function parseLyricsIntoPhrasesSimple(rawLyrics: string): Phrase[] {
  const lines = rawLyrics.split('\n');
  const phrases: Phrase[] = [];
  let order = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();

    if (!line) {
      // 空行の場合は空のプレースホルダーフレーズを作成
      phrases.push({
        id: generateId(),
        lineIndex,
        order,
        text: '',
        tokens: [],
      });
      order++;
      continue;
    }

    // 簡易実装: 空白で分割してフレーズとする
    const words = line.split(/\s+/);
    for (const word of words) {
      if (!word) continue;
      phrases.push({
        id: generateId(),
        lineIndex,
        order,
        text: word,
        tokens: [],
      });
      order++;
    }
  }

  return phrases;
}

/**
 * Parse lyrics into phrases using kuromoji.js morphological analysis
 */
export async function parseLyricsIntoPhrases(
  rawLyrics: string,
): Promise<Phrase[]> {
  try {
    return await parseLyricsWithKuromoji(rawLyrics, tokenize);
  } catch (error) {
    console.error(
      'Kuromoji analysis failed, falling back to simple split:',
      error,
    );
    return parseLyricsIntoPhrasesSimple(rawLyrics);
  }
}

/**
 * Update song's updatedAt timestamp
 */
export function touchSong(song: Song): Song {
  return {
    ...song,
    updatedAt: Date.now(),
  };
}

/**
 * Add a new take to song
 */
export function addTake(song: Song): Song {
  const maxOrder = Math.max(0, ...song.takes.map((t) => t.order));
  const newTake = {
    id: generateId(),
    order: maxOrder + 1,
    label: `${maxOrder + 1}`,
    color: getTakeColor(maxOrder + 1),
  };

  return touchSong({
    ...song,
    takes: [...song.takes, newTake],
  });
}

/**
 * Remove a take from song (and associated marks)
 */
export function removeTake(song: Song, takeId: string): Song {
  const takes = song.takes.filter((t) => t.id !== takeId);
  const marks = song.marks.filter((m) => m.takeId !== takeId);

  // Reorder remaining takes
  const reorderedTakes = takes.map((take, index) => ({
    ...take,
    order: index + 1,
    label: `${index + 1}`,
  }));

  return touchSong({
    ...song,
    takes: reorderedTakes,
    marks,
  });
}
