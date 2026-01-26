/**
 * Vocal Take Manager - Data Models & Type Definitions
 * Based on CLAUDE.md specifications
 */

// ==================== Token (Kuromoji.js result) ====================
export interface Token {
  surfaceForm: string;
  pos: string;
  posDetail1: string;
  // kuromoji の詳細情報（助動詞語幹などの判定に使用）
  posDetail2: string;
  posDetail3: string;
  baseForm: string;
  reading: string;
  pronunciation: string;
}

// ==================== Phrase ====================
export interface Phrase {
  id: string;
  lineIndex: number; // 元の歌詞の行インデックス
  order: number; // フレーズの全体順序
  text: string; // フレーズテキスト
  tokens: Token[]; // 形態素解析結果
  isRehearsalMark?: boolean; // リハーサルマーク行かどうか
}

// ==================== Take ====================
export interface Take {
  id: string;
  order: number; // 1..n
  label: string; // 表示用ラベル（デフォルトは番号）
  color: string; // UI用カラー
}

// ==================== Mark ====================
export interface Mark {
  id: string;
  phraseId: string;
  takeId: string;
  markValue: string | null; // 例: ◎/〇/△/空
  memo: string | null; // 手動メモ（0キー入力）
  updatedAt: number; // タイムスタンプ (ms)
}

// ==================== Comping State ====================
export interface CompingState {
  currentPhraseIndex: number; // 現在選択中のフレーズインデックス
  selectedTakeByPhraseId: Record<string, string>; // phraseId -> takeId
}

// ==================== Mark Setting ====================
export interface MarkSetting {
  key: number; // 1..9
  symbol: string | null; // 表示記号（例: ◎, 〇, △）
  color: string | null; // 表示色
}

// ==================== Song (Root Model) ====================
export interface Song {
  id: string; // UUID
  title: string;
  credits: string;
  rawLyrics: string; // 入力された生の歌詞
  createdAt: number; // タイムスタンプ (ms)
  updatedAt: number; // タイムスタンプ (ms)
  phrases: Phrase[];
  takes: Take[];
  marks: Mark[];
  comping: CompingState;
  // 後方互換性のためオプショナル（新規作成時は含めない）
  markSettings?: MarkSetting[];
  freeMemo: string; // フリーメモエリア
}

// ==================== VTM Export Format ====================
export interface VtmExport {
  version: string; // フォーマットバージョン
  exportedAt: number; // エクスポート日時 (ms)
  song: Song;
}

// ==================== Helper Types ====================

/**
 * 新規Song作成時のデフォルト値を含むヘルパー型
 */
export type NewSongInput = Pick<Song, 'title' | 'credits' | 'rawLyrics'>;

/**
 * データベース保存用の簡易Song情報（リスト表示用）
 */
export interface SongListItem {
  id: string;
  title: string;
  updatedAt: number;
}
