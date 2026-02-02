import { useCallback, useRef } from 'react';

import type { RefObject } from 'react';

interface UseSynchronizedScrollReturn {
  primaryScrollRef: RefObject<HTMLDivElement | null>;
  secondaryScrollRef: RefObject<HTMLDivElement | null>;
  handlePrimaryScroll: () => void;
  handleSecondaryScroll: () => void;
}

function getMaxScrollTop(element: HTMLDivElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function syncScrollByRatio(
  source: HTMLDivElement,
  target: HTMLDivElement,
): void {
  const sourceMaxScroll = getMaxScrollTop(source);
  const targetMaxScroll = getMaxScrollTop(target);

  if (sourceMaxScroll <= 0 || targetMaxScroll <= 0) {
    target.scrollTop = 0;
    return;
  }

  const scrollRatio = source.scrollTop / sourceMaxScroll;
  const targetScrollTop = scrollRatio * targetMaxScroll;

  target.scrollTop = Math.min(targetScrollTop, targetMaxScroll);
}

export function useSynchronizedScroll(): UseSynchronizedScrollReturn {
  const primaryScrollRef = useRef<HTMLDivElement>(null);
  const secondaryScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  const syncScroll = useCallback(
    (source: HTMLDivElement, target: HTMLDivElement) => {
      if (isSyncingRef.current) return;

      isSyncingRef.current = true;

      syncScrollByRatio(source, target);

      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    },
    [],
  );

  const handlePrimaryScroll = useCallback(() => {
    if (secondaryScrollRef.current && primaryScrollRef.current) {
      syncScroll(primaryScrollRef.current, secondaryScrollRef.current);
    }
  }, [syncScroll]);

  const handleSecondaryScroll = useCallback(() => {
    if (primaryScrollRef.current && secondaryScrollRef.current) {
      syncScroll(secondaryScrollRef.current, primaryScrollRef.current);
    }
  }, [syncScroll]);

  return {
    primaryScrollRef,
    secondaryScrollRef,
    handlePrimaryScroll,
    handleSecondaryScroll,
  };
}
