import { Fragment, memo } from 'react';
import { Box, TextField, Typography, useTheme } from '@mui/material';

import { getTakeHeaderColor } from '@/utils/takeHelpers';

import type { FC } from 'react';
import type { Phrase } from '@/types/models';

interface CompingPhraseCellProps {
  phrase: Phrase;
  index: number;
  linePhrases: Phrase[];
  currentPhrase: Phrase | undefined;
  selectedTakeLabel: string | null;
  selectedTakeColor: string | null;
  isEditing: boolean;
  editingText: string;
  isManualSplitMode: boolean;
  isManualDeleteMode: boolean;
  isLyricEditMode: boolean;
  isRehearsalMarkMode: boolean;
  onEditingTextChange: (text: string) => void;
  onEditingPhraseIdChange: (id: string | null) => void;
  onPhraseClick: (phraseId: string) => void;
  onManualSplit: (phraseId: string, splitIndex: number) => void;
  onManualDeleteDivider: (leftPhraseId: string, rightPhraseId: string) => void;
  onCurrentPhraseIndexChange: (index: number) => void;
  phraseIndexById: Map<string, number>;
}

export const CompingPhraseCell: FC<CompingPhraseCellProps> = memo(
  ({
    phrase,
    index,
    linePhrases,
    currentPhrase,
    selectedTakeLabel,
    selectedTakeColor,
    isEditing,
    editingText,
    isManualSplitMode,
    isManualDeleteMode,
    isLyricEditMode,
    isRehearsalMarkMode,
    onEditingTextChange,
    onEditingPhraseIdChange,
    onPhraseClick,
    onManualSplit,
    onManualDeleteDivider,
    onCurrentPhraseIndexChange,
    phraseIndexById,
  }) => {
    const theme = useTheme();
    const phraseIndex = phraseIndexById.get(phrase.id);
    const isCurrent = currentPhrase && currentPhrase.id === phrase.id;

    return (
      <Box
        key={phrase.id}
        onClick={() => {
          if (isLyricEditMode) {
            onPhraseClick(phrase.id);
          } else if (
            !isManualSplitMode &&
            !isManualDeleteMode &&
            phraseIndex !== undefined
          ) {
            onCurrentPhraseIndexChange(phraseIndex);
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
          bgcolor: isCurrent ? 'action.selected' : 'transparent',
          '&:hover': {
            bgcolor: isCurrent ? 'action.selected' : 'action.hover',
          },
          '@media print': {
            cursor: 'default',
            bgcolor: 'transparent',
            '&:hover': {
              bgcolor: 'transparent',
            },
          },
        }}
      >
        {isCurrent && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              bgcolor: 'primary.main',
              '@media print': {
                display: 'none',
              },
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
                onEditingPhraseIdChange(null);
                onEditingTextChange('');
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
        {selectedTakeLabel && (
          <Box
            sx={{
              ml: 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Box
              sx={{
                width: 16,
                height: 16,
                borderRadius: 0.5,
                bgcolor: selectedTakeColor
                  ? getTakeHeaderColor(selectedTakeColor, theme.palette.mode)
                  : 'action.hover',
                '@media print': {
                  bgcolor: selectedTakeColor || 'action.hover',
                },
                border: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              <Typography variant="caption">{selectedTakeLabel}</Typography>
            </Box>
          </Box>
        )}
      </Box>
    );
  },
);

CompingPhraseCell.displayName = 'CompingPhraseCell';
