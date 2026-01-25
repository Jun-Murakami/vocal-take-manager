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
 * Get default take colors (for visual distinction)
 * 16-color palette with high visibility and clear separation
 */
const TAKE_COLORS = [
  '#FFB6B6', // 1: ライトレッド（薄い赤）
  '#FFE4B5', // 2: モカシン（薄いオレンジ）
  '#90EE90', // 3: ライトグリーン
  '#FFD700', // 4: ゴールド
  '#DDA0DD', // 5: プラム（薄い紫）
  '#87CEEB', // 6: スカイブルー
  '#FFC0CB', // 7: ピンク
  '#F0E68C', // 8: カーキ
  '#98FB98', // 9: ペールグリーン
  '#FFDDCC', // 10: ライトコーラル
  '#B0E0E6', // 11: パウダーブルー
  '#FFDAB9', // 12: ピーチパフ
  '#E0BBE4', // 13: 薄いラベンダー
  '#FFDAC1', // 14: アプリコット
  '#B5EAD7', // 15: ミントクリーム
  '#C7CEEA', // 16: ペリウィンクル
];

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
