import { useCallback, useRef } from 'react';

import type { RefObject } from 'react';

interface UseSynchronizedScrollReturn {
  primaryScrollRef: RefObject<HTMLDivElement | null>;
  secondaryScrollRef: RefObject<HTMLDivElement | null>;
  handlePrimaryScroll: () => void;
  handleSecondaryScroll: () => void;
}

function syncScrollDirect(
  source: HTMLDivElement,
  target: HTMLDivElement,
): void {
  target.scrollTop = source.scrollTop;
}

export function useSynchronizedScroll(): UseSynchronizedScrollReturn {
  const primaryScrollRef = useRef<HTMLDivElement>(null);
  const secondaryScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  const syncScroll = useCallback(
    (source: HTMLDivElement, target: HTMLDivElement) => {
      if (isSyncingRef.current) return;

      isSyncingRef.current = true;

      syncScrollDirect(source, target);

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
