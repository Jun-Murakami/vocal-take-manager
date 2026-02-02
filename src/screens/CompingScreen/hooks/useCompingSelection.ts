import { useCallback, useMemo } from 'react';

import {
  getNextSelectableIndex,
  getPreviousSelectableIndex,
  isSelectablePhrase,
} from '@/utils/phraseHelpers';

import type { Song } from '@/types/models';

interface UseCompingSelectionParams {
  song: Song | null;
  currentPhraseIndex: number;
  setCurrentPhraseIndex: (index: number) => void;
  onSaveSong: (song: Song) => Promise<void>;
}

interface UseCompingSelectionResult {
  handleSelectTake: (takeId: string) => Promise<void>;
  handleClearSelectedTake: () => Promise<void>;
  handlePrevPhrase: () => void;
  handleNextPhrase: () => void;
  selectedTakeId: string | null;
  nextPhraseText: string;
}

export const useCompingSelection = ({
  song,
  currentPhraseIndex,
  setCurrentPhraseIndex,
  onSaveSong,
}: UseCompingSelectionParams): UseCompingSelectionResult => {
  const currentPhrase = song?.phrases[currentPhraseIndex];

  const selectedTakeId = useMemo(() => {
    if (!currentPhrase || !song) return null;
    return song.comping.selectedTakeByPhraseId[currentPhrase.id] ?? null;
  }, [currentPhrase, song]);

  const nextPhraseText = useMemo(() => {
    if (!song) return '';
    const nextIndex = getNextSelectableIndex(song.phrases, currentPhraseIndex);
    if (nextIndex === currentPhraseIndex) return '';
    return song.phrases[nextIndex]?.text || '';
  }, [song, currentPhraseIndex]);

  const handleSelectTake = useCallback(
    async (takeId: string) => {
      if (!song || !song.phrases[currentPhraseIndex]) return;

      const phrase = song.phrases[currentPhraseIndex];
      if (!isSelectablePhrase(phrase)) return;

      const phraseId = phrase.id;
      const updatedSong: Song = {
        ...song,
        comping: {
          ...song.comping,
          currentPhraseIndex,
          selectedTakeByPhraseId: {
            ...song.comping.selectedTakeByPhraseId,
            [phraseId]: takeId,
          },
        },
        updatedAt: Date.now(),
      };

      await onSaveSong(updatedSong);

      const nextIndex = getNextSelectableIndex(
        song.phrases,
        currentPhraseIndex,
      );
      if (nextIndex !== currentPhraseIndex) {
        setCurrentPhraseIndex(nextIndex);
      }
    },
    [song, currentPhraseIndex, setCurrentPhraseIndex, onSaveSong],
  );

  const handleClearSelectedTake = useCallback(async () => {
    if (!song || !song.phrases[currentPhraseIndex]) return;

    const phrase = song.phrases[currentPhraseIndex];
    if (!isSelectablePhrase(phrase)) return;

    const phraseId = phrase.id;
    if (!song.comping.selectedTakeByPhraseId[phraseId]) return;

    const updatedSelectedTakeByPhraseId = {
      ...song.comping.selectedTakeByPhraseId,
    };
    delete updatedSelectedTakeByPhraseId[phraseId];

    const updatedSong: Song = {
      ...song,
      comping: {
        ...song.comping,
        currentPhraseIndex,
        selectedTakeByPhraseId: updatedSelectedTakeByPhraseId,
      },
      updatedAt: Date.now(),
    };

    await onSaveSong(updatedSong);
  }, [song, currentPhraseIndex, onSaveSong]);

  const handlePrevPhrase = useCallback(() => {
    if (!song) return;
    const prevIndex = getPreviousSelectableIndex(
      song.phrases,
      currentPhraseIndex,
    );
    setCurrentPhraseIndex(prevIndex);
  }, [song, currentPhraseIndex, setCurrentPhraseIndex]);

  const handleNextPhrase = useCallback(() => {
    if (!song) return;
    const nextIndex = getNextSelectableIndex(song.phrases, currentPhraseIndex);
    setCurrentPhraseIndex(nextIndex);
  }, [song, currentPhraseIndex, setCurrentPhraseIndex]);

  return {
    handleSelectTake,
    handleClearSelectedTake,
    handlePrevPhrase,
    handleNextPhrase,
    selectedTakeId,
    nextPhraseText,
  };
};
