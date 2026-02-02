import { type RefObject, useMemo } from 'react';
import { Box } from '@mui/material';

import { CompingPhraseCell } from './CompingPhraseCell';

import {
  type InteractionMode,
  LyricsLine,
  LyricsScrollContainer,
  RehearsalMarkInsertBar,
  RehearsalMarkRow,
} from '@/components/lyrics';
import { ROW_GAP, ROW_HEIGHT_PX } from '@/constants/layout';

import type { SxProps, Theme } from '@mui/material/styles';
import type { Phrase, Song } from '@/types/models';

interface CompingLyricsAreaProps {
  song: Song;
  phrasesByLine: { lineIndex: number; phrases: Phrase[] }[];
  currentPhrase: Phrase | undefined;
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
  marksHorizontalScrollbarHeight: number;
  phraseIndexById: Map<string, number>;
  onPhraseClick: (phraseId: string) => void;
  onManualSplit: (phraseId: string, splitIndex: number) => void;
  onManualDeleteDivider: (leftPhraseId: string, rightPhraseId: string) => void;
  onCurrentPhraseIndexChange: (index: number) => void;
}

export function CompingLyricsArea({
  song,
  phrasesByLine,
  currentPhrase,
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
  marksHorizontalScrollbarHeight,
  phraseIndexById,
  onPhraseClick,
  onManualSplit,
  onManualDeleteDivider,
  onCurrentPhraseIndexChange,
}: CompingLyricsAreaProps) {
  const interactionMode: InteractionMode = useMemo(() => {
    if (isManualSplitMode) return { kind: 'manualSplit' };
    if (isManualDeleteMode) return { kind: 'manualDelete' };
    if (isLyricEditMode) return { kind: 'lyricEdit' };
    if (isRehearsalMarkMode) return { kind: 'rehearsalMark' };
    return { kind: 'none' };
  }, [
    isManualSplitMode,
    isManualDeleteMode,
    isLyricEditMode,
    isRehearsalMarkMode,
  ]);

  const scrollSx: SxProps<Theme> = {
    paddingBottom:
      marksHorizontalScrollbarHeight > 0
        ? `calc(16px + ${marksHorizontalScrollbarHeight}px)`
        : undefined,
    '@media print': {
      overflow: 'visible',
      p: 1,
      pb: 5,
    },
  };

  const lineContainerSx: SxProps<Theme> = {
    '@media print': {
      mb: '2px',
      height: 28,
      '&::after': {
        opacity: 0,
      },
    },
  };

  const rehearsalMarksBeforeFirstLine = useMemo(() => {
    const firstLinePhrases =
      phrasesByLine.length > 0 ? phrasesByLine[0].phrases : [];
    const minOrderInFirstLine =
      firstLinePhrases.length > 0
        ? Math.min(...firstLinePhrases.map((p) => p.order))
        : 0;
    return song.phrases.filter(
      (phrase) => phrase.isRehearsalMark && phrase.order < minOrderInFirstLine,
    );
  }, [phrasesByLine, song.phrases]);

  return (
    <LyricsScrollContainer
      scrollRef={scrollRef}
      onScroll={onScroll}
      interactionMode={interactionMode}
      sx={scrollSx}
    >
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

      {phrasesByLine.map((lineGroup, lineGroupIndex) => {
        const { lineIndex, phrases: linePhrases } = lineGroup;
        const isLocatorLine = linePhrases.some(
          (phrase) => phrase.id === currentPhrase?.id,
        );

        const rehearsalMarksAfterLine = song.phrases.filter((phrase) => {
          if (!phrase.isRehearsalMark) return false;
          const maxOrderInCurrentLine = Math.max(
            ...linePhrases.map((p) => p.order),
          );
          const nextLineIndex = lineGroupIndex + 1;
          if (nextLineIndex < phrasesByLine.length) {
            const nextLinePhrases = phrasesByLine[nextLineIndex].phrases;
            const minOrderInNextLine = Math.min(
              ...nextLinePhrases.map((p) => p.order),
            );
            return (
              phrase.order > maxOrderInCurrentLine &&
              phrase.order < minOrderInNextLine
            );
          }
          return phrase.order > maxOrderInCurrentLine;
        });

        return (
          <Box key={`line-${lineIndex}`}>
            <LyricsLine
              lineIndex={lineIndex}
              rowGap={ROW_GAP}
              rowHeightPx={ROW_HEIGHT_PX}
              isLocatorLine={isLocatorLine}
              sx={lineContainerSx}
            >
              {linePhrases.map((phrase, phraseIndex) => (
                <CompingPhraseCell
                  key={phrase.id}
                  phrase={phrase}
                  index={phraseIndex}
                  linePhrases={linePhrases}
                  currentPhrase={currentPhrase}
                  selectedTakeLabel={
                    song.comping.selectedTakeByPhraseId[phrase.id]
                      ? (song.takes.find(
                          (t) =>
                            t.id ===
                            song.comping.selectedTakeByPhraseId[phrase.id],
                        )?.label ?? null)
                      : null
                  }
                  selectedTakeColor={
                    song.comping.selectedTakeByPhraseId[phrase.id]
                      ? (song.takes.find(
                          (t) =>
                            t.id ===
                            song.comping.selectedTakeByPhraseId[phrase.id],
                        )?.color ?? null)
                      : null
                  }
                  isEditing={editingPhraseId === phrase.id}
                  editingText={editingText}
                  isManualSplitMode={isManualSplitMode}
                  isManualDeleteMode={isManualDeleteMode}
                  isLyricEditMode={isLyricEditMode}
                  isRehearsalMarkMode={isRehearsalMarkMode}
                  onEditingTextChange={onEditingTextChange}
                  onEditingPhraseIdChange={onEditingPhraseIdChange}
                  onPhraseClick={onPhraseClick}
                  onManualSplit={onManualSplit}
                  onManualDeleteDivider={onManualDeleteDivider}
                  onCurrentPhraseIndexChange={onCurrentPhraseIndexChange}
                  phraseIndexById={phraseIndexById}
                />
              ))}
            </LyricsLine>

            {isRehearsalMarkMode &&
              lineGroupIndex < phrasesByLine.length - 1 &&
              rehearsalMarksAfterLine.length === 0 &&
              !editingRehearsalMarkId && (
                <RehearsalMarkInsertBar
                  afterLineIndex={lineIndex}
                  onInsert={onInsertRehearsalMark}
                />
              )}

            {rehearsalMarksAfterLine.map((rehearsalMark) => (
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
          </Box>
        );
      })}
    </LyricsScrollContainer>
  );
}
