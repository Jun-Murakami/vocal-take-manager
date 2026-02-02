import { useCallback, useEffect, useRef, useState } from 'react';

import type { SxProps, Theme } from '@mui/material/styles';

const FEEDBACK_DURATION_MS = 360;

interface UseShortcutFeedbackReturn {
  activeShortcutKey: string | null;
  triggerShortcutFeedback: (key: string) => void;
  getShortcutPulseSx: (isActive: boolean) => SxProps<Theme>;
}

export function useShortcutFeedback(): UseShortcutFeedbackReturn {
  const [activeShortcutKey, setActiveShortcutKey] = useState<string | null>(
    null,
  );
  const timeoutRef = useRef<number | null>(null);

  const triggerShortcutFeedback = useCallback((key: string) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    setActiveShortcutKey(key);
    timeoutRef.current = window.setTimeout(() => {
      setActiveShortcutKey(null);
    }, FEEDBACK_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getShortcutPulseSx = useCallback(
    (isActive: boolean): SxProps<Theme> => {
      if (!isActive) return {};
      return {
        animation: `shortcutPulse ${FEEDBACK_DURATION_MS}ms ease-out`,
        '@keyframes shortcutPulse': {
          '0%': {
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.22)',
            filter: 'brightness(1)',
          },
          '60%': {
            transform: 'scale(1.12)',
            boxShadow: '0 0 0 10px rgba(25, 118, 210, 0.14)',
            filter: 'brightness(1.12)',
          },
          '100%': {
            transform: 'scale(1)',
            boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)',
            filter: 'brightness(1)',
          },
        },
      };
    },
    [],
  );

  return {
    activeShortcutKey,
    triggerShortcutFeedback,
    getShortcutPulseSx,
  };
}
