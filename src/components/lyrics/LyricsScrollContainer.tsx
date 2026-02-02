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
      sx={{
        flex: 1,
        overflow: 'auto',
        p: 2,
        zIndex: isEditMode ? 6 : 'auto',
        bgcolor: isEditMode ? 'background.paper' : 'transparent',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
