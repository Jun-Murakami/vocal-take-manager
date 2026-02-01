/**
 * TakeColumnBody - Renders the body of a take column in Comping screen
 */

import React from 'react';
import CreateIcon from '@mui/icons-material/Create';
import { Box, Tooltip, Typography } from '@mui/material';

import { getMark } from '@/utils/markHelpers';

import type { Phrase, Song, Take } from '@/types/models';

interface PhrasesByLine {
  lineIndex: number;
  phrases: Phrase[];
}

interface TakeColumnBodyProps {
  take: Take;
  song: Song;
  phrasesByLine: PhrasesByLine[];
  phraseIndexById: Map<string, number>;
  currentPhrase: Phrase | undefined;
  selectedTakeId: string | null;
  isCollapsed: boolean;
  takeColumnWidth: number;
  rowHeightPx: number;
  rowGap: string;
  onPhraseClick: (phraseIndex: number) => void;
}

export const TakeColumnBody: React.FC<TakeColumnBodyProps> = ({
  take,
  song,
  phrasesByLine,
  phraseIndexById,
  currentPhrase,
  selectedTakeId,
  isCollapsed,
  takeColumnWidth,
  rowHeightPx,
  rowGap,
  onPhraseClick,
}) => {
  const getRehearsalMarksBeforeFirstLine = () => {
    const firstLinePhrases =
      phrasesByLine.length > 0 ? phrasesByLine[0].phrases : [];
    const minOrderInFirstLine =
      firstLinePhrases.length > 0
        ? Math.min(...firstLinePhrases.map((p) => p.order))
        : 0;
    return song.phrases.filter(
      (p) => p.isRehearsalMark && p.order < minOrderInFirstLine,
    );
  };

  const getRehearsalMarksForLine = (
    lineArrayIndex: number,
    phrases: Phrase[],
  ) => {
    const maxOrderInThisLine =
      phrases.length > 0 ? Math.max(...phrases.map((p) => p.order)) : -1;
    const nextLinePhrases =
      lineArrayIndex < phrasesByLine.length - 1
        ? phrasesByLine[lineArrayIndex + 1].phrases
        : [];
    const minOrderInNextLine =
      nextLinePhrases.length > 0
        ? Math.min(...nextLinePhrases.map((p) => p.order))
        : maxOrderInThisLine + 1000;
    return song.phrases.filter(
      (p) =>
        p.isRehearsalMark &&
        p.order > maxOrderInThisLine &&
        p.order < minOrderInNextLine,
    );
  };

  const renderEmptyRow = (key: string) => (
    <Box key={key} sx={{ mb: rowGap, height: rowHeightPx }} />
  );

  const renderCollapsedContent = () => (
    <>
      {getRehearsalMarksBeforeFirstLine().map((rm) => renderEmptyRow(rm.id))}
      {phrasesByLine.map(({ lineIndex, phrases }, lineArrayIndex) => (
        <React.Fragment key={lineIndex}>
          {renderEmptyRow(`line-${lineIndex}`)}
          {getRehearsalMarksForLine(lineArrayIndex, phrases).map((rm) =>
            renderEmptyRow(rm.id),
          )}
        </React.Fragment>
      ))}
    </>
  );

  const renderMarkCell = (
    phrase: Phrase,
    phraseIndex: number,
    totalPhrases: number,
  ) => {
    const mark = getMark(song, phrase.id, take.id);
    const isCurrent = currentPhrase?.id === phrase.id;
    const isSelectedTake = isCurrent && selectedTakeId === take.id;
    const phraseIndexValue = phraseIndexById.get(phrase.id);
    const isExtraDense = totalPhrases >= 10;

    return (
      <Box
        key={phrase.id}
        onClick={() =>
          phraseIndexValue !== undefined && onPhraseClick(phraseIndexValue)
        }
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          bgcolor: isCurrent ? 'action.focus' : 'transparent',
          '&:hover': { bgcolor: isCurrent ? 'action.focus' : 'action.hover' },
          borderRight: phraseIndex < totalPhrases - 1 ? '1px solid' : 'none',
          borderColor: isSelectedTake ? 'primary.main' : 'divider',
          border: isSelectedTake ? '2px solid' : undefined,
          minWidth: isExtraDense ? 14 : 18,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: isExtraDense ? 0.1 : 0.25,
            alignItems: 'center',
          }}
        >
          {mark?.markValue && (
            <Typography
              variant="caption"
              sx={{ fontSize: isExtraDense ? 9 : 12 }}
            >
              {mark.markValue}
            </Typography>
          )}
          {mark?.memo && (
            <Tooltip
              title={
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {mark.memo}
                </Typography>
              }
              arrow
              enterTouchDelay={0}
              leaveTouchDelay={3000}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CreateIcon
                  fontSize="small"
                  sx={{ fontSize: isExtraDense ? 12 : 14 }}
                />
              </Box>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  };

  const renderLineRow = (phrases: Phrase[]) => {
    const gap = phrases.length >= 10 ? 0.1 : phrases.length >= 7 ? 0.25 : 0.5;
    const padding =
      phrases.length >= 10 ? 0.1 : phrases.length >= 7 ? 0.25 : 0.5;

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap,
          mb: rowGap,
          height: rowHeightPx,
          border: 1,
          borderColor: 'divider',
          p: padding,
          boxSizing: 'border-box',
        }}
      >
        {phrases.map((phrase, idx) =>
          renderMarkCell(phrase, idx, phrases.length),
        )}
      </Box>
    );
  };

  const renderExpandedContent = () => (
    <>
      {getRehearsalMarksBeforeFirstLine().map((rm) => renderEmptyRow(rm.id))}
      {phrasesByLine.map(({ lineIndex, phrases }, lineArrayIndex) => {
        const isEmptyLine = phrases.every((p) => p.text.trim().length === 0);
        const rehearsalMarks = getRehearsalMarksForLine(
          lineArrayIndex,
          phrases,
        );

        if (isEmptyLine) {
          return (
            <React.Fragment key={lineIndex}>
              {renderEmptyRow(`line-${lineIndex}`)}
              {rehearsalMarks.map((rm) => renderEmptyRow(rm.id))}
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={lineIndex}>
            {renderLineRow(phrases)}
            {rehearsalMarks.map((rm) => renderEmptyRow(rm.id))}
          </React.Fragment>
        );
      })}
    </>
  );

  return (
    <Box
      sx={{
        width: isCollapsed ? 40 : takeColumnWidth,
        flexShrink: 0,
        borderRight: '1px solid',
        borderRightColor: 'divider',
        px: isCollapsed ? 0 : 2,
        py: 2,
      }}
    >
      {isCollapsed ? renderCollapsedContent() : renderExpandedContent()}
    </Box>
  );
};
