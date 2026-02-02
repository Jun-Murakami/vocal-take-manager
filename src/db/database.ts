/**
 * Dexie Database Setup
 * IndexedDB wrapper for Vocal Take Manager
 */

import Dexie, { type EntityTable } from 'dexie';

import type { Song, SongListItem } from '@/types/models';

// ==================== Database Schema ====================

/**
 * Song data stored in IndexedDB
 */
interface SongData {
  id: string;
  json: string; // JSON.stringify(Song)
}

/**
 * アプリ全体の設定（ソング間で共有）
 */
interface AppSettings {
  id: 'app'; // 固定ID
  // マーク設定（1～9の記号）
  markSymbols: Record<number, string>; // key: 1-9, value: 記号（1文字）
  // 0キー用の自由入力テキスト
  memoText: string;
}

class VocalTakeManagerDB extends Dexie {
  // リスト表示用の軽量データ
  songs!: EntityTable<SongListItem, 'id'>;
  // 完全なSongデータ（JSON文字列）
  songData!: EntityTable<SongData, 'id'>;
  // アプリ全体の設定（ソング間で共有）
  appSettings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('VocalTakeManagerDB');

    this.version(1).stores({
      songs: 'id, title, updatedAt',
      songData: 'id',
    });

    // バージョン2でアプリ設定テーブルを追加
    this.version(2).stores({
      songs: 'id, title, updatedAt',
      songData: 'id',
      appSettings: 'id',
    });
  }
}

// ==================== Database Instance ====================

export const db = new VocalTakeManagerDB();

// ==================== CRUD Operations ====================

/**
 * 全曲のリストを取得（更新日時降順）
 */
export async function getAllSongs(): Promise<SongListItem[]> {
  return await db.songs.orderBy('updatedAt').reverse().toArray();
}

/**
 * IDで曲を取得
 */
export async function getSongById(id: string): Promise<Song | null> {
  const data = await db.songData.get(id);
  if (!data) return null;
  try {
    return JSON.parse(data.json) as Song;
  } catch {
    console.error(`Failed to parse song data for id: ${id}`);
    return null;
  }
}

/**
 * 曲を保存（新規 or 更新）
 */
export async function saveSong(song: Song): Promise<void> {
  const listItem: SongListItem = {
    id: song.id,
    title: song.title,
    updatedAt: song.updatedAt,
  };

  const songData: SongData = {
    id: song.id,
    json: JSON.stringify(song),
  };

  await db.transaction('rw', db.songs, db.songData, async () => {
    await db.songs.put(listItem);
    await db.songData.put(songData);
  });
}

/**
 * 曲を削除
 */
export async function deleteSong(id: string): Promise<void> {
  await db.transaction('rw', db.songs, db.songData, async () => {
    await db.songs.delete(id);
    await db.songData.delete(id);
  });
}

/**
 * すべてのデータをクリア（テスト用）
 */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    db.songs,
    db.songData,
    db.appSettings,
    async () => {
      await db.songs.clear();
      await db.songData.clear();
      await db.appSettings.clear();
    },
  );
}

// ==================== App Settings Operations ====================

/**
 * アプリ設定を取得（デフォルト値付き）
 */
export async function getAppSettings(): Promise<AppSettings> {
  const settings = await db.appSettings.get('app');
  if (settings) {
    return settings;
  }

  // デフォルト値
  const defaultSettings: AppSettings = {
    id: 'app',
    markSymbols: {
      1: '◎',
      2: '〇',
      3: '△',
      4: '',
      5: 'P',
      6: 'R',
      7: '',
      8: '',
      9: '',
    },
    memoText: '',
  };

  // デフォルト値を保存
  await db.appSettings.put(defaultSettings);
  return defaultSettings;
}

/**
 * アプリ設定を保存
 */
export async function saveAppSettings(
  settings: Partial<Omit<AppSettings, 'id'>>,
): Promise<void> {
  const current = await getAppSettings();
  const updated: AppSettings = {
    ...current,
    ...settings,
    id: 'app', // IDは固定
  };
  await db.appSettings.put(updated);
}

/**
 * マーク記号を取得（1～9）
 */
export async function getMarkSymbol(key: number): Promise<string> {
  const settings = await getAppSettings();
  return settings.markSymbols[key] || '';
}

/**
 * マーク記号を設定（1～9）
 */
export async function setMarkSymbol(
  key: number,
  symbol: string,
): Promise<void> {
  const settings = await getAppSettings();
  const updatedSymbols = {
    ...settings.markSymbols,
    [key]: symbol.slice(0, 1), // 1文字に制限
  };
  await saveAppSettings({ markSymbols: updatedSymbols });
}

/**
 * メモテキストを取得（0キー用）
 */
export async function getMemoText(): Promise<string> {
  const settings = await getAppSettings();
  return settings.memoText;
}

/**
 * メモテキストを設定（0キー用）
 */
export async function setMemoText(text: string): Promise<void> {
  await saveAppSettings({ memoText: text });
}
