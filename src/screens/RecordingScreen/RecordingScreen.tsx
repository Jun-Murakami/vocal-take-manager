/**
 * Recording Screen
 * Mark takes for each phrase with keyboard shortcuts
 */

import { useEffect, useRef, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import CreateIcon from '@mui/icons-material/Create';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Input,
  InputAdornment,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';

import {
  MarkFilterBar,
  RecordingLyricsArea,
  RecordingTakeHeader,
  RecordingTakeMarkColumn,
} from './components';
import { useMarkFiltering } from './hooks/useMarkFiltering';
import { useRecordingKeyboard } from './hooks/useRecordingKeyboard';

import { BottomPanel, DeleteAndNavControls } from '@/components/BottomPanel';
import { EditableField } from '@/components/EditableField';
import { LyricEditModeControls } from '@/components/LyricEditModeControls';
import { MarksArea } from '@/components/MarksArea';
import { CONTROL_COLUMN_WIDTH, TAKE_COLUMN_WIDTH } from '@/constants/layout';
import {
  getAppSettings,
  getSongById,
  saveSong,
  setMarkSymbol,
  setMemoText,
} from '@/db/database';
import {
  useDocumentTitle,
  useMarksViewportWidth,
  useShortcutFeedback,
  useSynchronizedScroll,
  useTakeCollapse,
} from '@/hooks';
import { showDialog } from '@/stores/dialogStore';
import {
  clearMark,
  clearMarksForTake,
  setMarkMemo,
  setMarkValue,
} from '@/utils/markHelpers';
import {
  findNextSelectablePhrase,
  findPreviousSelectablePhrase,
  isSelectablePhrase,
} from '@/utils/phraseHelpers';
import {
  addTake,
  insertRehearsalMarkAfterLine,
  mergePhraseAtDivider,
  removeLyricsLine,
  removeTake,
  splitPhraseByChar,
} from '@/utils/songHelpers';

import type { FC } from 'react';
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

export const RecordingScreen: FC<RecordingScreenProps> = ({
  songId,
  onNavigate,
}) => {
  const isTablet = useMediaQuery('(max-height: 800px)');

  const [song, setSong] = useState<Song | null>(null);
  const [selectedPhraseId, setSelectedPhraseId] = useState<string | null>(null);
  const [selectedTakeId, setSelectedTakeId] = useState<string | null>(null);
  const [freeMemo, setFreeMemo] = useState('');

  const [isManualSplitMode, setIsManualSplitMode] = useState(false); // 手動分割モード（歌詞の分割線を増やす）
  const [isManualDeleteMode, setIsManualDeleteMode] = useState(false); // 手動削除モード（分割線を削除する）
  const [isLyricEditMode, setIsLyricEditMode] = useState(false); // 歌詞修正モード
  const [isRehearsalMarkMode, setIsRehearsalMarkMode] = useState(false);
  const [editingPhraseId, setEditingPhraseId] = useState<string | null>(null); // 編集中のフレーズID
  const [editingText, setEditingText] = useState(''); // 編集中のテキスト
  const [editingRehearsalMarkId, setEditingRehearsalMarkId] = useState<
    string | null
  >(null); // 編集中のリハーサルマークID
  const [editingRehearsalMarkText, setEditingRehearsalMarkText] = useState(''); // 編集中のリハーサルマークテキスト

  const [markSymbols, setMarkSymbols] = useState<Record<number, string>>({
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
  const [memoText, setMemoTextState] = useState('');

  const { activeMarkFilters, handleToggleFilter, isPhraseHighlighted } =
    useMarkFiltering(song, markSymbols);

  const { activeShortcutKey, triggerShortcutFeedback, getShortcutPulseSx } =
    useShortcutFeedback();

  const {
    primaryScrollRef: lyricsScrollRef,
    secondaryScrollRef: marksScrollRef,
    handlePrimaryScroll: handleLyricsScroll,
    handleSecondaryScroll: handleMarksScroll,
  } = useSynchronizedScroll();

  const { collapsedTakeIds, toggleTakeCollapse } = useTakeCollapse({
    takes: song?.takes,
  });

  const { marksViewportWidth, marksHorizontalScrollbarHeight } =
    useMarksViewportWidth({
      marksScrollRef,
      takeCount: song?.takes.length ?? 0,
      collapsedCount: collapsedTakeIds.size,
      isLoaded: !!song,
    });

  useDocumentTitle(song?.title);

  const lyricsRowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const marksRowRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const pendingSongRef = useRef<Song | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const suppressAutoScrollRef = useRef(false);

  // Load app settings and song data
  useEffect(() => {
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
        // NOTE: リハーサルマークはロケーター対象外のため、ここでも除外する
        const firstSelectablePhrase = loadedSong.phrases.find(
          (phrase) => phrase.text.trim().length > 0 && !phrase.isRehearsalMark,
        );
        if (firstSelectablePhrase) {
          selectPhraseWithScroll(firstSelectablePhrase.id);
        }
        if (loadedSong.takes.length > 0) {
          setSelectedTakeId(loadedSong.takes[0].id);
        }
      }
    };
    loadData();
  }, [songId]);

  // Save song to database (optimistic)
  const handleSaveSong = (updatedSong: Song) => {
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
  };

  // アンマウント時に保存タイマーをクリア
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // 現在フレーズの次の歌詞（表示用）
  const nextPhraseText = (() => {
    if (!song || !selectedPhraseId) return '';
    const currentPhrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!currentPhrase) return '';
    const currentOrder = currentPhrase.order;
    const nextPhrase = song.phrases.find(
      (phrase) => phrase.order > currentOrder && isSelectablePhrase(phrase),
    );
    return nextPhrase?.text || '';
  })();

  /**
   * テイク単位で全マークをクリアする
   * - 対象テイクの記号/メモをまとめて空にする
   * - ユーザー確認ダイアログで誤操作を防ぐ
   */
  const handleClearTakeMarks = async (takeId: string) => {
    if (!song) return;

    // 表示用のテイク名を解決する（ラベルが無い場合は番号にフォールバック）
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

    // 対象テイクのマークを空にして保存する
    const updatedSong = clearMarksForTake(song, takeId);
    handleSaveSong(updatedSong);
  };

  const moveToNextPhrase = () => {
    if (!song || !selectedPhraseId) return;

    const currentPhrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!currentPhrase) return;

    const nextPhrase = findNextSelectablePhrase(
      song.phrases,
      currentPhrase.order,
    );
    if (nextPhrase) {
      selectPhraseWithScroll(nextPhrase.id);
    }
  };

  const moveToPreviousPhrase = () => {
    if (!song || !selectedPhraseId) return;

    const currentPhrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!currentPhrase) return;

    const previousPhrase = findPreviousSelectablePhrase(
      song.phrases,
      currentPhrase.order,
    );
    if (previousPhrase) {
      selectPhraseWithScroll(previousPhrase.id);
    }
  };

  /**
   * マーク記号を入力（1～9）
   */
  const handleMarkInput = async (key: number) => {
    if (!song || !selectedPhraseId || !selectedTakeId) return;

    const symbol = markSymbols[key] || '';
    if (!symbol) {
      // 記号が未設定の場合は「空を入力」して次へ進める
      const updatedSong = clearMark(song, selectedPhraseId, selectedTakeId);
      await handleSaveSong(updatedSong);
      setTimeout(() => {
        moveToNextPhrase();
      }, 0);
      return;
    }

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
  };

  /**
   * メモを入力（0キー）
   */
  const handleMemoInput = async () => {
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
  };

  const handleClearMark = async () => {
    if (!song || !selectedPhraseId || !selectedTakeId) return;

    const updatedSong = clearMark(song, selectedPhraseId, selectedTakeId);
    await handleSaveSong(updatedSong);
  };

  useRecordingKeyboard({
    song,
    selectedPhraseId,
    selectedTakeId,
    isManualSplitMode,
    isManualDeleteMode,
    isLyricEditMode,
    isRehearsalMarkMode,
    onMarkInput: handleMarkInput,
    onMemoInput: handleMemoInput,
    onClearMark: handleClearMark,
    onPrevPhrase: moveToPreviousPhrase,
    onNextPhrase: moveToNextPhrase,
    triggerShortcutFeedback,
  });

  // Save free memo when it changes
  const handleFreeMemoBlur = async () => {
    if (!song) return;
    const updatedSong = { ...song, freeMemo, updatedAt: Date.now() };
    await handleSaveSong(updatedSong);
  };

  /**
   * 手動分割: 指定フレーズを文字位置で分割する
   */
  const handleManualSplit = (phraseId: string, splitIndex: number) => {
    if (!song) return;
    const updatedSong = splitPhraseByChar(song, phraseId, splitIndex);
    if (updatedSong !== song) {
      handleSaveSong(updatedSong);
      // 操作対象のフレーズを選択状態にする（視認性向上）
      selectPhraseWithScroll(phraseId, { suppressScroll: true });
    }
  };

  /**
   * 歌詞修正モードの切り替え
   */
  const handleToggleLyricEditMode = () => {
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
  };

  /**
   * タイトル編集の確定
   */
  const handleTitleSave = (newTitle: string) => {
    if (!song) return;
    const updatedSong: Song = {
      ...song,
      title: newTitle,
      updatedAt: Date.now(),
    };
    void handleSaveSong(updatedSong);
    // タイトル変更時にdocument.titleも更新
    document.title = `${newTitle} - Vocal Take Manager`;
  };

  /**
   * クレジット編集の確定
   */
  const handleCreditsSave = (newCredits: string) => {
    if (!song) return;
    const updatedSong: Song = {
      ...song,
      credits: newCredits,
      updatedAt: Date.now(),
    };
    void handleSaveSong(updatedSong);
  };

  /**
   * リハーサルマーク編集モードの切り替え
   */
  const handleToggleRehearsalMarkMode = () => {
    setIsRehearsalMarkMode((prev) => {
      // モードをオフにする際に編集中の状態をクリア
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

  /**
   * 次の描画サイクルまでロケーター自動スクロールを抑止する
   * - リハーサルマークの追加/編集/削除で song が更新されると、
   *   useEffect による自動スクロールが走って縦位置がリセットされるため
   * - 直後の UI 更新だけ抑止し、その後は通常動作に戻す
   */
  const suppressAutoScrollOnce = () => {
    suppressAutoScrollRef.current = true;
    // 次のタスクで解除しておけば、以降の操作では通常通り自動スクロールする
    window.setTimeout(() => {
      suppressAutoScrollRef.current = false;
    }, 0);
  };

  /**
   * 行間をクリックしてリハーサルマーク行を挿入
   */
  const handleInsertRehearsalMark = async (afterLineIndex: number) => {
    if (!song || !isRehearsalMarkMode) return;
    const result = insertRehearsalMarkAfterLine(song, afterLineIndex);
    if (!result) {
      // 追加できない場合（既にリハーサルマークが存在する、または連続している）
      await showDialog({
        title: 'リハーサルマークの追加',
        content:
          'この行間には既にリハーサルマークが存在するか、リハーサルマーク行が連続して追加できません。',
      });
      return;
    }
    // 先にsongを更新してから編集モードに入る
    // NOTE: リハーサルマーク操作では縦スクロールがリセットされやすいため抑止する
    suppressAutoScrollOnce();
    handleSaveSong(result.song);
    // 追加直後は編集モードで入力
    setEditingRehearsalMarkId(result.rehearsalMarkPhraseId);
    setEditingRehearsalMarkText('');
  };

  /**
   * リハーサルマーク行をクリックして編集開始
   */
  const handleRehearsalMarkClick = (phraseId: string) => {
    if (!isRehearsalMarkMode || !song) return;
    const phrase = song.phrases.find((p) => p.id === phraseId);
    if (!phrase || !phrase.isRehearsalMark) return;

    setEditingRehearsalMarkId(phraseId);
    setEditingRehearsalMarkText(phrase.text);
  };

  /**
   * リハーサルマーク編集の確定
   */
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

    // 編集確定時に縦スクロールが跳ねないよう抑止する
    suppressAutoScrollOnce();
    void handleSaveSong(updatedSong);
    setEditingRehearsalMarkId(null);
    setEditingRehearsalMarkText('');
  };

  /**
   * リハーサルマークを削除する
   * - 歌詞行は維持し、リハーサルマーク行のみ除去する
   * - 編集中のマークを削除した場合は編集状態もクリアする
   */
  const handleDeleteRehearsalMark = (phraseId: string) => {
    if (!song) return;
    const targetPhrase = song.phrases.find((p) => p.id === phraseId);
    if (!targetPhrase || !targetPhrase.isRehearsalMark) return;

    const updatedSong: Song = {
      ...song,
      phrases: song.phrases.filter((p) => p.id !== phraseId),
      updatedAt: Date.now(),
    };

    // 削除時に縦スクロールが跳ねないよう抑止する
    suppressAutoScrollOnce();
    handleSaveSong(updatedSong);

    // 削除対象が編集中の場合は編集状態を解除
    if (editingRehearsalMarkId === phraseId) {
      setEditingRehearsalMarkId(null);
      setEditingRehearsalMarkText('');
    }
  };

  /**
   * フレーズをクリックして編集開始
   */
  const handlePhraseClickForEdit = (phraseId: string) => {
    if (!isLyricEditMode || !song) return;
    const phrase = song.phrases.find((p) => p.id === phraseId);
    if (!phrase) return;

    setEditingPhraseId(phraseId);
    setEditingText(phrase.text);
  };

  /**
   * 歌詞修正モード時の「行削除」処理
   * - 確認ダイアログでユーザー確認を取る
   * - 行に含まれるフレーズと関連データを削除する
   * - 削除後はロケーターの移動先を調整する
   */
  const handleDeleteLyricsLine = async (lineIndex: number) => {
    if (!song || !isLyricEditMode) return;

    // 行に含まれる歌詞フレーズをまとめて取得する
    const linePhrases = song.phrases.filter(
      (phrase) => !phrase.isRehearsalMark && phrase.lineIndex === lineIndex,
    );
    if (linePhrases.length === 0) return;

    // 確認メッセージ用に行の文字列を組み立てる
    const lineText = linePhrases.map((phrase) => phrase.text).join('');
    const result = await showDialog({
      title: '行の削除',
      content: `この行を削除しますか？\n「${lineText || '（空行）'}」`,
      primaryButton: { text: '削除', variant: 'contained', color: 'error' },
      secondaryButton: { text: 'キャンセル', variant: 'outlined' },
    });
    if (result !== '削除') return;

    // 削除対象フレーズをセット化し、ロケーター調整に使う
    const removedPhraseIds = new Set(linePhrases.map((phrase) => phrase.id));
    const minOrderInLine = Math.min(
      ...linePhrases.map((phrase) => phrase.order),
    );
    const updatedSong = removeLyricsLine(song, lineIndex);

    // 削除後は編集状態を解除して保存する
    await handleSaveSong(updatedSong);
    setEditingPhraseId(null);
    setEditingText('');

    // ロケーターが削除行にあった場合は、近い行へ移動する
    if (selectedPhraseId && removedPhraseIds.has(selectedPhraseId)) {
      const nextPhrase = updatedSong.phrases.find(
        (phrase) => !phrase.isRehearsalMark && phrase.order >= minOrderInLine,
      );
      if (nextPhrase) {
        selectPhraseWithScroll(nextPhrase.id);
        return;
      }
      const prevPhrase = [...updatedSong.phrases]
        .reverse()
        .find(
          (phrase) => !phrase.isRehearsalMark && phrase.order < minOrderInLine,
        );
      if (prevPhrase) {
        selectPhraseWithScroll(prevPhrase.id);
      } else {
        // 歌詞が無い場合はロケーターをクリアする
        setSelectedPhraseId(null);
      }
    }
  };

  /**
   * 手動削除: 指定した分割線を結合して削除する
   */
  const handleManualDeleteDivider = async (
    leftPhraseId: string,
    rightPhraseId: string,
  ) => {
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

    const mergeResult = mergePhraseAtDivider(song, leftPhraseId, rightPhraseId);
    if (!mergeResult) return;
    handleSaveSong(mergeResult.song);
    // 結合先フレーズにロケートを合わせる
    selectPhraseWithScroll(mergeResult.mergedPhraseId);
  };

  /**
   * 指定行を画面中央付近に表示するためのスクロール
   */
  const scrollToLine = (lineIndex: number) => {
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
  };

  /**
   * フレーズを選択し、必要に応じてスクロールする統合ヘルパー
   * @param phraseId 選択するフレーズのID
   * @param options.suppressScroll trueの場合、スクロールをスキップ（リハーサルマーク操作用）
   */
  const selectPhraseWithScroll = (
    phraseId: string,
    options?: { suppressScroll?: boolean },
  ) => {
    setSelectedPhraseId(phraseId);
    if (options?.suppressScroll) return;
    if (suppressAutoScrollRef.current) return;
    const phrase = song?.phrases.find((p) => p.id === phraseId);
    if (!phrase || phrase.text.trim().length === 0) return;
    scrollToLine(phrase.lineIndex);
  };

  /**
   * テイクを選択し、横スクロールで表示位置を合わせる統合ヘルパー
   * @param takeId 選択するテイクのID
   */
  const selectTakeWithScroll = (takeId: string) => {
    setSelectedTakeId(takeId);
    if (!marksScrollRef.current || !song) return;
    const selectedIndex = song.takes.findIndex((take) => take.id === takeId);
    if (selectedIndex < 0) return;
    const targetLeft = selectedIndex * TAKE_COLUMN_WIDTH;
    marksScrollRef.current.scrollTo({ left: targetLeft, behavior: 'smooth' });
  };

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
    selectTakeWithScroll(newTake.id);
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
        selectTakeWithScroll(
          updatedSong.takes[updatedSong.takes.length - 1].id,
        );
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

  // Group phrases by lineIndex（歌詞行のみ。リハーサルマークは行間で描画する）
  // NOTE: リハーサルマークのlineIndexを混ぜると空行が生成され、
  //       先頭の追加バーが残る・1行上に追加される見た目になるため除外する。
  const phrasesByLine: PhrasesByLine[] = [];
  const lineMap = new Map<number, Phrase[]>();

  for (const phrase of song.phrases) {
    if (phrase.isRehearsalMark) {
      // リハーサルマークは行間描画のためここでは集計しない
      continue;
    }
    // 通常の歌詞フレーズ
    const phrases = lineMap.get(phrase.lineIndex) || [];
    phrases.push(phrase);
    lineMap.set(phrase.lineIndex, phrases);
  }

  // すべてのlineIndexを取得（歌詞行のみ）
  const sortedLineIndices = Array.from(lineMap.keys()).sort((a, b) => a - b);

  for (const lineIndex of sortedLineIndices) {
    const phrases = lineMap.get(lineIndex) || [];
    phrasesByLine.push({ lineIndex, phrases });
  }

  /**
   * 末尾の「追加余白」幅を計算する。
   * - 目的: 選択中テイクを左端（歌詞のすぐ右）に揃えるためのスクロール余地を作る
   * - CONTROL_COLUMN_WIDTH を含めて、実際に右側へ残る幅を確保する
   */
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
      }}
    >
      {/* Header */}
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
        <Box>
          <EditableField
            value={song.title}
            onSave={handleTitleSave}
            variant="h5"
          />
          <EditableField
            value={song.credits}
            onSave={handleCreditsSave}
            variant="body2"
            color="text.secondary"
          />
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
          {/* Mark filter toggles (left-top area) */}
          <Box
            sx={{
              p: 1,
              // 57px to match marks area sticky header height (header content + 1px border)
              minHeight: 57,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <MarkFilterBar
              markSymbols={markSymbols}
              activeMarkFilters={activeMarkFilters}
              onToggleFilter={handleToggleFilter}
            />
          </Box>

          {/* Lyrics display */}
          <RecordingLyricsArea
            song={song}
            phrasesByLine={phrasesByLine}
            selectedPhraseId={selectedPhraseId}
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
            onLineRef={(lineIndex, el) => {
              lyricsRowRefs.current[lineIndex] = el;
            }}
            scrollSx={{
              paddingBottom:
                marksHorizontalScrollbarHeight > 0
                  ? `calc(33px + ${marksHorizontalScrollbarHeight}px)`
                  : undefined,
            }}
            isPhraseHighlighted={isPhraseHighlighted}
            onPhraseClick={(phraseId) => {
              if (!isManualSplitMode && !isManualDeleteMode) {
                selectPhraseWithScroll(phraseId);
              }
            }}
            onManualSplit={handleManualSplit}
            onManualDeleteDivider={handleManualDeleteDivider}
            onPhraseClickForEdit={handlePhraseClickForEdit}
            onDeleteLyricsLine={handleDeleteLyricsLine}
          />

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
          <MarksArea
            takes={song.takes}
            scrollRef={marksScrollRef}
            onScroll={handleMarksScroll}
            trailingSpacerWidth={trailingSpacerWidth}
            renderHeaderCell={(take) => {
              const isCollapsed = collapsedTakeIds.has(take.id);
              const isSelected = selectedTakeId === take.id;

              return (
                <RecordingTakeHeader
                  key={take.id}
                  take={take}
                  isCollapsed={isCollapsed}
                  isSelected={isSelected}
                  onToggleCollapse={() => toggleTakeCollapse(take.id)}
                  onClearMarks={() => handleClearTakeMarks(take.id)}
                  onSelectTake={() => selectTakeWithScroll(take.id)}
                />
              );
            }}
            headerControlColumn={
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  width: CONTROL_COLUMN_WIDTH,
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
            }
            renderBodyColumn={(take, takeIndex) => (
              <RecordingTakeMarkColumn
                key={take.id}
                take={take}
                takeIndex={takeIndex}
                song={song}
                phrasesByLine={phrasesByLine}
                selectedPhraseId={selectedPhraseId}
                selectedTakeId={selectedTakeId}
                collapsedTakeIds={collapsedTakeIds}
                onSelectPhrase={selectPhraseWithScroll}
                onSelectTake={selectTakeWithScroll}
                onLineRef={(lineIndex, el) => {
                  marksRowRefs.current[lineIndex] = el;
                }}
              />
            )}
            bodyControlColumn={
              <Box
                sx={{
                  px: 2,
                  py: 2,
                  // ヘッダーの +/- 列と同じ幅・区切り線で整列する
                  width: CONTROL_COLUMN_WIDTH,
                  flexShrink: 0,
                  // 操作列の右側は罫線を消して空白領域にする
                  borderRight: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <Box sx={{ minHeight: 40 }} />
              </Box>
            }
            bodyRowSx={{
              pb: '17px',
            }}
          />

          {/* Mark settings area */}
          <BottomPanel
            height={120}
            padding={isTablet ? 1 : 2}
            topContent={
              // 上部: 現在のテイク番号とロケート歌詞
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
              // 下部: コントロール
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

                {/* マーク設定（1～9） */}
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
                        const newSymbol = e.target.value.slice(0, 1); // 1文字に制限
                        setMarkSymbols((prev) => ({
                          ...prev,
                          [key]: newSymbol,
                        }));
                        // 設定保存は非同期で実行（UIは先に反映）
                        void setMarkSymbol(key, newSymbol);
                      }}
                      sx={{
                        // ボタンを内包する分だけ横幅を確保して見やすくする
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
                      // ボタンを入力欄内に配置し、記号入力はその右側から開始する
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

                {/* メモ入力（0） */}
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
                      // 設定保存は非同期で実行（UIは先に反映）
                      void setMemoText(newText);
                    }}
                    onKeyDown={(e) => {
                      // Enter でメモを確定して次へ進む
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleMemoInput();
                      }
                    }}
                    placeholder="メモを入力"
                    // ボタンを入力欄内に配置し、入力位置は右側から開始する
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
      {
        // NOTE:
        // JSXの子要素として「JSの式」を書く場合は必ず `{ ... }` で囲む必要がある。
        // ここが `{}` なしだと、`(isManualSplitMode || ...)` が “ただの文字列/テキストノード” として扱われ、
        // 期待している条件レンダリング（バックドロップ表示）が効かなくなる。
        (isManualSplitMode ||
          isManualDeleteMode ||
          isLyricEditMode ||
          isRehearsalMarkMode) && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(0, 0, 0, 0.35)',
              zIndex: 5,
            }}
          />
        )
      }
    </Box>
  );
};
