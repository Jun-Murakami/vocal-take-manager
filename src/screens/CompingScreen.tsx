/**
 * Comping Screen
 * Select best take for each phrase
 */

import React from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CreateIcon from '@mui/icons-material/Create';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { getSongById, saveSong } from '@/db/database';
import { BottomPanel, DeleteAndNavControls } from '@/components/BottomPanel';
import { LyricsArea } from '@/components/LyricsArea';
import { MarksArea } from '@/components/MarksArea';
import { showDialog } from '@/stores/dialogStore';
import { exportVtmFile } from '@/utils/fileExport';
import { getMark } from '@/utils/markHelpers';
import {
  insertRehearsalMarkAfterLine,
  mergePhraseAtDivider,
  splitPhraseByChar,
} from '@/utils/songHelpers';

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
  // レイアウトの列幅を固定して、ヘッダーと本文のズレを防止する
  // レコーディング画面と同じ幅に揃えて見切れを防ぐ
  const takeColumnWidth = 220;

  const [song, setSong] = React.useState<Song | null>(null);
  const [currentPhraseIndex, setCurrentPhraseIndex] = React.useState(0);
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
  // リハーサルマーク編集モード
  const [isRehearsalMarkMode, setIsRehearsalMarkMode] = React.useState(false);
  // 編集中のリハーサルマークID
  const [editingRehearsalMarkId, setEditingRehearsalMarkId] = React.useState<
    string | null
  >(null);
  // 編集中のリハーサルマークテキスト
  const [editingRehearsalMarkText, setEditingRehearsalMarkText] =
    React.useState('');
  // ショートカット操作の視覚フィードバック用
  const [activeShortcutKey, setActiveShortcutKey] = React.useState<
    string | null
  >(null);
  const shortcutTimeoutRef = React.useRef<number | null>(null);
  // テイク折りたたみ状態（マークエリア専用の表示状態）
  const [collapsedTakeIds, setCollapsedTakeIds] = React.useState<Set<string>>(
    () => new Set(),
  );

  // スクロール同期用の参照
  const lyricsScrollRef = React.useRef<HTMLDivElement>(null);
  const marksScrollRef = React.useRef<HTMLDivElement>(null);
  // テイクマークエリアの可視幅（横スクロール位置の計算に使う）
  const [marksViewportWidth, setMarksViewportWidth] = React.useState(0);
  // 横スクロールバーの高さ（歌詞側の下余白調整に使う）
  const [marksHorizontalScrollbarHeight, setMarksHorizontalScrollbarHeight] =
    React.useState(0);
  // song 未読み込みでも安全に参照できる現在フレーズと選択テイク
  const currentPhrase = song?.phrases[currentPhraseIndex];
  const selectedTakeId = currentPhrase
    ? (song?.comping.selectedTakeByPhraseId[currentPhrase.id] ?? null)
    : null;

  // 印刷時のヘッダー（document.title）を楽曲タイトルに変更
  React.useEffect(() => {
    if (song) {
      // コンピングモードでは「楽曲タイトル - Vocal Take Manager」に設定
      document.title = `${song.title} - Vocal Take Manager`;
    }
    // コンポーネントがアンマウントされる際に元のタイトルに戻す
    return () => {
      document.title = 'Vocal Take Manager';
    };
  }, [song]);

  /**
   * テイクマークエリアの表示幅を保持する。
   * - 選択中テイクを左端（歌詞のすぐ右）へ揃えるために末尾の余白幅を計算する
   * - 画面幅が変わると必要な余白も変わるため、都度更新する
   */
  const updateMarksViewportWidth = React.useCallback(() => {
    const viewport = marksScrollRef.current;
    const viewportWidth = viewport?.clientWidth ?? 0;
    setMarksViewportWidth(viewportWidth);

    // 横スクロールバー分だけ高さが縮むため、その差分を取得して歌詞側に補正する
    const scrollbarHeight = viewport
      ? viewport.offsetHeight - viewport.clientHeight
      : 0;
    setMarksHorizontalScrollbarHeight(scrollbarHeight);
  }, []);

  React.useLayoutEffect(() => {
    // 初回描画時に幅を更新する
    updateMarksViewportWidth();
  }, [updateMarksViewportWidth]);

  React.useEffect(() => {
    // ウィンドウリサイズ時にも幅を更新する
    const handleResize = () => updateMarksViewportWidth();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateMarksViewportWidth]);

  // Load song data
  React.useEffect(() => {
    const loadSong = async () => {
      const loadedSong = await getSongById(songId);
      if (loadedSong) {
        setSong(loadedSong);
        // 空行とリハーサルマークを避けてロケートする
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

  // Save song to database
  const handleSaveSong = React.useCallback(async (updatedSong: Song) => {
    setSong(updatedSong);
    await saveSong(updatedSong);
  }, []);

  /**
   * 選択可能なフレーズ判定（空行とリハーサルマークは除外）
   */
  const isSelectablePhrase = React.useCallback((phrase: Phrase) => {
    return phrase.text.trim().length > 0 && !phrase.isRehearsalMark;
  }, []);

  /**
   * 次の選択可能なフレーズインデックスを取得（空行とリハーサルマークは飛ばす）
   */
  const getNextSelectableIndex = React.useCallback(
    (startIndex: number) => {
      if (!song) return startIndex;
      for (let i = startIndex + 1; i < song.phrases.length; i += 1) {
        if (isSelectablePhrase(song.phrases[i])) {
          return i;
        }
      }
      return startIndex;
    },
    [song, isSelectablePhrase],
  );

  /**
   * 前の選択可能なフレーズインデックスを取得（空行とリハーサルマークは飛ばす）
   */
  const getPreviousSelectableIndex = React.useCallback(
    (startIndex: number) => {
      if (!song) return startIndex;
      for (let i = startIndex - 1; i >= 0; i -= 1) {
        if (isSelectablePhrase(song.phrases[i])) {
          return i;
        }
      }
      return startIndex;
    },
    [song, isSelectablePhrase],
  );

  // 現在フレーズの次の歌詞（表示用）
  const nextPhraseText = React.useMemo(() => {
    if (!song) return '';
    const nextIndex = getNextSelectableIndex(currentPhraseIndex);
    if (nextIndex === currentPhraseIndex) return '';
    return song.phrases[nextIndex]?.text || '';
  }, [song, currentPhraseIndex, getNextSelectableIndex]);

  // ショートカット操作時に一時的なアニメーションを付ける（視認性重視で少し長め）
  const triggerShortcutFeedback = React.useCallback((key: string) => {
    if (shortcutTimeoutRef.current !== null) {
      window.clearTimeout(shortcutTimeoutRef.current);
    }
    setActiveShortcutKey(key);
    shortcutTimeoutRef.current = window.setTimeout(() => {
      setActiveShortcutKey(null);
    }, 360);
  }, []);

  React.useEffect(() => {
    return () => {
      if (shortcutTimeoutRef.current !== null) {
        window.clearTimeout(shortcutTimeoutRef.current);
      }
    };
  }, []);

  /**
   * テイクの折りたたみを切り替える
   * - マークエリアの表示だけを切り替える（データは保持）
   * - 同じ操作で展開に戻せるように Set をトグルする
   */
  const toggleTakeCollapse = React.useCallback((takeId: string) => {
    setCollapsedTakeIds((prev) => {
      const next = new Set(prev);
      if (next.has(takeId)) {
        next.delete(takeId);
      } else {
        next.add(takeId);
      }
      return next;
    });
  }, []);

  /**
   * テイクの増減に合わせて折りたたみ状態を掃除する
   * - すでに削除されたテイクIDが残らないようにする
   */
  React.useEffect(() => {
    if (!song) return;
    setCollapsedTakeIds((prev) => {
      const validIds = new Set(song.takes.map((take) => take.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [song]);

  const getShortcutPulseSx = React.useCallback((isActive: boolean) => {
    if (!isActive) return {};
    return {
      // ボタン色に埋もれやすいので、拡大＋影＋明るさで強調する
      animation: 'shortcutPulse 360ms ease-out',
      '@keyframes shortcutPulse': {
        '0%': {
          transform: 'scale(1)',
          boxShadow: '0 0 0 0 rgba(25, 118, 210, 0.22)',
          filter: 'brightness(1)',
        },
        '60%': {
          transform: 'scale(1.12)',
          boxShadow: '0 0 0 10px rgba(25, 118, 210, 0.14)',
          filter: 'brightness(1.12)',
        },
        '100%': {
          transform: 'scale(1)',
          boxShadow: '0 0 0 0 rgba(25, 118, 210, 0)',
          filter: 'brightness(1)',
        },
      },
    };
  }, []);

  /**
   * 歌詞とマークのスクロールを同期
   */
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
   * 現在選択中のテイクを、歌詞エリアのすぐ右（マークエリア左端）に揃える。
   * - テイク列の幅は固定なので、インデックス × 幅でスクロール位置を算出できる
   * - 末尾に余白を追加することで、最後のテイクも左寄せ表示が可能になる
   */
  React.useEffect(() => {
    if (!song || !selectedTakeId || !marksScrollRef.current) return;
    const selectedIndex = song.takes.findIndex(
      (take) => take.id === selectedTakeId,
    );
    if (selectedIndex < 0) return;
    const targetLeft = selectedIndex * takeColumnWidth;
    marksScrollRef.current.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }, [song, selectedTakeId]);

  /**
   * 手動分割: 指定フレーズを文字位置で分割する
   */
  const handleManualSplit = React.useCallback(
    (phraseId: string, splitIndex: number) => {
      if (!song) return;
      const updatedSong = splitPhraseByChar(song, phraseId, splitIndex);
      if (updatedSong !== song) {
        handleSaveSong(updatedSong);
        // 操作対象のフレーズにロケートする
        const phraseIndex = song.phrases.findIndex(
          (phrase) => phrase.id === phraseId,
        );
        if (phraseIndex >= 0) {
          setCurrentPhraseIndex(phraseIndex);
        }
      }
    },
    [song, handleSaveSong],
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
      const mergedIndex = mergeResult.song.phrases.findIndex(
        (phrase) => phrase.id === mergeResult.mergedPhraseId,
      );
      if (mergedIndex >= 0) {
        setCurrentPhraseIndex(mergedIndex);
      }
    },
    [song, handleSaveSong],
  );

  // Select take for current phrase
  const handleSelectTake = React.useCallback(
    async (takeId: string) => {
      if (!song || !song.phrases[currentPhraseIndex]) return;

      const phrase = song.phrases[currentPhraseIndex];
      if (!isSelectablePhrase(phrase)) return;

      const phraseId = phrase.id;
      const updatedSong: Song = {
        ...song,
        comping: {
          ...song.comping,
          currentPhraseIndex,
          selectedTakeByPhraseId: {
            ...song.comping.selectedTakeByPhraseId,
            [phraseId]: takeId,
          },
        },
        updatedAt: Date.now(),
      };

      await handleSaveSong(updatedSong);

      // Move to next selectable phrase (skip empty lines)
      const nextIndex = getNextSelectableIndex(currentPhraseIndex);
      if (nextIndex !== currentPhraseIndex) {
        setCurrentPhraseIndex(nextIndex);
      }
    },
    [
      song,
      currentPhraseIndex,
      handleSaveSong,
      getNextSelectableIndex,
      isSelectablePhrase,
    ],
  );

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
   * リハーサルマーク編集モードの切り替え
   */
  const handleToggleRehearsalMarkMode = React.useCallback(() => {
    setIsRehearsalMarkMode((prev) => !prev);
    setIsManualSplitMode(false);
    setIsManualDeleteMode(false);
    setIsLyricEditMode(false);
    // モードをオフにする際に編集中の状態をクリア
    if (isRehearsalMarkMode) {
      setEditingRehearsalMarkId(null);
      setEditingRehearsalMarkText('');
    }
  }, [isRehearsalMarkMode]);

  /**
   * 行間をクリックしてリハーサルマーク行を挿入
   */
  const handleInsertRehearsalMark = React.useCallback(
    async (afterLineIndex: number) => {
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
      handleSaveSong(result.song);
      // 追加直後は編集モードで入力
      setEditingRehearsalMarkId(result.rehearsalMarkPhraseId);
      setEditingRehearsalMarkText('');
    },
    [song, isRehearsalMarkMode, handleSaveSong],
  );

  /**
   * リハーサルマーク行をクリックして編集開始
   */
  const handleRehearsalMarkClick = React.useCallback(
    (phraseId: string) => {
      if (!isRehearsalMarkMode || !song) return;
      const phrase = song.phrases.find((p) => p.id === phraseId);
      if (!phrase || !phrase.isRehearsalMark) return;

      setEditingRehearsalMarkId(phraseId);
      setEditingRehearsalMarkText(phrase.text);
    },
    [isRehearsalMarkMode, song],
  );

  /**
   * リハーサルマーク編集の確定
   */
  const handleRehearsalMarkSave = React.useCallback(() => {
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
  }, [song, editingRehearsalMarkId, editingRehearsalMarkText, handleSaveSong]);

  /**
   * リハーサルマークを削除する
   * - 歌詞行は維持し、リハーサルマーク行のみ除去する
   * - 編集中のマークを削除した場合は編集状態もクリアする
   */
  const handleDeleteRehearsalMark = React.useCallback(
    (phraseId: string) => {
      if (!song) return;
      const targetPhrase = song.phrases.find((p) => p.id === phraseId);
      if (!targetPhrase || !targetPhrase.isRehearsalMark) return;

      const updatedSong: Song = {
        ...song,
        phrases: song.phrases.filter((p) => p.id !== phraseId),
        updatedAt: Date.now(),
      };

      handleSaveSong(updatedSong);

      // 削除対象が編集中の場合は編集状態を解除
      if (editingRehearsalMarkId === phraseId) {
        setEditingRehearsalMarkId(null);
        setEditingRehearsalMarkText('');
      }
    },
    [song, handleSaveSong, editingRehearsalMarkId],
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
   * 現在のフレーズに対する採用テイクをクリアする
   */
  const handleClearSelectedTake = React.useCallback(async () => {
    if (!song || !song.phrases[currentPhraseIndex]) return;

    const phrase = song.phrases[currentPhraseIndex];
    if (!isSelectablePhrase(phrase)) return;

    const phraseId = phrase.id;
    if (!song.comping.selectedTakeByPhraseId[phraseId]) return;

    // 選択解除はキーを削除して、未選択状態に戻す
    const updatedSelectedTakeByPhraseId = {
      ...song.comping.selectedTakeByPhraseId,
    };
    delete updatedSelectedTakeByPhraseId[phraseId];

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

  // Navigate to previous/next phrase
  const handlePrevPhrase = React.useCallback(() => {
    if (!song) return;
    const prevIndex = getPreviousSelectableIndex(currentPhraseIndex);
    setCurrentPhraseIndex(prevIndex);
  }, [song, currentPhraseIndex, getPreviousSelectableIndex]);

  const handleNextPhrase = React.useCallback(() => {
    if (!song) return;
    const nextIndex = getNextSelectableIndex(currentPhraseIndex);
    setCurrentPhraseIndex(nextIndex);
  }, [song, currentPhraseIndex, getNextSelectableIndex]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (!song) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 手動分割/削除/歌詞修正/リハーサルマーク編集モード中はキーボード操作を無効化する
      if (
        isManualSplitMode ||
        isManualDeleteMode ||
        isLyricEditMode ||
        isRehearsalMarkMode
      )
        return;

      // Ignore if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Number keys 1-9, 0: Select take by order
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const takeOrder = e.key === '0' ? 10 : Number.parseInt(e.key, 10);
        const take = song.takes.find((t) => t.order === takeOrder);
        if (take) {
          triggerShortcutFeedback(`take-${take.order}`);
          handleSelectTake(take.id);
        }
      }

      // Arrow keys: Navigate between phrases
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

      // Delete/Backspace: Clear selected take for current phrase
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
    isManualSplitMode,
    isManualDeleteMode,
    isLyricEditMode,
    isRehearsalMarkMode,
  ]);

  // Save free memo when it changes
  const handleFreeMemoBlur = React.useCallback(async () => {
    if (!song) return;
    const updatedSong = { ...song, freeMemo, updatedAt: Date.now() };
    await handleSaveSong(updatedSong);
  }, [song, freeMemo, handleSaveSong]);

  const handleBack = () => {
    onNavigate({ type: 'recording', songId });
  };

  const handleExport = React.useCallback(async () => {
    if (!song) return;

    try {
      // 書き出し対象のソング情報をVTMフォーマットに整形する
      const vtmData: VtmExport = {
        version: '1.0',
        exportedAt: Date.now(),
        song,
      };

      // JSONとして整形し、iOS対応のエクスポート処理で書き出す
      const json = JSON.stringify(vtmData, null, 2);
      await exportVtmFile(song.title, json);
    } catch (error) {
      await showDialog({
        title: 'エラー',
        content: `書き出しに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
      });
    }
  }, [song]);

  const handlePrint = () => {
    window.print();
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

  // フレーズのインデックス参照（クリックで移動するため）
  const phraseIndexById = new Map<string, number>();
  song.phrases.forEach((phrase, index) => {
    phraseIndexById.set(phrase.id, index);
  });

  // 行単位にフレーズをまとめる（録音画面と同じ行構成）
  // NOTE: リハーサルマークのlineIndexは行間描画で扱うため除外する。
  //       混在すると空行が生成され、先頭追加バーが残る/ずれる原因になる。
  const phrasesByLine: { lineIndex: number; phrases: Song['phrases'] }[] = [];
  const lineMap = new Map<number, Song['phrases']>();

  for (const phrase of song.phrases) {
    if (phrase.isRehearsalMark) {
      // リハーサルマークは行間描画のためここでは集計しない
      continue;
    }
    // 通常の歌詞フレーズ
    const linePhrases = lineMap.get(phrase.lineIndex) || [];
    linePhrases.push(phrase);
    lineMap.set(phrase.lineIndex, linePhrases);
  }

  // すべてのlineIndexを取得（歌詞行のみ）
  const sortedLineIndices = Array.from(lineMap.keys()).sort((a, b) => a - b);

  for (const lineIndex of sortedLineIndices) {
    const linePhrases = lineMap.get(lineIndex) || [];
    phrasesByLine.push({ lineIndex, phrases: linePhrases });
  }

  // 行の高さと行間（px）を統一してズレを防ぐ
  // NOTE: 4pxだけ高さを詰め、レコーディング画面と同じ密度で
  //       文字・マーク行の並びを揃える。
  const rowHeightPx = 28;
  const rowGapPx = 4;
  const rowGap = `${rowGapPx}px`;

  /**
   * 末尾に追加する余白幅。
   * - 目的: 選択中テイクを左端に揃えて見せるためのスクロール余地
   * - コンピング画面には操作列がないため、単純に1列分の幅を差し引く
   */
  const trailingSpacerWidth = Math.max(0, marksViewportWidth - takeColumnWidth);

  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        // 印刷時はスクロール固定の高さを解除し、全内容をページへ展開する
        '@media print': {
          height: 'auto',
          overflow: 'visible',
          // 背景色やテイクカラーを印刷に反映させる
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        },
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
          // 印刷時はヘッダーの上下余白を詰めてタイトル下の空きを減らす
          '@media print': {
            py: 1,
          },
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
                  sx={{ width: 270 }}
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
                  sx={{ width: 270 }}
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
                  sx={{
                    cursor: 'pointer',
                    // 印刷時はクレジット行の上下余白と行高を詰める
                    '@media print': {
                      lineHeight: 1.2,
                    },
                  }}
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
        <Stack
          direction="row"
          spacing={1}
          sx={{
            // 印刷時は操作ボタンのみ非表示にする
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

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          // 印刷時はスクロールを解除して全体を表示する
          '@media print': {
            overflow: 'visible',
          },
        }}
      >
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
            // 印刷時は歌詞エリアを全幅で表示する
            '@media print': {
              maxWidth: '100%',
              borderRight: 'none',
            },
          }}
        >
          {/* Spacer to align with take header */}
          <Box
            sx={{
              p: 1,
              minHeight: 56,
              '@media print': {
                minHeight: 0,
              },
            }}
          />

          {/* Lyrics display */}
          <LyricsArea
            phrasesByLine={phrasesByLine}
            phrases={song.phrases}
            rowGap={rowGap}
            rowHeightPx={rowHeightPx}
            scrollRef={lyricsScrollRef}
            onScroll={handleLyricsScroll}
            isManualSplitMode={isManualSplitMode}
            isManualDeleteMode={isManualDeleteMode}
            isLyricEditMode={isLyricEditMode}
            isRehearsalMarkMode={isRehearsalMarkMode}
            editingRehearsalMarkId={editingRehearsalMarkId}
            editingRehearsalMarkText={editingRehearsalMarkText}
            onChangeRehearsalMarkText={setEditingRehearsalMarkText}
            onInsertRehearsalMark={handleInsertRehearsalMark}
            onRehearsalMarkClick={handleRehearsalMarkClick}
            onRehearsalMarkSave={handleRehearsalMarkSave}
            onDeleteRehearsalMark={handleDeleteRehearsalMark}
            isLocatorLine={(linePhrases) =>
              linePhrases.some((phrase) => phrase.id === currentPhrase?.id)
            }
            scrollSx={{
              // マーク側に横スクロールバーが出た分だけ歌詞側の下余白を増やす
              paddingBottom:
                marksHorizontalScrollbarHeight > 0
                  ? `calc(16px + ${marksHorizontalScrollbarHeight}px)`
                  : undefined,
              // 印刷時はスクロール領域を解除し、全歌詞を表示する
              '@media print': {
                overflow: 'visible',
                // 印刷時は下部に余白を追加してフリーメモと重ならないようにする
                p: 1,
                pb: 5,
              },
            }}
            lineContainerSx={{
              // 印刷時は行間をさらに詰めて密度を上げる
              '@media print': {
                mb: '2px',
                height: 28,
                '&::after': {
                  opacity: 0,
                },
              },
            }}
            renderPhraseCell={(phrase, index, linePhrases) => {
              const phraseIndex = phraseIndexById.get(phrase.id);
              const isCurrent = currentPhrase && currentPhrase.id === phrase.id;
              const selectedTake =
                song.comping.selectedTakeByPhraseId[phrase.id];
              const selectedTakeLabel = selectedTake
                ? song.takes.find((t) => t.id === selectedTake)?.label
                : null;
              const selectedTakeColor = selectedTake
                ? song.takes.find((t) => t.id === selectedTake)?.color
                : null;
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
                      !isManualDeleteMode &&
                      phraseIndex !== undefined
                    ) {
                      setCurrentPhraseIndex(phraseIndex);
                    }
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor:
                      isManualSplitMode ||
                      isManualDeleteMode ||
                      isLyricEditMode ||
                      isRehearsalMarkMode
                        ? 'text'
                        : 'pointer',
                    position: 'relative',
                    px: 1,
                    py: 0.5,
                    borderRight:
                      index < linePhrases.length - 1
                        ? '1px solid rgba(0, 0, 0, 0.2)'
                        : 'none',
                    bgcolor: isCurrent ? 'action.selected' : 'transparent',
                    '&:hover': {
                      bgcolor: isCurrent ? 'action.selected' : 'action.hover',
                    },
                    // 印刷時はロケーターやホバーの強調を消す
                    '@media print': {
                      cursor: 'default',
                      bgcolor: 'transparent',
                      '&:hover': {
                        bgcolor: 'transparent',
                      },
                    },
                  }}
                >
                  {/* Locator indicator for selected phrase */}
                  {isCurrent && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        bgcolor: 'primary.main',
                        // 印刷時はロケーターを出さない
                        '@media print': {
                          display: 'none',
                        },
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
                      {Array.from(phrase.text).map((char, charIndex, arr) => (
                        <React.Fragment key={`${phrase.id}-${charIndex}`}>
                          <Typography component="span" variant="body1">
                            {char}
                          </Typography>
                          {charIndex < arr.length - 1 && (
                            <Box
                              component="span"
                              onClick={(event) => {
                                // 文字間クリックで分割するため、親のクリックを止める
                                event.stopPropagation();
                                handleManualSplit(phrase.id, charIndex + 1);
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
                  ) : isManualDeleteMode ? (
                    <>
                      <Typography variant="body1">{phrase.text}</Typography>
                      {index < linePhrases.length - 1 && (
                        <Box
                          onClick={(event) => {
                            event.stopPropagation();
                            const nextPhrase = linePhrases[index + 1];
                            if (!nextPhrase) return;
                            handleManualDeleteDivider(phrase.id, nextPhrase.id);
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
                        // Enterキーで確定（ただし、改行も許可）
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
                  {selectedTakeLabel && (
                    <Box
                      sx={{
                        ml: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      {/* テイク番号は小さな四角を背景色で塗り、視認性を上げる */}
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: 0.5,
                          bgcolor: selectedTakeColor || 'action.hover',
                          border: 1,
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxSizing: 'border-box',
                        }}
                      >
                        <Typography variant="caption">
                          {selectedTakeLabel}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            }}
          />

          {/* Free memo area */}
          <Box
            sx={{
              px: 2,
              py: 1,
              borderTop: 1,
              borderColor: 'divider',
              height: 120,
              // 印刷時はフリーメモ入力UIを非表示にする
              '@media print': {
                display: 'none',
              },
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
                    isManualSplitMode ||
                    isManualDeleteMode ||
                    isLyricEditMode ||
                    isRehearsalMarkMode
                      ? 10
                      : 'auto',
                }}
              >
                歌詞修正
              </Button>
              <Button
                variant={isRehearsalMarkMode ? 'contained' : 'outlined'}
                size="small"
                onClick={handleToggleRehearsalMarkMode}
                sx={{
                  zIndex:
                    isManualSplitMode ||
                    isManualDeleteMode ||
                    isLyricEditMode ||
                    isRehearsalMarkMode
                      ? 10
                      : 'auto',
                }}
              >
                リハーサルマーク
              </Button>
              {(isManualSplitMode ||
                isManualDeleteMode ||
                isLyricEditMode ||
                isRehearsalMarkMode) && (
                <Typography variant="caption" color="text.secondary">
                  {isManualSplitMode
                    ? '文字間をクリックして分割線を追加します'
                    : isManualDeleteMode
                      ? '分割線をクリックして削除します'
                      : isLyricEditMode
                        ? editingPhraseId
                          ? '編集後、「歌詞修正」ボタンを再度クリックして確定します'
                          : '修正したいフレーズをクリックしてください'
                        : isRehearsalMarkMode
                          ? '行間をクリックしてリハーサルマークを追加します'
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
              placeholder="メモを入力"
              size="small"
            />
          </Box>
        </Box>

        {/* Right side: Take columns + comping controls */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            minWidth: 0,
            // 印刷時は右側のテイクマークエリアを非表示にする
            '@media print': {
              display: 'none',
            },
          }}
        >
          {/* Combined scrollable area */}
          <MarksArea
            takes={song.takes}
            scrollRef={marksScrollRef}
            onScroll={handleMarksScroll}
            trailingSpacerWidth={trailingSpacerWidth}
            scrollSx={{
              // 印刷時はスクロールを解除して全マークを表示する
              '@media print': {
                overflow: 'visible',
              },
            }}
            headerStickySx={{
              // 印刷時は固定表示を解除する
              '@media print': {
                position: 'static',
              },
            }}
            headerRowSx={{
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
            renderHeaderCell={(take) => {
              // テイク単位の折りたたみ状態を参照する
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
                        // 折りたたみ時は番号のみ表示しているため、クリックで展開する
                        toggleTakeCollapse(take.id);
                      }
                    }}
                    sx={{
                      // テイクヘッダーは視認性を保つため高さは維持する
                      minHeight: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isCollapsed ? 'pointer' : 'default',
                      bgcolor: take.color,
                      border: 1,
                      borderColor: 'divider',
                      boxSizing: 'border-box',
                      // 折りたたみ時はヘッダーを正方形にして番号のみ表示する
                      width: isCollapsed ? 32 : '100%',
                      height: isCollapsed ? 32 : 40,
                      mx: 'auto',
                      position: 'relative',
                      px: 0,
                      maxWidth: '100%',
                    }}
                  >
                    {!isCollapsed && (
                      <IconButton
                        size="small"
                        aria-label="テイクを折りたたむ"
                        onClick={() => {
                          // ヘッダー操作とは独立して折りたたみだけ切り替える
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
                    )}
                    <Typography variant="body2" fontWeight="bold">
                      {isCollapsed ? take.order : take.label}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
            renderBodyColumn={(take) => {
              // 折りたたみ対象かどうかを判定する
              const isCollapsed = collapsedTakeIds.has(take.id);

              return (
                <Box
                  key={take.id}
                  sx={{
                    // ヘッダーと同じ列幅に揃える（折りたたみ時は正方形の幅に寄せる）
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
                      {/* 折りたたみ時は空行だけ確保して高さを保つ */}
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
                              sx={{
                                mb: rowGap,
                                height: rowHeightPx,
                              }}
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
                              <Box
                                sx={{
                                  mb: rowGap,
                                  height: rowHeightPx,
                                }}
                              />
                              {rehearsalMarksForThisLine.map(
                                (rehearsalMark) => (
                                  <Box
                                    key={rehearsalMark.id}
                                    sx={{
                                      mb: rowGap,
                                      height: rowHeightPx,
                                    }}
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
                      {/* 先頭行の前のリハーサルマーク行のマークセル（空） */}
                      {(() => {
                        const firstLinePhrases =
                          phrasesByLine.length > 0
                            ? phrasesByLine[0].phrases
                            : [];
                        const minOrderInFirstLine =
                          firstLinePhrases.length > 0
                            ? Math.min(...firstLinePhrases.map((p) => p.order))
                            : 0;
                        // 先頭行の前のリハーサルマーク（orderが最初の行の最初のphraseのorderより小さい）
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
                              sx={{
                                // リハーサルマーク行の空セルも行高さに合わせる
                                mb: rowGap,
                                height: rowHeightPx,
                              }}
                            />
                          ),
                        );
                      })()}
                      {phrasesByLine.map(
                        ({ lineIndex, phrases }, lineArrayIndex) => {
                          // この行の最後のphraseのorderを取得
                          const maxOrderInThisLine =
                            phrases.length > 0
                              ? Math.max(...phrases.map((p) => p.order))
                              : -1;
                          // 次の行の最初のphraseのorderを取得
                          const nextLinePhrases =
                            lineArrayIndex < phrasesByLine.length - 1
                              ? phrasesByLine[lineArrayIndex + 1].phrases
                              : [];
                          const minOrderInNextLine =
                            nextLinePhrases.length > 0
                              ? Math.min(...nextLinePhrases.map((p) => p.order))
                              : maxOrderInThisLine + 1000;

                          // この行間（この行の後、次の行の前）にリハーサルマークがあるかチェック
                          // orderがこの行の最後のphraseのorderより大きく、次の行の最初のphraseのorderより小さい
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
                              <React.Fragment key={lineIndex}>
                                {/* 空行でもマーク列の高さを詰めて並びを揃える */}
                                <Box
                                  sx={{
                                    // 空行でもマーク列の高さを揃える
                                    mb: rowGap,
                                    height: rowHeightPx,
                                  }}
                                />
                                {/* リハーサルマーク行のマークセル（空） */}
                                {rehearsalMarksForThisLine.map(
                                  (rehearsalMark) => (
                                    <Box
                                      key={rehearsalMark.id}
                                      sx={{
                                        // リハーサルマーク行の空セルも行高さに合わせる
                                        mb: rowGap,
                                        height: rowHeightPx,
                                      }}
                                    />
                                  ),
                                )}
                              </React.Fragment>
                            );
                          }

                          return (
                            <React.Fragment key={lineIndex}>
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
                                  // テイク管理のマーク表示ボックスも行高さを揃える
                                  mb: rowGap,
                                  height: rowHeightPx,
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
                                  const mark = getMark(
                                    song,
                                    phrase.id,
                                    take.id,
                                  );
                                  const isCurrent =
                                    currentPhrase &&
                                    currentPhrase.id === phrase.id;
                                  const isSelectedTake =
                                    isCurrent && selectedTakeId === take.id;
                                  const phraseIndexValue = phraseIndexById.get(
                                    phrase.id,
                                  );
                                  const isExtraDenseLayout =
                                    phrases.length >= 10;

                                  return (
                                    <Box
                                      key={phrase.id}
                                      onClick={() => {
                                        if (phraseIndexValue !== undefined) {
                                          setCurrentPhraseIndex(
                                            phraseIndexValue,
                                          );
                                        }
                                      }}
                                      sx={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        bgcolor: isCurrent
                                          ? 'action.focus'
                                          : 'transparent',
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
                                        border: isSelectedTake
                                          ? '2px solid'
                                          : undefined,
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
                              {/* リハーサルマーク行のマークセル（空） */}
                              {rehearsalMarksForThisLine.map(
                                (rehearsalMark) => (
                                  <Box
                                    key={rehearsalMark.id}
                                    sx={{
                                      // リハーサルマーク行の空セルも行高さに合わせる
                                      mb: rowGap,
                                      height: rowHeightPx,
                                    }}
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
          />

          {/* Bottom comping controls */}
          <BottomPanel
            height={120}
            hideOnPrint
            topContent={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 95 }}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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

                {/* テイク選択 */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    // シャドウで一瞬スクロールバーが出るのを防ぐ
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
                          bgcolor: take.color,
                          border: isSelected ? 2 : 1,
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.25,
                          // 番号を上に寄せて、マークがある場合とない場合で位置を揃える
                          alignItems: 'center',
                          justifyContent: 'center',
                          pt: 0.5, // 上部に少し余白を追加
                          // シャドウ演出が外側に広がってスクロールを誘発しないように抑制
                          overflow: 'hidden',
                          // 変形や影が親のスクロール領域に影響しないように描画を閉じ込める
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
                            // マークがない場合でも高さを確保して位置を揃える
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
      {/* 印刷専用: 歌詞の下にフリーメモを枠付きで出力する */}
      <Box
        sx={{
          display: 'none',
          // 画面では隠し、印刷時のみメモを表示する
          '@media print': {
            display: 'block',
            px: 2,
            pb: 2,
            // 歌詞ブロックとの間隔を確保して重なりを避ける
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
      {/* 手動分割/削除/歌詞修正/リハーサルマーク編集モード時は歌詞エリア以外をバックドロップで無効化 */}
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
            // 印刷時はバックドロップを出さない
            '@media print': {
              display: 'none',
            },
          }}
        />
      )}
    </Box>
  );
};
