import { Box } from '@mui/material';

import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode, RefObject } from 'react';

export type InteractionMode =
  | { kind: 'none' }
  | { kind: 'manualSplit' }
  | { kind: 'manualDelete' }
  | { kind: 'lyricEdit' }
  | { kind: 'rehearsalMark' };

interface LyricsScrollContainerProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  interactionMode: InteractionMode;
  sx?: SxProps<Theme>;
  children: ReactNode;
}

export function LyricsScrollContainer({
  scrollRef,
  onScroll,
  interactionMode,
  sx,
  children,
}: LyricsScrollContainerProps) {
  const isEditMode = interactionMode.kind !== 'none';

  return (
    <Box
      ref={scrollRef}
      onScroll={onScroll}
      data-testid="lyrics-scroll-area"
      sx={{
        flex: 1,
        overflow: 'auto',
        p: 2,
        // 横スクロールバーの高さを確保して、MarksAreaと同じ高さ計算にする
        pb: '33px',
        zIndex: isEditMode ? 6 : 'auto',
        bgcolor: isEditMode ? 'background.paper' : 'transparent',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
