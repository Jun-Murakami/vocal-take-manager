import React from 'react';
import CreateIcon from '@mui/icons-material/Create';
import {
  Box,
  Button,
  CircularProgress,
  darken,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { BottomPanel, DeleteAndNavControls } from '@/components/BottomPanel';
import { EditModeToolbar } from '@/components/EditModeToolbar';
import { LyricsArea } from '@/components/LyricsArea';
import { MarksArea } from '@/components/MarksArea';
import { SongHeader } from '@/components/SongHeader';
import { TakeColumnBody } from '@/components/TakeColumnBody';
import { TakeColumnHeader } from '@/components/TakeColumnHeader';
import { getSongById, saveSong } from '@/db/database';
import { useEditModes } from '@/hooks/useEditModes';
import { useShortcutFeedback } from '@/hooks/useShortcutFeedback';
import { useTakeCollapse } from '@/hooks/useTakeCollapse';
import { useTitleCreditsEdit } from '@/hooks/useTitleCreditsEdit';
import { useViewportSync } from '@/hooks/useViewportSync';
import { showDialog } from '@/stores/dialogStore';
import { increaseSaturation } from '@/utils/colorHelpers';
import { exportVtmFile } from '@/utils/fileExport';
import { getMark } from '@/utils/markHelpers';
import { mergePhraseAtDivider } from '@/utils/songHelpers';

import type { Phrase, Song, VtmExport } from '@/types/models';
import type { Screen } from '@/types/routing';

interface CompingScreenProps {
  songId: string;
  onNavigate: (screen: Screen) => void;
}

export const CompingScreen: React.FC<CompingScreenProps> = ({
  songId,
  onNavigate,
}) => {
  const theme = useTheme();
  const takeColumnWidth = 220;
  const [song, setSong] = React.useState<Song | null>(null);
  const [currentPhraseIndex, setCurrentPhraseIndex] = React.useState(0);
  const [freeMemo, setFreeMemo] = React.useState('');
  const lyricsScrollRef = React.useRef<HTMLDivElement>(null);
  const marksScrollRef = React.useRef<HTMLDivElement>(null);
  const currentPhrase = song?.phrases[currentPhraseIndex];
  const selectedTakeId = currentPhrase
    ? (song?.comping.selectedTakeByPhraseId[currentPhrase.id] ?? null)
    : null;

  const { activeShortcutKey, triggerShortcutFeedback, getShortcutPulseSx } =
    useShortcutFeedback();

  const takeIds = song?.takes.map((t) => t.id) ?? [];
  const { collapsedTakeIds, toggleTakeCollapse } = useTakeCollapse(takeIds);

  const { marksViewportWidth, marksHorizontalScrollbarHeight } =
    useViewportSync(
      marksScrollRef,
      !!song,
      song?.takes.length ?? 0,
      collapsedTakeIds.size,
    );

  React.useEffect(() => {
    if (song) document.title = `${song.title} - Vocal Take Manager`;
    return () => {
      document.title = 'Vocal Take Manager';
    };
  }, [song]);

  React.useEffect(() => {
    const loadSong = async () => {
      const loadedSong = await getSongById(songId);
      if (loadedSong) {
        setSong(loadedSong);
        const initialIndex = loadedSong.comping.currentPhraseIndex;
        const initialPhrase = loadedSong.phrases[initialIndex];
        const isSelectable = (p: Phrase | undefined) =>
          p ? p.text.trim().length > 0 && !p.isRehearsalMark : false;
        if (isSelectable(initialPhrase)) {
          setCurrentPhraseIndex(initialIndex);
        } else {
          const fallbackIndex = loadedSong.phrases.findIndex(isSelectable);
          setCurrentPhraseIndex(fallbackIndex >= 0 ? fallbackIndex : 0);
        }
        setFreeMemo(loadedSong.freeMemo);
      }
    };
    loadSong();
  }, [songId]);

  const handleSaveSong = React.useCallback(
    async (updater: Song | ((prev: Song) => Song)) => {
      if (!song && typeof updater === 'function') return;
      const updatedSong =
        typeof updater === 'function' ? updater(song as Song) : updater;
      setSong(updatedSong);
      await saveSong(updatedSong);
    },
    [song],
  );

  const titleCreditsEdit = useTitleCreditsEdit({
    onSaveTitle: (newTitle) => {
      handleSaveSong((prev) => ({
        ...prev,
        title: newTitle,
        updatedAt: Date.now(),
      }));
      document.title = `${newTitle} - Vocal Take Manager`;
    },
    onSaveCredits: (newCredits) => {
      handleSaveSong((prev) => ({
        ...prev,
        credits: newCredits,
        updatedAt: Date.now(),
      }));
    },
  });

  const editModes = useEditModes(song, handleSaveSong);

  const isSelectablePhrase = React.useCallback(
    (phrase: Phrase) =>
      phrase.text.trim().length > 0 && !phrase.isRehearsalMark,
    [],
  );
  const getNextSelectableIndex = React.useCallback(
    (startIndex: number) => {
      if (!song) return startIndex;
      for (let i = startIndex + 1; i < song.phrases.length; i += 1)
        if (isSelectablePhrase(song.phrases[i])) return i;
      return startIndex;
    },
    [song, isSelectablePhrase],
  );
  const getPreviousSelectableIndex = React.useCallback(
    (startIndex: number) => {
      if (!song) return startIndex;
      for (let i = startIndex - 1; i >= 0; i -= 1)
        if (isSelectablePhrase(song.phrases[i])) return i;
      return startIndex;
    },
    [song, isSelectablePhrase],
  );
  const nextPhraseText = React.useMemo(() => {
    if (!song) return '';
    const nextIndex = getNextSelectableIndex(currentPhraseIndex);
    return nextIndex === currentPhraseIndex
      ? ''
      : song.phrases[nextIndex]?.text || '';
  }, [song, currentPhraseIndex, getNextSelectableIndex]);

  const getTakeHeaderColor = React.useCallback(
    (color: string) =>
      theme.palette.mode === 'dark'
        ? darken(increaseSaturation(color, 0.95), 0.4)
        : color,
    [theme.palette.mode],
  );
  const handleLyricsScroll = () => {
    if (marksScrollRef.current && lyricsScrollRef.current)
      marksScrollRef.current.scrollTop = lyricsScrollRef.current.scrollTop;
  };
  const handleMarksScroll = () => {
    if (lyricsScrollRef.current && marksScrollRef.current)
      lyricsScrollRef.current.scrollTop = marksScrollRef.current.scrollTop;
  };

  const handleManualSplit = React.useCallback(
    (phraseId: string, splitIndex: number) => {
      if (!song) return;
      const phraseIndex = song.phrases.findIndex((p) => p.id === phraseId);
      editModes.handleManualSplit(phraseId, splitIndex);
      if (phraseIndex >= 0) setCurrentPhraseIndex(phraseIndex);
    },
    [song, editModes],
  );
  const handleManualDeleteDivider = React.useCallback(
    async (leftPhraseId: string, rightPhraseId: string) => {
      if (!song) return;
      const rightHasMarks = song.marks.some(
        (m) =>
          m.phraseId === rightPhraseId &&
          (Boolean(m.markValue) || Boolean(m.memo)),
      );
      const rightHasSelection = Boolean(
        song.comping.selectedTakeByPhraseId[rightPhraseId],
      );
      if (rightHasMarks || rightHasSelection) {
        const result = await showDialog({
          title: 'データ消失確認',
          content:
            'この分割線を削除すると、入力されたデータの一部が失われます。実行しますか？',
          primaryButton: { text: '削除', color: 'error', variant: 'contained' },
          secondaryButton: {
            text: 'キャンセル',
            color: 'inherit',
            variant: 'outlined',
          },
        });
        if (result !== '削除') return;
      }
      const mergeResult = mergePhraseAtDivider(
        song,
        leftPhraseId,
        rightPhraseId,
      );
      if (!mergeResult) return;
      handleSaveSong(mergeResult.song);
      const mergedIndex = mergeResult.song.phrases.findIndex(
        (p) => p.id === mergeResult.mergedPhraseId,
      );
      if (mergedIndex >= 0) setCurrentPhraseIndex(mergedIndex);
    },
    [song, handleSaveSong],
  );

  const handleSelectTake = React.useCallback(
    async (takeId: string) => {
      if (!song || !song.phrases[currentPhraseIndex]) return;
      const phrase = song.phrases[currentPhraseIndex];
      if (!isSelectablePhrase(phrase)) return;
      const updatedSong: Song = {
        ...song,
        comping: {
          ...song.comping,
          currentPhraseIndex,
          selectedTakeByPhraseId: {
            ...song.comping.selectedTakeByPhraseId,
            [phrase.id]: takeId,
          },
        },
        updatedAt: Date.now(),
      };
      await handleSaveSong(updatedSong);
      const nextIndex = getNextSelectableIndex(currentPhraseIndex);
      if (nextIndex !== currentPhraseIndex) setCurrentPhraseIndex(nextIndex);
    },
    [
      song,
      currentPhraseIndex,
      handleSaveSong,
      getNextSelectableIndex,
      isSelectablePhrase,
    ],
  );
  const handleInsertRehearsalMarkWithDialog = React.useCallback(
    async (afterLineIndex: number) => {
      if (!song || !editModes.isRehearsalMarkMode) return;
      editModes.handleInsertRehearsalMark(afterLineIndex);
      const insertedPhrase = song.phrases.find(
        (p) =>
          p.isRehearsalMark &&
          p.lineIndex === afterLineIndex &&
          editModes.editingRehearsalMarkId === p.id,
      );
      if (!insertedPhrase && !editModes.editingRehearsalMarkId) {
        await showDialog({
          title: 'リハーサルマークの追加',
          content:
            'この行間には既にリハーサルマークが存在するか、リハーサルマーク行が連続して追加できません。',
        });
      }
    },
    [song, editModes],
  );
  const handleClearSelectedTake = React.useCallback(async () => {
    if (!song || !song.phrases[currentPhraseIndex]) return;
    const phrase = song.phrases[currentPhraseIndex];
    if (!isSelectablePhrase(phrase)) return;
    if (!song.comping.selectedTakeByPhraseId[phrase.id]) return;
    const updatedSelectedTakeByPhraseId = {
      ...song.comping.selectedTakeByPhraseId,
    };
    delete updatedSelectedTakeByPhraseId[phrase.id];
    const updatedSong: Song = {
      ...song,
      comping: {
        ...song.comping,
        currentPhraseIndex,
        selectedTakeByPhraseId: updatedSelectedTakeByPhraseId,
      },
      updatedAt: Date.now(),
    };
    await handleSaveSong(updatedSong);
  }, [song, currentPhraseIndex, handleSaveSong, isSelectablePhrase]);
  const handlePrevPhrase = React.useCallback(() => {
    if (!song) return;
    setCurrentPhraseIndex(getPreviousSelectableIndex(currentPhraseIndex));
  }, [song, currentPhraseIndex, getPreviousSelectableIndex]);
  const handleNextPhrase = React.useCallback(() => {
    if (!song) return;
    setCurrentPhraseIndex(getNextSelectableIndex(currentPhraseIndex));
  }, [song, currentPhraseIndex, getNextSelectableIndex]);
  React.useEffect(() => {
    if (!song) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        editModes.isManualSplitMode ||
        editModes.isManualDeleteMode ||
        editModes.isLyricEditMode ||
        editModes.isRehearsalMarkMode
      )
        return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const take = song.takes.find(
          (t) => t.order === (e.key === '0' ? 10 : Number.parseInt(e.key, 10)),
        );
        if (take) {
          triggerShortcutFeedback(`take-${take.order}`);
          handleSelectTake(take.id);
        }
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerShortcutFeedback('nav-prev');
        handlePrevPhrase();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerShortcutFeedback('nav-next');
        handleNextPhrase();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        triggerShortcutFeedback('delete');
        void handleClearSelectedTake();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    song,
    handleSelectTake,
    handlePrevPhrase,
    handleNextPhrase,
    handleClearSelectedTake,
    triggerShortcutFeedback,
    editModes,
  ]);
  const handleFreeMemoBlur = React.useCallback(async () => {
    if (!song) return;
    await handleSaveSong({ ...song, freeMemo, updatedAt: Date.now() });
  }, [song, freeMemo, handleSaveSong]);
  const handleBack = () => onNavigate({ type: 'recording', songId });

  const handleExport = React.useCallback(async () => {
    if (!song) return;
    try {
      const vtmData: VtmExport = {
        version: '1.0',
        exportedAt: Date.now(),
        song,
      };
      await exportVtmFile(song.title, JSON.stringify(vtmData, null, 2));
    } catch (error) {
      await showDialog({
        title: 'エラー',
        content: `書き出しに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
      });
    }
  }, [song]);
  const handlePrint = () => {
    window.dispatchEvent(new Event('vtm:print:start'));
    window.setTimeout(() => {
      window.print();
      window.dispatchEvent(new Event('vtm:print:end'));
    }, 0);
  };
  const handleClose = () => onNavigate({ type: 'home' });
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
  for (let i = 0; i < song.phrases.length; i++)
    phraseIndexById.set(song.phrases[i].id, i);
  const phrasesByLine: { lineIndex: number; phrases: Song['phrases'] }[] = [];
  const lineMap = new Map<number, Song['phrases']>();
  for (const phrase of song.phrases) {
    if (phrase.isRehearsalMark) continue;
    const linePhrases = lineMap.get(phrase.lineIndex) || [];
    linePhrases.push(phrase);
    lineMap.set(phrase.lineIndex, linePhrases);
  }
  for (const lineIndex of Array.from(lineMap.keys()).sort((a, b) => a - b)) {
    phrasesByLine.push({ lineIndex, phrases: lineMap.get(lineIndex) || [] });
  }
  const rowHeightPx = 28;
  const rowGap = '4px';
  const trailingSpacerWidth = Math.max(0, marksViewportWidth - takeColumnWidth);

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
          '@media print': { py: 1 },
        }}
      >
        <SongHeader
          title={song.title}
          credits={song.credits}
          isEditingTitle={titleCreditsEdit.isEditingTitle}
          isEditingCredits={titleCreditsEdit.isEditingCredits}
          editingTitleText={titleCreditsEdit.editingTitleText}
          editingCreditsText={titleCreditsEdit.editingCreditsText}
          onTitleTextChange={titleCreditsEdit.setEditingTitleText}
          onCreditsTextChange={titleCreditsEdit.setEditingCreditsText}
          onStartEditingTitle={() =>
            titleCreditsEdit.startEditingTitle(song.title)
          }
          onStartEditingCredits={() =>
            titleCreditsEdit.startEditingCredits(song.credits)
          }
          onTitleSave={titleCreditsEdit.handleTitleSave}
          onCreditsSave={titleCreditsEdit.handleCreditsSave}
          actionButtons={
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                '@media print': { display: 'none' },
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
            </Box>
          }
        />
      </Box>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          '@media print': { overflow: 'visible' },
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
            '@media print': { maxWidth: '100%', borderRight: 'none' },
          }}
        >
          <Box sx={{ p: 1, minHeight: 56, '@media print': { minHeight: 0 } }} />

          <LyricsArea
            phrasesByLine={phrasesByLine}
            phrases={song.phrases}
            rowGap={rowGap}
            rowHeightPx={rowHeightPx}
            scrollRef={lyricsScrollRef}
            onScroll={handleLyricsScroll}
            isManualSplitMode={editModes.isManualSplitMode}
            isManualDeleteMode={editModes.isManualDeleteMode}
            isLyricEditMode={editModes.isLyricEditMode}
            isRehearsalMarkMode={editModes.isRehearsalMarkMode}
            editingRehearsalMarkId={editModes.editingRehearsalMarkId}
            editingRehearsalMarkText={editModes.editingRehearsalMarkText}
            onChangeRehearsalMarkText={editModes.setEditingRehearsalMarkText}
            onInsertRehearsalMark={handleInsertRehearsalMarkWithDialog}
            onRehearsalMarkClick={(phraseId) => {
              const phrase = song.phrases.find((p) => p.id === phraseId);
              if (phrase)
                editModes.handleRehearsalMarkClick(phraseId, phrase.text);
            }}
            onRehearsalMarkSave={editModes.handleRehearsalMarkSave}
            onDeleteRehearsalMark={editModes.handleDeleteRehearsalMark}
            isLocatorLine={(linePhrases) =>
              linePhrases.some((phrase) => phrase.id === currentPhrase?.id)
            }
            scrollSx={{
              paddingBottom:
                marksHorizontalScrollbarHeight > 0
                  ? `calc(16px + ${marksHorizontalScrollbarHeight}px)`
                  : undefined,
              '@media print': { overflow: 'visible', p: 1, pb: 5 },
            }}
            lineContainerSx={{
              '@media print': {
                mb: '2px',
                height: 28,
                '&::after': { opacity: 0 },
              },
            }}
            renderPhraseCell={(phrase, index, linePhrases) => {
              const phraseIndex = phraseIndexById.get(phrase.id);
              const isCurrent = currentPhrase?.id === phrase.id;
              const selectedTake =
                song.comping.selectedTakeByPhraseId[phrase.id];
              const takeData = selectedTake
                ? song.takes.find((t) => t.id === selectedTake)
                : null;
              const isEditing = editModes.editingPhraseId === phrase.id;
              const anyEditMode =
                editModes.isManualSplitMode ||
                editModes.isManualDeleteMode ||
                editModes.isLyricEditMode ||
                editModes.isRehearsalMarkMode;
              return (
                <Box
                  key={phrase.id}
                  onClick={() => {
                    if (editModes.isLyricEditMode)
                      editModes.handlePhraseClickForEdit(
                        phrase.id,
                        phrase.text,
                      );
                    else if (
                      !editModes.isManualSplitMode &&
                      !editModes.isManualDeleteMode &&
                      phraseIndex !== undefined
                    )
                      setCurrentPhraseIndex(phraseIndex);
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: anyEditMode ? 'text' : 'pointer',
                    position: 'relative',
                    px: 1,
                    py: 0.5,
                    borderRight:
                      index < linePhrases.length - 1 ? '1px solid' : 'none',
                    borderRightColor: 'divider',
                    bgcolor: isCurrent ? 'action.selected' : 'transparent',
                    '&:hover': {
                      bgcolor: isCurrent ? 'action.selected' : 'action.hover',
                    },
                    '@media print': {
                      cursor: 'default',
                      bgcolor: 'transparent',
                      '&:hover': { bgcolor: 'transparent' },
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
                        '@media print': { display: 'none' },
                      }}
                    />
                  )}
                  {editModes.isManualSplitMode ? (
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        cursor: 'text',
                      }}
                    >
                      {Array.from(phrase.text).map((char, ci, arr) => (
                        <React.Fragment key={`${phrase.id}-${ci}`}>
                          <Typography component="span" variant="body1">
                            {char}
                          </Typography>
                          {ci < arr.length - 1 && (
                            <Box
                              component="span"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleManualSplit(phrase.id, ci + 1);
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
                                  '&:hover': { opacity: 1 },
                                }}
                              />
                            </Box>
                          )}
                        </React.Fragment>
                      ))}
                    </Box>
                  ) : editModes.isManualDeleteMode ? (
                    <>
                      <Typography variant="body1">{phrase.text}</Typography>
                      {index < linePhrases.length - 1 && (
                        <Box
                          onClick={(e) => {
                            e.stopPropagation();
                            const np = linePhrases[index + 1];
                            if (np) handleManualDeleteDivider(phrase.id, np.id);
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
                              '&:hover': { opacity: 1 },
                            }}
                          />
                        </Box>
                      )}
                    </>
                  ) : isEditing ? (
                    <TextField
                      value={editModes.editingText}
                      onChange={(e) => editModes.setEditingText(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape')
                          editModes.handlePhraseClickForEdit('', '');
                      }}
                      variant="standard"
                      size="small"
                      autoFocus
                      sx={{
                        '& .MuiInputBase-input': { py: 0.5, fontSize: '1rem' },
                      }}
                    />
                  ) : (
                    <Typography variant="body1">{phrase.text}</Typography>
                  )}
                  {takeData?.label && (
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
                          border: 1,
                          borderColor: 'divider',
                          boxSizing: 'border-box',
                          bgcolor: takeData.color
                            ? getTakeHeaderColor(takeData.color)
                            : 'action.hover',
                          '@media print': {
                            bgcolor: takeData.color || 'action.hover',
                          },
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="caption">
                          {takeData.label}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            }}
          />

          <Box
            sx={{
              px: 2,
              py: 1,
              borderTop: 1,
              borderColor: 'divider',
              height: 120,
              '@media print': { display: 'none' },
            }}
          >
            <EditModeToolbar
              isManualSplitMode={editModes.isManualSplitMode}
              isManualDeleteMode={editModes.isManualDeleteMode}
              isLyricEditMode={editModes.isLyricEditMode}
              isRehearsalMarkMode={editModes.isRehearsalMarkMode}
              editingPhraseId={editModes.editingPhraseId}
              onToggleSplitMode={() =>
                editModes.setIsManualSplitMode(!editModes.isManualSplitMode)
              }
              onToggleDeleteMode={() =>
                editModes.setIsManualDeleteMode(!editModes.isManualDeleteMode)
              }
              onToggleLyricEditMode={editModes.handleToggleLyricEditMode}
              onToggleRehearsalMarkMode={
                editModes.handleToggleRehearsalMarkMode
              }
            />
            <TextField
              multiline
              rows={2}
              fullWidth
              value={freeMemo}
              onChange={(e) => setFreeMemo(e.target.value)}
              onBlur={handleFreeMemoBlur}
              placeholder="メモを入力"
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
            '@media print': { display: 'none' },
          }}
        >
          <MarksArea
            takes={song.takes}
            scrollRef={marksScrollRef}
            onScroll={handleMarksScroll}
            trailingSpacerWidth={trailingSpacerWidth}
            scrollSx={{ '@media print': { overflow: 'visible' } }}
            headerStickySx={{ '@media print': { position: 'static' } }}
            headerRowSx={{
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
            renderHeaderCell={(take) => (
              <TakeColumnHeader
                key={take.id}
                take={take}
                isCollapsed={collapsedTakeIds.has(take.id)}
                takeColumnWidth={takeColumnWidth}
                getTakeHeaderColor={getTakeHeaderColor}
                onToggleCollapse={toggleTakeCollapse}
              />
            )}
            renderBodyColumn={(take) => (
              <TakeColumnBody
                key={take.id}
                take={take}
                song={song}
                phrasesByLine={phrasesByLine}
                phraseIndexById={phraseIndexById}
                currentPhrase={currentPhrase}
                selectedTakeId={selectedTakeId}
                isCollapsed={collapsedTakeIds.has(take.id)}
                takeColumnWidth={takeColumnWidth}
                rowHeightPx={rowHeightPx}
                rowGap={rowGap}
                onPhraseClick={setCurrentPhraseIndex}
              />
            )}
          />

          <BottomPanel
            height={120}
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
                        onClick={() => handleSelectTake(take.id)}
                        sx={{
                          minWidth: 48,
                          height: 48,
                          color: isSelected ? 'primary.main' : 'text.primary',
                          bgcolor: getTakeHeaderColor(take.color),
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
                          ...getShortcutPulseSx(
                            activeShortcutKey === `take-${take.order}`,
                          ),
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
                            <Typography variant="caption">
                              {mark.markValue}
                            </Typography>
                          )}
                          {mark?.memo && <CreateIcon fontSize="small" />}
                        </Box>
                      </Button>
                    );
                  })}
                </Box>
              </Box>
            }
          />
        </Box>
      </Box>
      <Box
        sx={{
          display: 'none',
          '@media print': { display: 'block', px: 2, pb: 2, mt: 1 },
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
            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {freeMemo.trim().length > 0 ? freeMemo : '（メモなし）'}
          </Typography>
        </Box>
      </Box>
      {(editModes.isManualSplitMode ||
        editModes.isManualDeleteMode ||
        editModes.isLyricEditMode ||
        editModes.isRehearsalMarkMode) && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(0, 0, 0, 0.35)',
            zIndex: 5,
            '@media print': { display: 'none' },
          }}
        />
      )}
    </Box>
  );
};
