import CreateIcon from '@mui/icons-material/Create';
import { Box, Button, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { getMark } from '@/utils/markHelpers';
import { getTakeHeaderColor } from '@/utils/takeHelpers';

import type { SxProps, Theme } from '@mui/material/styles';
import type { FC } from 'react';
import type { Song } from '@/types/models';

interface TakeSelectionPanelProps {
  song: Song;
  currentPhraseIndex: number;
  selectedTakeId: string | null;
  activeShortcutKey: string | null;
  onSelectTake: (takeId: string) => void;
  getShortcutPulseSx: (isActive: boolean) => SxProps<Theme>;
}

export const TakeSelectionPanel: FC<TakeSelectionPanelProps> = ({
  song,
  currentPhraseIndex,
  selectedTakeId,
  activeShortcutKey,
  onSelectTake,
  getShortcutPulseSx,
}) => {
  const theme = useTheme();
  const currentPhrase = song.phrases[currentPhraseIndex];

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarGutter: 'stable',
      }}
    >
      {song.takes.map((take) => {
        const mark = currentPhrase
          ? getMark(song, currentPhrase.id, take.id)
          : null;
        const isSelected = selectedTakeId === take.id;

        return (
          <Button
            key={take.id}
            variant={isSelected ? 'contained' : 'outlined'}
            onClick={() => onSelectTake(take.id)}
            sx={{
              minWidth: 48,
              height: 48,
              color: isSelected ? 'primary.main' : 'text.primary',
              bgcolor: getTakeHeaderColor(take.color, theme.palette.mode),
              border: isSelected ? 2 : 1,
              borderColor: isSelected ? 'primary.main' : 'divider',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
              alignItems: 'center',
              justifyContent: 'center',
              pt: 0.5,
              overflow: 'hidden',
              contain: 'paint',
              transformOrigin: 'center',
              ...getShortcutPulseSx(activeShortcutKey === `take-${take.order}`),
            }}
          >
            <Typography variant="caption" fontWeight="bold">
              {take.label}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                gap: 0.25,
                alignItems: 'center',
                minHeight: 16,
              }}
            >
              {mark?.markValue && (
                <Typography variant="caption">{mark.markValue}</Typography>
              )}
              {mark?.memo && <CreateIcon fontSize="small" />}
            </Box>
          </Button>
        );
      })}
    </Box>
  );
};
