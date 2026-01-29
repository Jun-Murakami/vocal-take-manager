/**
 * Recording Screen
 * Mark takes for each phrase with keyboard shortcuts
 */

import React from 'react';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import CreateIcon from '@mui/icons-material/Create';
import ClearIcon from '@mui/icons-material/Clear';
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
import CloseIcon from '@mui/icons-material/Close';
import { alpha } from '@mui/material/styles';

import {
  getAppSettings,
  getSongById,
  saveSong,
  setMarkSymbol,
  setMemoText,
} from '@/db/database';
import { BottomPanel, DeleteAndNavControls } from '@/components/BottomPanel';
import { LyricsArea } from '@/components/LyricsArea';
import { MarksArea } from '@/components/MarksArea';
import { showDialog } from '@/stores/dialogStore';
import {
  clearMark,
  clearMarksForTake,
  getMark,
  setMarkMemo,
  setMarkValue,
} from '@/utils/markHelpers';
import { increaseSaturation } from '@/utils/colorHelpers';
import {
  addTake,
  insertRehearsalMarkAfterLine,
  mergePhraseAtDivider,
  removeLyricsLine,
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
  const theme = useTheme();
  const isTablet = useMediaQuery('(max-height: 800px)');
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
  // リハーサルマーク編集モード
  const [isRehearsalMarkMode, setIsRehearsalMarkMode] = React.useState(false);
  // 編集中のリハーサルマークID
  const [editingRehearsalMarkId, setEditingRehearsalMarkId] = React.useState<
    string | null
  >(null);
  // 編集中のリハーサルマークテキスト
  const [editingRehearsalMarkText, setEditingRehearsalMarkText] =
    React.useState('');

  // アプリ設定（マーク記号とメモテキスト）
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
  // ショートカット操作の視覚フィードバック用
  const [activeShortcutKey, setActiveShortcutKey] = React.useState<
    string | null
  >(null);
  const shortcutTimeoutRef = React.useRef<number | null>(null);
  // テイク折りたたみ状態（マークエリア専用の表示状態）
  const [collapsedTakeIds, setCollapsedTakeIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  // 歌詞ハイライト用のフィルタ（ONのマークキー）
  const [activeMarkFilters, setActiveMarkFilters] = React.useState<number[]>(
    [],
  );

  // フレーズごとのマーク情報を集計して、ハイライト判定を高速化する
  const phraseMarkMap = React.useMemo(() => {
    const map = new Map<string, { symbols: Set<string>; hasMemo: boolean }>();

    if (!song) {
      return map;
    }

    for (const mark of song.marks) {
      const entry = map.get(mark.phraseId) || {
        symbols: new Set<string>(),
        hasMemo: false,
      };

      // 記号マークはシンボル単位で保持する
      if (mark.markValue) {
        entry.symbols.add(mark.markValue);
      }

      // メモマークは「何か文字が入っているか」で判定する
      if (mark.memo && mark.memo.trim().length > 0) {
        entry.hasMemo = true;
      }

      map.set(mark.phraseId, entry);
    }

    return map;
  }, [song]);

  // フィルタ状態に応じてフレーズをハイライトするか判定する
  const isPhraseHighlighted = React.useCallback(
    (phraseId: string) => {
      if (activeMarkFilters.length === 0) {
        return false;
      }

      const entry = phraseMarkMap.get(phraseId);
      if (!entry) {
        return false;
      }

      for (const key of activeMarkFilters) {
        if (key === 0) {
          // 0番はメモマークとして扱う
          if (entry.hasMemo) {
            return true;
          }
          continue;
        }

        const symbol = markSymbols[key] || '';
        if (symbol && entry.symbols.has(symbol)) {
          return true;
        }
      }

      return false;
    },
    [activeMarkFilters, markSymbols, phraseMarkMap],
  );

  // フィルタトグルを切り替える
  const handleToggleFilter = React.useCallback((key: number) => {
    setActiveMarkFilters((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }, []);

  // Refs for synchronized scrolling
  const lyricsScrollRef = React.useRef<HTMLDivElement>(null);
  const marksScrollRef = React.useRef<HTMLDivElement>(null);
  // テイクマークエリアの可視幅（現在の画面幅に応じて更新する）
  const [marksViewportWidth, setMarksViewportWidth] = React.useState(0);
  // 横スクロールバーの高さ（歌詞側の下余白調整に使う）
  const [marksHorizontalScrollbarHeight, setMarksHorizontalScrollbarHeight] =
    React.useState(0);
  // 行位置の参照（自動スクロール用）
  const lyricsRowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  const marksRowRefs = React.useRef<Record<number, HTMLDivElement | null>>({});
  // 楽観的更新の保存待ち（連続入力時の負荷軽減）
  const pendingSongRef = React.useRef<Song | null>(null);
  const saveTimeoutRef = React.useRef<number | null>(null);
  // リハーサルマーク操作時の「意図しない縦スクロール」を抑止するためのフラグ
  // NOTE: song の更新トリガーでロケーター自動スクロールが走るため、必要時だけ一時的に無効化する
  const suppressAutoScrollRef = React.useRef(false);

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

  /**
   * テイクマークエリアの「見えている横幅」を取得して保持する。
   * - 選択中テイクを歌詞のすぐ右に揃えるため、末尾に必要な余白幅を算出する
   * - 画面リサイズやテイク数変更で幅が変わるため都度更新する
   * - 描画タイミングによって ref が null の場合があるため、null なら 0 として保持する
   */
  const updateMarksViewportWidth = React.useCallback(() => {
    const viewport = marksScrollRef.current;
    // DOM が未確定のタイミングでも安全に取得できるようにしておく
    const viewportWidth = viewport?.clientWidth ?? 0;
    setMarksViewportWidth(viewportWidth);

    // 横スクロールバー分だけ高さが縮むため、その差分を取得して歌詞側に補正する
    const scrollbarHeight = viewport
      ? viewport.offsetHeight - viewport.clientHeight
      : 0;
    setMarksHorizontalScrollbarHeight(scrollbarHeight);
  }, []);

  React.useLayoutEffect(() => {
    // 初回描画時に幅を再計算する
    // NOTE: 初回は ref が null のことがあるため 0 になる可能性がある
    updateMarksViewportWidth();
  }, [updateMarksViewportWidth]);

  React.useLayoutEffect(() => {
    // 楽曲ロード後に ref が有効化されるため、必ず再計測する
    // NOTE: これを行わないと末尾余白が 0 のままになり、選択テイクの左寄せが効かない
    if (!song) return;
    updateMarksViewportWidth();
  }, [song, updateMarksViewportWidth]);

  React.useLayoutEffect(() => {
    // テイク数や折りたたみ状態が変わると横スクロールバーの有無が変化するため、
    // 描画直後のタイミングで再計測して歌詞側の下余白を確実に追従させる
    // NOTE: production では StrictMode の二重実行がないため、更新タイミングがズレると
    //       スクロールバー高さが 0 のまま固定されるケースがある
    if (!song) return;
    const takeCount = song.takes.length;
    const collapsedCount = collapsedTakeIds.size;
    // 依存関係として明示的に参照し、状態変更時に必ず再計測する
    if (takeCount >= 0 && collapsedCount >= 0) {
      updateMarksViewportWidth();
    }
  }, [collapsedTakeIds, song, updateMarksViewportWidth]);

  React.useEffect(() => {
    // ウィンドウサイズ変更に追従して、末尾の余白幅を更新する
    const handleResize = () => updateMarksViewportWidth();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateMarksViewportWidth]);

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
        // NOTE: リハーサルマークはロケーター対象外のため、ここでも除外する
        const firstSelectablePhrase = loadedSong.phrases.find(
          (phrase) => phrase.text.trim().length > 0 && !phrase.isRehearsalMark,
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
   * ロケーターで選択可能なフレーズ判定
   * - 空行は無視
   * - リハーサルマークはロケーターの対象外（歌詞フレーズのみ移動させる）
   */
  const isSelectablePhrase = React.useCallback((phrase: Phrase) => {
    // 空白のみの歌詞は選択しない
    const hasText = phrase.text.trim().length > 0;
    // リハーサルマークは行間表示用なので選択しない
    const isRehearsalMark = phrase.isRehearsalMark;
    return hasText && !isRehearsalMark;
  }, []);

  // 現在フレーズの次の歌詞（表示用）
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
   * テイク単位で全マークをクリアする
   * - 対象テイクの記号/メモをまとめて空にする
   * - ユーザー確認ダイアログで誤操作を防ぐ
   */
  const handleClearTakeMarks = React.useCallback(
    async (takeId: string) => {
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
    },
    [song, handleSaveSong],
  );

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

  /**
   * テイクヘッダーの背景色をテーマに合わせて補正する
   * - ライトモードはそのまま
   * - ダークモードは彩度を上げて色の差を見やすくする
   */
  const getTakeHeaderColor = React.useCallback(
    (color: string) => {
      if (theme.palette.mode === 'dark') {
        return darken(increaseSaturation(color, 0.95), 0.4);
      }
      return color;
    },
    [theme.palette.mode],
  );

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
   * 次の選択可能なフレーズに移動（空行・リハーサルマークは飛ばす）
   */
  const moveToNextPhrase = React.useCallback(() => {
    if (!song || !selectedPhraseId) return;

    const currentPhrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!currentPhrase) return;

    // 現在のフレーズの order を取得
    const currentOrder = currentPhrase.order;

    // 次の選択可能なフレーズを探す（空行・リハーサルマークは飛ばす）
    const nextPhrase = song.phrases.find(
      (p) => p.order > currentOrder && isSelectablePhrase(p),
    );

    if (nextPhrase) {
      setSelectedPhraseId(nextPhrase.id);
    }
  }, [song, selectedPhraseId, isSelectablePhrase]);

  /**
   * 前の選択可能なフレーズに移動（空行・リハーサルマークは飛ばす）
   */
  const moveToPreviousPhrase = React.useCallback(() => {
    if (!song || !selectedPhraseId) return;

    const currentPhrase = song.phrases.find((p) => p.id === selectedPhraseId);
    if (!currentPhrase) return;

    // 現在のフレーズの order を取得
    const currentOrder = currentPhrase.order;

    // 前の選択可能なフレーズを探す（空行・リハーサルマークは飛ばす、逆順で検索）
    const previousPhrase = [...song.phrases]
      .reverse()
      .find((p) => p.order < currentOrder && isSelectablePhrase(p));

    if (previousPhrase) {
      setSelectedPhraseId(previousPhrase.id);
    }
  }, [song, selectedPhraseId, isSelectablePhrase]);

  /**
   * マーク記号を入力（1～9）
   */
  const handleMarkInput = React.useCallback(
    async (key: number) => {
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

      // 左右矢印キー: ロケーター移動
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

      // 空行のプレースホルダーは選択・操作対象から除外する
      const selectedPhrase = song.phrases.find(
        (phrase) => phrase.id === selectedPhraseId,
      );
      if (!selectedPhrase || selectedPhrase.text.trim().length === 0) {
        return;
      }

      // Keys 1-9: マーク記号を入力
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const keyNum = Number.parseInt(e.key, 10);
        triggerShortcutFeedback(`mark-${keyNum}`);
        await handleMarkInput(keyNum);
        return;
      }

      // Delete/Backspace: マーク削除
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        triggerShortcutFeedback('delete');
        await handleClearMark();
        return;
      }

      // Key 0: メモを入力
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
   * 現在選択中のテイク列が「歌詞エリアのすぐ右」に来るように横スクロールを合わせる。
   * - 横幅は固定（takeColumnWidth）なので、インデックス * 幅で左端位置を算出する
   * - 末尾に余白を追加することで、最後のテイクでも左寄せが可能になる
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
   * 次の描画サイクルまでロケーター自動スクロールを抑止する
   * - リハーサルマークの追加/編集/削除で song が更新されると、
   *   useEffect による自動スクロールが走って縦位置がリセットされるため
   * - 直後の UI 更新だけ抑止し、その後は通常動作に戻す
   */
  const suppressAutoScrollOnce = React.useCallback(() => {
    suppressAutoScrollRef.current = true;
    // 次のタスクで解除しておけば、以降の操作では通常通り自動スクロールする
    window.setTimeout(() => {
      suppressAutoScrollRef.current = false;
    }, 0);
  }, []);

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
      // NOTE: リハーサルマーク操作では縦スクロールがリセットされやすいため抑止する
      suppressAutoScrollOnce();
      handleSaveSong(result.song);
      // 追加直後は編集モードで入力
      setEditingRehearsalMarkId(result.rehearsalMarkPhraseId);
      setEditingRehearsalMarkText('');
    },
    [song, isRehearsalMarkMode, handleSaveSong, suppressAutoScrollOnce],
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

    // 編集確定時に縦スクロールが跳ねないよう抑止する
    suppressAutoScrollOnce();
    void handleSaveSong(updatedSong);
    setEditingRehearsalMarkId(null);
    setEditingRehearsalMarkText('');
  }, [
    song,
    editingRehearsalMarkId,
    editingRehearsalMarkText,
    handleSaveSong,
    suppressAutoScrollOnce,
  ]);

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

      // 削除時に縦スクロールが跳ねないよう抑止する
      suppressAutoScrollOnce();
      handleSaveSong(updatedSong);

      // 削除対象が編集中の場合は編集状態を解除
      if (editingRehearsalMarkId === phraseId) {
        setEditingRehearsalMarkId(null);
        setEditingRehearsalMarkText('');
      }
    },
    [song, handleSaveSong, editingRehearsalMarkId, suppressAutoScrollOnce],
  );

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
   * 歌詞修正モード時の「行削除」処理
   * - 確認ダイアログでユーザー確認を取る
   * - 行に含まれるフレーズと関連データを削除する
   * - 削除後はロケーターの移動先を調整する
   */
  const handleDeleteLyricsLine = React.useCallback(
    async (lineIndex: number) => {
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
          // 歌詞が無い場合はロケーターをクリアする
          setSelectedPhraseId(null);
        }
      }
    },
    [song, isLyricEditMode, handleSaveSong, selectedPhraseId],
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
    // リハーサルマーク操作の直後は縦スクロールを固定する
    if (suppressAutoScrollRef.current) return;
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

  // 行の高さと行間（px）を統一してズレを防ぐ
  // NOTE: 4pxだけ高さを詰め、歌詞エリアとマークエリアの見た目を
  //       さらに低くしつつピクセル単位の整列を維持する。
  const rowHeightPx = 28;
  const rowGapPx = 4;
  const rowGap = `${rowGapPx}px`;

  /**
   * 末尾の「追加余白」幅を計算する。
   * - 目的: 選択中テイクを左端（歌詞のすぐ右）に揃えるためのスクロール余地を作る
   * - controlColumnWidth を含めて、実際に右側へ残る幅を確保する
   */
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
          {/* Mark filter toggles (left-top area) */}
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
              {/* 1～9: 設定中マーク記号 */}
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
              {/* 0: メモマーク */}
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
              linePhrases.some((phrase) => phrase.id === selectedPhraseId)
            }
            onLineRef={(lineIndex, el) => {
              // 歌詞側の行位置を保存（中央スクロールの基準）
              lyricsRowRefs.current[lineIndex] = el;
            }}
            scrollSx={{
              // マーク側に横スクロールバーが出た分だけ歌詞側の下余白を増やす
              paddingBottom:
                marksHorizontalScrollbarHeight > 0
                  ? `calc(16px + ${marksHorizontalScrollbarHeight}px)`
                  : undefined,
            }}
            lineLeadingContent={(lineIndex) =>
              isLyricEditMode ? (
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
                      // 行全体の削除なので、フレーズ編集のクリックを止める
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
              const isEditing = editingPhraseId === phrase.id;
              // フィルタに一致するマークがあるフレーズは薄いPrimary色でハイライトする
              const shouldHighlight = isPhraseHighlighted(phrase.id);

              return (
                <Box
                  key={phrase.id}
                  onClick={() => {
                    if (isLyricEditMode) {
                      // 歌詞修正モード時は編集開始
                      handlePhraseClickForEdit(phrase.id);
                    } else if (!isManualSplitMode && !isManualDeleteMode) {
                      setSelectedPhraseId(phrase.id);
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
                    // ダークモードでも区切り線が見えるように theme の divider を使う
                    borderRight:
                      index < linePhrases.length - 1 ? '1px solid' : 'none',
                    borderRightColor: 'divider',
                    bgcolor:
                      selectedPhraseId === phrase.id
                        ? shouldHighlight
                          ? (theme) => alpha(theme.palette.primary.main, 0.4)
                          : 'action.selected'
                        : shouldHighlight
                          ? (theme) => alpha(theme.palette.primary.main, 0.175)
                          : 'transparent',
                    '&:hover': {
                      bgcolor:
                        selectedPhraseId === phrase.id
                          ? 'action.selected'
                          : shouldHighlight
                            ? (theme) => alpha(theme.palette.primary.main, 0.3)
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
                    // +/- 操作列の下に線を出さないため、罫線は各テイク列にだけ付与
                    borderBottom: 1,
                    borderBottomColor: 'divider',
                    boxSizing: 'border-box',
                    // ヘッダー内の上下余白が透けないように背景色を個別列にも付与する
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box
                    onClick={() => {
                      if (isCollapsed) {
                        // 折りたたみ時は番号のみ表示しているため、クリックで展開する
                        toggleTakeCollapse(take.id);
                        return;
                      }
                      // 展開中はヘッダークリックでテイク選択を切り替える
                      setSelectedTakeId(take.id);
                    }}
                    sx={{
                      minHeight: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      bgcolor: getTakeHeaderColor(take.color),
                      // 印刷時はライトモードのパレットに戻す
                      '@media print': {
                        bgcolor: take.color,
                      },
                      border:
                        selectedTakeId === take.id ? '3px solid' : '1px solid',
                      borderColor:
                        selectedTakeId === take.id ? 'primary.main' : 'divider',
                      boxSizing: 'border-box',
                      maxWidth: '100%',
                      // 折りたたみ時はヘッダーを正方形にして番号のみ表示する
                      width: isCollapsed ? 32 : '100%',
                      height: isCollapsed ? 32 : 40,
                      mx: 'auto',
                      position: 'relative',
                      // 折りたたみ時は内側の左右余白を確保する
                      px: 0,
                    }}
                  >
                    {!isCollapsed && (
                      <Tooltip title="折りたたむ" arrow>
                        <IconButton
                          size="small"
                          aria-label="テイクを折りたたむ"
                          onClick={(event) => {
                            // ヘッダー選択とは分離して折りたたみだけ切り替える
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
                            // ヘッダー選択とは分離してテイクのクリアだけ行う
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
            renderBodyColumn={(take, takeIndex) => {
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

                          // 空行はマークセル自体を描画しない
                          const isEmptyLine = phrases.every(
                            (phrase) => phrase.text.trim().length === 0,
                          );

                          if (isEmptyLine) {
                            return (
                              <React.Fragment key={lineIndex}>
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

                          // マーク側でロケーター行かどうか（下線の色変更に使う）
                          const isLocatorLine = phrases.some(
                            (phrase) => phrase.id === selectedPhraseId,
                          );

                          return (
                            <React.Fragment key={lineIndex}>
                              <Box
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
                                  // テイク管理のマーク表示ボックスも行高さを揃える
                                  mb: rowGap,
                                  height: rowHeightPx,
                                  border: 1,
                                  borderColor: 'divider',
                                  // ロケーター行の選択中テイクは下線だけ色を強調する
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
            bodyControlColumn={
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
            }
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
          }}
        />
      )}
    </Box>
  );
};
