import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

import type { RefObject } from 'react';

interface UseMarksViewportWidthOptions {
  marksScrollRef: RefObject<HTMLDivElement | null>;
  takeCount: number;
  collapsedCount: number;
  isLoaded: boolean;
}

interface UseMarksViewportWidthReturn {
  marksViewportWidth: number;
  marksHorizontalScrollbarHeight: number;
  updateMarksViewportWidth: () => void;
}

export function useMarksViewportWidth({
  marksScrollRef,
  takeCount,
  collapsedCount,
  isLoaded,
}: UseMarksViewportWidthOptions): UseMarksViewportWidthReturn {
  const [marksViewportWidth, setMarksViewportWidth] = useState(0);
  const [marksHorizontalScrollbarHeight, setMarksHorizontalScrollbarHeight] =
    useState(0);

  const updateMarksViewportWidth = useCallback(() => {
    const viewport = marksScrollRef.current;
    const viewportWidth = viewport?.clientWidth ?? 0;
    setMarksViewportWidth(viewportWidth);

    const scrollbarHeight = viewport
      ? viewport.offsetHeight - viewport.clientHeight
      : 0;
    setMarksHorizontalScrollbarHeight(scrollbarHeight);
  }, [marksScrollRef]);

  useLayoutEffect(() => {
    updateMarksViewportWidth();
  }, [updateMarksViewportWidth]);

  useLayoutEffect(() => {
    if (!isLoaded) return;
    updateMarksViewportWidth();
  }, [isLoaded, updateMarksViewportWidth]);

  useLayoutEffect(() => {
    if (!isLoaded) return;
    if (takeCount >= 0 && collapsedCount >= 0) {
      updateMarksViewportWidth();
    }
  }, [collapsedCount, takeCount, isLoaded, updateMarksViewportWidth]);

  useEffect(() => {
    const handleResize = () => updateMarksViewportWidth();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateMarksViewportWidth]);

  return {
    marksViewportWidth,
    marksHorizontalScrollbarHeight,
    updateMarksViewportWidth,
  };
}
