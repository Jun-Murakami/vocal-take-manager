import { useCallback, useMemo, useState } from 'react';

import type { Song } from '@/types/models';

interface UseMarkFilteringResult {
  activeMarkFilters: number[];
  handleToggleFilter: (key: number) => void;
  isPhraseHighlighted: (phraseId: string) => boolean;
}

export const useMarkFiltering = (
  song: Song | null,
  markSymbols: Record<number, string>,
): UseMarkFilteringResult => {
  const [activeMarkFilters, setActiveMarkFilters] = useState<number[]>([]);

  const phraseMarkMap = useMemo(() => {
    const map = new Map<string, { symbols: Set<string>; hasMemo: boolean }>();

    if (!song) {
      return map;
    }

    for (const mark of song.marks) {
      const entry = map.get(mark.phraseId) || {
        symbols: new Set<string>(),
        hasMemo: false,
      };

      if (mark.markValue) {
        entry.symbols.add(mark.markValue);
      }

      if (mark.memo && mark.memo.trim().length > 0) {
        entry.hasMemo = true;
      }

      map.set(mark.phraseId, entry);
    }

    return map;
  }, [song]);

  const handleToggleFilter = useCallback((key: number) => {
    setActiveMarkFilters((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }, []);

  const isPhraseHighlighted = useCallback(
    (phraseId: string) => {
      if (activeMarkFilters.length === 0) {
        return false;
      }

      const entry = phraseMarkMap.get(phraseId);
      if (!entry) {
        return false;
      }

      for (const key of activeMarkFilters) {
        if (key === 0) {
          if (entry.hasMemo) {
            return true;
          }
          continue;
        }

        const symbol = markSymbols[key] || '';
        if (symbol && entry.symbols.has(symbol)) {
          return true;
        }
      }

      return false;
    },
    [activeMarkFilters, phraseMarkMap, markSymbols],
  );

  return {
    activeMarkFilters,
    handleToggleFilter,
    isPhraseHighlighted,
  };
};
