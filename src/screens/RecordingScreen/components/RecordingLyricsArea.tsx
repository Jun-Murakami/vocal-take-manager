import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton } from '@mui/material';

import { RecordingPhraseCell } from './RecordingPhraseCell';

import {
  type InteractionMode,
  LyricsLine,
  LyricsScrollContainer,
  RehearsalMarkInsertBar,
  RehearsalMarkRow,
} from '@/components/lyrics';
import { ROW_GAP, ROW_HEIGHT_PX } from '@/constants/layout';

import type { SxProps, Theme } from '@mui/material/styles';
import type { RefObject } from 'react';
import type { Phrase, Song } from '@/types/models';

interface RecordingLyricsAreaProps {
  song: Song;
  phrasesByLine: { lineIndex: number; phrases: Phrase[] }[];
  selectedPhraseId: string | null;
  isManualSplitMode: boolean;
  isManualDeleteMode: boolean;
  isLyricEditMode: boolean;
  isRehearsalMarkMode: boolean;
  editingPhraseId: string | null;
  editingText: string;
  onEditingTextChange: (text: string) => void;
  onEditingPhraseIdChange: (id: string | null) => void;
  editingRehearsalMarkId: string | null;
  editingRehearsalMarkText: string;
  onChangeRehearsalMarkText: (text: string) => void;
  onInsertRehearsalMark: (afterLineIndex: number) => void;
  onRehearsalMarkClick: (phraseId: string) => void;
  onRehearsalMarkSave: () => void;
  onDeleteRehearsalMark: (phraseId: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  onLineRef: (lineIndex: number, el: HTMLDivElement | null) => void;
  scrollSx?: SxProps<Theme>;
  isPhraseHighlighted: (phraseId: string) => boolean;
  onPhraseClick: (phraseId: string) => void;
  onManualSplit: (phraseId: string, splitIndex: number) => void;
  onManualDeleteDivider: (leftPhraseId: string, rightPhraseId: string) => void;
  onPhraseClickForEdit: (phraseId: string) => void;
  onDeleteLyricsLine: (lineIndex: number) => void;
}

export function RecordingLyricsArea({
  song,
  phrasesByLine,
  selectedPhraseId,
  isManualSplitMode,
  isManualDeleteMode,
  isLyricEditMode,
  isRehearsalMarkMode,
  editingPhraseId,
  editingText,
  onEditingTextChange,
  onEditingPhraseIdChange,
  editingRehearsalMarkId,
  editingRehearsalMarkText,
  onChangeRehearsalMarkText,
  onInsertRehearsalMark,
  onRehearsalMarkClick,
  onRehearsalMarkSave,
  onDeleteRehearsalMark,
  scrollRef,
  onScroll,
  onLineRef,
  scrollSx,
  isPhraseHighlighted,
  onPhraseClick,
  onManualSplit,
  onManualDeleteDivider,
  onPhraseClickForEdit,
  onDeleteLyricsLine,
}: RecordingLyricsAreaProps) {
  const interactionMode: InteractionMode = isManualSplitMode
    ? { kind: 'manualSplit' }
    : isManualDeleteMode
      ? { kind: 'manualDelete' }
      : isLyricEditMode
        ? { kind: 'lyricEdit' }
        : isRehearsalMarkMode
          ? { kind: 'rehearsalMark' }
          : { kind: 'none' };

  const getRehearsalMarksBeforeFirstLine = () => {
    const firstLinePhrases =
      phrasesByLine.length > 0 ? phrasesByLine[0].phrases : [];
    const minOrderInFirstLine =
      firstLinePhrases.length > 0
        ? Math.min(...firstLinePhrases.map((p) => p.order))
        : 0;
    return song.phrases.filter(
      (phrase) => phrase.isRehearsalMark && phrase.order < minOrderInFirstLine,
    );
  };

  const getRehearsalMarksBetweenLines = (
    lineArrayIndex: number,
    linePhrases: Phrase[],
  ) => {
    const maxOrderInThisLine =
      linePhrases.length > 0
        ? Math.max(...linePhrases.map((phrase) => phrase.order))
        : -1;
    const nextLinePhrases =
      lineArrayIndex < phrasesByLine.length - 1
        ? phrasesByLine[lineArrayIndex + 1].phrases
        : [];
    const minOrderInNextLine =
      nextLinePhrases.length > 0
        ? Math.min(...nextLinePhrases.map((phrase) => phrase.order))
        : maxOrderInThisLine + 1000;

    return song.phrases.filter(
      (phrase) =>
        phrase.isRehearsalMark &&
        phrase.order > maxOrderInThisLine &&
        phrase.order < minOrderInNextLine,
    );
  };

  const rehearsalMarksBeforeFirstLine = getRehearsalMarksBeforeFirstLine();

  return (
    <LyricsScrollContainer
      scrollRef={scrollRef}
      onScroll={onScroll}
      interactionMode={interactionMode}
      sx={scrollSx}
    >
      {/* Rehearsal marks before first line */}
      {(() => {
        return (
          <>
            {isRehearsalMarkMode &&
              phrasesByLine.length > 0 &&
              rehearsalMarksBeforeFirstLine.length === 0 &&
              !editingRehearsalMarkId && (
                <RehearsalMarkInsertBar
                  afterLineIndex={-1}
                  onInsert={onInsertRehearsalMark}
                />
              )}
            {rehearsalMarksBeforeFirstLine.map((rehearsalMark) => (
              <RehearsalMarkRow
                key={rehearsalMark.id}
                rehearsalMark={rehearsalMark}
                rowGap={ROW_GAP}
                rowHeightPx={ROW_HEIGHT_PX}
                isEditing={editingRehearsalMarkId === rehearsalMark.id}
                isEditModeEnabled={isRehearsalMarkMode}
                editingText={editingRehearsalMarkText}
                onEditingTextChange={onChangeRehearsalMarkText}
                onSave={onRehearsalMarkSave}
                onClick={onRehearsalMarkClick}
                onDelete={onDeleteRehearsalMark}
              />
            ))}
          </>
        );
      })()}

      {/* Lines with phrases and between-line rehearsal marks */}
      {phrasesByLine.map(
        ({ lineIndex, phrases: linePhrases }, lineArrayIndex) => {
          const isLocatorLine = linePhrases.some(
            (phrase) => phrase.id === selectedPhraseId,
          );
          const rehearsalMarksBetweenLines = getRehearsalMarksBetweenLines(
            lineArrayIndex,
            linePhrases,
          );

          return (
            <Box key={lineIndex}>
              <LyricsLine
                lineIndex={lineIndex}
                rowGap={ROW_GAP}
                rowHeightPx={ROW_HEIGHT_PX}
                isLocatorLine={isLocatorLine}
                onLineRef={onLineRef}
                leadingContent={
                  isLyricEditMode ? (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton
                        size="small"
                        aria-label="行を削除"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteLyricsLine(lineIndex);
                        }}
                        sx={{ color: 'text.secondary' }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : null
                }
              >
                {linePhrases.length === 0 ? (
                  <Box sx={{ flex: 1 }} />
                ) : (
                  linePhrases.map((phrase, index) => (
                    <RecordingPhraseCell
                      key={phrase.id}
                      phrase={phrase}
                      index={index}
                      linePhrases={linePhrases}
                      selectedPhraseId={selectedPhraseId}
                      isManualSplitMode={isManualSplitMode}
                      isManualDeleteMode={isManualDeleteMode}
                      isLyricEditMode={isLyricEditMode}
                      isRehearsalMarkMode={isRehearsalMarkMode}
                      isEditing={editingPhraseId === phrase.id}
                      editingText={editingText}
                      shouldHighlight={isPhraseHighlighted(phrase.id)}
                      onPhraseClick={(phraseId) => {
                        if (isLyricEditMode) {
                          onPhraseClickForEdit(phraseId);
                        } else if (!isManualSplitMode && !isManualDeleteMode) {
                          onPhraseClick(phraseId);
                        }
                      }}
                      onManualSplit={onManualSplit}
                      onManualDeleteDivider={onManualDeleteDivider}
                      onEditingTextChange={onEditingTextChange}
                      onEditingCancel={() => {
                        onEditingPhraseIdChange(null);
                        onEditingTextChange('');
                      }}
                    />
                  ))
                )}
              </LyricsLine>

              {/* Rehearsal marks between this line and next */}
              {(() => {
                return (
                  <>
                    {isRehearsalMarkMode &&
                      lineArrayIndex < phrasesByLine.length - 1 &&
                      rehearsalMarksBetweenLines.length === 0 &&
                      !editingRehearsalMarkId && (
                        <RehearsalMarkInsertBar
                          afterLineIndex={lineIndex}
                          onInsert={onInsertRehearsalMark}
                        />
                      )}
                    {rehearsalMarksBetweenLines.map((rehearsalMark) => (
                      <RehearsalMarkRow
                        key={rehearsalMark.id}
                        rehearsalMark={rehearsalMark}
                        rowGap={ROW_GAP}
                        rowHeightPx={ROW_HEIGHT_PX}
                        isEditing={editingRehearsalMarkId === rehearsalMark.id}
                        isEditModeEnabled={isRehearsalMarkMode}
                        editingText={editingRehearsalMarkText}
                        onEditingTextChange={onChangeRehearsalMarkText}
                        onSave={onRehearsalMarkSave}
                        onClick={onRehearsalMarkClick}
                        onDelete={onDeleteRehearsalMark}
                      />
                    ))}
                  </>
                );
              })()}
            </Box>
          );
        },
      )}
    </LyricsScrollContainer>
  );
}
