/**
 * Lyric Edit Screen
 * Input title, credits, and lyrics
 */

import { useState } from 'react';
import type { FC } from 'react';
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { saveSong } from '@/db/database';
import {
  createNewSong,
  normalizeLyricsLines,
  parseLyricsIntoPhrases,
} from '@/utils/songHelpers';

import type { Screen } from '@/types/routing';
import { importLyricsFromFile } from '@/utils/lyricsImport';
import { showDialog } from '@/stores/dialogStore';

interface LyricEditScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const LyricEditScreen: FC<LyricEditScreenProps> = ({ onNavigate }) => {
  const [title, setTitle] = useState('');
  const [credits, setCredits] = useState('');
  const [lyrics, setLyrics] = useState('');

  const isTablet = useMediaQuery('(max-height: 800px)');
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const handleOk = async () => {
    if (!title.trim()) {
      await showDialog({
        title: 'Information',
        content: 'タイトルを入力してください',
        primaryButton: { text: 'OK' },
      });
      return;
    }

    // 入力された歌詞は行単位でトリムしてから判定・保存する
    // NOTE: 先頭/末尾の空白やタブのみの行を空行として扱えるようにする
    const normalizedLyrics = normalizeLyricsLines(lyrics);

    if (!normalizedLyrics.trim()) {
      await showDialog({
        title: 'Information',
        content: '歌詞を入力してください',
        primaryButton: { text: 'OK' },
      });
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
      await showDialog({
        title: '保存に失敗しました',
        content: error instanceof Error ? error.message : '不明なエラー',
        primaryButton: { text: 'OK' },
      });
    }
  };

  /**
   * ファイルから歌詞テキストを読み込む
   * - 対象: .docx / .doc / .odt / .rtf / .txt
   * - 取得したテキストは歌詞入力欄に流し込む
   */
  const handleImportLyrics = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx,.doc,.odt,.rtf,.txt';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const extractedText = await importLyricsFromFile(file);

        // 改行コードを統一して歌詞欄に反映する
        const normalizedText = extractedText.replace(/\r\n/g, '\n');
        setLyrics(normalizedText);
      } catch (error) {
        console.error('Failed to import lyrics from file:', error);
        await showDialog({
          title: 'ファイルの読み込みに失敗しました',
          content: error instanceof Error ? error.message : '不明なエラー',
          primaryButton: { text: 'OK' },
        });
      } finally {
        // 同じファイルを再選択できるように値をクリアする
        input.value = '';
      }
    };
    input.click();
  };

  const handleCancel = () => {
    onNavigate({ type: 'home' });
  };

  return (
    <Box
      sx={{
        backgroundColor: isDarkMode ? 'background.default' : 'grey.200',
        height: '100dvh',
        width: '100%',
      }}
    >
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
              rows={isTablet ? 10 : 18}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="歌詞を入力してください"
              required
            />

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Button variant="outlined" onClick={handleImportLyrics}>
                ファイルからインポート
              </Button>
              <Stack direction="row" spacing={2}>
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
          </Stack>
          <Typography variant="caption" color="text.secondary">
            ※【】で囲まれた行はリハーサルマークとしてインポートされます。
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};
