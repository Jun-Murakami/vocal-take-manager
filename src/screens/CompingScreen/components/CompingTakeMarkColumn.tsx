import { Fragment, memo } from 'react';
import CreateIcon from '@mui/icons-material/Create';
import { Box, Tooltip, Typography } from '@mui/material';

import { ROW_GAP, ROW_HEIGHT_PX, TAKE_COLUMN_WIDTH } from '@/constants/layout';
import { getMark } from '@/utils/markHelpers';

import type { FC } from 'react';
import type { Phrase, Song, Take } from '@/types/models';

interface CompingTakeMarkColumnProps {
  take: Take;
  isCollapsed: boolean;
  song: Song;
  phrasesByLine: { lineIndex: number; phrases: Phrase[] }[];
  currentPhrase: Phrase | undefined;
  selectedTakeId: string | null;
  phraseIndexById: Map<string, number>;
  onPhraseClick: (phraseIndex: number) => void;
}

export const CompingTakeMarkColumn: FC<CompingTakeMarkColumnProps> = memo(
  ({
    take,
    isCollapsed,
    song,
    phrasesByLine,
    currentPhrase,
    selectedTakeId,
    phraseIndexById,
    onPhraseClick,
  }) => {
    return (
      <Box
        key={take.id}
        sx={{
          width: isCollapsed ? 40 : TAKE_COLUMN_WIDTH,
          flexShrink: 0,
          borderRight: '1px solid',
          borderRightColor: 'divider',
          px: isCollapsed ? 0 : 2,
          py: 2,
        }}
      >
        {isCollapsed ? (
          <>
            {(() => {
              const firstLinePhrases =
                phrasesByLine.length > 0 ? phrasesByLine[0].phrases : [];
              const minOrderInFirstLine =
                firstLinePhrases.length > 0
                  ? Math.min(...firstLinePhrases.map((p) => p.order))
                  : 0;
              const rehearsalMarksBeforeFirstLine = song.phrases.filter(
                (p) => p.isRehearsalMark && p.order < minOrderInFirstLine,
              );
              return rehearsalMarksBeforeFirstLine.map((rehearsalMark) => (
                <Box
                  key={rehearsalMark.id}
                  sx={{
                    mb: ROW_GAP,
                    height: ROW_HEIGHT_PX,
                  }}
                />
              ));
            })()}
            {phrasesByLine.map(({ lineIndex, phrases }, lineArrayIndex) => {
              const maxOrderInThisLine =
                phrases.length > 0
                  ? Math.max(...phrases.map((p) => p.order))
                  : -1;
              const nextLinePhrases =
                lineArrayIndex < phrasesByLine.length - 1
                  ? phrasesByLine[lineArrayIndex + 1].phrases
                  : [];
              const minOrderInNextLine =
                nextLinePhrases.length > 0
                  ? Math.min(...nextLinePhrases.map((p) => p.order))
                  : maxOrderInThisLine + 1000;
              const rehearsalMarksForThisLine = song.phrases.filter(
                (p) =>
                  p.isRehearsalMark &&
                  p.order > maxOrderInThisLine &&
                  p.order < minOrderInNextLine,
              );

              return (
                <Fragment key={lineIndex}>
                  <Box
                    sx={{
                      mb: ROW_GAP,
                      height: ROW_HEIGHT_PX,
                    }}
                  />
                  {rehearsalMarksForThisLine.map((rehearsalMark) => (
                    <Box
                      key={rehearsalMark.id}
                      sx={{
                        mb: ROW_GAP,
                        height: ROW_HEIGHT_PX,
                      }}
                    />
                  ))}
                </Fragment>
              );
            })}
          </>
        ) : (
          <>
            {(() => {
              const firstLinePhrases =
                phrasesByLine.length > 0 ? phrasesByLine[0].phrases : [];
              const minOrderInFirstLine =
                firstLinePhrases.length > 0
                  ? Math.min(...firstLinePhrases.map((p) => p.order))
                  : 0;
              const rehearsalMarksBeforeFirstLine = song.phrases.filter(
                (p) => p.isRehearsalMark && p.order < minOrderInFirstLine,
              );
              return rehearsalMarksBeforeFirstLine.map((rehearsalMark) => (
                <Box
                  key={rehearsalMark.id}
                  sx={{
                    mb: ROW_GAP,
                    height: ROW_HEIGHT_PX,
                  }}
                />
              ));
            })()}
            {phrasesByLine.map(({ lineIndex, phrases }, lineArrayIndex) => {
              const maxOrderInThisLine =
                phrases.length > 0
                  ? Math.max(...phrases.map((p) => p.order))
                  : -1;
              const nextLinePhrases =
                lineArrayIndex < phrasesByLine.length - 1
                  ? phrasesByLine[lineArrayIndex + 1].phrases
                  : [];
              const minOrderInNextLine =
                nextLinePhrases.length > 0
                  ? Math.min(...nextLinePhrases.map((p) => p.order))
                  : maxOrderInThisLine + 1000;

              const rehearsalMarksForThisLine = song.phrases.filter(
                (p) =>
                  p.isRehearsalMark &&
                  p.order > maxOrderInThisLine &&
                  p.order < minOrderInNextLine,
              );
              const isEmptyLine = phrases.every(
                (phrase) => phrase.text.trim().length === 0,
              );

              if (isEmptyLine) {
                return (
                  <Fragment key={lineIndex}>
                    <Box
                      sx={{
                        mb: ROW_GAP,
                        height: ROW_HEIGHT_PX,
                      }}
                    />
                    {rehearsalMarksForThisLine.map((rehearsalMark) => (
                      <Box
                        key={rehearsalMark.id}
                        sx={{
                          mb: ROW_GAP,
                          height: ROW_HEIGHT_PX,
                        }}
                      />
                    ))}
                  </Fragment>
                );
              }

              return (
                <Fragment key={lineIndex}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap:
                        phrases.length >= 10
                          ? 0.1
                          : phrases.length >= 7
                            ? 0.25
                            : 0.5,
                      mb: ROW_GAP,
                      height: ROW_HEIGHT_PX,
                      border: 1,
                      borderColor: 'divider',
                      p:
                        phrases.length >= 10
                          ? 0.1
                          : phrases.length >= 7
                            ? 0.25
                            : 0.5,
                      boxSizing: 'border-box',
                    }}
                  >
                    {phrases.map((phrase, phraseIndex) => {
                      const mark = getMark(song, phrase.id, take.id);
                      const isCurrent =
                        currentPhrase && currentPhrase.id === phrase.id;
                      const isSelectedTake =
                        isCurrent && selectedTakeId === take.id;
                      const phraseIndexValue = phraseIndexById.get(phrase.id);
                      const isExtraDenseLayout = phrases.length >= 10;

                      return (
                        <Box
                          key={phrase.id}
                          onClick={() => {
                            if (phraseIndexValue !== undefined) {
                              onPhraseClick(phraseIndexValue);
                            }
                          }}
                          sx={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            bgcolor: isCurrent ? 'action.focus' : 'transparent',
                            '&:hover': {
                              bgcolor: isCurrent
                                ? 'action.focus'
                                : 'action.hover',
                            },
                            borderRight:
                              phraseIndex < phrases.length - 1
                                ? '1px solid'
                                : 'none',
                            borderColor: isSelectedTake
                              ? 'primary.main'
                              : 'divider',
                            border: isSelectedTake ? '2px solid' : undefined,
                            minWidth: isExtraDenseLayout ? 14 : 18,
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              gap: isExtraDenseLayout ? 0.1 : 0.25,
                              alignItems: 'center',
                            }}
                          >
                            {mark?.markValue && (
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: isExtraDenseLayout ? 9 : 12,
                                }}
                              >
                                {mark.markValue}
                              </Typography>
                            )}
                            {mark?.memo && (
                              <Tooltip
                                title={
                                  <Typography
                                    variant="body2"
                                    sx={{ whiteSpace: 'pre-line' }}
                                  >
                                    {mark.memo}
                                  </Typography>
                                }
                                arrow
                                enterTouchDelay={0}
                                leaveTouchDelay={3000}
                              >
                                <Box
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                >
                                  <CreateIcon
                                    fontSize="small"
                                    sx={{
                                      fontSize: isExtraDenseLayout ? 12 : 14,
                                    }}
                                  />
                                </Box>
                              </Tooltip>
                            )}
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                  {rehearsalMarksForThisLine.map((rehearsalMark) => (
                    <Box
                      key={rehearsalMark.id}
                      sx={{
                        mb: ROW_GAP,
                        height: ROW_HEIGHT_PX,
                      }}
                    />
                  ))}
                </Fragment>
              );
            })}
          </>
        )}
      </Box>
    );
  },
);

CompingTakeMarkColumn.displayName = 'CompingTakeMarkColumn';
