/**
 * Lyric Edit Screen
 * Input title, credits, and lyrics
 */

import React from 'react';
import {
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { getSongById, saveSong } from '@/db/database';
import { createNewSong, parseLyricsIntoPhrases } from '@/utils/songHelpers';

import type { Song } from '@/types/models';
import type { Screen } from '@/types/routing';

interface LyricEditScreenProps {
  songId?: string;
  onNavigate: (screen: Screen) => void;
}

export const LyricEditScreen: React.FC<LyricEditScreenProps> = ({
  songId,
  onNavigate,
}) => {
  const [title, setTitle] = React.useState('');
  const [credits, setCredits] = React.useState('');
  const [lyrics, setLyrics] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(!!songId);

  // 既存曲の編集時にデータを読み込む
  React.useEffect(() => {
    if (!songId) return;

    const loadSong = async () => {
      const song = await getSongById(songId);
      if (song) {
        setTitle(song.title);
        setCredits(song.credits);
        setLyrics(song.rawLyrics);
      }
      setIsLoading(false);
    };

    loadSong();
  }, [songId]);

  const handleOk = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    if (!lyrics.trim()) {
      alert('歌詞を入力してください');
      return;
    }

    try {
      let song: Song;
      if (songId) {
        // 既存曲の更新
        const existingSong = await getSongById(songId);
        if (!existingSong) {
          alert('曲が見つかりませんでした');
          return;
        }
        const phrases = await parseLyricsIntoPhrases(lyrics);
        song = {
          ...existingSong,
          title,
          credits,
          rawLyrics: lyrics,
          phrases,
          updatedAt: Date.now(),
        };
      } else {
        // 新規曲の作成
        song = createNewSong({ title, credits, rawLyrics: lyrics });
        song.phrases = await parseLyricsIntoPhrases(lyrics);
      }

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

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography>読み込み中...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ p: 4 }}>
        <Stack spacing={3}>
          <Typography variant="h5" component="h1">
            {songId ? '歌詞を編集' : '新規作成'}
          </Typography>

          <TextField
            label="タイトル"
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
            rows={12}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="歌詞を入力してください"
            required
          />

          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="outlined" onClick={handleCancel}>
              キャンセル
            </Button>
            <Button variant="contained" onClick={handleOk}>
              OK
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
};
