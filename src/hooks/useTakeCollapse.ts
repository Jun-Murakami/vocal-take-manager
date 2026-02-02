import { useCallback, useEffect, useRef, useState } from 'react';

import type { Take } from '@/types/models';

interface UseTakeCollapseOptions {
  takes: Take[] | undefined;
}

interface UseTakeCollapseReturn {
  collapsedTakeIds: Set<string>;
  toggleTakeCollapse: (takeId: string) => void;
}

export function useTakeCollapse({
  takes,
}: UseTakeCollapseOptions): UseTakeCollapseReturn {
  const [collapsedTakeIds, setCollapsedTakeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const prevTakesRef = useRef<Take[] | null>(null);

  const toggleTakeCollapse = useCallback((takeId: string) => {
    setCollapsedTakeIds((prev) => {
      const next = new Set(prev);
      if (next.has(takeId)) {
        next.delete(takeId);
      } else {
        next.add(takeId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!takes) return;

    if (prevTakesRef.current === takes) return;
    prevTakesRef.current = takes;

    setCollapsedTakeIds((prev) => {
      const validIds = new Set(takes.map((take) => take.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [takes]);

  return {
    collapsedTakeIds,
    toggleTakeCollapse,
  };
}
