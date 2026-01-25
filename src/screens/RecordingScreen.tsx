/**
 * Recording Screen
 * Mark takes for each phrase with keyboard shortcuts
 */

import React from 'react';
import AddIcon from '@mui/icons-material/Add';
import CreateIcon from '@mui/icons-material/Create';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Box,
  Button,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material';

import { getSongById, saveSong } from '@/db/database';
import { showDialog, showInputDialog } from '@/stores/dialogStore';
import { getMark, setMarkMemo, setMarkValue } from '@/utils/markHelpers';
import { addTake, removeTake } from '@/utils/songHelpers';

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

  // Refs for synchronized scrolling
  const lyricsScrollRef = React.useRef<HTMLDivElement>(null);
  const marksScrollRef = React.useRef<HTMLDivElement>(null);

  // Load song data
  React.useEffect(() => {
    const loadSong = async () => {
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
    loadSong();
  }, [songId]);

  // Save song to database
  const handleSaveSong = React.useCallback(async (updatedSong: Song) => {
    setSong(updatedSong);
    await saveSong(updatedSong);
  }, []);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (!song || !selectedPhraseId || !selectedTakeId) return;

    // 空行のプレースホルダーは選択・操作対象から除外する
    const selectedPhrase = song.phrases.find(
      (phrase) => phrase.id === selectedPhraseId,
    );
    if (!selectedPhrase || selectedPhrase.text.trim().length === 0) {
      return;
    }

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Keys 1-5: Set mark value
      if (e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const keyNum = Number.parseInt(e.key, 10);
        const setting = song.markSettings.find((s) => s.key === keyNum);
        const markValue = setting?.symbol || null;

        const updatedSong = setMarkValue(
          song,
          selectedPhraseId,
          selectedTakeId,
          markValue,
        );
        await handleSaveSong(updatedSong);
      }

      // Key 0: Set memo
      if (e.key === '0') {
        e.preventDefault();
        const currentMark = getMark(song, selectedPhraseId, selectedTakeId);
        const result = await showInputDialog({
          title: 'メモを入力',
          content: 'このセル用のメモを入力してください',
          input: {
            label: 'メモ',
            defaultValue: currentMark?.memo || '',
            placeholder: 'メモを入力',
          },
          primaryButton: { text: '保存', variant: 'contained' },
          secondaryButton: { text: 'キャンセル', variant: 'text' },
        });

        if (result !== null) {
          const updatedSong = setMarkMemo(
            song,
            selectedPhraseId,
            selectedTakeId,
            result || null,
          );
          await handleSaveSong(updatedSong);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [song, selectedPhraseId, selectedTakeId, handleSaveSong]);

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
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
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
          <Typography variant="h5">{song.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {song.credits}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" onClick={handleComping}>
            繋ぐ
          </Button>
          <Button variant="contained" onClick={handleClose}>
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
            sx={{ flex: 1, overflow: 'auto', p: 2 }}
          >
            {phrasesByLine.map(({ lineIndex, phrases }) => (
              <Box
                key={lineIndex}
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

                  return phrases.map((phrase, index) => (
                    <Box
                      key={phrase.id}
                      onClick={() => setSelectedPhraseId(phrase.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
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
                      <Typography variant="body1">{phrase.text}</Typography>
                    </Box>
                  ));
                })()}
              </Box>
            ))}
          </Box>

          {/* Free memo area */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom>
              フリーメモリア
            </Typography>
            <TextField
              multiline
              rows={4}
              fullWidth
              value={freeMemo}
              onChange={(e) => setFreeMemo(e.target.value)}
              onBlur={handleFreeMemoBlur}
              placeholder="メモを入力"
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
              {song.takes.map((take) => (
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
                        sx={{
                          display: 'flex',
                          flexDirection: 'row',
                          gap: 0.5,
                          mb: 1,
                          minHeight: 40,
                          border: 1,
                          borderColor: 'divider',
                          p: 0.5,
                          boxSizing: 'border-box',
                        }}
                      >
                        {phrases.map((phrase, phraseIndex) => {
                          const mark = getMark(song, phrase.id, take.id);
                          const isSelected =
                            selectedPhraseId === phrase.id &&
                            selectedTakeId === take.id;
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
                                minWidth: 24,
                              }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  gap: 0.5,
                                  alignItems: 'center',
                                }}
                              >
                                {mark?.markValue && (
                                  <Typography variant="caption">
                                    {mark.markValue}
                                  </Typography>
                                )}
                                {mark?.memo && <CreateIcon fontSize="small" />}
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
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              マーク設定
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {song.markSettings.map((setting) => (
                <Box
                  key={setting.key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    minWidth: 80,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {setting.key}
                  </Typography>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: setting.color || 'transparent',
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 0.5,
                    }}
                  >
                    <Typography>{setting.symbol || ''}</Typography>
                  </Box>
                </Box>
              ))}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  minWidth: 80,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  0
                </Typography>
                <CreateIcon />
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};
