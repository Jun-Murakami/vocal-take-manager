import React from 'react';

import type { SxProps } from '@mui/material/styles';

export interface UseShortcutFeedbackReturn {
  activeShortcutKey: string | null;
  triggerShortcutFeedback: (key: string) => void;
  getShortcutPulseSx: (isActive: boolean) => SxProps;
}

/**
 * Custom hook for managing visual feedback on keyboard shortcuts
 * Provides animation state and styling for shortcut key presses
 */
export const useShortcutFeedback = (): UseShortcutFeedbackReturn => {
  const [activeShortcutKey, setActiveShortcutKey] = React.useState<
    string | null
  >(null);
  const shortcutTimeoutRef = React.useRef<number | null>(null);

  // ショートカット操作時に一時的なアニメーションを付ける（視認性重視で少し長め）
  const triggerShortcutFeedback = React.useCallback((key: string) => {
    if (shortcutTimeoutRef.current !== null) {
      window.clearTimeout(shortcutTimeoutRef.current);
    }
    setActiveShortcutKey(key);
    shortcutTimeoutRef.current = window.setTimeout(() => {
      setActiveShortcutKey(null);
    }, 360);
  }, []);

  React.useEffect(() => {
    return () => {
      if (shortcutTimeoutRef.current !== null) {
        window.clearTimeout(shortcutTimeoutRef.current);
      }
    };
  }, []);

  const getShortcutPulseSx = React.useCallback((isActive: boolean) => {
    if (!isActive) return {};
    return {
      // ボタン色に埋もれやすいので、拡大＋影＋明るさで強調する
      animation: 'shortcutPulse 360ms ease-out',
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
  }, []);

  return {
    activeShortcutKey,
    triggerShortcutFeedback,
    getShortcutPulseSx,
  };
};
