import { describe, expect, test } from 'vitest';

import {
  clearMark,
  clearMarksForTake,
  getMark,
  setMarkMemo,
  setMarkValue,
} from './markHelpers';

import type { Mark, Song } from '@/types/models';

function createMockSong(overrides?: Partial<Song>): Song {
  return {
    id: 'test-song',
    title: 'Test Song',
    credits: '',
    rawLyrics: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    phrases: [
      { id: 'phrase-1', lineIndex: 0, order: 0, text: 'Phrase 1', tokens: [] },
      { id: 'phrase-2', lineIndex: 0, order: 1, text: 'Phrase 2', tokens: [] },
    ],
    takes: [
      { id: 'take-1', order: 1, label: 'Take 1', color: '#ff0000' },
      { id: 'take-2', order: 2, label: 'Take 2', color: '#00ff00' },
    ],
    marks: [],
    comping: { currentPhraseIndex: 0, selectedTakeByPhraseId: {} },
    freeMemo: '',
    ...overrides,
  };
}

describe('markHelpers', () => {
  describe('getMark', () => {
    test('存在するマークを取得', () => {
      const mark: Mark = {
        id: 'mark-1',
        phraseId: 'phrase-1',
        takeId: 'take-1',
        markValue: '◎',
        memo: null,
        updatedAt: Date.now(),
      };
      const song = createMockSong({ marks: [mark] });

      const result = getMark(song, 'phrase-1', 'take-1');

      expect(result).toEqual(mark);
    });

    test('存在しないマークはnullを返す', () => {
      const song = createMockSong();

      const result = getMark(song, 'phrase-1', 'take-1');

      expect(result).toBeNull();
    });
  });

  describe('setMarkValue', () => {
    test('新規マークを作成', () => {
      const song = createMockSong();

      const result = setMarkValue(song, 'phrase-1', 'take-1', '◎');

      expect(result.marks).toHaveLength(1);
      expect(result.marks[0].markValue).toBe('◎');
      expect(result.marks[0].phraseId).toBe('phrase-1');
      expect(result.marks[0].takeId).toBe('take-1');
    });

    test('既存マークを更新', () => {
      const mark: Mark = {
        id: 'mark-1',
        phraseId: 'phrase-1',
        takeId: 'take-1',
        markValue: '〇',
        memo: null,
        updatedAt: Date.now(),
      };
      const song = createMockSong({ marks: [mark] });

      const result = setMarkValue(song, 'phrase-1', 'take-1', '◎');

      expect(result.marks).toHaveLength(1);
      expect(result.marks[0].markValue).toBe('◎');
    });
  });

  describe('clearMark', () => {
    test('マークをクリア', () => {
      const mark: Mark = {
        id: 'mark-1',
        phraseId: 'phrase-1',
        takeId: 'take-1',
        markValue: '◎',
        memo: null,
        updatedAt: Date.now(),
      };
      const song = createMockSong({ marks: [mark] });

      const result = clearMark(song, 'phrase-1', 'take-1');

      expect(result.marks).toHaveLength(1);
      expect(result.marks[0].markValue).toBeNull();
      expect(result.marks[0].memo).toBeNull();
    });

    test('存在しないマークを削除してもエラーにならない', () => {
      const song = createMockSong();

      const result = clearMark(song, 'phrase-1', 'take-1');

      expect(result.marks).toHaveLength(0);
    });
  });

  describe('clearMarksForTake', () => {
    test('テイクの全マークをクリア', () => {
      const marks: Mark[] = [
        {
          id: 'mark-1',
          phraseId: 'phrase-1',
          takeId: 'take-1',
          markValue: '◎',
          memo: null,
          updatedAt: Date.now(),
        },
        {
          id: 'mark-2',
          phraseId: 'phrase-2',
          takeId: 'take-1',
          markValue: '〇',
          memo: null,
          updatedAt: Date.now(),
        },
        {
          id: 'mark-3',
          phraseId: 'phrase-1',
          takeId: 'take-2',
          markValue: '△',
          memo: null,
          updatedAt: Date.now(),
        },
      ];
      const song = createMockSong({ marks });

      const result = clearMarksForTake(song, 'take-1');

      expect(result.marks).toHaveLength(3);
      expect(result.marks[0].markValue).toBeNull();
      expect(result.marks[1].markValue).toBeNull();
      expect(result.marks[2].markValue).toBe('△');
    });
  });

  describe('setMarkMemo', () => {
    test('マークにメモを設定', () => {
      const song = createMockSong();

      const result = setMarkMemo(song, 'phrase-1', 'take-1', 'テストメモ');

      expect(result.marks).toHaveLength(1);
      expect(result.marks[0].memo).toBe('テストメモ');
    });

    test('空文字メモはnullとして保存', () => {
      const song = createMockSong();

      const result = setMarkMemo(song, 'phrase-1', 'take-1', '');

      expect(result.marks).toHaveLength(1);
      expect(result.marks[0].memo).toBeNull();
    });
  });
});
