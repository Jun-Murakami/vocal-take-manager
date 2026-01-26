/**
 * Lyric Edit Screen
 * Input title, credits, and lyrics
 */

import React from 'react';
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { saveSong } from '@/db/database';
import {
  createNewSong,
  normalizeLyricsLines,
  parseLyricsIntoPhrases,
} from '@/utils/songHelpers';

import type { Screen } from '@/types/routing';

interface LyricEditScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const LyricEditScreen: React.FC<LyricEditScreenProps> = ({
  onNavigate,
}) => {
  const [title, setTitle] = React.useState('');
  const [credits, setCredits] = React.useState('');
  const [lyrics, setLyrics] = React.useState('');

  const handleOk = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    // 入力された歌詞は行単位でトリムしてから判定・保存する
    // NOTE: 先頭/末尾の空白やタブのみの行を空行として扱えるようにする
    const normalizedLyrics = normalizeLyricsLines(lyrics);

    if (!normalizedLyrics.trim()) {
      alert('歌詞を入力してください');
      return;
    }

    try {
      const song = createNewSong({
        title,
        credits,
        rawLyrics: normalizedLyrics,
      });
      song.phrases = await parseLyricsIntoPhrases(normalizedLyrics);
      await saveSong(song);
      onNavigate({ type: 'recording', songId: song.id });
    } catch (error) {
      console.error('Failed to save song:', error);
      alert('保存に失敗しました');
    }
  };

  const handleCancel = () => {
    onNavigate({ type: 'home' });
  };

  return (
    <Box sx={{ backgroundColor: 'grey.200', height: '100dvh', width: '100%' }}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper
          elevation={2}
          sx={{
            p: 4,
            marginY: 'auto',
          }}
        >
          <Stack spacing={3}>
            <Typography variant="h5" component="h1">
              プロジェクトの新規作成
            </Typography>

            <TextField
              label="楽曲のタイトル"
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <TextField
              label="クレジット"
              fullWidth
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              placeholder="作詞：Aさん／作曲：Bさん／編曲：Cさん"
            />

            <TextField
              label="歌詞"
              fullWidth
              multiline
              rows={10}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="歌詞を入力してください"
              required
            />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={handleCancel}>
                キャンセル
              </Button>
              <Button
                variant="contained"
                onClick={handleOk}
                disabled={!title.trim() || !lyrics.trim()}
              >
                OK
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};
