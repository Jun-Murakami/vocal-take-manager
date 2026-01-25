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

  if (existingMarkIndex >= 0) {
    // Update existing mark
    newMarks[existingMarkIndex] = {
      ...newMarks[existingMarkIndex],
      markValue,
      updatedAt: Date.now(),
    };
  } else {
    // Create new mark
    newMarks.push({
      id: generateId(),
      phraseId,
      takeId,
      markValue,
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
      memo,
      updatedAt: Date.now(),
    };
  } else {
    // Create new mark
    newMarks.push({
      id: generateId(),
      phraseId,
      takeId,
      markValue: null,
      memo,
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
