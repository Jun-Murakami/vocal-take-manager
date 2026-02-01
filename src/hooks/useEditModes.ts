/**
 * useEditModes Hook
 * Manages all edit modes (manual split, manual delete, lyric edit, rehearsal mark)
 */

import React from 'react';

import {
  insertRehearsalMarkAfterLine,
  mergePhraseAtDivider,
  splitPhraseByChar,
} from '@/utils/songHelpers';

import type { Song } from '@/types/models';

export interface UseEditModesReturn {
  // Mode states
  isManualSplitMode: boolean;
  isManualDeleteMode: boolean;
  isLyricEditMode: boolean;
  isRehearsalMarkMode: boolean;

  // Lyric editing states
  editingPhraseId: string | null;
  editingText: string;

  // Rehearsal mark editing states
  editingRehearsalMarkId: string | null;
  editingRehearsalMarkText: string;

  // Mode togglers
  setIsManualSplitMode: (value: boolean) => void;
  setIsManualDeleteMode: (value: boolean) => void;
  handleToggleLyricEditMode: () => void;
  handleToggleRehearsalMarkMode: () => void;

  // Lyric editing handlers
  handlePhraseClickForEdit: (phraseId: string, phraseText: string) => void;
  setEditingText: (text: string) => void;

  // Rehearsal mark handlers
  handleRehearsalMarkClick: (phraseId: string, text: string) => void;
  setEditingRehearsalMarkText: (text: string) => void;
  handleRehearsalMarkSave: () => void;
  handleDeleteRehearsalMark: (phraseId: string) => void;
  handleInsertRehearsalMark: (afterLineIndex: number) => void;

  // Phrase manipulation handlers
  handleManualSplit: (phraseId: string, charIndex: number) => void;
  handleManualDeleteDivider: (phraseId: string, nextPhraseId: string) => void;
}

export function useEditModes(
  song: Song | null,
  onSongChange: (updater: (prev: Song) => Song) => void,
): UseEditModesReturn {
  // Mode states
  const [isManualSplitMode, setIsManualSplitModeInternal] =
    React.useState(false);
  const [isManualDeleteMode, setIsManualDeleteModeInternal] =
    React.useState(false);
  const [isLyricEditMode, setIsLyricEditMode] = React.useState(false);
  const [isRehearsalMarkMode, setIsRehearsalMarkMode] = React.useState(false);

  // Lyric editing states
  const [editingPhraseId, setEditingPhraseId] = React.useState<string | null>(
    null,
  );
  const [editingText, setEditingText] = React.useState('');

  // Rehearsal mark editing states
  const [editingRehearsalMarkId, setEditingRehearsalMarkId] = React.useState<
    string | null
  >(null);
  const [editingRehearsalMarkText, setEditingRehearsalMarkText] =
    React.useState('');

  /**
   * Mode togglers with mutual exclusion
   */
  const setIsManualSplitMode = React.useCallback((value: boolean) => {
    setIsManualSplitModeInternal(value);
    if (value) {
      setIsManualDeleteModeInternal(false);
    }
  }, []);

  const setIsManualDeleteMode = React.useCallback((value: boolean) => {
    setIsManualDeleteModeInternal(value);
    if (value) {
      setIsManualSplitModeInternal(false);
      setIsLyricEditMode(false);
    }
  }, []);

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

      onSongChange((prev) => ({
        ...prev,
        phrases: updatedPhrases,
        updatedAt: Date.now(),
      }));

      setEditingPhraseId(null);
      setEditingText('');
    }
    setIsLyricEditMode((prev) => !prev);
    setIsManualSplitModeInternal(false);
    setIsManualDeleteModeInternal(false);
  }, [isLyricEditMode, editingPhraseId, editingText, song, onSongChange]);

  /**
   * リハーサルマークモードの切り替え
   */
  const handleToggleRehearsalMarkMode = React.useCallback(() => {
    // モードをオフにする際に編集中の状態があれば保存
    if (isRehearsalMarkMode && editingRehearsalMarkId) {
      if (!song) return;
      const phraseIndex = song.phrases.findIndex(
        (p) => p.id === editingRehearsalMarkId,
      );
      if (phraseIndex >= 0) {
        const updatedPhrases = [...song.phrases];
        updatedPhrases[phraseIndex] = {
          ...updatedPhrases[phraseIndex],
          text: editingRehearsalMarkText,
        };

        onSongChange((prev) => ({
          ...prev,
          phrases: updatedPhrases,
          updatedAt: Date.now(),
        }));
      }

      setEditingRehearsalMarkId(null);
      setEditingRehearsalMarkText('');
    }

    setIsRehearsalMarkMode((prev) => !prev);
    setIsManualSplitModeInternal(false);
    setIsManualDeleteModeInternal(false);
    setIsLyricEditMode(false);

    // モードをオフにする際に編集中の状態をクリア
    if (isRehearsalMarkMode) {
      setEditingRehearsalMarkId(null);
      setEditingRehearsalMarkText('');
    }
  }, [
    isRehearsalMarkMode,
    editingRehearsalMarkId,
    editingRehearsalMarkText,
    song,
    onSongChange,
  ]);

  /**
   * フレーズをクリックして編集開始
   */
  const handlePhraseClickForEdit = React.useCallback(
    (phraseId: string, phraseText: string) => {
      if (!isLyricEditMode || !song) return;
      const phrase = song.phrases.find((p) => p.id === phraseId);
      if (!phrase) return;

      setEditingPhraseId(phraseId);
      setEditingText(phraseText);
    },
    [isLyricEditMode, song],
  );

  /**
   * リハーサルマーク行をクリックして編集開始
   */
  const handleRehearsalMarkClick = React.useCallback(
    (phraseId: string, text: string) => {
      if (!isRehearsalMarkMode || !song) return;
      const phrase = song.phrases.find((p) => p.id === phraseId);
      if (!phrase || !phrase.isRehearsalMark) return;

      setEditingRehearsalMarkId(phraseId);
      setEditingRehearsalMarkText(text);
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

    onSongChange((prev) => ({
      ...prev,
      phrases: updatedPhrases,
      updatedAt: Date.now(),
    }));

    setEditingRehearsalMarkId(null);
    setEditingRehearsalMarkText('');
  }, [song, editingRehearsalMarkId, editingRehearsalMarkText, onSongChange]);

  /**
   * リハーサルマークを削除する
   */
  const handleDeleteRehearsalMark = React.useCallback(
    (phraseId: string) => {
      if (!song) return;
      const targetPhrase = song.phrases.find((p) => p.id === phraseId);
      if (!targetPhrase || !targetPhrase.isRehearsalMark) return;

      onSongChange((prev) => ({
        ...prev,
        phrases: prev.phrases.filter((p) => p.id !== phraseId),
        updatedAt: Date.now(),
      }));

      // 削除対象が編集中の場合は編集状態を解除
      if (editingRehearsalMarkId === phraseId) {
        setEditingRehearsalMarkId(null);
        setEditingRehearsalMarkText('');
      }
    },
    [song, editingRehearsalMarkId, onSongChange],
  );

  /**
   * 行間をクリックしてリハーサルマーク行を挿入
   */
  const handleInsertRehearsalMark = React.useCallback(
    (afterLineIndex: number) => {
      if (!song || !isRehearsalMarkMode) return;
      const result = insertRehearsalMarkAfterLine(song, afterLineIndex);
      if (!result) {
        // 追加できない場合は何もしない（呼び出し側でダイアログ表示）
        return;
      }

      onSongChange(() => result.song);

      // 追加直後は編集モードで入力
      setEditingRehearsalMarkId(result.rehearsalMarkPhraseId);
      setEditingRehearsalMarkText('');
    },
    [song, isRehearsalMarkMode, onSongChange],
  );

  /**
   * 手動分割: 文字位置でフレーズを2つに分割する
   */
  const handleManualSplit = React.useCallback(
    (phraseId: string, splitIndex: number) => {
      if (!song) return;
      const updatedSong = splitPhraseByChar(song, phraseId, splitIndex);
      if (updatedSong !== song) {
        onSongChange(() => updatedSong);
      }
    },
    [song, onSongChange],
  );

  /**
   * 手動分割: 指定した境界（左/右フレーズ）を結合して分割線を削除する
   */
  const handleManualDeleteDivider = React.useCallback(
    (leftPhraseId: string, rightPhraseId: string) => {
      if (!song) return;

      const mergeResult = mergePhraseAtDivider(
        song,
        leftPhraseId,
        rightPhraseId,
      );
      if (!mergeResult) return;

      onSongChange(() => mergeResult.song);
    },
    [song, onSongChange],
  );

  return {
    // Mode states
    isManualSplitMode,
    isManualDeleteMode,
    isLyricEditMode,
    isRehearsalMarkMode,

    // Lyric editing states
    editingPhraseId,
    editingText,

    // Rehearsal mark editing states
    editingRehearsalMarkId,
    editingRehearsalMarkText,

    // Mode togglers
    setIsManualSplitMode,
    setIsManualDeleteMode,
    handleToggleLyricEditMode,
    handleToggleRehearsalMarkMode,

    // Lyric editing handlers
    handlePhraseClickForEdit,
    setEditingText,

    // Rehearsal mark handlers
    handleRehearsalMarkClick,
    setEditingRehearsalMarkText,
    handleRehearsalMarkSave,
    handleDeleteRehearsalMark,
    handleInsertRehearsalMark,

    // Phrase manipulation handlers
    handleManualSplit,
    handleManualDeleteDivider,
  };
}
