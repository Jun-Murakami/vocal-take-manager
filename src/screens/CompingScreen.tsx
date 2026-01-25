/**
 * Comping Screen
 * Select best take for each phrase
 */

import React from 'react';
import CreateIcon from '@mui/icons-material/Create';
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { getSongById, saveSong } from '@/db/database';
import { getMarksForPhrase } from '@/utils/markHelpers';

import type { Song } from '@/types/models';
import type { Screen } from '@/types/routing';

interface CompingScreenProps {
  songId: string;
  onNavigate: (screen: Screen) => void;
}

export const CompingScreen: React.FC<CompingScreenProps> = ({
  songId,
  onNavigate,
}) => {
  const [song, setSong] = React.useState<Song | null>(null);
  const [currentPhraseIndex, setCurrentPhraseIndex] = React.useState(0);
  const [freeMemo, setFreeMemo] = React.useState('');

  // Load song data
  React.useEffect(() => {
    const loadSong = async () => {
      const loadedSong = await getSongById(songId);
      if (loadedSong) {
        setSong(loadedSong);
        setCurrentPhraseIndex(loadedSong.comping.currentPhraseIndex);
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

  // Select take for current phrase
  const handleSelectTake = React.useCallback(
    async (takeId: string) => {
      if (!song || !song.phrases[currentPhraseIndex]) return;

      const phraseId = song.phrases[currentPhraseIndex].id;
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

      // Move to next phrase if not at the end
      if (currentPhraseIndex < song.phrases.length - 1) {
        setCurrentPhraseIndex(currentPhraseIndex + 1);
      }
    },
    [song, currentPhraseIndex, handleSaveSong],
  );

  // Navigate to previous/next phrase
  const handlePrevPhrase = React.useCallback(() => {
    if (currentPhraseIndex > 0) {
      setCurrentPhraseIndex(currentPhraseIndex - 1);
    }
  }, [currentPhraseIndex]);

  const handleNextPhrase = React.useCallback(() => {
    if (song && currentPhraseIndex < song.phrases.length - 1) {
      setCurrentPhraseIndex(currentPhraseIndex + 1);
    }
  }, [song, currentPhraseIndex]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (!song) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
          handleSelectTake(take.id);
        }
      }

      // Arrow keys: Navigate between phrases
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevPhrase();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextPhrase();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [song, handleSelectTake, handlePrevPhrase, handleNextPhrase]);

  // Save free memo when it changes
  const handleFreeMemoBlur = React.useCallback(async () => {
    if (!song) return;
    const updatedSong = { ...song, freeMemo, updatedAt: Date.now() };
    await handleSaveSong(updatedSong);
  }, [song, freeMemo, handleSaveSong]);

  const handleBack = () => {
    onNavigate({ type: 'recording', songId });
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    alert('エクスポート機能は後ほど実装されます');
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePdf = () => {
    window.print(); // Browser's print to PDF
  };

  const handleClose = () => {
    onNavigate({ type: 'home' });
  };

  if (!song) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>読み込み中...</Typography>
      </Box>
    );
  }

  const currentPhrase = song.phrases[currentPhraseIndex];
  const selectedTakeId = currentPhrase
    ? song.comping.selectedTakeByPhraseId[currentPhrase.id]
    : null;

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
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" onClick={handleExport}>
            書き出す
          </Button>
          <Button variant="outlined" size="small" onClick={handlePrint}>
            印刷
          </Button>
          <Button variant="outlined" size="small" onClick={handlePdf}>
            PDF
          </Button>
          <Button variant="outlined" onClick={handleBack}>
            戻る
          </Button>
          <Button variant="contained" onClick={handleClose}>
            終了
          </Button>
        </Stack>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left side: Phrase list with selection indicators */}
        <Box
          sx={{
            width: 300,
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Phrase list */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {song.phrases.map((phrase, index) => {
              const selectedTake =
                song.comping.selectedTakeByPhraseId[phrase.id];
              const take = selectedTake
                ? song.takes.find((t) => t.id === selectedTake)
                : null;

              return (
                <Box
                  key={phrase.id}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    bgcolor:
                      currentPhraseIndex === index
                        ? 'action.selected'
                        : 'transparent',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                  onClick={() => setCurrentPhraseIndex(index)}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Typography>{phrase.text}</Typography>
                    {take && (
                      <Chip
                        label={take.label}
                        size="small"
                        sx={{ bgcolor: take.color }}
                      />
                    )}
                  </Box>
                </Box>
              );
            })}
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

        {/* Right side: Take selection for current phrase */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
        >
          {currentPhrase ? (
            <Paper elevation={3} sx={{ p: 4, maxWidth: 800, width: '100%' }}>
              <Typography variant="h6" gutterBottom>
                いつも
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                フレーズ {currentPhraseIndex + 1} / {song.phrases.length}
              </Typography>

              {/* Navigation arrows */}
              <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                <Button
                  variant="outlined"
                  onClick={handlePrevPhrase}
                  disabled={currentPhraseIndex === 0}
                >
                  ←
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleNextPhrase}
                  disabled={currentPhraseIndex === song.phrases.length - 1}
                >
                  →
                </Button>
              </Stack>

              {/* Take selection buttons */}
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {song.takes.map((take) => {
                  const marks = getMarksForPhrase(song, currentPhrase.id);
                  const mark = marks.find((m) => m.takeId === take.id);
                  const isSelected = selectedTakeId === take.id;

                  return (
                    <Button
                      key={take.id}
                      variant={isSelected ? 'contained' : 'outlined'}
                      onClick={() => handleSelectTake(take.id)}
                      sx={{
                        minWidth: 100,
                        minHeight: 80,
                        bgcolor: take.color,
                        '&:hover': {
                          opacity: 0.8,
                        },
                        border: isSelected ? 2 : 1,
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                      }}
                    >
                      <Typography variant="h6">{take.label}</Typography>
                      <Box
                        sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}
                      >
                        {mark?.markValue && (
                          <Typography variant="body2">
                            {mark.markValue}
                          </Typography>
                        )}
                        {mark?.memo && <CreateIcon fontSize="small" />}
                      </Box>
                    </Button>
                  );
                })}
              </Stack>
            </Paper>
          ) : (
            <Typography>フレーズがありません</Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};
