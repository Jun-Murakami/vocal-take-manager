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
  CircularProgress,
  IconButton,
  Input,
  InputAdornment,
  Paper,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
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
  insertRehearsalMarkAfterLine,
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

  // Refs for synchronized scrolling
  const lyricsScrollRef = React.useRef<HTMLDivElement>(null);
  const marksScrollRef = React.useRef<HTMLDivElement>(null);
  // テイクマークエリアの可視幅（現在の画面幅に応じて更新する）
  const [marksViewportWidth, setMarksViewportWidth] = React.useState(0);
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
    // DOM が未確定のタイミングでも安全に取得できるようにしておく
    const viewportWidth = marksScrollRef.current?.clientWidth ?? 0;
    setMarksViewportWidth(viewportWidth);
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

      // Keys 1-9: マーク記号を入力
      if (e.key >= '1' && e.key <= '9') {
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
                isManualSplitMode ||
                isManualDeleteMode ||
                isLyricEditMode ||
                isRehearsalMarkMode
                  ? 6
                  : 'auto',
              // バックドロップの暗さが透けないように背景色を明示する
              bgcolor:
                isManualSplitMode ||
                isManualDeleteMode ||
                isLyricEditMode ||
                isRehearsalMarkMode
                  ? 'background.paper'
                  : 'transparent',
            }}
          >
            {/* 先頭行の前のリハーサルマーク行を表示 */}
            {(() => {
              const firstLinePhrases =
                phrasesByLine.length > 0 ? phrasesByLine[0].phrases : [];
              const minOrderInFirstLine =
                firstLinePhrases.length > 0
                  ? Math.min(...firstLinePhrases.map((p) => p.order))
                  : 0;
              // 先頭行の前のリハーサルマーク（orderが最初の行の最初のphraseのorderより小さい）
              const rehearsalMarksBeforeFirstLine = song.phrases.filter(
                (p) => p.isRehearsalMark && p.order < minOrderInFirstLine,
              );
              return (
                <>
                  {/* 最初の行の前の行間クリック領域を表示（先頭にリハーサルマークがない場合のみ、かつ編集中でない場合） */}
                  {isRehearsalMarkMode &&
                    phrasesByLine.length > 0 &&
                    rehearsalMarksBeforeFirstLine.length === 0 &&
                    !editingRehearsalMarkId && (
                      <Box
                        onClick={() => handleInsertRehearsalMark(-1)}
                        sx={{
                          height: 3,
                          mb: 1,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          pl: 2,
                          color: 'primary.main',
                          '&:hover': {
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        {/* 追加バーはシンプルに左矢印のみ表示する */}
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          sx={{ transform: 'scale(3,1)' }}
                        >
                          ←
                        </Typography>
                      </Box>
                    )}
                  {rehearsalMarksBeforeFirstLine.map((rehearsalMark) => {
                    const isEditingRehearsalMark =
                      editingRehearsalMarkId === rehearsalMark.id;
                    return (
                      <Box
                        key={rehearsalMark.id}
                        sx={{
                          width: '100%',
                          // リハーサルマーク行も歌詞行と同じ高さに揃える
                          mb: rowGap,
                          height: rowHeightPx,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          position: 'relative',
                        }}
                      >
                        {isEditingRehearsalMark ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                border: 2,
                                borderColor: 'primary.main',
                                borderRadius: 1,
                                px: 1.5,
                                py: 0.5,
                              }}
                            >
                              <TextField
                                value={editingRehearsalMarkText}
                                onChange={(e) =>
                                  setEditingRehearsalMarkText(e.target.value)
                                }
                                onKeyDown={(event) => {
                                  // Enterで確定ボタンと同じ動作にする
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    handleRehearsalMarkSave();
                                  }
                                }}
                                variant="standard"
                                size="small"
                                autoFocus
                                placeholder="1A, 2B, 3C ..."
                                sx={{ width: 100 }}
                              />
                              <Button
                                variant="contained"
                                size="small"
                                onClick={handleRehearsalMarkSave}
                              >
                                確定
                              </Button>
                            </Box>
                            {/* リハーサルマーク編集モード中のみ削除ボタンを表示 */}
                            {isRehearsalMarkMode && (
                              <IconButton
                                size="small"
                                aria-label="リハーサルマークを削除"
                                onClick={(event) => {
                                  // 編集ボックスのクリックイベントを阻止して削除だけ実行する
                                  event.stopPropagation();
                                  handleDeleteRehearsalMark(rehearsalMark.id);
                                }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Box
                              onClick={() => {
                                if (isRehearsalMarkMode) {
                                  handleRehearsalMarkClick(rehearsalMark.id);
                                }
                              }}
                              sx={{
                                border: 2,
                                borderColor: 'primary.main',
                                borderRadius: 1,
                                px: 1.5,
                                py: 0.5,
                                display: 'inline-block',
                                cursor: isRehearsalMarkMode
                                  ? 'pointer'
                                  : 'default',
                                bgcolor: 'background.paper',
                                '&:hover': isRehearsalMarkMode
                                  ? {
                                      bgcolor: 'action.hover',
                                    }
                                  : {},
                              }}
                            >
                              <Typography
                                variant="body1"
                                fontWeight="bold"
                                sx={{ textAlign: 'left' }}
                              >
                                {rehearsalMark.text || '[リハーサルマーク]'}
                              </Typography>
                            </Box>
                            {/* リハーサルマーク編集モード中のみ削除ボタンを表示 */}
                            {isRehearsalMarkMode && (
                              <IconButton
                                size="small"
                                aria-label="リハーサルマークを削除"
                                onClick={(event) => {
                                  // 表示ボックスのクリックで編集開始しないように阻止する
                                  event.stopPropagation();
                                  handleDeleteRehearsalMark(rehearsalMark.id);
                                }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </>
              );
            })()}
            {phrasesByLine.map(({ lineIndex, phrases }, lineArrayIndex) => {
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
              // この行間に既にリハーサルマークがあるかチェック
              const hasRehearsalMarkBetweenLines =
                rehearsalMarksForThisLine.length > 0;

              // ロケーターがある行かどうか（歌詞エリアの下線表示用）
              const isLocatorLine = phrases.some(
                (phrase) => phrase.id === selectedPhraseId,
              );

              return (
                <React.Fragment key={lineIndex}>
                  {/* 通常の歌詞行 */}
                  <Box
                    ref={(el: HTMLDivElement | null) => {
                      // 歌詞側の行位置を保存（中央スクロールの基準）
                      lyricsRowRefs.current[lineIndex] = el;
                    }}
                    sx={{
                      display: 'flex',
                      // ピクセル単位で行の高さと行間を固定する
                      mb: rowGap,
                      height: rowHeightPx,
                      alignItems: 'stretch',
                      // 疑似要素で下線を引くため、基準位置を確保する
                      position: 'relative',
                      // ロケーター行は歌詞エリアの左右いっぱいに下線を入れる
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        // 右側だけパディング分を伸ばす（左側はパディングを維持）
                        left: 0,
                        right: (theme) => `calc(${theme.spacing(2)} * -1)`,
                        bottom: 0,
                        // MUIの高さは数値だと「100%扱い」になりやすいのでpx指定にする
                        height: '1px',
                        bgcolor: 'primary.main',
                        opacity: isLocatorLine ? 1 : 0,
                        pointerEvents: 'none',
                      },
                      boxSizing: 'border-box',
                    }}
                  >
                    {(() => {
                      // 空行はボックスを表示せず、空白の行間だけを確保する
                      const isEmptyLine = phrases.every(
                        (phrase) => phrase.text.trim().length === 0,
                      );

                      if (isEmptyLine) {
                        // 空行は下線対象から外し、スペーサーのみ表示する
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
                                isLyricEditMode ||
                                isRehearsalMarkMode
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
                                      <Typography
                                        component="span"
                                        variant="body1"
                                      >
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
                              <Typography variant="body1">
                                {phrase.text}
                              </Typography>
                            )}
                          </Box>
                        );
                      });
                    })()}
                  </Box>
                  {/* この行の後にリハーサルマーク行を表示 */}
                  {rehearsalMarksForThisLine.map((rehearsalMark) => {
                    const isEditingRehearsalMark =
                      editingRehearsalMarkId === rehearsalMark.id;
                    return (
                      <Box
                        key={rehearsalMark.id}
                        sx={{
                          width: '100%',
                          // リハーサルマーク行も歌詞行と同じ高さに揃える
                          mb: rowGap,
                          height: rowHeightPx,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          position: 'relative',
                        }}
                      >
                        {isEditingRehearsalMark ? (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                border: 2,
                                borderColor: 'primary.main',
                                borderRadius: 1,
                                px: 1.5,
                                py: 0.5,
                              }}
                            >
                              <TextField
                                value={editingRehearsalMarkText}
                                onChange={(e) =>
                                  setEditingRehearsalMarkText(e.target.value)
                                }
                                onKeyDown={(event) => {
                                  // Enterで確定ボタンと同じ動作にする
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    handleRehearsalMarkSave();
                                  }
                                }}
                                variant="standard"
                                size="small"
                                autoFocus
                                placeholder="1A, 2B, 3C ..."
                                sx={{ width: 100 }}
                              />
                              <Button
                                variant="contained"
                                size="small"
                                onClick={handleRehearsalMarkSave}
                              >
                                確定
                              </Button>
                            </Box>
                            {/* リハーサルマーク編集モード中のみ削除ボタンを表示 */}
                            {isRehearsalMarkMode && (
                              <IconButton
                                size="small"
                                aria-label="リハーサルマークを削除"
                                onClick={(event) => {
                                  // 編集ボックスのクリックイベントを阻止して削除だけ実行する
                                  event.stopPropagation();
                                  handleDeleteRehearsalMark(rehearsalMark.id);
                                }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Box
                              onClick={() => {
                                if (isRehearsalMarkMode) {
                                  handleRehearsalMarkClick(rehearsalMark.id);
                                }
                              }}
                              sx={{
                                border: 2,
                                borderColor: 'primary.main',
                                borderRadius: 1,
                                px: 1.5,
                                py: 0.5,
                                display: 'inline-block',
                                cursor: isRehearsalMarkMode
                                  ? 'pointer'
                                  : 'default',
                                bgcolor: 'background.paper',
                                '&:hover': isRehearsalMarkMode
                                  ? {
                                      bgcolor: 'action.hover',
                                    }
                                  : {},
                              }}
                            >
                              <Typography
                                variant="body1"
                                fontWeight="bold"
                                sx={{ textAlign: 'left' }}
                              >
                                {rehearsalMark.text || '[リハーサルマーク]'}
                              </Typography>
                            </Box>
                            {/* リハーサルマーク編集モード中のみ削除ボタンを表示 */}
                            {isRehearsalMarkMode && (
                              <IconButton
                                size="small"
                                aria-label="リハーサルマークを削除"
                                onClick={(event) => {
                                  // 表示ボックスのクリックで編集開始しないように阻止する
                                  event.stopPropagation();
                                  handleDeleteRehearsalMark(rehearsalMark.id);
                                }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                  {/* 行間クリック領域（リハーサルマーク編集モード時のみ表示、この行間にリハーサルマークがない場合のみ） */}
                  {isRehearsalMarkMode && !hasRehearsalMarkBetweenLines && (
                    <Box
                      onClick={() => handleInsertRehearsalMark(lineIndex)}
                      sx={{
                        height: 3,
                        mb: 1,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        pl: 2,
                        color: 'primary.main',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      {/* 追加バーはシンプルに左矢印のみ表示する */}
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        sx={{ transform: 'scale(3,1)' }}
                      >
                        ←
                      </Typography>
                    </Box>
                  )}
                </React.Fragment>
              );
            })}
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
                {/* 末尾に余白を追加して、最後のテイクでも左寄せスクロールできるようにする */}
                <Box
                  sx={{
                    width: trailingSpacerWidth,
                    flexShrink: 0,
                    bgcolor: 'background.paper',
                  }}
                />
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
                  {/* 先頭行の前のリハーサルマーク行のマークセル（空） */}
                  {(() => {
                    const firstLinePhrases =
                      phrasesByLine.length > 0 ? phrasesByLine[0].phrases : [];
                    const minOrderInFirstLine =
                      firstLinePhrases.length > 0
                        ? Math.min(...firstLinePhrases.map((p) => p.order))
                        : 0;
                    // 先頭行の前のリハーサルマーク（orderが最初の行の最初のphraseのorderより小さい）
                    const rehearsalMarksBeforeFirstLine = song.phrases.filter(
                      (p) => p.isRehearsalMark && p.order < minOrderInFirstLine,
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
                            {rehearsalMarksForThisLine.map((rehearsalMark) => (
                              <Box
                                key={rehearsalMark.id}
                                sx={{
                                  // リハーサルマーク行の空セルも行高さに合わせる
                                  mb: rowGap,
                                  height: rowHeightPx,
                                }}
                              />
                            ))}
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
                          {/* リハーサルマーク行のマークセル（空） */}
                          {rehearsalMarksForThisLine.map((rehearsalMark) => (
                            <Box
                              key={rehearsalMark.id}
                              sx={{
                                // リハーサルマーク行の空セルも行高さに合わせる
                                mb: rowGap,
                                height: rowHeightPx,
                              }}
                            />
                          ))}
                        </React.Fragment>
                      );
                    },
                  )}
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
              {/* 末尾余白（選択中テイクの左寄せスクロール用） */}
              <Box
                sx={{
                  width: trailingSpacerWidth,
                  flexShrink: 0,
                }}
              />
            </Box>
          </Box>

          {/* Mark settings area */}
          <Paper
            elevation={3}
            sx={{
              p: isTablet ? 1 : 2,
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
                gap: isTablet ? 1.5 : 2,
                flexWrap: 'wrap',
              }}
            >
              {/* マーク削除ボタン（Delete/Backspace相当） */}
              <Button
                variant="contained"
                size="small"
                onClick={handleClearMark}
                sx={{
                  minWidth: 56,
                  height: isTablet ? 28 : 36,
                  borderRadius: 1,
                }}
              >
                DEL
              </Button>
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
                    height: isTablet ? 28 : undefined,
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
                    height: isTablet ? 28 : undefined,
                  }}
                >
                  <ArrowForwardIcon />
                </IconButton>
              </Box>

              {/* マーク設定（1～9） */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((key) => (
                <Box
                  key={key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
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
                      width: isTablet ? 60 : 66,
                      height: isTablet ? 30 : 38,
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
                            minWidth: isTablet ? 22 : 26,
                            height: isTablet ? 20 : 24,
                            borderRadius: 0.5,
                            px: 0.5,
                            fontSize: '0.7rem',
                            lineHeight: 1,
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
                          minWidth: isTablet ? 22 : 26,
                          height: isTablet ? 20 : 24,
                          borderRadius: 0.5,
                          px: 0.5,
                          fontSize: '0.7rem',
                          lineHeight: 1,
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
                    height: isTablet ? 30 : 38,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    px: 0.5,
                  }}
                />
                <CreateIcon sx={{ fontSize: isTablet ? 18 : 22 }} />
              </Box>
            </Box>
          </Paper>
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
