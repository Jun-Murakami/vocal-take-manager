import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import {
  CompingLyricsArea,
  CompingTakeHeader,
  CompingTakeMarkColumn,
  TakeSelectionPanel,
} from './components';
import { useCompingKeyboard } from './hooks/useCompingKeyboard';
import { useCompingSelection } from './hooks/useCompingSelection';

import { BottomPanel, DeleteAndNavControls } from '@/components/BottomPanel';
import { EditableField } from '@/components/EditableField';
import { LyricEditModeControls } from '@/components/LyricEditModeControls';
import { MarksArea } from '@/components/MarksArea';
import { CONTROL_COLUMN_WIDTH, TAKE_COLUMN_WIDTH } from '@/constants/layout';
import { getSongById, saveSong } from '@/db/database';
import {
  useDocumentTitle,
  useMarksViewportWidth,
  useShortcutFeedback,
  useSynchronizedScroll,
  useTakeCollapse,
} from '@/hooks';
import { showDialog } from '@/stores/dialogStore';
import { exportVtmFile } from '@/utils/fileExport';
import {
  insertRehearsalMarkAfterLine,
  mergePhraseAtDivider,
  splitPhraseByChar,
} from '@/utils/songHelpers';

import type { FC } from 'react';
import type { Phrase, Song, VtmExport } from '@/types/models';
import type { Screen } from '@/types/routing';

interface CompingScreenProps {
  songId: string;
  onNavigate: (screen: Screen) => void;
}

export const CompingScreen: FC<CompingScreenProps> = ({
  songId,
  onNavigate,
}) => {
  const [song, setSong] = useState<Song | null>(null);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [freeMemo, setFreeMemo] = useState('');

  const [isManualSplitMode, setIsManualSplitMode] = useState(false);
  const [isManualDeleteMode, setIsManualDeleteMode] = useState(false);
  const [isLyricEditMode, setIsLyricEditMode] = useState(false);
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingRehearsalMarkId, setEditingRehearsalMarkId] = useState<
    string | null
  >(null);
  const [editingRehearsalMarkText, setEditingRehearsalMarkText] = useState('');
  const [isRehearsalMarkMode, setIsRehearsalMarkMode] = useState(false);

  const [takeMemos, setTakeMemos] = useState<Record<string, string>>({});

  const { activeShortcutKey, triggerShortcutFeedback, getShortcutPulseSx } =
    useShortcutFeedback();
  const { collapsedTakeIds, toggleTakeCollapse } = useTakeCollapse({
    takes: song?.takes,
  });
  const {
    primaryScrollRef: lyricsScrollRef,
    secondaryScrollRef: marksScrollRef,
    handlePrimaryScroll: handleLyricsScroll,
    handleSecondaryScroll: handleMarksScroll,
  } = useSynchronizedScroll();
  const { marksViewportWidth, marksHorizontalScrollbarHeight } =
    useMarksViewportWidth({
      marksScrollRef,
      takeCount: song?.takes.length ?? 0,
      collapsedCount: collapsedTakeIds.size,
      isLoaded: !!song,
    });
  useDocumentTitle(song?.title);

  const handleSaveSong = async (updatedSong: Song) => {
    setSong(updatedSong);
    await saveSong(updatedSong);
  };

  const {
    handleSelectTake,
    handleClearSelectedTake,
    handlePrevPhrase,
    handleNextPhrase,
    selectedTakeId,
    nextPhraseText,
  } = useCompingSelection({
    song,
    currentPhraseIndex,
    setCurrentPhraseIndex,
    onSaveSong: handleSaveSong,
  });

  const currentPhrase = song?.phrases[currentPhraseIndex];

  useEffect(() => {
    const loadSong = async () => {
      const loadedSong = await getSongById(songId);
      if (loadedSong) {
        setSong(loadedSong);
        const initialIndex = loadedSong.comping.currentPhraseIndex;
        const initialPhrase = loadedSong.phrases[initialIndex];
        const isSelectable = (phrase: Phrase | undefined) => {
          if (!phrase) {
            return false;
          }
          return phrase.text.trim().length > 0 && !phrase.isRehearsalMark;
        };

        if (isSelectable(initialPhrase)) {
          setCurrentPhraseIndex(initialIndex);
        } else {
          const fallbackIndex = loadedSong.phrases.findIndex((phrase) =>
            isSelectable(phrase),
          );
          setCurrentPhraseIndex(fallbackIndex >= 0 ? fallbackIndex : 0);
        }
        setFreeMemo(loadedSong.freeMemo);
      }
    };
    loadSong();
  }, [songId]);

  useEffect(() => {
    if (!song) return;
    const memos: Record<string, string> = {};
    for (const take of song.takes) {
      memos[take.id] = take.memo ?? '';
    }
    setTakeMemos(memos);
  }, [song]);

  const handleTakeMemoChange = (takeId: string, value: string) => {
    setTakeMemos((prev) => ({ ...prev, [takeId]: value }));
  };

  const handleTakeMemoBlur = async (takeId: string) => {
    if (!song) return;
    const memoValue = takeMemos[takeId] ?? '';
    const updatedTakes = song.takes.map((t) =>
      t.id === takeId ? { ...t, memo: memoValue } : t,
    );
    const updatedSong = { ...song, takes: updatedTakes, updatedAt: Date.now() };
    await handleSaveSong(updatedSong);
  };

  const handleManualSplit = (phraseId: string, splitIndex: number) => {
    if (!song) return;
    const updatedSong = splitPhraseByChar(song, phraseId, splitIndex);
    if (updatedSong !== song) {
      handleSaveSong(updatedSong);
      const phraseIndex = song.phrases.findIndex(
        (phrase) => phrase.id === phraseId,
      );
      if (phraseIndex >= 0) {
        setCurrentPhraseIndex(phraseIndex);
      }
    }
  };

  const handleManualDeleteDivider = async (
    leftPhraseId: string,
    rightPhraseId: string,
  ) => {
    if (!song) return;
    const rightHasMarks = song.marks.some(
      (mark) =>
        mark.phraseId === rightPhraseId &&
        (Boolean(mark.markValue) || Boolean(mark.memo)),
    );
    const rightHasSelection = Boolean(
      song.comping.selectedTakeByPhraseId[rightPhraseId],
    );
    if (rightHasMarks || rightHasSelection) {
      const result = await showDialog({
        title: 'データ消失確認',
        content:
          'この分割線を削除すると、入力されたデータの一部が失われます。実行しますか？',
        primaryButton: {
          text: '削除',
          color: 'error',
          variant: 'contained',
        },
        secondaryButton: {
          text: 'キャンセル',
          color: 'inherit',
          variant: 'outlined',
        },
      });
      if (result !== '削除') return;
    }

    const mergeResult = mergePhraseAtDivider(song, leftPhraseId, rightPhraseId);
    if (!mergeResult) return;
    handleSaveSong(mergeResult.song);
    const mergedIndex = mergeResult.song.phrases.findIndex(
      (phrase) => phrase.id === mergeResult.mergedPhraseId,
    );
    if (mergedIndex >= 0) {
      setCurrentPhraseIndex(mergedIndex);
    }
  };

  const handleTitleSave = (newTitle: string) => {
    if (!song) return;
    const updatedSong: Song = {
      ...song,
      title: newTitle,
      updatedAt: Date.now(),
    };
    void handleSaveSong(updatedSong);
    document.title = `${newTitle} - Vocal Take Manager`;
  };

  const handleCreditsSave = (newCredits: string) => {
    if (!song) return;
    const updatedSong: Song = {
      ...song,
      credits: newCredits,
      updatedAt: Date.now(),
    };
    void handleSaveSong(updatedSong);
  };

  const handleToggleRehearsalMarkMode = () => {
    setIsRehearsalMarkMode((prev) => {
      if (prev) {
        setEditingRehearsalMarkId(null);
        setEditingRehearsalMarkText('');
      }
      return !prev;
    });
    setIsManualSplitMode(false);
    setIsManualDeleteMode(false);
    setIsLyricEditMode(false);
  };

  const handleInsertRehearsalMark = async (afterLineIndex: number) => {
    if (!song || !isRehearsalMarkMode) return;
    const result = insertRehearsalMarkAfterLine(song, afterLineIndex);
    if (!result) {
      await showDialog({
        title: 'リハーサルマークの追加',
        content:
          'この行間には既にリハーサルマークが存在するか、リハーサルマーク行が連続して追加できません。',
      });
      return;
    }
    handleSaveSong(result.song);
    setEditingRehearsalMarkId(result.rehearsalMarkPhraseId);
    setEditingRehearsalMarkText('');
  };

  const handleRehearsalMarkClick = (phraseId: string) => {
    if (!isRehearsalMarkMode || !song) return;
    const phrase = song.phrases.find((p) => p.id === phraseId);
    if (!phrase || !phrase.isRehearsalMark) return;

    setEditingRehearsalMarkId(phraseId);
    setEditingRehearsalMarkText(phrase.text);
  };

  const handleRehearsalMarkSave = () => {
    if (!song || !editingRehearsalMarkId) return;
    const phraseIndex = song.phrases.findIndex(
      (p) => p.id === editingRehearsalMarkId,
    );
    if (phraseIndex < 0) return;

    const updatedPhrases = [...song.phrases];
    updatedPhrases[phraseIndex] = {
      ...updatedPhrases[phraseIndex],
      text: editingRehearsalMarkText,
    };

    const updatedSong: Song = {
      ...song,
      phrases: updatedPhrases,
      updatedAt: Date.now(),
    };

    void handleSaveSong(updatedSong);
    setEditingRehearsalMarkId(null);
    setEditingRehearsalMarkText('');
  };

  const handleDeleteRehearsalMark = (phraseId: string) => {
    if (!song) return;
    const targetPhrase = song.phrases.find((p) => p.id === phraseId);
    if (!targetPhrase || !targetPhrase.isRehearsalMark) return;

    const updatedSong: Song = {
      ...song,
      phrases: song.phrases.filter((p) => p.id !== phraseId),
      updatedAt: Date.now(),
    };

    handleSaveSong(updatedSong);

    if (editingRehearsalMarkId === phraseId) {
      setEditingRehearsalMarkId(null);
      setEditingRehearsalMarkText('');
    }
  };

  const handleToggleLyricEditMode = () => {
    if (isLyricEditMode && editingPhraseId) {
      if (!song) return;
      const phraseIndex = song.phrases.findIndex(
        (p) => p.id === editingPhraseId,
      );
      if (phraseIndex < 0) return;

      const updatedPhrases = [...song.phrases];
      updatedPhrases[phraseIndex] = {
        ...updatedPhrases[phraseIndex],
        text: editingText,
      };

      const updatedSong: Song = {
        ...song,
        phrases: updatedPhrases,
        updatedAt: Date.now(),
      };

      void handleSaveSong(updatedSong);
      setEditingPhraseId(null);
      setEditingText('');
    }
    setIsLyricEditMode((prev) => !prev);
    setIsManualSplitMode(false);
    setIsManualDeleteMode(false);
  };

  const handlePhraseClickForEdit = (phraseId: string) => {
    if (!isLyricEditMode || !song) return;
    const phrase = song.phrases.find((p) => p.id === phraseId);
    if (!phrase) return;

    setEditingPhraseId(phraseId);
    setEditingText(phrase.text);
  };

  useCompingKeyboard({
    song,
    isManualSplitMode,
    isManualDeleteMode,
    isLyricEditMode,
    isRehearsalMarkMode,
    onSelectTake: handleSelectTake,
    onClearSelectedTake: handleClearSelectedTake,
    onPrevPhrase: handlePrevPhrase,
    onNextPhrase: handleNextPhrase,
    triggerShortcutFeedback,
  });

  const handleFreeMemoBlur = async () => {
    if (!song) return;
    const updatedSong = { ...song, freeMemo, updatedAt: Date.now() };
    await handleSaveSong(updatedSong);
  };

  const handleBack = () => {
    onNavigate({ type: 'recording', songId });
  };

  const handleExport = async () => {
    if (!song) return;

    try {
      const vtmData: VtmExport = {
        version: '1.0',
        exportedAt: Date.now(),
        song,
      };

      const json = JSON.stringify(vtmData, null, 2);
      await exportVtmFile(song.title, json);
    } catch (error) {
      await showDialog({
        title: 'エラー',
        content: `書き出しに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
      });
    }
  };

  const handlePrint = () => {
    window.dispatchEvent(new Event('vtm:print:start'));
    window.setTimeout(() => {
      window.print();
      window.dispatchEvent(new Event('vtm:print:end'));
    }, 0);
  };

  const handleClose = () => {
    onNavigate({ type: 'home' });
  };

  if (!song) {
    return (
      <Box
        sx={{
          p: 4,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100dvh',
          gap: 2,
        }}
      >
        <CircularProgress />
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  const phraseIndexById = new Map<string, number>();
  song.phrases.forEach((phrase, index) => {
    phraseIndexById.set(phrase.id, index);
  });

  const phrasesByLine: { lineIndex: number; phrases: Song['phrases'] }[] = [];
  const lineMap = new Map<number, Song['phrases']>();

  for (const phrase of song.phrases) {
    if (phrase.isRehearsalMark) {
      continue;
    }
    const linePhrases = lineMap.get(phrase.lineIndex) || [];
    linePhrases.push(phrase);
    lineMap.set(phrase.lineIndex, linePhrases);
  }

  const sortedLineIndices = Array.from(lineMap.keys()).sort((a, b) => a - b);

  for (const lineIndex of sortedLineIndices) {
    const linePhrases = lineMap.get(lineIndex) || [];
    phrasesByLine.push({ lineIndex, phrases: linePhrases });
  }

  const trailingSpacerWidth = Math.max(
    0,
    marksViewportWidth - TAKE_COLUMN_WIDTH - CONTROL_COLUMN_WIDTH,
  );

  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        '@media print': {
          height: 'auto',
          overflow: 'visible',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          '@media print': {
            py: 1,
          },
        }}
      >
        <Box>
          <EditableField
            value={song.title}
            onSave={handleTitleSave}
            variant="h5"
            textFieldWidth={270}
          />
          <EditableField
            value={song.credits}
            onSave={handleCreditsSave}
            variant="body2"
            color="text.secondary"
            textFieldWidth={270}
            textSx={{ '@media print': { lineHeight: 1.2 } }}
          />
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            '@media print': {
              display: 'none',
            },
          }}
        >
          <Button variant="contained" size="small" onClick={handleExport}>
            ソングプロジェクトの書き出し
          </Button>
          <Button variant="contained" size="small" onClick={handlePrint}>
            印刷 / PDFの書き出し
          </Button>
          <Button variant="contained" onClick={handleBack}>
            レコーディングモードに戻る
          </Button>
          <Button variant="outlined" onClick={handleClose}>
            終了
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          '@media print': {
            overflow: 'visible',
          },
        }}
      >
        <Box
          sx={{
            flex: '0 0 auto',
            maxWidth: '75%',
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            '@media print': {
              maxWidth: '100%',
              borderRight: 'none',
            },
          }}
        >
          <Box
            sx={{
              p: 1,
              // 57px to match marks area sticky header height (header content + 1px border)
              minHeight: 57,
              '@media print': {
                minHeight: 0,
              },
            }}
          />

          <CompingLyricsArea
            song={song}
            phrasesByLine={phrasesByLine}
            currentPhrase={currentPhrase}
            isManualSplitMode={isManualSplitMode}
            isManualDeleteMode={isManualDeleteMode}
            isLyricEditMode={isLyricEditMode}
            isRehearsalMarkMode={isRehearsalMarkMode}
            editingPhraseId={editingPhraseId}
            editingText={editingText}
            onEditingTextChange={setEditingText}
            onEditingPhraseIdChange={setEditingPhraseId}
            editingRehearsalMarkId={editingRehearsalMarkId}
            editingRehearsalMarkText={editingRehearsalMarkText}
            onChangeRehearsalMarkText={setEditingRehearsalMarkText}
            onInsertRehearsalMark={handleInsertRehearsalMark}
            onRehearsalMarkClick={handleRehearsalMarkClick}
            onRehearsalMarkSave={handleRehearsalMarkSave}
            onDeleteRehearsalMark={handleDeleteRehearsalMark}
            scrollRef={lyricsScrollRef}
            onScroll={handleLyricsScroll}
            phraseIndexById={phraseIndexById}
            onPhraseClick={handlePhraseClickForEdit}
            onManualSplit={handleManualSplit}
            onManualDeleteDivider={handleManualDeleteDivider}
            onCurrentPhraseIndexChange={setCurrentPhraseIndex}
          />

          <Box
            sx={{
              px: 2,
              py: 1,
              borderTop: 1,
              borderColor: 'divider',
              height: 170,
              '@media print': {
                display: 'none',
              },
            }}
          >
            <LyricEditModeControls
              isManualSplitMode={isManualSplitMode}
              isManualDeleteMode={isManualDeleteMode}
              isLyricEditMode={isLyricEditMode}
              isRehearsalMarkMode={isRehearsalMarkMode}
              editingPhraseId={editingPhraseId}
              onToggleSplitMode={() => {
                setIsManualSplitMode((prev) => !prev);
                setIsManualDeleteMode(false);
              }}
              onToggleDeleteMode={() => {
                setIsManualDeleteMode((prev) => !prev);
                setIsManualSplitMode(false);
                setIsLyricEditMode(false);
              }}
              onToggleLyricEditMode={handleToggleLyricEditMode}
              onToggleRehearsalMarkMode={handleToggleRehearsalMarkMode}
            />
            <TextField
              multiline
              rows={4}
              fullWidth
              value={freeMemo}
              onChange={(e) => setFreeMemo(e.target.value)}
              onBlur={handleFreeMemoBlur}
              placeholder="フリーメモを入力"
              size="small"
            />
          </Box>
        </Box>

        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            minWidth: 0,
            '@media print': {
              display: 'none',
            },
          }}
        >
          <MarksArea
            takes={song.takes}
            scrollRef={marksScrollRef}
            onScroll={handleMarksScroll}
            trailingSpacerWidth={trailingSpacerWidth}
            scrollSx={{
              '@media print': {
                overflow: 'visible',
              },
            }}
            headerStickySx={{
              '@media print': {
                position: 'static',
              },
            }}
            headerRowSx={{
              bgcolor: 'background.paper',
            }}
            renderHeaderCell={(take) => {
              const isCollapsed = collapsedTakeIds.has(take.id);

              return (
                <CompingTakeHeader
                  key={take.id}
                  take={take}
                  isCollapsed={isCollapsed}
                  onToggleCollapse={toggleTakeCollapse}
                />
              );
            }}
            renderBodyColumn={(take) => {
              const isCollapsed = collapsedTakeIds.has(take.id);

              return (
                <CompingTakeMarkColumn
                  key={take.id}
                  take={take}
                  isCollapsed={isCollapsed}
                  song={song}
                  phrasesByLine={phrasesByLine}
                  currentPhrase={currentPhrase}
                  selectedTakeId={selectedTakeId}
                  phraseIndexById={phraseIndexById}
                  onPhraseClick={setCurrentPhraseIndex}
                />
              );
            }}
            bodyRowSx={{}}
            renderFooterCell={(take) => (
              <Box
                key={take.id}
                sx={{
                  width: TAKE_COLUMN_WIDTH,
                  flexShrink: 0,
                  px: 2,
                  py: 1,
                  boxSizing: 'border-box',
                  borderRight: 1,
                  borderRightColor: 'divider',
                  height: 54,
                }}
              >
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  placeholder={`T${take.label} メモ`}
                  value={takeMemos[take.id] ?? ''}
                  onChange={(e) =>
                    handleTakeMemoChange(take.id, e.target.value)
                  }
                  onBlur={() => handleTakeMemoBlur(take.id)}
                  sx={{
                    height: '100%',
                    '& .MuiInputBase-root': {
                      height: '100%',
                      alignItems: 'flex-start',
                    },
                    '& .MuiInputBase-input': {
                      fontSize: '0.875rem',
                      overflow: 'auto !important',
                      height: '100% !important',
                    },
                  }}
                />
              </Box>
            )}
            footerControlColumn={
              <Box
                sx={{
                  width: CONTROL_COLUMN_WIDTH,
                  flexShrink: 0,
                  boxSizing: 'border-box',
                  height: 54,
                }}
              />
            }
            spacerColumnWidth={TAKE_COLUMN_WIDTH}
            spacerControlColumnWidth={CONTROL_COLUMN_WIDTH}
          />

          <BottomPanel
            height={115 - marksHorizontalScrollbarHeight}
            hideOnPrint
            topContent={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 85 }}>
                  <Typography variant="body2" color="text.secondary">
                    {currentPhraseIndex + 1} / {song.phrases.length}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  歌詞：
                </Typography>
                <Typography variant="body1" fontWeight="bold">
                  {currentPhrase?.text || '-'}
                </Typography>
                {nextPhraseText && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 5, opacity: 0.5 }}
                  >
                    {nextPhraseText}
                  </Typography>
                )}
              </Box>
            }
            bottomContent={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  height: 65,
                }}
              >
                <DeleteAndNavControls
                  onDelete={() => {
                    void handleClearSelectedTake();
                  }}
                  onPrev={handlePrevPhrase}
                  onNext={handleNextPhrase}
                  deleteButtonHeight={36}
                  deleteButtonSx={getShortcutPulseSx(
                    activeShortcutKey === 'delete',
                  )}
                  prevButtonSx={getShortcutPulseSx(
                    activeShortcutKey === 'nav-prev',
                  )}
                  nextButtonSx={getShortcutPulseSx(
                    activeShortcutKey === 'nav-next',
                  )}
                />

                <TakeSelectionPanel
                  song={song}
                  currentPhraseIndex={currentPhraseIndex}
                  selectedTakeId={selectedTakeId}
                  activeShortcutKey={activeShortcutKey}
                  onSelectTake={handleSelectTake}
                  getShortcutPulseSx={getShortcutPulseSx}
                />
              </Box>
            }
          />
        </Box>
      </Box>
      <Box
        sx={{
          display: 'none',
          '@media print': {
            display: 'block',
            px: 2,
            pb: 2,
            mt: 1,
          },
        }}
      >
        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            minHeight: 80,
            boxSizing: 'border-box',
          }}
        >
          <Typography
            variant="body1"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {freeMemo.trim().length > 0 ? freeMemo : '（メモなし）'}
          </Typography>
        </Box>
      </Box>
      {(isManualSplitMode ||
        isManualDeleteMode ||
        isLyricEditMode ||
        isRehearsalMarkMode) && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0, 0, 0, 0.35)',
            zIndex: 5,
            '@media print': {
              display: 'none',
            },
          }}
        />
      )}
    </Box>
  );
};
