import { useHotkeys } from 'react-hotkeys-hook';

import type { Song } from '../../../types/models';

type ShortcutFeedbackType =
  | 'nav-prev'
  | 'nav-next'
  | 'delete'
  | 'memo-0'
  | `mark-${number}`;

interface UseRecordingKeyboardOptions {
  song: Song | null;
  selectedPhraseId: string | null;
  selectedTakeId: string | null;
  isManualSplitMode: boolean;
  isManualDeleteMode: boolean;
  isLyricEditMode: boolean;
  isRehearsalMarkMode: boolean;
  onMarkInput: (keyNum: number) => Promise<void>;
  onMemoInput: () => Promise<void>;
  onClearMark: () => Promise<void>;
  onPrevPhrase: () => void;
  onNextPhrase: () => void;
  triggerShortcutFeedback: (type: ShortcutFeedbackType) => void;
}

export function useRecordingKeyboard({
  song,
  selectedPhraseId,
  selectedTakeId,
  isManualSplitMode,
  isManualDeleteMode,
  isLyricEditMode,
  isRehearsalMarkMode,
  onMarkInput,
  onMemoInput,
  onClearMark,
  onPrevPhrase,
  onNextPhrase,
  triggerShortcutFeedback,
}: UseRecordingKeyboardOptions) {
  const isEnabled =
    !!song &&
    !!selectedPhraseId &&
    !!selectedTakeId &&
    !isManualSplitMode &&
    !isManualDeleteMode &&
    !isLyricEditMode &&
    !isRehearsalMarkMode;

  const isNavigationEnabled =
    !!song &&
    !isManualSplitMode &&
    !isManualDeleteMode &&
    !isLyricEditMode &&
    !isRehearsalMarkMode;

  const isSelectablePhrase = () => {
    if (!song || !selectedPhraseId) return false;
    const phrase = song.phrases.find((p) => p.id === selectedPhraseId);
    return phrase && phrase.text.trim().length > 0;
  };

  useHotkeys(
    'left',
    (e) => {
      e.preventDefault();
      triggerShortcutFeedback('nav-prev');
      onPrevPhrase();
    },
    {
      enabled: isNavigationEnabled,
      enableOnFormTags: false,
    },
    [isNavigationEnabled, onPrevPhrase, triggerShortcutFeedback],
  );

  useHotkeys(
    'right',
    (e) => {
      e.preventDefault();
      triggerShortcutFeedback('nav-next');
      onNextPhrase();
    },
    {
      enabled: isNavigationEnabled,
      enableOnFormTags: false,
    },
    [isNavigationEnabled, onNextPhrase, triggerShortcutFeedback],
  );

  useHotkeys(
    '1,2,3,4,5,6,7,8,9',
    (e) => {
      if (!isSelectablePhrase()) return;
      e.preventDefault();
      const keyNum = Number.parseInt(e.key, 10);
      triggerShortcutFeedback(`mark-${keyNum}`);
      void onMarkInput(keyNum);
    },
    {
      enabled: isEnabled,
      enableOnFormTags: false,
    },
    [isEnabled, song, selectedPhraseId, onMarkInput, triggerShortcutFeedback],
  );

  useHotkeys(
    '0',
    (e) => {
      if (!isSelectablePhrase()) return;
      e.preventDefault();
      triggerShortcutFeedback('memo-0');
      void onMemoInput();
    },
    {
      enabled: isEnabled,
      enableOnFormTags: false,
    },
    [isEnabled, song, selectedPhraseId, onMemoInput, triggerShortcutFeedback],
  );

  useHotkeys(
    'delete,backspace',
    (e) => {
      if (!isSelectablePhrase()) return;
      e.preventDefault();
      triggerShortcutFeedback('delete');
      void onClearMark();
    },
    {
      enabled: isEnabled,
      enableOnFormTags: false,
    },
    [isEnabled, song, selectedPhraseId, onClearMark, triggerShortcutFeedback],
  );
}
