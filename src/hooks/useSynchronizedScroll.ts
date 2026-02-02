import { useCallback, useRef } from 'react';

import type { RefObject } from 'react';

interface UseSynchronizedScrollReturn {
  primaryScrollRef: RefObject<HTMLDivElement | null>;
  secondaryScrollRef: RefObject<HTMLDivElement | null>;
  handlePrimaryScroll: () => void;
  handleSecondaryScroll: () => void;
}

export function useSynchronizedScroll(): UseSynchronizedScrollReturn {
  const primaryScrollRef = useRef<HTMLDivElement>(null);
  const secondaryScrollRef = useRef<HTMLDivElement>(null);

  const handlePrimaryScroll = useCallback(() => {
    if (secondaryScrollRef.current && primaryScrollRef.current) {
      secondaryScrollRef.current.scrollTop = primaryScrollRef.current.scrollTop;
    }
  }, []);

  const handleSecondaryScroll = useCallback(() => {
    if (primaryScrollRef.current && secondaryScrollRef.current) {
      primaryScrollRef.current.scrollTop = secondaryScrollRef.current.scrollTop;
    }
  }, []);

  return {
    primaryScrollRef,
    secondaryScrollRef,
    handlePrimaryScroll,
    handleSecondaryScroll,
  };
}
