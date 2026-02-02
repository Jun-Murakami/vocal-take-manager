import { Fragment } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

import type { FC } from 'react';
import type { Phrase } from '@/types/models';

interface RecordingPhraseCellProps {
  phrase: Phrase;
  index: number;
  linePhrases: Phrase[];
  selectedPhraseId: string | null;
  isManualSplitMode: boolean;
  isManualDeleteMode: boolean;
  isLyricEditMode: boolean;
  isRehearsalMarkMode: boolean;
  isEditing: boolean;
  editingText: string;
  shouldHighlight: boolean;
  onPhraseClick: (phraseId: string) => void;
  onManualSplit: (phraseId: string, splitIndex: number) => void;
  onManualDeleteDivider: (leftPhraseId: string, rightPhraseId: string) => void;
  onEditingTextChange: (text: string) => void;
  onEditingCancel: () => void;
}

export const RecordingPhraseCell: FC<RecordingPhraseCellProps> = ({
  phrase,
  index,
  linePhrases,
  selectedPhraseId,
  isManualSplitMode,
  isManualDeleteMode,
  isLyricEditMode,
  isRehearsalMarkMode,
  isEditing,
  editingText,
  shouldHighlight,
  onPhraseClick,
  onManualSplit,
  onManualDeleteDivider,
  onEditingTextChange,
  onEditingCancel,
}) => {
  return (
    <Box
      key={phrase.id}
      onClick={() => {
        if (isLyricEditMode) {
          onPhraseClick(phrase.id);
        } else if (!isManualSplitMode && !isManualDeleteMode) {
          onPhraseClick(phrase.id);
        }
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        cursor:
          isManualSplitMode ||
          isManualDeleteMode ||
          isLyricEditMode ||
          isRehearsalMarkMode
            ? 'text'
            : 'pointer',
        position: 'relative',
        px: 1,
        py: 0.5,
        borderRight: index < linePhrases.length - 1 ? '1px solid' : 'none',
        borderRightColor: 'divider',
        bgcolor:
          selectedPhraseId === phrase.id
            ? shouldHighlight
              ? (theme) => alpha(theme.palette.primary.main, 0.4)
              : 'action.selected'
            : shouldHighlight
              ? (theme) => alpha(theme.palette.primary.main, 0.175)
              : 'transparent',
        '&:hover': {
          bgcolor:
            selectedPhraseId === phrase.id
              ? 'action.selected'
              : shouldHighlight
                ? (theme) => alpha(theme.palette.primary.main, 0.3)
                : 'action.hover',
        },
      }}
    >
      {selectedPhraseId === phrase.id && (
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            bgcolor: 'primary.main',
          }}
        />
      )}
      {isManualSplitMode ? (
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            cursor: 'text',
          }}
        >
          {Array.from(phrase.text).map((char, charIndex, arr) => (
            <Fragment key={`${phrase.id}-${charIndex}`}>
              <Typography component="span" variant="body1">
                {char}
              </Typography>
              {charIndex < arr.length - 1 && (
                <Box
                  component="span"
                  onClick={(event) => {
                    event.stopPropagation();
                    onManualSplit(phrase.id, charIndex + 1);
                  }}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    width: 8,
                    cursor: 'text',
                  }}
                >
                  <Box
                    sx={{
                      width: 1,
                      height: '1em',
                      bgcolor: 'primary.main',
                      opacity: 0.3,
                      '&:hover': {
                        opacity: 1,
                      },
                    }}
                  />
                </Box>
              )}
            </Fragment>
          ))}
        </Box>
      ) : isManualDeleteMode ? (
        <>
          <Typography variant="body1">{phrase.text}</Typography>
          {index < linePhrases.length - 1 && (
            <Box
              onClick={(event) => {
                event.stopPropagation();
                const nextPhrase = linePhrases[index + 1];
                if (!nextPhrase) return;
                onManualDeleteDivider(phrase.id, nextPhrase.id);
              }}
              sx={{
                position: 'absolute',
                right: -8,
                top: 0,
                bottom: 0,
                width: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: '60%',
                  bgcolor: 'error.main',
                  opacity: 0.6,
                  '&:hover': {
                    opacity: 1,
                  },
                }}
              />
            </Box>
          )}
        </>
      ) : isEditing ? (
        <TextField
          value={editingText}
          onChange={(e) => onEditingTextChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onEditingCancel();
            }
          }}
          variant="standard"
          size="small"
          autoFocus
          sx={{
            '& .MuiInputBase-input': {
              py: 0.5,
              fontSize: '1rem',
            },
          }}
        />
      ) : (
        <Typography variant="body1">{phrase.text}</Typography>
      )}
    </Box>
  );
};
