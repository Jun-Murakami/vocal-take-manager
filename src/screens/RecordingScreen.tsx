/**
 * Recording Screen
 * Mark takes for each phrase with keyboard shortcuts
 */

import React from 'react';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CreateIcon from '@mui/icons-material/Create';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Box,
  Button,
  IconButton,
  Input,
  InputAdornment,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import {
  getAppSettings,
  getSongById,
  saveSong,
  setMarkSymbol,
  setMemoText,
} from '@/db/database';
import { showDialog } from '@/stores/dialogStore';
import {
  clearMark,
  getMark,
  setMarkMemo,
  setMarkValue,
} from '@/utils/markHelpers';
import {
  addTake,
  mergePhraseAtDivider,
  removeTake,
  splitPhraseByChar,
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
  // レイアウトの列幅を固定して、ヘッダーと本文のズレを防止する
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
  // 手動分割モード（歌詞の分割線を増やす）
  const [isManualSplitMode, setIsManualSplitMode] = React.useState(false);
  // 手動削除モード（分割線を削除する）
  const [isManualDeleteMode, setIsManualDeleteMode] = React.useState(false);
  // 歌詞修正モード
  const [isLyricEditMode, setIsLyricEditMode] = React.useState(false);
  // 編集中のフレーズID
  const [editingPhraseId, setEditingPhraseId] = React.useState<string | null>(
    null,
  );
  // 編集中のテキスト
  const [editingText, setEditingText] = React.useState('');
  // タイトル編集中フラグ
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  // クレジット編集中フラグ
  const [isEditingCredits, setIsEditingCredits] = React.useState(false);
  // 編集中のタイトルテキスト
  const [editingTitleText, setEditingTitleText] = React.useState('');
  // 編集中のクレジットテキスト
  const [editingCreditsText, setEditingCreditsText] = React.useState('');

  // アプリ設定（マーク記号とメモテキスト）
  const [markSymbols, setMarkSymbols] = React.useState<Record<number, string>>({
    1: '◎',
    2: '〇',
    3: '△',
    4: '',
    5: '',
  });
  const [memoText, setMemoTextState] = React.useState('');

  // Refs for synchronized scrolling
  const lyricsScrollRef = React.useRef<HTMLDivElement>(null);
  const marksScrollRef = React.useRef<HTMLDivElement>(null);
  // 行位置の参照（自動スクロール用）
  const lyricsRowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const marksRowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  // 楽観的更新の保存待ち（連続入力時の負荷軽減）
  const pendingSongRef = React.useRef<Song | null>(null);
  const saveTimeoutRef = React.useRef<number | null>(null);

  // 印刷時のヘッダー（document.title）を楽曲タイトルに変更
  React.useEffect(() => {
    if (song) {
      // レコーディングモードでは「楽曲タイトル - Vocal Take Manager」に設定
      document.title = `${song.title} - Vocal Take Manager`;
    }
    // コンポーネントがアンマウントされる際に元のタイトルに戻す
    return () => {
      document.title = 'Vocal Take Manager';
    };
  }, [song]);

  // Load app settings and song data
  React.useEffect(() => {
    const loadData = async () => {
      // アプリ設定を読み込む（ソング間で共有）
      const appSettings = await getAppSettings();
      setMarkSymbols(appSettings.markSymbols);
      setMemoTextState(appSettings.memoText);

      // 曲データを読み込む
      const loadedSong = await getSongById(songId);
      if (loadedSong) {
        setSong(loadedSong);
        setFreeMemo(loadedSong.freeMemo);
        // Select first non-empty phrase by default (empty lines are not selectable)
        const firstSelectablePhrase = loadedSong.phrases.find(
          (phrase) => phrase.text.trim().length > 0,
        );
        if (firstSelectablePhrase) {
          setSelectedPhraseId(firstSelectablePhrase.id);
        }
        if (loadedSong.takes.length > 0) {
          setSelectedTakeId(loadedSong.takes[0].id);
        }
      }
    };
    loadData();
  }, [songId]);

  // Save song to database (optimistic)
  const handleSaveSong = React.useCallback((updatedSong: Song) => {
    // UIは先に更新（楽観的更新）
    setSong(updatedSong);
    // 最新データを保持
    pendingSongRef.current = updatedSong;

    // 直近の保存をキャンセルしてまとめる
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      if (!pendingSongRef.current) return;
      try {
        await saveSong(pendingSongRef.current);
      } catch (error) {
        // 保存失敗時はコンソールに出し、UIは維持する
        console.error('Failed to save song:', error);
      }
    }, 250);
  }, []);

  // アンマウント時に保存タイマーをクリア
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  /**
   * 次の選択可能なフレーズに移動（空行は飛ばす）
   */
  const moveToNextPhrase = React.useCallback(() => {
    if (!song || !selectedPhraseId) return;

    const currentPhrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!currentPhrase) return;

    // 現在のフレーズの order を取得
    const currentOrder = currentPhrase.order;

    // 次の選択可能なフレーズを探す（空行は飛ばす）
    const nextPhrase = song.phrases.find(
      (p) => p.order > currentOrder && p.text.trim().length > 0,
    );

    if (nextPhrase) {
      setSelectedPhraseId(nextPhrase.id);
    }
  }, [song, selectedPhraseId]);

  /**
   * 前の選択可能なフレーズに移動（空行は飛ばす）
   */
  const moveToPreviousPhrase = React.useCallback(() => {
    if (!song || !selectedPhraseId) return;

    const currentPhrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!currentPhrase) return;

    // 現在のフレーズの order を取得
    const currentOrder = currentPhrase.order;

    // 前の選択可能なフレーズを探す（空行は飛ばす、逆順で検索）
    const previousPhrase = [...song.phrases]
      .reverse()
      .find((p) => p.order < currentOrder && p.text.trim().length > 0);

    if (previousPhrase) {
      setSelectedPhraseId(previousPhrase.id);
    }
  }, [song, selectedPhraseId]);

  /**
   * マーク記号を入力（1～5）
   */
  const handleMarkInput = React.useCallback(
    async (key: number) => {
      if (!song || !selectedPhraseId || !selectedTakeId) return;

      const symbol = markSymbols[key] || '';
      if (!symbol) return; // 記号が設定されていない場合は何もしない

      // マークを設定
      const updatedSong = setMarkValue(
        song,
        selectedPhraseId,
        selectedTakeId,
        symbol,
      );
      await handleSaveSong(updatedSong);

      // 自動的に次のフレーズに移動（空行は飛ばす）
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

  /**
   * メモを入力（0キー）
   */
  const handleMemoInput = React.useCallback(async () => {
    if (!song || !selectedPhraseId || !selectedTakeId) return;

    // 現在のメモテキストを使用
    const memo = memoText.trim();

    // マークにメモを設定
    const updatedSong = setMarkMemo(
      song,
      selectedPhraseId,
      selectedTakeId,
      memo || null,
    );
    await handleSaveSong(updatedSong);

    // 自動的に次のフレーズに移動（空行は飛ばす）
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

  /**
   * ロケート位置のマークを削除（値・メモを両方クリア）
   */
  const handleClearMark = React.useCallback(async () => {
    if (!song || !selectedPhraseId || !selectedTakeId) return;

    const updatedSong = clearMark(song, selectedPhraseId, selectedTakeId);
    await handleSaveSong(updatedSong);
  }, [song, selectedPhraseId, selectedTakeId, handleSaveSong]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (!song || !selectedPhraseId || !selectedTakeId) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      // 手動分割/削除/歌詞修正モード中はキーボード操作を無効化する
      if (isManualSplitMode || isManualDeleteMode || isLyricEditMode) return;

      // Ignore if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // 左右矢印キー: ロケーター移動
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveToPreviousPhrase();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveToNextPhrase();
        return;
      }

      // 空行のプレースホルダーは選択・操作対象から除外する
      const selectedPhrase = song.phrases.find(
        (phrase) => phrase.id === selectedPhraseId,
      );
      if (!selectedPhrase || selectedPhrase.text.trim().length === 0) {
        return;
      }

      // Keys 1-5: マーク記号を入力
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const keyNum = Number.parseInt(e.key, 10);
        await handleMarkInput(keyNum);
        return;
      }

      // Delete/Backspace: マーク削除
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        await handleClearMark();
        return;
      }

      // Key 0: メモを入力
      if (e.key === '0') {
        e.preventDefault();
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
    moveToNextPhrase,
    moveToPreviousPhrase,
    isManualSplitMode,
    isManualDeleteMode,
    isLyricEditMode,
  ]);

  // Save free memo when it changes
  const handleFreeMemoBlur = React.useCallback(async () => {
    if (!song) return;
    const updatedSong = { ...song, freeMemo, updatedAt: Date.now() };
    await handleSaveSong(updatedSong);
  }, [song, freeMemo, handleSaveSong]);

  // Synchronized scrolling between lyrics and marks
  const handleLyricsScroll = () => {
    if (marksScrollRef.current && lyricsScrollRef.current) {
      marksScrollRef.current.scrollTop = lyricsScrollRef.current.scrollTop;
    }
  };

  const handleMarksScroll = () => {
    if (lyricsScrollRef.current && marksScrollRef.current) {
      lyricsScrollRef.current.scrollTop = marksScrollRef.current.scrollTop;
    }
  };

  /**
   * 手動分割: 指定フレーズを文字位置で分割する
   */
  const handleManualSplit = React.useCallback(
    (phraseId: string, splitIndex: number) => {
      if (!song) return;
      const updatedSong = splitPhraseByChar(song, phraseId, splitIndex);
      if (updatedSong !== song) {
        handleSaveSong(updatedSong);
        // 操作対象のフレーズを選択状態にする（視認性向上）
        setSelectedPhraseId(phraseId);
      }
    },
    [song, handleSaveSong],
  );

  /**
   * 歌詞修正モードの切り替え
   */
  const handleToggleLyricEditMode = React.useCallback(() => {
    if (isLyricEditMode && editingPhraseId) {
      // 編集確定処理
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
  }, [isLyricEditMode, editingPhraseId, editingText, song, handleSaveSong]);

  /**
   * タイトル編集の確定
   */
  const handleTitleSave = React.useCallback(() => {
    if (!song) return;
    const updatedSong: Song = {
      ...song,
      title: editingTitleText,
      updatedAt: Date.now(),
    };
    void handleSaveSong(updatedSong);
    setIsEditingTitle(false);
    // タイトル変更時にdocument.titleも更新
    document.title = `${editingTitleText} - Vocal Take Manager`;
  }, [song, editingTitleText, handleSaveSong]);

  /**
   * クレジット編集の確定
   */
  const handleCreditsSave = React.useCallback(() => {
    if (!song) return;
    const updatedSong: Song = {
      ...song,
      credits: editingCreditsText,
      updatedAt: Date.now(),
    };
    void handleSaveSong(updatedSong);
    setIsEditingCredits(false);
  }, [song, editingCreditsText, handleSaveSong]);

  /**
   * フレーズをクリックして編集開始
   */
  const handlePhraseClickForEdit = React.useCallback(
    (phraseId: string) => {
      if (!isLyricEditMode || !song) return;
      const phrase = song.phrases.find((p) => p.id === phraseId);
      if (!phrase) return;

      setEditingPhraseId(phraseId);
      setEditingText(phrase.text);
    },
    [isLyricEditMode, song],
  );

  /**
   * 手動削除: 指定した分割線を結合して削除する
   */
  const handleManualDeleteDivider = React.useCallback(
    async (leftPhraseId: string, rightPhraseId: string) => {
      if (!song) return;
      // 右側フレーズにデータがある場合は確認ダイアログを出す
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

      const mergeResult = mergePhraseAtDivider(
        song,
        leftPhraseId,
        rightPhraseId,
      );
      if (!mergeResult) return;
      handleSaveSong(mergeResult.song);
      // 結合先フレーズにロケートを合わせる
      setSelectedPhraseId(mergeResult.mergedPhraseId);
    },
    [song, handleSaveSong],
  );

  /**
   * 指定行を画面中央付近に表示するためのスクロール
   */
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

    // 左右のスクロール位置を揃えつつ、ロケーター行を中央寄せ
    marksContainer.scrollTop = targetTop;
    lyricsContainer.scrollTop = targetTop;
  }, []);

  /**
   * 選択フレーズが変わったら、ロケーター行を中央に寄せる
   */
  React.useEffect(() => {
    if (!song || !selectedPhraseId) return;
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
    // Select the newly added take
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
      // If deleted take was selected, select the new last take
      if (selectedTakeId === lastTake.id && updatedSong.takes.length > 0) {
        setSelectedTakeId(updatedSong.takes[updatedSong.takes.length - 1].id);
      }
    }
  };

  if (!song) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  // Group phrases by lineIndex
  const phrasesByLine: PhrasesByLine[] = [];
  const lineMap = new Map<number, Phrase[]>();

  for (const phrase of song.phrases) {
    const phrases = lineMap.get(phrase.lineIndex) || [];
    phrases.push(phrase);
    lineMap.set(phrase.lineIndex, phrases);
  }

  const sortedLineIndices = Array.from(lineMap.keys()).sort((a, b) => a - b);
  for (const lineIndex of sortedLineIndices) {
    const phrases = lineMap.get(lineIndex) || [];
    phrasesByLine.push({ lineIndex, phrases });
  }

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          {/* タイトル編集 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover .edit-icon': {
                opacity: 1,
              },
            }}
          >
            {isEditingTitle ? (
              <>
                <TextField
                  value={editingTitleText}
                  onChange={(e) => setEditingTitleText(e.target.value)}
                  variant="standard"
                  size="small"
                  autoFocus
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleTitleSave}
                  sx={{ mr: -50 }}
                >
                  変更
                </Button>
              </>
            ) : (
              <>
                <Typography
                  variant="h5"
                  onClick={() => {
                    setEditingTitleText(song.title);
                    setIsEditingTitle(true);
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  {song.title}
                </Typography>
                <CreateIcon
                  className="edit-icon"
                  sx={{
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    color: 'text.secondary',
                  }}
                  onClick={() => {
                    setEditingTitleText(song.title);
                    setIsEditingTitle(true);
                  }}
                />
              </>
            )}
          </Box>
          {/* クレジット編集 */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover .edit-icon': {
                opacity: 1,
              },
            }}
          >
            {isEditingCredits ? (
              <>
                <TextField
                  value={editingCreditsText}
                  onChange={(e) => setEditingCreditsText(e.target.value)}
                  variant="standard"
                  size="small"
                  autoFocus
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleCreditsSave}
                  sx={{ mr: -50 }}
                >
                  変更
                </Button>
              </>
            ) : (
              <>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  onClick={() => {
                    setEditingCreditsText(song.credits);
                    setIsEditingCredits(true);
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  {song.credits}
                </Typography>
                <CreateIcon
                  className="edit-icon"
                  sx={{
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    color: 'text.secondary',
                  }}
                  onClick={() => {
                    setEditingCreditsText(song.credits);
                    setIsEditingCredits(true);
                  }}
                />
              </>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={handleComping}>
            セレクトモードに切り替える
          </Button>
          <Button variant="outlined" onClick={handleClose}>
            終了
          </Button>
        </Box>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left side: Lyrics display and free memo */}
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
          {/* Spacer to align with take header */}
          <Box
            sx={{
              p: 1,
              minHeight: 56,
            }}
          />

          {/* Lyrics display */}
          <Box
            ref={lyricsScrollRef}
            onScroll={handleLyricsScroll}
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
              zIndex:
                isManualSplitMode || isManualDeleteMode || isLyricEditMode
                  ? 6
                  : 'auto',
              // バックドロップの暗さが透けないように背景色を明示する
              bgcolor:
                isManualSplitMode || isManualDeleteMode || isLyricEditMode
                  ? 'background.paper'
                  : 'transparent',
            }}
          >
            {phrasesByLine.map(({ lineIndex, phrases }) => (
              <Box
                key={lineIndex}
                ref={(el: HTMLDivElement | null) => {
                  // 歌詞側の行位置を保存（中央スクロールの基準）
                  lyricsRowRefs.current[lineIndex] = el;
                }}
                sx={{
                  display: 'flex',
                  mb: 1,
                  minHeight: 40,
                  alignItems: 'stretch',
                }}
              >
                {(() => {
                  // 空行はボックスを表示せず、空白の行間だけを確保する
                  const isEmptyLine = phrases.every(
                    (phrase) => phrase.text.trim().length === 0,
                  );

                  if (isEmptyLine) {
                    return <Box sx={{ flex: 1 }} />;
                  }

                  return phrases.map((phrase, index) => {
                    const isEditing = editingPhraseId === phrase.id;
                    return (
                      <Box
                        key={phrase.id}
                        onClick={() => {
                          if (isLyricEditMode) {
                            // 歌詞修正モード時は編集開始
                            handlePhraseClickForEdit(phrase.id);
                          } else if (
                            !isManualSplitMode &&
                            !isManualDeleteMode
                          ) {
                            setSelectedPhraseId(phrase.id);
                          }
                        }}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          cursor:
                            isManualSplitMode ||
                            isManualDeleteMode ||
                            isLyricEditMode
                              ? 'text'
                              : 'pointer',
                          position: 'relative',
                          px: 1,
                          py: 0.5,
                          borderRight:
                            index < phrases.length - 1
                              ? '1px solid rgba(0, 0, 0, 0.2)'
                              : 'none',
                          bgcolor:
                            selectedPhraseId === phrase.id
                              ? 'action.selected'
                              : 'transparent',
                          '&:hover': {
                            bgcolor:
                              selectedPhraseId === phrase.id
                                ? 'action.selected'
                                : 'action.hover',
                          },
                        }}
                      >
                        {/* Locator indicator for selected phrase */}
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
                            {Array.from(phrase.text).map(
                              (char, charIndex, arr) => (
                                <React.Fragment
                                  key={`${phrase.id}-${charIndex}`}
                                >
                                  <Typography component="span" variant="body1">
                                    {char}
                                  </Typography>
                                  {charIndex < arr.length - 1 && (
                                    <Box
                                      component="span"
                                      onClick={(event) => {
                                        // 文字間クリックで分割するため、親のクリックを止める
                                        event.stopPropagation();
                                        handleManualSplit(
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
                              ),
                            )}
                          </Box>
                        ) : isManualDeleteMode ? (
                          <>
                            <Typography variant="body1">
                              {phrase.text}
                            </Typography>
                            {index < phrases.length - 1 && (
                              <Box
                                onClick={(event) => {
                                  event.stopPropagation();
                                  const nextPhrase = phrases[index + 1];
                                  if (!nextPhrase) return;
                                  handleManualDeleteDivider(
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
                          // 編集中のフレーズはテキストフィールドに変更
                          <TextField
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              // Escapeキーでキャンセル
                              if (e.key === 'Escape') {
                                setEditingPhraseId(null);
                                setEditingText('');
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
                  });
                })()}
              </Box>
            ))}
          </Box>

          {/* Free memo area */}
          <Box
            sx={{
              px: 2,
              py: 1,
              borderTop: 1,
              borderColor: 'divider',
              height: 120,
            }}
          >
            {/* 手動分割ボタンはフリーメモの上に配置する */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Button
                variant={isManualSplitMode ? 'contained' : 'outlined'}
                size="small"
                onClick={() => {
                  setIsManualSplitMode((prev) => !prev);
                  setIsManualDeleteMode(false);
                }}
                sx={{
                  zIndex: isManualSplitMode || isManualDeleteMode ? 10 : 'auto',
                }}
              >
                分割線を追加
              </Button>
              <Button
                variant={isManualDeleteMode ? 'contained' : 'outlined'}
                size="small"
                onClick={() => {
                  setIsManualDeleteMode((prev) => !prev);
                  setIsManualSplitMode(false);
                  setIsLyricEditMode(false);
                }}
                sx={{
                  zIndex:
                    isManualSplitMode || isManualDeleteMode || isLyricEditMode
                      ? 10
                      : 'auto',
                }}
              >
                分割線を削除
              </Button>
              <Button
                variant={isLyricEditMode ? 'contained' : 'outlined'}
                size="small"
                onClick={handleToggleLyricEditMode}
                sx={{
                  zIndex:
                    isManualSplitMode || isManualDeleteMode || isLyricEditMode
                      ? 10
                      : 'auto',
                }}
              >
                歌詞修正
              </Button>
              {(isManualSplitMode || isManualDeleteMode || isLyricEditMode) && (
                <Typography variant="caption" color="text.secondary">
                  {isManualSplitMode
                    ? '文字間をクリックして分割線を追加します'
                    : isManualDeleteMode
                      ? '分割線をクリックして削除します'
                      : isLyricEditMode
                        ? editingPhraseId
                          ? '編集後、「歌詞修正」ボタンを再度クリックして確定します'
                          : '修正したいフレーズをクリックしてください'
                        : ''}
                </Typography>
              )}
            </Box>
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

        {/* Right side: Mark grid */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            // Flex itemのmin-width:autoを解除して、内部の横スクロールが発火できる幅に制限する
            minWidth: 0,
          }}
        >
          {/* Combined scrollable area */}
          <Box
            ref={marksScrollRef}
            onScroll={handleMarksScroll}
            sx={{
              flex: 1,
              // 横方向のスクロールバーが表示されるように明示する（縦横ともに許可）
              overflowX: 'auto',
              overflowY: 'auto',
              // 子要素の幅に引っ張られないようにする（スクロール幅計算のため）
              minWidth: 0,
            }}
          >
            {/* Take header row - sticky */}
            <Box
              sx={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                bgcolor: 'background.paper',
              }}
            >
              {/* 本文と同じ幅計算になるように、横幅を内容に合わせて固定 */}
              <Box
                sx={{
                  display: 'inline-flex',
                  minWidth: 'min-content',
                  // 内容幅に合わせた領域の背景を塗り、下層の罫線が透けないようにする
                  bgcolor: 'background.paper',
                }}
              >
                {/* テイクヘッダー列 */}
                {song.takes.map((take) => (
                  <Box
                    key={take.id}
                    sx={{
                      px: 2,
                      py: 1,
                      width: takeColumnWidth,
                      flexShrink: 0,
                      borderRight: 1,
                      borderRightColor: 'divider',
                      // +/- 操作列の下に線を出さないため、罫線は各テイク列にだけ付与
                      borderBottom: 1,
                      borderBottomColor: 'divider',
                      boxSizing: 'border-box',
                      // ヘッダー内の上下余白が透けないように背景色を個別列にも付与する
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Box
                      onClick={() => setSelectedTakeId(take.id)}
                      sx={{
                        minHeight: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        bgcolor: take.color,
                        border:
                          selectedTakeId === take.id
                            ? '3px solid'
                            : '1px solid',
                        borderColor:
                          selectedTakeId === take.id
                            ? 'primary.main'
                            : 'divider',
                        boxSizing: 'border-box',
                      }}
                    >
                      <Typography variant="body2" fontWeight="bold">
                        {take.label}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                {/* +/- 操作列（本文のスペーサー列と同じ幅） */}
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    width: controlColumnWidth,
                    flexShrink: 0,
                    // 操作列の右側は罫線を消して空白領域にする
                    borderRight: 'none',
                    boxSizing: 'border-box',
                    // 操作列の上下余白が透けないように背景色を付与する
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
              </Box>
            </Box>

            {/* Marks content */}
            <Box
              sx={{
                display: 'inline-flex',
                minWidth: 'min-content',
              }}
            >
              {/* Each take column - just mark cells, no header */}
              {song.takes.map((take, takeIndex) => (
                <Box
                  key={take.id}
                  sx={{
                    // ヘッダーと同じ列幅に揃える
                    width: takeColumnWidth,
                    flexShrink: 0,
                    borderRight: '1px solid',
                    borderRightColor: 'divider',
                    px: 2,
                    py: 2,
                  }}
                >
                  {phrasesByLine.map(({ lineIndex, phrases }) => {
                    // 空行はマークセル自体を描画しない
                    const isEmptyLine = phrases.every(
                      (phrase) => phrase.text.trim().length === 0,
                    );

                    if (isEmptyLine) {
                      return (
                        <Box
                          key={lineIndex}
                          sx={{
                            mb: 1,
                            minHeight: 40,
                          }}
                        />
                      );
                    }

                    return (
                      <Box
                        key={lineIndex}
                        ref={(el: HTMLDivElement | null) => {
                          // マーク側は先頭テイクの行だけ参照を保持する
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
                          mb: 1,
                          minHeight: 40,
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
                          const isSelected =
                            selectedPhraseId === phrase.id &&
                            selectedTakeId === take.id;
                          const isExtraDenseLayout = phrases.length >= 10;
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
                                      fontSize: isExtraDenseLayout ? 9 : 12,
                                    }}
                                  >
                                    {mark.markValue}
                                  </Typography>
                                )}
                                {mark?.memo && (
                                  <Tooltip
                                    // タップ/ホバー時にメモ内容を表示する
                                    title={
                                      <Typography
                                        variant="body2"
                                        sx={{ whiteSpace: 'pre-line' }}
                                      >
                                        {mark.memo}
                                      </Typography>
                                    }
                                    arrow
                                    // タップ操作でもすぐ出るように遅延を短くする
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
                    );
                  })}
                </Box>
              ))}
              {/* Spacer for +/- buttons alignment */}
              <Box
                sx={{
                  px: 2,
                  py: 2,
                  // ヘッダーの +/- 列と同じ幅・区切り線で整列する
                  width: controlColumnWidth,
                  flexShrink: 0,
                  // 操作列の右側は罫線を消して空白領域にする
                  borderRight: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <Box sx={{ minHeight: 40 }} />
              </Box>
            </Box>
          </Box>

          {/* Mark settings area */}
          <Paper
            elevation={3}
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              height: 120,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* 上部: 現在のテイク番号とロケート歌詞 */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                mb: 1,
              }}
            >
              {song && selectedTakeId && (
                <>
                  <Typography variant="body2" color="text.secondary">
                    テイク:
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {song.takes.find((t) => t.id === selectedTakeId)?.label ||
                      '-'}
                  </Typography>
                </>
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
                  <Typography variant="body1">
                    {song.phrases.find((p) => p.id === selectedPhraseId)
                      ?.text || '-'}
                  </Typography>
                </>
              )}
            </Box>

            {/* 下部: コントロール */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              {/* ロケーター移動ボタン */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton
                  onClick={moveToPreviousPhrase}
                  size="small"
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    color: 'primary.contrastText',
                    backgroundColor: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  }}
                >
                  <ArrowBackIcon />
                </IconButton>
                <IconButton
                  onClick={moveToNextPhrase}
                  size="small"
                  color="primary"
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    color: 'primary.contrastText',
                    backgroundColor: 'primary.main',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  }}
                >
                  <ArrowForwardIcon />
                </IconButton>
              </Box>

              {/* マーク削除ボタン（Delete/Backspace相当） */}
              <Button
                variant="contained"
                size="small"
                onClick={handleClearMark}
                sx={{
                  minWidth: 56,
                  height: 36,
                  borderRadius: 1,
                }}
              >
                DEL
              </Button>

              {/* マーク設定（1～5） */}
              {[1, 2, 3, 4, 5].map((key) => (
                <Box
                  key={key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <Button
                    variant="contained"
                    onClick={() => handleMarkInput(key)}
                    sx={{
                      minWidth: 40,
                      height: 40,
                      borderRadius: 1,
                    }}
                  >
                    {key}
                  </Button>
                  <Input
                    value={markSymbols[key] || ''}
                    onChange={(e) => {
                      const newSymbol = e.target.value.slice(0, 1); // 1文字に制限
                      setMarkSymbols((prev) => ({
                        ...prev,
                        [key]: newSymbol,
                      }));
                      // 設定保存は非同期で実行（UIは先に反映）
                      void setMarkSymbol(key, newSymbol);
                    }}
                    sx={{
                      width: 40,
                      height: 40,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 1,
                      px: 1,
                      '& input': {
                        textAlign: 'center',
                        fontSize: '1.2rem',
                      },
                    }}
                    inputProps={{
                      maxLength: 1,
                    }}
                  />
                </Box>
              ))}

              {/* メモ入力（0） */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <Button
                  variant="contained"
                  onClick={handleMemoInput}
                  sx={{
                    minWidth: 40,
                    height: 40,
                    borderRadius: 1,
                  }}
                >
                  0
                </Button>
                <CreateIcon sx={{ fontSize: 24 }} />
                <Input
                  value={memoText}
                  onChange={(e) => {
                    const newText = e.target.value;
                    setMemoTextState(newText);
                    // 設定保存は非同期で実行（UIは先に反映）
                    void setMemoText(newText);
                  }}
                  placeholder="メモを入力"
                  endAdornment={
                    memoText.trim().length > 0 ? (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="メモをクリア"
                          size="small"
                          onClick={() => {
                            // 手動メモ入力欄をクリアする
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
                    width: 200,
                    height: 40,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    px: 1,
                  }}
                />
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
      {/* 手動分割/削除/歌詞修正モード時は歌詞エリア以外をバックドロップで無効化 */}
      {(isManualSplitMode || isManualDeleteMode || isLyricEditMode) && (
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
