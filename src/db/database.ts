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

class VocalTakeManagerDB extends Dexie {
  // リスト表示用の軽量データ
  songs!: EntityTable<SongListItem, 'id'>;
  // 完全なSongデータ（JSON文字列）
  songData!: EntityTable<SongData, 'id'>;

  constructor() {
    super('VocalTakeManagerDB');

    this.version(1).stores({
      songs: 'id, title, updatedAt',
      songData: 'id',
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
  await db.transaction('rw', db.songs, db.songData, async () => {
    await db.songs.clear();
    await db.songData.clear();
  });
}
