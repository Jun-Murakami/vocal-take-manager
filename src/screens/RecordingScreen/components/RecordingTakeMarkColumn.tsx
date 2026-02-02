import { Fragment } from 'react';
import CreateIcon from '@mui/icons-material/Create';
import { Box, Tooltip, Typography } from '@mui/material';

import { ROW_GAP, ROW_HEIGHT_PX, TAKE_COLUMN_WIDTH } from '@/constants/layout';
import { getMark } from '@/utils/markHelpers';

import type { FC } from 'react';
import type { Phrase, Song, Take } from '@/types/models';

interface PhrasesByLine {
  lineIndex: number;
  phrases: Phrase[];
}

interface RecordingTakeMarkColumnProps {
  take: Take;
  takeIndex: number;
  song: Song;
  phrasesByLine: PhrasesByLine[];
  selectedPhraseId: string | null;
  selectedTakeId: string | null;
  collapsedTakeIds: Set<string>;
  onSelectPhrase: (phraseId: string) => void;
  onSelectTake: (takeId: string) => void;
  onLineRef: (lineIndex: number, el: HTMLDivElement | null) => void;
}

export const RecordingTakeMarkColumn: FC<RecordingTakeMarkColumnProps> = ({
  take,
  takeIndex,
  song,
  phrasesByLine,
  selectedPhraseId,
  selectedTakeId,
  collapsedTakeIds,
  onSelectPhrase,
  onSelectTake,
  onLineRef,
}) => {
  const isCollapsed = collapsedTakeIds.has(take.id);

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

            const isLocatorLine = phrases.some(
              (phrase) => phrase.id === selectedPhraseId,
            );

            return (
              <Fragment key={lineIndex}>
                <Box
                  ref={(el: HTMLDivElement | null) => {
                    if (takeIndex === 0) {
                      onLineRef(lineIndex, el);
                    }
                  }}
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
                    borderBottomColor:
                      isLocatorLine && selectedTakeId === take.id
                        ? 'primary.main'
                        : 'divider',
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
                    const isSelected =
                      selectedPhraseId === phrase.id &&
                      selectedTakeId === take.id;
                    const isExtraDenseLayout = phrases.length >= 10;
                    return (
                      <Box
                        key={phrase.id}
                        onClick={() => {
                          onSelectPhrase(phrase.id);
                          onSelectTake(take.id);
                        }}
                        sx={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          bgcolor: isSelected ? 'action.focus' : 'transparent',
                          '&:hover': {
                            bgcolor: isSelected
                              ? 'action.focus'
                              : 'action.hover',
                          },
                          borderRight:
                            phraseIndex < phrases.length - 1
                              ? '1px solid'
                              : 'none',
                          borderColor: 'divider',
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
};
