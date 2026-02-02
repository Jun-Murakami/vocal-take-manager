import { describe, expect, test } from 'vitest';

import {
  addTake,
  mergePhraseAtDivider,
  removeTake,
  splitPhraseByChar,
} from './songHelpers';

import type { Phrase, Song, Take } from '@/types/models';

function createMockSong(overrides?: Partial<Song>): Song {
  const phrases: Phrase[] = [
    {
      id: 'phrase-1',
      lineIndex: 0,
      order: 0,
      text: 'これはテスト',
      tokens: [],
    },
    { id: 'phrase-2', lineIndex: 0, order: 1, text: '歌詞です', tokens: [] },
    { id: 'phrase-3', lineIndex: 1, order: 2, text: '二行目', tokens: [] },
  ];

  const takes: Take[] = [
    { id: 'take-1', order: 1, label: 'Take 1', color: '#ff0000' },
  ];

  return {
    id: 'test-song',
    title: 'Test Song',
    credits: '',
    rawLyrics: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    phrases,
    takes,
    marks: [],
    comping: { currentPhraseIndex: 0, selectedTakeByPhraseId: {} },
    freeMemo: '',
    ...overrides,
  };
}

describe('songHelpers', () => {
  describe('addTake', () => {
    test('新しいテイクを追加', () => {
      const song = createMockSong();

      const result = addTake(song);

      expect(result.takes).toHaveLength(2);
      expect(result.takes[1].order).toBe(2);
      expect(result.takes[1].label).toBe('2');
    });

    test('追加したテイクは一意なIDを持つ', () => {
      const song = createMockSong();

      const result = addTake(song);

      expect(result.takes[0].id).not.toBe(result.takes[1].id);
    });
  });

  describe('removeTake', () => {
    test('指定したテイクを削除', () => {
      const takes: Take[] = [
        { id: 'take-1', order: 1, label: 'Take 1', color: '#ff0000' },
        { id: 'take-2', order: 2, label: 'Take 2', color: '#00ff00' },
      ];
      const song = createMockSong({ takes });

      const result = removeTake(song, 'take-1');

      expect(result.takes).toHaveLength(1);
      expect(result.takes[0].id).toBe('take-2');
    });

    test('関連するマークも削除される', () => {
      const takes: Take[] = [
        { id: 'take-1', order: 1, label: 'Take 1', color: '#ff0000' },
        { id: 'take-2', order: 2, label: 'Take 2', color: '#00ff00' },
      ];
      const song = createMockSong({
        takes,
        marks: [
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
            phraseId: 'phrase-1',
            takeId: 'take-2',
            markValue: '〇',
            memo: null,
            updatedAt: Date.now(),
          },
        ],
      });

      const result = removeTake(song, 'take-1');

      expect(result.marks).toHaveLength(1);
      expect(result.marks[0].takeId).toBe('take-2');
    });
  });

  describe('splitPhraseByChar', () => {
    test('フレーズを指定位置で分割', () => {
      const song = createMockSong();
      const originalPhrase = song.phrases[0];

      const result = splitPhraseByChar(song, originalPhrase.id, 3);

      expect(result.phrases).toHaveLength(4);
      const splitIndex = result.phrases.findIndex(
        (p) => p.id === originalPhrase.id,
      );
      expect(result.phrases[splitIndex].text).toBe('これは');
      expect(result.phrases[splitIndex + 1].text).toBe('テスト');
    });

    test('無効な分割位置では変更なし', () => {
      const song = createMockSong();
      const originalPhrase = song.phrases[0];

      const result = splitPhraseByChar(song, originalPhrase.id, 0);

      expect(result.phrases).toHaveLength(3);
    });
  });

  describe('mergePhraseAtDivider', () => {
    test('隣接するフレーズを結合', () => {
      const song = createMockSong();

      const result = mergePhraseAtDivider(song, 'phrase-1', 'phrase-2');

      expect(result).not.toBeNull();
      expect(result?.song.phrases).toHaveLength(2);
      const mergedPhrase = result?.song.phrases.find(
        (p) => p.text === 'これはテスト歌詞です',
      );
      expect(mergedPhrase).toBeDefined();
    });

    test('異なる行のフレーズは結合できない', () => {
      const song = createMockSong();

      const result = mergePhraseAtDivider(song, 'phrase-2', 'phrase-3');

      expect(result).toBeNull();
    });
  });
});
