import React from 'react';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';
import CreateIcon from '@mui/icons-material/Create';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Box,
  Button,
  CircularProgress,
  darken,
  IconButton,
  Input,
  InputAdornment,
  TextField,
  ToggleButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import { BottomPanel, DeleteAndNavControls } from '@/components/BottomPanel';
import { EditModeToolbar } from '@/components/EditModeToolbar';
import { LyricsArea } from '@/components/LyricsArea';
import { MarksArea } from '@/components/MarksArea';
import { SongHeader } from '@/components/SongHeader';
import {
  getAppSettings,
  getSongById,
  saveSong,
  setMarkSymbol,
  setMemoText,
} from '@/db/database';
import { useEditModes } from '@/hooks/useEditModes';
import { useShortcutFeedback } from '@/hooks/useShortcutFeedback';
import { useTakeCollapse } from '@/hooks/useTakeCollapse';
import { useTitleCreditsEdit } from '@/hooks/useTitleCreditsEdit';
import { useViewportSync } from '@/hooks/useViewportSync';
import { showDialog } from '@/stores/dialogStore';
import { increaseSaturation } from '@/utils/colorHelpers';
import {
  clearMark,
  clearMarksForTake,
  getMark,
  setMarkMemo,
  setMarkValue,
} from '@/utils/markHelpers';
import {
  addTake,
  insertRehearsalMarkAfterLine,
  mergePhraseAtDivider,
  removeLyricsLine,
  removeTake,
} from '@/utils/songHelpers';

import type { Phrase, Song } from '@/types/models';
import type { Screen } from '@/types/routing';

interface RecordingScreenProps {
  songId: string;
  onNavigate: (screen: Screen) => void;
}

interface PhrasesByLine {
  lineIndex: number;
  phrases: Phrase[];
}

export const RecordingScreen: React.FC<RecordingScreenProps> = ({
  songId,
  onNavigate,
}) => {
  const theme = useTheme();
  const isTablet = useMediaQuery('(max-height: 800px)');
  const takeColumnWidth = 220;
  const controlColumnWidth = 96;

  const [song, setSong] = React.useState<Song | null>(null);
  const [selectedPhraseId, setSelectedPhraseId] = React.useState<string | null>(
    null,
  );
  const [selectedTakeId, setSelectedTakeId] = React.useState<string | null>(
    null,
  );
  const [freeMemo, setFreeMemo] = React.useState('');

  const [markSymbols, setMarkSymbols] = React.useState<Record<number, string>>({
    1: '◎',
    2: '〇',
    3: '△',
    4: '',
    5: 'P',
    6: 'R',
    7: '',
    8: '',
    9: '',
  });
  const [memoText, setMemoTextState] = React.useState('');
  const [activeMarkFilters, setActiveMarkFilters] = React.useState<number[]>(
    [],
  );

  const lyricsScrollRef = React.useRef<HTMLDivElement>(null);
  const marksScrollRef = React.useRef<HTMLDivElement>(null);
  const lyricsRowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const marksRowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const pendingSongRef = React.useRef<Song | null>(null);
  const saveTimeoutRef = React.useRef<number | null>(null);
  const suppressAutoScrollRef = React.useRef(false);

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
    const loadData = async () => {
      const appSettings = await getAppSettings();
      setMarkSymbols(appSettings.markSymbols);
      setMemoTextState(appSettings.memoText);
      const loadedSong = await getSongById(songId);
      if (loadedSong) {
        setSong(loadedSong);
        setFreeMemo(loadedSong.freeMemo);
        const firstSelectablePhrase = loadedSong.phrases.find(
          (phrase) => phrase.text.trim().length > 0 && !phrase.isRehearsalMark,
        );
        if (firstSelectablePhrase)
          setSelectedPhraseId(firstSelectablePhrase.id);
        if (loadedSong.takes.length > 0)
          setSelectedTakeId(loadedSong.takes[0].id);
      }
    };
    loadData();
  }, [songId]);

  const handleSaveSong = React.useCallback((updatedSong: Song) => {
    setSong(updatedSong);
    pendingSongRef.current = updatedSong;
    if (saveTimeoutRef.current !== null)
      window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(async () => {
      if (!pendingSongRef.current) return;
      try {
        await saveSong(pendingSongRef.current);
      } catch (error) {
        console.error('Failed to save song:', error);
      }
    }, 250);
  }, []);

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null)
        window.clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleSongUpdate = React.useCallback(
    (updater: (prev: Song) => Song) => {
      if (!song) return;
      handleSaveSong(updater(song));
    },
    [song, handleSaveSong],
  );
  const titleCreditsEdit = useTitleCreditsEdit({
    onSaveTitle: (newTitle) => {
      if (!song) return;
      handleSaveSong({ ...song, title: newTitle, updatedAt: Date.now() });
      document.title = `${newTitle} - Vocal Take Manager`;
    },
    onSaveCredits: (newCredits) => {
      if (!song) return;
      handleSaveSong({ ...song, credits: newCredits, updatedAt: Date.now() });
    },
  });
  const editModes = useEditModes(song, handleSongUpdate);

  const phraseMarkMap = React.useMemo(() => {
    const map = new Map<string, { symbols: Set<string>; hasMemo: boolean }>();
    if (!song) return map;
    for (const mark of song.marks) {
      const entry = map.get(mark.phraseId) || {
        symbols: new Set<string>(),
        hasMemo: false,
      };
      if (mark.markValue) entry.symbols.add(mark.markValue);
      if (mark.memo && mark.memo.trim().length > 0) entry.hasMemo = true;
      map.set(mark.phraseId, entry);
    }
    return map;
  }, [song]);

  const isPhraseHighlighted = React.useCallback(
    (phraseId: string) => {
      if (activeMarkFilters.length === 0) return false;
      const entry = phraseMarkMap.get(phraseId);
      if (!entry) return false;
      for (const key of activeMarkFilters) {
        if (key === 0) {
          if (entry.hasMemo) return true;
          continue;
        }
        const symbol = markSymbols[key] || '';
        if (symbol && entry.symbols.has(symbol)) return true;
      }
      return false;
    },
    [activeMarkFilters, markSymbols, phraseMarkMap],
  );

  const handleToggleFilter = React.useCallback((key: number) => {
    setActiveMarkFilters((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }, []);

  const handleClearTakeMarks = React.useCallback(
    async (takeId: string) => {
      if (!song) return;

      const targetTake = song.takes.find((take) => take.id === takeId);
      const takeLabel =
        targetTake?.label ?? (targetTake?.order ? `${targetTake.order}` : '');

      const result = await showDialog({
        title: 'テイクのクリア',
        content: `テイク${takeLabel}のマークをクリアしますか？`,
        primaryButton: { text: 'クリア', variant: 'contained', color: 'error' },
        secondaryButton: { text: 'キャンセル', variant: 'outlined' },
      });

      if (result !== 'クリア') return;

      const updatedSong = clearMarksForTake(song, takeId);
      handleSaveSong(updatedSong);
    },
    [song, handleSaveSong],
  );

  const getTakeHeaderColor = React.useCallback(
    (color: string) => {
      if (theme.palette.mode === 'dark') {
        return darken(increaseSaturation(color, 0.95), 0.4);
      }
      return color;
    },
    [theme.palette.mode],
  );

  const isSelectablePhrase = React.useCallback((phrase: Phrase) => {
    const hasText = phrase.text.trim().length > 0;
    const isRehearsalMark = phrase.isRehearsalMark;
    return hasText && !isRehearsalMark;
  }, []);

  const nextPhraseText = React.useMemo(() => {
    if (!song || !selectedPhraseId) return '';
    const currentPhrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!currentPhrase) return '';
    const currentOrder = currentPhrase.order;
    const nextPhrase = song.phrases.find(
      (phrase) => phrase.order > currentOrder && isSelectablePhrase(phrase),
    );
    return nextPhrase?.text || '';
  }, [song, selectedPhraseId, isSelectablePhrase]);

  const moveToNextPhrase = React.useCallback(() => {
    if (!song || !selectedPhraseId) return;

    const currentPhrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!currentPhrase) return;

    const currentOrder = currentPhrase.order;
    const nextPhrase = song.phrases.find(
      (p) => p.order > currentOrder && isSelectablePhrase(p),
    );

    if (nextPhrase) {
      setSelectedPhraseId(nextPhrase.id);
    }
  }, [song, selectedPhraseId, isSelectablePhrase]);

  const moveToPreviousPhrase = React.useCallback(() => {
    if (!song || !selectedPhraseId) return;

    const currentPhrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!currentPhrase) return;

    const currentOrder = currentPhrase.order;
    const previousPhrase = [...song.phrases]
      .reverse()
      .find((p) => p.order < currentOrder && isSelectablePhrase(p));

    if (previousPhrase) {
      setSelectedPhraseId(previousPhrase.id);
    }
  }, [song, selectedPhraseId, isSelectablePhrase]);

  const handleMarkInput = React.useCallback(
    async (key: number) => {
      if (!song || !selectedPhraseId || !selectedTakeId) return;

      const symbol = markSymbols[key] || '';
      if (!symbol) {
        const updatedSong = clearMark(song, selectedPhraseId, selectedTakeId);
        await handleSaveSong(updatedSong);
        setTimeout(() => {
          moveToNextPhrase();
        }, 0);
        return;
      }

      const updatedSong = setMarkValue(
        song,
        selectedPhraseId,
        selectedTakeId,
        symbol,
      );
      await handleSaveSong(updatedSong);

      setTimeout(() => {
        moveToNextPhrase();
      }, 0);
    },
    [
      song,
      selectedPhraseId,
      selectedTakeId,
      markSymbols,
      handleSaveSong,
      moveToNextPhrase,
    ],
  );

  const handleMemoInput = React.useCallback(async () => {
    if (!song || !selectedPhraseId || !selectedTakeId) return;

    const memo = memoText.trim();
    const updatedSong = setMarkMemo(
      song,
      selectedPhraseId,
      selectedTakeId,
      memo || null,
    );
    await handleSaveSong(updatedSong);

    setTimeout(() => {
      moveToNextPhrase();
    }, 0);
  }, [
    song,
    selectedPhraseId,
    selectedTakeId,
    memoText,
    handleSaveSong,
    moveToNextPhrase,
  ]);

  const handleClearMark = React.useCallback(async () => {
    if (!song || !selectedPhraseId || !selectedTakeId) return;

    const updatedSong = clearMark(song, selectedPhraseId, selectedTakeId);
    await handleSaveSong(updatedSong);
  }, [song, selectedPhraseId, selectedTakeId, handleSaveSong]);

  React.useEffect(() => {
    if (!song || !selectedPhraseId || !selectedTakeId) return;
    const handleKeyDown = async (e: KeyboardEvent) => {
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
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerShortcutFeedback('nav-prev');
        moveToPreviousPhrase();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerShortcutFeedback('nav-next');
        moveToNextPhrase();
        return;
      }
      const selectedPhrase = song.phrases.find(
        (p) => p.id === selectedPhraseId,
      );
      if (!selectedPhrase || selectedPhrase.text.trim().length === 0) return;
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        triggerShortcutFeedback(`mark-${e.key}`);
        await handleMarkInput(Number.parseInt(e.key, 10));
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        triggerShortcutFeedback('delete');
        await handleClearMark();
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        triggerShortcutFeedback('memo-0');
        await handleMemoInput();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    song,
    selectedPhraseId,
    selectedTakeId,
    handleMarkInput,
    handleClearMark,
    handleMemoInput,
    triggerShortcutFeedback,
    moveToNextPhrase,
    moveToPreviousPhrase,
    editModes.isManualSplitMode,
    editModes.isManualDeleteMode,
    editModes.isLyricEditMode,
    editModes.isRehearsalMarkMode,
  ]);

  const handleFreeMemoBlur = React.useCallback(async () => {
    if (!song) return;
    handleSaveSong({ ...song, freeMemo, updatedAt: Date.now() });
  }, [song, freeMemo, handleSaveSong]);

  const handleLyricsScroll = () => {
    if (marksScrollRef.current && lyricsScrollRef.current)
      marksScrollRef.current.scrollTop = lyricsScrollRef.current.scrollTop;
  };
  const handleMarksScroll = () => {
    if (lyricsScrollRef.current && marksScrollRef.current)
      lyricsScrollRef.current.scrollTop = marksScrollRef.current.scrollTop;
  };

  React.useEffect(() => {
    if (!song || !selectedTakeId || !marksScrollRef.current) return;
    const selectedIndex = song.takes.findIndex((t) => t.id === selectedTakeId);
    if (selectedIndex < 0) return;
    marksScrollRef.current.scrollTo({
      left: selectedIndex * takeColumnWidth,
      behavior: 'smooth',
    });
  }, [song, selectedTakeId]);

  const suppressAutoScrollOnce = React.useCallback(() => {
    suppressAutoScrollRef.current = true;
    window.setTimeout(() => {
      suppressAutoScrollRef.current = false;
    }, 0);
  }, []);

  const handleInsertRehearsalMarkWithDialog = React.useCallback(
    async (afterLineIndex: number) => {
      if (!song || !editModes.isRehearsalMarkMode) return;
      const result = insertRehearsalMarkAfterLine(song, afterLineIndex);
      if (!result) {
        await showDialog({
          title: 'リハーサルマークの追加',
          content:
            'この行間には既にリハーサルマークが存在するか、リハーサルマーク行が連続して追加できません。',
        });
        return;
      }
      suppressAutoScrollOnce();
      editModes.handleInsertRehearsalMark(afterLineIndex);
    },
    [song, editModes, suppressAutoScrollOnce],
  );

  const handleRehearsalMarkSaveWithScrollSuppress = React.useCallback(() => {
    suppressAutoScrollOnce();
    editModes.handleRehearsalMarkSave();
  }, [editModes, suppressAutoScrollOnce]);

  const handleDeleteRehearsalMarkWithScrollSuppress = React.useCallback(
    (phraseId: string) => {
      suppressAutoScrollOnce();
      editModes.handleDeleteRehearsalMark(phraseId);
    },
    [editModes, suppressAutoScrollOnce],
  );

  const handleManualSplitWithSelection = React.useCallback(
    (phraseId: string, splitIndex: number) => {
      editModes.handleManualSplit(phraseId, splitIndex);
      setSelectedPhraseId(phraseId);
    },
    [editModes],
  );

  const handleManualDeleteDividerWithConfirm = React.useCallback(
    async (leftPhraseId: string, rightPhraseId: string) => {
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
      setSelectedPhraseId(mergeResult.mergedPhraseId);
    },
    [song, handleSaveSong],
  );

  const handleDeleteLyricsLine = React.useCallback(
    async (lineIndex: number) => {
      if (!song || !editModes.isLyricEditMode) return;

      const linePhrases = song.phrases.filter(
        (phrase) => !phrase.isRehearsalMark && phrase.lineIndex === lineIndex,
      );
      if (linePhrases.length === 0) return;

      const lineText = linePhrases.map((phrase) => phrase.text).join('');
      const result = await showDialog({
        title: '行の削除',
        content: `この行を削除しますか？\n「${lineText || '（空行）'}」`,
        primaryButton: { text: '削除', variant: 'contained', color: 'error' },
        secondaryButton: { text: 'キャンセル', variant: 'outlined' },
      });
      if (result !== '削除') return;

      const removedPhraseIds = new Set(linePhrases.map((phrase) => phrase.id));
      const minOrderInLine = Math.min(
        ...linePhrases.map((phrase) => phrase.order),
      );
      const updatedSong = removeLyricsLine(song, lineIndex);

      await handleSaveSong(updatedSong);

      if (selectedPhraseId && removedPhraseIds.has(selectedPhraseId)) {
        const nextPhrase = updatedSong.phrases.find(
          (phrase) => !phrase.isRehearsalMark && phrase.order >= minOrderInLine,
        );
        if (nextPhrase) {
          setSelectedPhraseId(nextPhrase.id);
          return;
        }
        const prevPhrase = [...updatedSong.phrases]
          .reverse()
          .find(
            (phrase) =>
              !phrase.isRehearsalMark && phrase.order < minOrderInLine,
          );
        if (prevPhrase) {
          setSelectedPhraseId(prevPhrase.id);
        } else {
          setSelectedPhraseId(null);
        }
      }
    },
    [song, editModes.isLyricEditMode, handleSaveSong, selectedPhraseId],
  );

  const scrollToLine = React.useCallback((lineIndex: number) => {
    const marksContainer = marksScrollRef.current;
    const lyricsContainer = lyricsScrollRef.current;
    if (!marksContainer || !lyricsContainer) return;

    const marksRow = marksRowRefs.current[lineIndex];
    const lyricsRow = lyricsRowRefs.current[lineIndex];
    const rowElement = marksRow || lyricsRow;
    if (!rowElement) return;

    const rowTop = rowElement.offsetTop;
    const rowHeight = rowElement.offsetHeight || 40;
    const containerHeight = marksContainer.clientHeight;
    const targetTop = rowTop - (containerHeight - rowHeight) / 2;

    marksContainer.scrollTop = targetTop;
    lyricsContainer.scrollTop = targetTop;
  }, []);

  React.useEffect(() => {
    if (!song || !selectedPhraseId || suppressAutoScrollRef.current) return;
    const phrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!phrase || phrase.text.trim().length === 0) return;
    scrollToLine(phrase.lineIndex);
  }, [song, selectedPhraseId, scrollToLine]);

  const handleClose = () => {
    onNavigate({ type: 'home' });
  };

  const handleComping = () => {
    if (!song) return;
    onNavigate({ type: 'comping', songId: song.id });
  };

  const handleAddTake = async () => {
    if (!song) return;
    const updatedSong = addTake(song);
    await handleSaveSong(updatedSong);
    const newTake = updatedSong.takes[updatedSong.takes.length - 1];
    setSelectedTakeId(newTake.id);
  };

  const handleRemoveTake = async () => {
    if (!song || song.takes.length <= 1) return;
    const lastTake = song.takes[song.takes.length - 1];
    const result = await showDialog({
      title: 'テイクを削除',
      content: `テイク ${lastTake.label} を削除しますか？`,
      primaryButton: { text: '削除', variant: 'contained', color: 'error' },
      secondaryButton: { text: 'キャンセル', variant: 'text' },
    });
    if (result === '削除') {
      const updatedSong = removeTake(song, lastTake.id);
      await handleSaveSong(updatedSong);
      if (selectedTakeId === lastTake.id && updatedSong.takes.length > 0) {
        setSelectedTakeId(updatedSong.takes[updatedSong.takes.length - 1].id);
      }
    }
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

  const phrasesByLine: PhrasesByLine[] = [];
  const lineMap = new Map<number, Phrase[]>();

  for (const phrase of song.phrases) {
    if (phrase.isRehearsalMark) {
      continue;
    }
    const phrases = lineMap.get(phrase.lineIndex) || [];
    phrases.push(phrase);
    lineMap.set(phrase.lineIndex, phrases);
  }

  const sortedLineIndices = Array.from(lineMap.keys()).sort((a, b) => a - b);

  for (const lineIndex of sortedLineIndices) {
    const phrases = lineMap.get(lineIndex) || [];
    phrasesByLine.push({ lineIndex, phrases });
  }

  const rowHeightPx = 28;
  const rowGapPx = 4;
  const rowGap = `${rowGapPx}px`;

  const trailingSpacerWidth = Math.max(
    0,
    marksViewportWidth - takeColumnWidth - controlColumnWidth,
  );

  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
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
            <>
              <Button variant="contained" onClick={handleComping}>
                セレクトモードに切り替える
              </Button>
              <Button variant="outlined" onClick={handleClose}>
                終了
              </Button>
            </>
          }
        />
      </Box>

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box
          sx={{
            flex: '0 0 auto',
            maxWidth: '75%',
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          <Box
            sx={{
              p: 1,
              minHeight: 56,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.5,
                alignItems: 'center',
                pl: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                フィルター：
              </Typography>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((key) => (
                <ToggleButton
                  key={key}
                  value={key}
                  selected={activeMarkFilters.includes(key)}
                  onChange={() => handleToggleFilter(key)}
                  size="small"
                  sx={{
                    px: 0.6,
                    py: 0.2,
                    minWidth: 31,
                    borderRadius: 1,
                    textTransform: 'none',
                    fontSize: '0.75rem',
                  }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    {markSymbols[key] || '—'}
                  </Typography>
                </ToggleButton>
              ))}
              <ToggleButton
                value={0}
                selected={activeMarkFilters.includes(0)}
                onChange={() => handleToggleFilter(0)}
                size="small"
                sx={{
                  px: 0.6,
                  py: 0.2,
                  minWidth: 30,
                  borderRadius: 1,
                  textTransform: 'none',
                  fontSize: '0.75rem',
                }}
              >
                <CreateIcon sx={{ fontSize: 16, my: 0.25 }} />
              </ToggleButton>
            </Box>
          </Box>

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
              if (phrase) {
                editModes.handleRehearsalMarkClick(phraseId, phrase.text);
              }
            }}
            onRehearsalMarkSave={handleRehearsalMarkSaveWithScrollSuppress}
            onDeleteRehearsalMark={handleDeleteRehearsalMarkWithScrollSuppress}
            isLocatorLine={(linePhrases) =>
              linePhrases.some((phrase) => phrase.id === selectedPhraseId)
            }
            onLineRef={(lineIndex, el) => {
              lyricsRowRefs.current[lineIndex] = el;
            }}
            scrollSx={{
              paddingBottom:
                marksHorizontalScrollbarHeight > 0
                  ? `calc(16px + ${marksHorizontalScrollbarHeight}px)`
                  : undefined,
            }}
            lineLeadingContent={(lineIndex) =>
              editModes.isLyricEditMode ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <IconButton
                    size="small"
                    aria-label="行を削除"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleDeleteLyricsLine(lineIndex);
                    }}
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ) : null
            }
            renderPhraseCell={(phrase, index, linePhrases) => {
              const isEditing = editModes.editingPhraseId === phrase.id;
              const shouldHighlight = isPhraseHighlighted(phrase.id);

              return (
                <Box
                  key={phrase.id}
                  onClick={() => {
                    if (editModes.isLyricEditMode) {
                      editModes.handlePhraseClickForEdit(
                        phrase.id,
                        phrase.text,
                      );
                    } else if (
                      !editModes.isManualSplitMode &&
                      !editModes.isManualDeleteMode
                    ) {
                      setSelectedPhraseId(phrase.id);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor:
                      editModes.isManualSplitMode ||
                      editModes.isManualDeleteMode ||
                      editModes.isLyricEditMode ||
                      editModes.isRehearsalMarkMode
                        ? 'text'
                        : 'pointer',
                    position: 'relative',
                    px: 1,
                    py: 0.5,
                    borderRight:
                      index < linePhrases.length - 1 ? '1px solid' : 'none',
                    borderRightColor: 'divider',
                    bgcolor:
                      selectedPhraseId === phrase.id
                        ? shouldHighlight
                          ? (thm) => alpha(thm.palette.primary.main, 0.4)
                          : 'action.selected'
                        : shouldHighlight
                          ? (thm) => alpha(thm.palette.primary.main, 0.175)
                          : 'transparent',
                    '&:hover': {
                      bgcolor:
                        selectedPhraseId === phrase.id
                          ? 'action.selected'
                          : shouldHighlight
                            ? (thm) => alpha(thm.palette.primary.main, 0.3)
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
                      {Array.from(phrase.text).map((char, charIndex, arr) => (
                        <React.Fragment key={`${phrase.id}-${charIndex}`}>
                          <Typography component="span" variant="body1">
                            {char}
                          </Typography>
                          {charIndex < arr.length - 1 && (
                            <Box
                              component="span"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleManualSplitWithSelection(
                                  phrase.id,
                                  charIndex + 1,
                                );
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
                        </React.Fragment>
                      ))}
                    </Box>
                  ) : editModes.isManualDeleteMode ? (
                    <>
                      <Typography variant="body1">{phrase.text}</Typography>
                      {index < linePhrases.length - 1 && (
                        <Box
                          onClick={(event) => {
                            event.stopPropagation();
                            const nextPhrase = linePhrases[index + 1];
                            if (!nextPhrase) return;
                            handleManualDeleteDividerWithConfirm(
                              phrase.id,
                              nextPhrase.id,
                            );
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
                      value={editModes.editingText}
                      onChange={(e) => editModes.setEditingText(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          editModes.handlePhraseClickForEdit('', '');
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
            }}
          />

          <Box
            sx={{
              px: 2,
              py: 1,
              borderTop: 1,
              borderColor: 'divider',
              height: 120,
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
          }}
        >
          <MarksArea
            takes={song.takes}
            scrollRef={marksScrollRef}
            onScroll={handleMarksScroll}
            trailingSpacerWidth={trailingSpacerWidth}
            renderHeaderCell={(take) => {
              const isCollapsed = collapsedTakeIds.has(take.id);

              return (
                <Box
                  key={take.id}
                  sx={{
                    px: isCollapsed ? 0 : 2,
                    py: 1,
                    width: isCollapsed ? 40 : takeColumnWidth,
                    flexShrink: 0,
                    borderRight: 1,
                    borderRightColor: 'divider',
                    borderBottom: 1,
                    borderBottomColor: 'divider',
                    boxSizing: 'border-box',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box
                    onClick={() => {
                      if (isCollapsed) {
                        toggleTakeCollapse(take.id);
                        return;
                      }
                      setSelectedTakeId(take.id);
                    }}
                    sx={{
                      minHeight: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      bgcolor: getTakeHeaderColor(take.color),
                      '@media print': {
                        bgcolor: take.color,
                      },
                      border:
                        selectedTakeId === take.id ? '3px solid' : '1px solid',
                      borderColor:
                        selectedTakeId === take.id ? 'primary.main' : 'divider',
                      boxSizing: 'border-box',
                      maxWidth: '100%',
                      width: isCollapsed ? 32 : '100%',
                      height: isCollapsed ? 32 : 40,
                      mx: 'auto',
                      position: 'relative',
                      px: 0,
                    }}
                  >
                    {!isCollapsed && (
                      <Tooltip title="折りたたむ" arrow>
                        <IconButton
                          size="small"
                          aria-label="テイクを折りたたむ"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleTakeCollapse(take.id);
                          }}
                          sx={{
                            position: 'absolute',
                            left: 2,
                            opacity: 0.4,
                            '&:hover': {
                              opacity: 0.8,
                            },
                          }}
                        >
                          <ChevronLeftIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {!isCollapsed && (
                      <Tooltip title="このテイクをクリア" arrow>
                        <IconButton
                          size="small"
                          aria-label="テイクをクリア"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleClearTakeMarks(take.id);
                          }}
                          sx={{
                            position: 'absolute',
                            right: 2,
                            opacity: 0.4,
                            '&:hover': {
                              opacity: 0.8,
                            },
                          }}
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Typography variant="body2" fontWeight="bold">
                      {isCollapsed ? take.order : take.label}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
            headerControlColumn={
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  width: controlColumnWidth,
                  flexShrink: 0,
                  borderRight: 'none',
                  boxSizing: 'border-box',
                  bgcolor: 'background.paper',
                }}
              >
                <Box
                  sx={{
                    minHeight: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={handleAddTake}
                    sx={{ borderRadius: 1 }}
                  >
                    <AddIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={handleRemoveTake}
                    disabled={song.takes.length <= 1}
                    sx={{ borderRadius: 1 }}
                  >
                    <RemoveIcon />
                  </IconButton>
                </Box>
              </Box>
            }
            renderBodyColumn={(take, takeIndex) => {
              const isCollapsed = collapsedTakeIds.has(take.id);

              return (
                <Box
                  key={take.id}
                  sx={{
                    width: isCollapsed ? 40 : takeColumnWidth,
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
                          phrasesByLine.length > 0
                            ? phrasesByLine[0].phrases
                            : [];
                        const minOrderInFirstLine =
                          firstLinePhrases.length > 0
                            ? Math.min(...firstLinePhrases.map((p) => p.order))
                            : 0;
                        const rehearsalMarksBeforeFirstLine =
                          song.phrases.filter(
                            (p) =>
                              p.isRehearsalMark &&
                              p.order < minOrderInFirstLine,
                          );
                        return rehearsalMarksBeforeFirstLine.map(
                          (rehearsalMark) => (
                            <Box
                              key={rehearsalMark.id}
                              sx={{ mb: rowGap, height: rowHeightPx }}
                            />
                          ),
                        );
                      })()}
                      {phrasesByLine.map(
                        ({ lineIndex, phrases }, lineArrayIndex) => {
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
                            <React.Fragment key={lineIndex}>
                              <Box sx={{ mb: rowGap, height: rowHeightPx }} />
                              {rehearsalMarksForThisLine.map(
                                (rehearsalMark) => (
                                  <Box
                                    key={rehearsalMark.id}
                                    sx={{ mb: rowGap, height: rowHeightPx }}
                                  />
                                ),
                              )}
                            </React.Fragment>
                          );
                        },
                      )}
                    </>
                  ) : (
                    <>
                      {(() => {
                        const firstLinePhrases =
                          phrasesByLine.length > 0
                            ? phrasesByLine[0].phrases
                            : [];
                        const minOrderInFirstLine =
                          firstLinePhrases.length > 0
                            ? Math.min(...firstLinePhrases.map((p) => p.order))
                            : 0;
                        const rehearsalMarksBeforeFirstLine =
                          song.phrases.filter(
                            (p) =>
                              p.isRehearsalMark &&
                              p.order < minOrderInFirstLine,
                          );
                        return rehearsalMarksBeforeFirstLine.map(
                          (rehearsalMark) => (
                            <Box
                              key={rehearsalMark.id}
                              sx={{ mb: rowGap, height: rowHeightPx }}
                            />
                          ),
                        );
                      })()}
                      {phrasesByLine.map(
                        ({ lineIndex, phrases }, lineArrayIndex) => {
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
                            (ph) => ph.text.trim().length === 0,
                          );

                          if (isEmptyLine) {
                            return (
                              <React.Fragment key={lineIndex}>
                                <Box sx={{ mb: rowGap, height: rowHeightPx }} />
                                {rehearsalMarksForThisLine.map(
                                  (rehearsalMark) => (
                                    <Box
                                      key={rehearsalMark.id}
                                      sx={{ mb: rowGap, height: rowHeightPx }}
                                    />
                                  ),
                                )}
                              </React.Fragment>
                            );
                          }

                          const isLocatorLine = phrases.some(
                            (ph) => ph.id === selectedPhraseId,
                          );

                          return (
                            <React.Fragment key={lineIndex}>
                              <Box
                                ref={(el: HTMLDivElement | null) => {
                                  if (takeIndex === 0) {
                                    marksRowRefs.current[lineIndex] = el;
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
                                  mb: rowGap,
                                  height: rowHeightPx,
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
                                  const mark = getMark(
                                    song,
                                    phrase.id,
                                    take.id,
                                  );
                                  const isSelected =
                                    selectedPhraseId === phrase.id &&
                                    selectedTakeId === take.id;
                                  const isExtraDenseLayout =
                                    phrases.length >= 10;
                                  return (
                                    <Box
                                      key={phrase.id}
                                      onClick={() => {
                                        setSelectedPhraseId(phrase.id);
                                        setSelectedTakeId(take.id);
                                      }}
                                      sx={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        bgcolor: isSelected
                                          ? 'action.focus'
                                          : 'transparent',
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
                                              fontSize: isExtraDenseLayout
                                                ? 9
                                                : 12,
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
                                                  fontSize: isExtraDenseLayout
                                                    ? 12
                                                    : 14,
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
                              {rehearsalMarksForThisLine.map(
                                (rehearsalMark) => (
                                  <Box
                                    key={rehearsalMark.id}
                                    sx={{ mb: rowGap, height: rowHeightPx }}
                                  />
                                ),
                              )}
                            </React.Fragment>
                          );
                        },
                      )}
                    </>
                  )}
                </Box>
              );
            }}
            bodyControlColumn={
              <Box
                sx={{
                  px: 2,
                  py: 2,
                  width: controlColumnWidth,
                  flexShrink: 0,
                  borderRight: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <Box sx={{ minHeight: 40 }} />
              </Box>
            }
          />

          <BottomPanel
            height={120}
            padding={isTablet ? 1 : 2}
            topContent={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 0,
                }}
              >
                {song && selectedTakeId && (
                  <Box
                    sx={{
                      width: 80,
                      justifyContent: 'flex-start',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      テイク:
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {song.takes.find((t) => t.id === selectedTakeId)?.label ||
                        '-'}
                    </Typography>
                  </Box>
                )}
                {song && selectedPhraseId && (
                  <>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ ml: 2 }}
                    >
                      歌詞:
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {song.phrases.find((p) => p.id === selectedPhraseId)
                        ?.text || '-'}
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
                  </>
                )}
              </Box>
            }
            bottomContent={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  overflowX: 'auto',
                  height: 65,
                }}
              >
                <DeleteAndNavControls
                  onDelete={handleClearMark}
                  onPrev={moveToPreviousPhrase}
                  onNext={moveToNextPhrase}
                  deleteButtonHeight={36}
                  navButtonHeight={undefined}
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

                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((key) => (
                  <Box
                    key={key}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Input
                      value={markSymbols[key] || ''}
                      onChange={(e) => {
                        const newSymbol = e.target.value.slice(0, 1);
                        setMarkSymbols((prev) => ({
                          ...prev,
                          [key]: newSymbol,
                        }));
                        void setMarkSymbol(key, newSymbol);
                      }}
                      sx={{
                        width: 66,
                        height: 38,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        px: 0.5,

                        '& input': {
                          textAlign: 'center',
                          fontSize: '1.2rem',
                        },
                      }}
                      startAdornment={
                        <InputAdornment position="start">
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleMarkInput(key)}
                            sx={{
                              minWidth: 26,
                              height: 26,
                              borderRadius: 0.5,
                              px: 0.5,
                              fontSize: '0.7rem',
                              lineHeight: 1,
                              ...getShortcutPulseSx(
                                activeShortcutKey === `mark-${key}`,
                              ),
                            }}
                          >
                            {key}
                          </Button>
                        </InputAdornment>
                      }
                      inputProps={{
                        maxLength: 1,
                      }}
                    />
                  </Box>
                ))}

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <Input
                    value={memoText}
                    onChange={(e) => {
                      const newText = e.target.value;
                      setMemoTextState(newText);
                      void setMemoText(newText);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleMemoInput();
                      }
                    }}
                    placeholder="メモを入力"
                    startAdornment={
                      <InputAdornment position="start">
                        <Button
                          variant="contained"
                          size="small"
                          onClick={handleMemoInput}
                          sx={{
                            minWidth: 26,
                            height: 26,
                            borderRadius: 0.5,
                            px: 0.5,
                            fontSize: '0.7rem',
                            lineHeight: 1,
                            ...getShortcutPulseSx(
                              activeShortcutKey === 'memo-0',
                            ),
                          }}
                        >
                          0
                        </Button>
                      </InputAdornment>
                    }
                    endAdornment={
                      memoText.trim().length > 0 ? (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="メモをクリア"
                            size="small"
                            onClick={() => {
                              setMemoTextState('');
                              void setMemoText('');
                            }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : undefined
                    }
                    sx={{
                      width: isTablet ? 180 : 220,
                      height: 38,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      px: 0.5,
                    }}
                  />
                  <CreateIcon sx={{ fontSize: isTablet ? 18 : 22 }} />
                </Box>
              </Box>
            }
          />
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
          }}
        />
      )}
    </Box>
  );
};
