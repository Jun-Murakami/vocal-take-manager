import { useCallback, useEffect, useRef, useState } from 'react';

import type { SxProps, Theme } from '@mui/material/styles';

const FEEDBACK_DURATION_MS = 360;

interface ActiveShortcut {
  key: string;
  triggerId: number;
}

interface UseShortcutFeedbackReturn {
  activeShortcutKey: string | null;
  triggerShortcutFeedback: (key: string) => void;
  getShortcutPulseSx: (isActive: boolean) => SxProps<Theme>;
}

export function useShortcutFeedback(): UseShortcutFeedbackReturn {
  const [activeShortcut, setActiveShortcut] = useState<ActiveShortcut | null>(
    null,
  );
  const timeoutRef = useRef<number | null>(null);
  const triggerIdRef = useRef(0);

  // 後方互換のため activeShortcutKey として key のみを返す
  const activeShortcutKey = activeShortcut?.key ?? null;

  const triggerShortcutFeedback = useCallback((key: string) => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    // 毎回異なる triggerId を使用することで、同じキーでも状態変更として認識させる
    triggerIdRef.current += 1;
    setActiveShortcut({ key, triggerId: triggerIdRef.current });
    timeoutRef.current = window.setTimeout(() => {
      setActiveShortcut(null);
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
      if (!isActive || !activeShortcut) return {};
      // アニメーション名に triggerId を含めることで、毎回新しいアニメーションとして再生される
      const animationName = `shortcutPulse-${activeShortcut.triggerId}`;
      return {
        animation: `${animationName} ${FEEDBACK_DURATION_MS}ms ease-out`,
        [`@keyframes ${animationName}`]: {
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
    [activeShortcut],
  );

  return {
    activeShortcutKey,
    triggerShortcutFeedback,
    getShortcutPulseSx,
  };
}
