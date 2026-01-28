/**
 * LyricsArea
 * - Recording/Comping で共通する歌詞エリアの大枠（行・リハーサルマーク・行間挿入）を集約
 * - フレーズ自体の描画は renderPhraseCell で注入する
 */

import React from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, IconButton, TextField, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import type { Phrase } from '@/types/models';

interface PhrasesByLine {
  lineIndex: number;
  phrases: Phrase[];
}

interface LyricsAreaProps {
  // 行単位にグルーピングされたフレーズ
  phrasesByLine: PhrasesByLine[];
  // 全フレーズ（リハーサルマーク判定用）
  phrases: Phrase[];
  // 行間・行高
  rowGap: number | string;
  rowHeightPx: number;
  // スクロール参照とハンドラ
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  // モード状態
  isManualSplitMode: boolean;
  isManualDeleteMode: boolean;
  isLyricEditMode: boolean;
  isRehearsalMarkMode: boolean;
  // リハーサルマーク編集状態
  editingRehearsalMarkId: string | null;
  editingRehearsalMarkText: string;
  onChangeRehearsalMarkText: (value: string) => void;
  onInsertRehearsalMark: (afterLineIndex: number) => void;
  onRehearsalMarkClick: (phraseId: string) => void;
  onRehearsalMarkSave: () => void;
  onDeleteRehearsalMark: (phraseId: string) => void;
  // 行の下線表示（ロケーター行判定）
  isLocatorLine: (phrases: Phrase[]) => boolean;
  // 行要素のrefを外部へ渡す（スクロール同期用）
  onLineRef?: (lineIndex: number, el: HTMLDivElement | null) => void;
  // 行の前後に挿入する要素（削除ボタン等）
  lineLeadingContent?: (lineIndex: number) => React.ReactNode;
  lineTrailingContent?: (lineIndex: number) => React.ReactNode;
  // フレーズセルの描画（画面ごとの差異を吸収）
  renderPhraseCell: (
    phrase: Phrase,
    index: number,
    phrases: Phrase[],
  ) => React.ReactNode;
  // スクロール領域の追加スタイル
  scrollSx?: SxProps<Theme>;
  // 行コンテナの追加スタイル
  lineContainerSx?: SxProps<Theme>;
}

export function LyricsArea({
  phrasesByLine,
  phrases,
  rowGap,
  rowHeightPx,
  scrollRef,
  onScroll,
  isManualSplitMode,
  isManualDeleteMode,
  isLyricEditMode,
  isRehearsalMarkMode,
  editingRehearsalMarkId,
  editingRehearsalMarkText,
  onChangeRehearsalMarkText,
  onInsertRehearsalMark,
  onRehearsalMarkClick,
  onRehearsalMarkSave,
  onDeleteRehearsalMark,
  isLocatorLine,
  onLineRef,
  lineLeadingContent,
  lineTrailingContent,
  renderPhraseCell,
  scrollSx,
  lineContainerSx,
}: LyricsAreaProps) {
  return (
    <Box
      ref={scrollRef}
      onScroll={onScroll}
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
        bgcolor:
          isManualSplitMode ||
          isManualDeleteMode ||
          isLyricEditMode ||
          isRehearsalMarkMode
            ? 'background.paper'
            : 'transparent',
        ...scrollSx,
      }}
    >
      {/* 先頭行の前にあるリハーサルマークを表示 */}
      {(() => {
        const firstLinePhrases =
          phrasesByLine.length > 0 ? phrasesByLine[0].phrases : [];
        const minOrderInFirstLine =
          firstLinePhrases.length > 0
            ? Math.min(...firstLinePhrases.map((p) => p.order))
            : 0;
        const rehearsalMarksBeforeFirstLine = phrases.filter(
          (phrase) =>
            phrase.isRehearsalMark && phrase.order < minOrderInFirstLine,
        );

        return (
          <>
            {/* 最初の行の前の行間クリック領域（編集時のみ） */}
            {isRehearsalMarkMode &&
              phrasesByLine.length > 0 &&
              rehearsalMarksBeforeFirstLine.length === 0 &&
              !editingRehearsalMarkId && (
                <Box
                  onClick={() => onInsertRehearsalMark(-1)}
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
                            onChangeRehearsalMarkText(e.target.value)
                          }
                          onKeyDown={(event) => {
                            // Enterで確定ボタンと同じ動作にする
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              onRehearsalMarkSave();
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
                          onClick={onRehearsalMarkSave}
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
                            onDeleteRehearsalMark(rehearsalMark.id);
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
                            onRehearsalMarkClick(rehearsalMark.id);
                          }
                        }}
                        sx={{
                          border: 2,
                          borderColor: 'primary.main',
                          borderRadius: 1,
                          px: 1.5,
                          py: 0.5,
                          display: 'inline-block',
                          cursor: isRehearsalMarkMode ? 'pointer' : 'default',
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
                            onDeleteRehearsalMark(rehearsalMark.id);
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

      {phrasesByLine.map(
        ({ lineIndex, phrases: linePhrases }, lineArrayIndex) => {
          const maxOrderInThisLine =
            linePhrases.length > 0
              ? Math.max(...linePhrases.map((phrase) => phrase.order))
              : -1;
          const nextLinePhrases =
            lineArrayIndex < phrasesByLine.length - 1
              ? phrasesByLine[lineArrayIndex + 1].phrases
              : [];
          const minOrderInNextLine =
            nextLinePhrases.length > 0
              ? Math.min(...nextLinePhrases.map((phrase) => phrase.order))
              : maxOrderInThisLine + 1000;

          const rehearsalMarksForThisLine = phrases.filter(
            (phrase) =>
              phrase.isRehearsalMark &&
              phrase.order > maxOrderInThisLine &&
              phrase.order < minOrderInNextLine,
          );
          const hasRehearsalMarkBetweenLines =
            rehearsalMarksForThisLine.length > 0;
          const isEmptyLine = linePhrases.every(
            (phrase) => phrase.text.trim().length === 0,
          );
          const locatorLine = isLocatorLine(linePhrases);

          return (
            <React.Fragment key={lineIndex}>
              <Box
                ref={(el: HTMLDivElement | null) => {
                  if (onLineRef) {
                    onLineRef(lineIndex, el);
                  }
                }}
                sx={{
                  display: 'flex',
                  mb: rowGap,
                  height: rowHeightPx,
                  alignItems: 'stretch',
                  position: 'relative',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    right: (theme) => `calc(${theme.spacing(2)} * -1)`,
                    bottom: 0,
                    height: '1px',
                    bgcolor: 'primary.main',
                    opacity: locatorLine ? 1 : 0,
                    pointerEvents: 'none',
                  },
                  boxSizing: 'border-box',
                  ...lineContainerSx,
                }}
              >
                {lineLeadingContent ? lineLeadingContent(lineIndex) : null}
                {isEmptyLine ? (
                  <Box sx={{ flex: 1 }} />
                ) : (
                  linePhrases.map((phrase, index) =>
                    renderPhraseCell(phrase, index, linePhrases),
                  )
                )}
                {lineTrailingContent ? lineTrailingContent(lineIndex) : null}
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
                              onChangeRehearsalMarkText(e.target.value)
                            }
                            onKeyDown={(event) => {
                              // Enterで確定ボタンと同じ動作にする
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                onRehearsalMarkSave();
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
                            onClick={onRehearsalMarkSave}
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
                              onDeleteRehearsalMark(rehearsalMark.id);
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
                              onRehearsalMarkClick(rehearsalMark.id);
                            }
                          }}
                          sx={{
                            border: 2,
                            borderColor: 'primary.main',
                            borderRadius: 1,
                            px: 1.5,
                            py: 0.5,
                            display: 'inline-block',
                            cursor: isRehearsalMarkMode ? 'pointer' : 'default',
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
                              onDeleteRehearsalMark(rehearsalMark.id);
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
              {/* 行間クリック領域（リハーサルマーク編集モード時のみ表示） */}
              {isRehearsalMarkMode && !hasRehearsalMarkBetweenLines && (
                <Box
                  onClick={() => onInsertRehearsalMark(lineIndex)}
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
        },
      )}
    </Box>
  );
}
