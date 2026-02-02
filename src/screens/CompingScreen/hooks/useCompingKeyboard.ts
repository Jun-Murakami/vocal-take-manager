import { useHotkeys } from 'react-hotkeys-hook';

import type { Song } from '../../../types/models';

type ShortcutFeedbackType =
  | 'nav-prev'
  | 'nav-next'
  | 'delete'
  | `take-${number}`;

interface UseCompingKeyboardOptions {
  song: Song | null;
  isManualSplitMode: boolean;
  isManualDeleteMode: boolean;
  isLyricEditMode: boolean;
  isRehearsalMarkMode: boolean;
  onSelectTake: (takeId: string) => void;
  onClearSelectedTake: () => Promise<void>;
  onPrevPhrase: () => void;
  onNextPhrase: () => void;
  triggerShortcutFeedback: (type: ShortcutFeedbackType) => void;
}

export function useCompingKeyboard({
  song,
  isManualSplitMode,
  isManualDeleteMode,
  isLyricEditMode,
  isRehearsalMarkMode,
  onSelectTake,
  onClearSelectedTake,
  onPrevPhrase,
  onNextPhrase,
  triggerShortcutFeedback,
}: UseCompingKeyboardOptions) {
  const isEnabled =
    !!song &&
    !isManualSplitMode &&
    !isManualDeleteMode &&
    !isLyricEditMode &&
    !isRehearsalMarkMode;

  useHotkeys(
    'left',
    (e) => {
      e.preventDefault();
      triggerShortcutFeedback('nav-prev');
      onPrevPhrase();
    },
    {
      enabled: isEnabled,
      enableOnFormTags: false,
    },
    [isEnabled, onPrevPhrase, triggerShortcutFeedback],
  );

  useHotkeys(
    'right',
    (e) => {
      e.preventDefault();
      triggerShortcutFeedback('nav-next');
      onNextPhrase();
    },
    {
      enabled: isEnabled,
      enableOnFormTags: false,
    },
    [isEnabled, onNextPhrase, triggerShortcutFeedback],
  );

  useHotkeys(
    '0,1,2,3,4,5,6,7,8,9',
    (e) => {
      if (!song) return;
      e.preventDefault();
      const takeOrder = e.key === '0' ? 10 : Number.parseInt(e.key, 10);
      const take = song.takes.find((t) => t.order === takeOrder);
      if (take) {
        triggerShortcutFeedback(`take-${take.order}`);
        onSelectTake(take.id);
      }
    },
    {
      enabled: isEnabled,
      enableOnFormTags: false,
    },
    [isEnabled, song, onSelectTake, triggerShortcutFeedback],
  );

  useHotkeys(
    'delete,backspace',
    (e) => {
      e.preventDefault();
      triggerShortcutFeedback('delete');
      void onClearSelectedTake();
    },
    {
      enabled: isEnabled,
      enableOnFormTags: false,
    },
    [isEnabled, onClearSelectedTake, triggerShortcutFeedback],
  );
}
