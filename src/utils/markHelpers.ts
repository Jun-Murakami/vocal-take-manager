/**
 * Mark Helper Functions
 * Utilities for managing marks (ratings) on phrases and takes
 */

import { generateId } from './songHelpers';

import type { Mark, Song } from '@/types/models';

/**
 * Get mark for a specific phrase and take
 */
export function getMark(
  song: Song,
  phraseId: string,
  takeId: string,
): Mark | null {
  return (
    song.marks.find((m) => m.phraseId === phraseId && m.takeId === takeId) ||
    null
  );
}

/**
 * Set mark value for a phrase and take
 * markValue は記号を直接格納（1文字に制限）
 */
export function setMarkValue(
  song: Song,
  phraseId: string,
  takeId: string,
  markValue: string | null,
): Song {
  const existingMarkIndex = song.marks.findIndex(
    (m) => m.phraseId === phraseId && m.takeId === takeId,
  );

  const newMarks = [...song.marks];

  // 記号は1文字に制限
  const normalizedValue =
    markValue && markValue.length > 0 ? markValue.slice(0, 1) : null;

  if (existingMarkIndex >= 0) {
    // Update existing mark
    newMarks[existingMarkIndex] = {
      ...newMarks[existingMarkIndex],
      markValue: normalizedValue,
      updatedAt: Date.now(),
    };
  } else {
    // Create new mark
    newMarks.push({
      id: generateId(),
      phraseId,
      takeId,
      markValue: normalizedValue,
      memo: null,
      updatedAt: Date.now(),
    });
  }

  return {
    ...song,
    marks: newMarks,
    updatedAt: Date.now(),
  };
}

/**
 * Set memo for a phrase and take
 * memo は自由入力テキストを直接格納
 */
export function setMarkMemo(
  song: Song,
  phraseId: string,
  takeId: string,
  memo: string | null,
): Song {
  const existingMarkIndex = song.marks.findIndex(
    (m) => m.phraseId === phraseId && m.takeId === takeId,
  );

  const newMarks = [...song.marks];

  if (existingMarkIndex >= 0) {
    // Update existing mark
    newMarks[existingMarkIndex] = {
      ...newMarks[existingMarkIndex],
      memo: memo || null,
      updatedAt: Date.now(),
    };
  } else {
    // Create new mark
    newMarks.push({
      id: generateId(),
      phraseId,
      takeId,
      markValue: null,
      memo: memo || null,
      updatedAt: Date.now(),
    });
  }

  return {
    ...song,
    marks: newMarks,
    updatedAt: Date.now(),
  };
}

/**
 * Clear mark value and memo for a phrase and take
 */
export function clearMark(song: Song, phraseId: string, takeId: string): Song {
  const existingMarkIndex = song.marks.findIndex(
    (m) => m.phraseId === phraseId && m.takeId === takeId,
  );

  if (existingMarkIndex < 0) {
    return song;
  }

  const newMarks = [...song.marks];
  newMarks[existingMarkIndex] = {
    ...newMarks[existingMarkIndex],
    markValue: null,
    memo: null,
    updatedAt: Date.now(),
  };

  return {
    ...song,
    marks: newMarks,
    updatedAt: Date.now(),
  };
}

/**
 * Get all marks for a specific phrase (across all takes)
 */
export function getMarksForPhrase(song: Song, phraseId: string): Mark[] {
  return song.marks.filter((m) => m.phraseId === phraseId);
}

/**
 * Get all marks for a specific take (across all phrases)
 */
export function getMarksForTake(song: Song, takeId: string): Mark[] {
  return song.marks.filter((m) => m.takeId === takeId);
}
