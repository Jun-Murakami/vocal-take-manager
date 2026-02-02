import { Box } from '@mui/material';

import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';

interface LyricsLineProps {
  lineIndex: number;
  rowGap: number | string;
  rowHeightPx: number;
  isLocatorLine: boolean;
  onLineRef?: (lineIndex: number, el: HTMLDivElement | null) => void;
  leadingContent?: ReactNode;
  trailingContent?: ReactNode;
  sx?: SxProps<Theme>;
  children: ReactNode;
}

export function LyricsLine({
  lineIndex,
  rowGap,
  rowHeightPx,
  isLocatorLine,
  onLineRef,
  leadingContent,
  trailingContent,
  sx,
  children,
}: LyricsLineProps) {
  return (
    <Box
      ref={(el: HTMLDivElement | null) => {
        if (onLineRef) {
          onLineRef(lineIndex, el);
        }
      }}
      sx={{
        display: 'flex',
        mb: rowGap,
        height: rowHeightPx,
        alignItems: 'stretch',
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          left: 0,
          right: (theme) => `calc(${theme.spacing(2)} * -1)`,
          bottom: 0,
          height: '1px',
          bgcolor: 'primary.main',
          opacity: isLocatorLine ? 1 : 0,
          pointerEvents: 'none',
        },
        boxSizing: 'border-box',
        ...sx,
      }}
    >
      {leadingContent}
      {children}
      {trailingContent}
    </Box>
  );
}
