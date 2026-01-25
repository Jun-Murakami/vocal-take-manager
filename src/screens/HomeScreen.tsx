/**
 * Home Screen
 * Displays list of songs and allows creation, opening, import/export
 */

import React from 'react';
import {
  Box,
  Button,
  Container,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';

import { deleteSong, getAllSongs, saveSong } from '@/db/database';
import { showDialog } from '@/stores/dialogStore';

import type { VtmExport } from '@/types/models';
import type { Screen } from '@/types/routing';

interface HomeScreenProps {
  onNavigate: (screen: Screen) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  // リアルタイムでデータベースから曲リストを取得
  const songs = useLiveQuery(() => getAllSongs(), []);

  // 選択されている曲のID
  const [selectedSongId, setSelectedSongId] = React.useState<string | null>(
    null,
  );

  const handleNewSong = () => {
    onNavigate({ type: 'lyric-edit' });
  };

  const handleOpenSong = () => {
    if (selectedSongId) {
      onNavigate({ type: 'recording', songId: selectedSongId });
    }
  };

  const handleSelectSong = (songId: string) => {
    setSelectedSongId(songId);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vtm';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const vtmData: VtmExport = JSON.parse(text);

        // バージョンチェック（将来のために）
        if (!vtmData.version || !vtmData.song) {
          throw new Error('無効な VTM ファイル形式です');
        }

        // データベースに保存
        await saveSong(vtmData.song);

        await showDialog({
          title: 'インポート完了',
          content: `「${vtmData.song.title}」をインポートしました。`,
        });
      } catch (error) {
        await showDialog({
          title: 'エラー',
          content: `ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        });
      }
    };
    input.click();
  };

  const handleExport = async () => {
    if (!selectedSongId) return;

    try {
      const { getSongById } = await import('@/db/database');
      const song = await getSongById(selectedSongId);
      if (!song) {
        await showDialog({
          title: 'エラー',
          content: '曲データが見つかりませんでした。',
        });
        return;
      }

      const vtmData: VtmExport = {
        version: '1.0',
        exportedAt: Date.now(),
        song,
      };

      const json = JSON.stringify(vtmData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.title}.vtm`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      await showDialog({
        title: 'エラー',
        content: `書き出しに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
      });
    }
  };

  const handleDelete = async (songId: string, title: string) => {
    const result = await showDialog({
      title: '楽曲の削除',
      content: `「${title}」を削除してもよろしいですか？\nこの操作は取り消せません。`,
      primaryButton: { text: '削除', color: 'error', variant: 'contained' },
      secondaryButton: {
        text: 'キャンセル',
        color: 'inherit',
        variant: 'text',
      },
    });

    if (result === '削除') {
      await deleteSong(songId);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  };

  return (
    <Box sx={{ backgroundColor: 'grey.200', height: '100vh', width: '100%' }}>
      <Container
        maxWidth="md"
        sx={{
          height: 'min(100vh, 800px)',
          display: 'flex',
          flexDirection: 'column',
          py: 4,
        }}
      >
        <Box sx={{ textAlign: 'center', mt: 2, mb: 4 }}>
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            fontFamily="Bebas Neue"
          >
            VOCAL TAKE MANAGER
          </Typography>
        </Box>

        <Paper
          elevation={2}
          sx={{ p: 3, mb: 3, flexGrow: 1, overflow: 'auto' }}
        >
          {songs && songs.length > 0 ? (
            <List>
              {songs.map((song) => (
                <ListItem
                  key={song.id}
                  disablePadding
                  secondaryAction={
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(song.id, song.title);
                        }}
                      >
                        削除
                      </Button>
                    </Stack>
                  }
                >
                  <ListItemButton
                    selected={selectedSongId === song.id}
                    onClick={() => handleSelectSong(song.id)}
                  >
                    <ListItemText
                      primary={song.title}
                      secondary={formatDate(song.updatedAt)}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 400,
              }}
            >
              <Typography variant="body1" color="text.secondary">
                曲がまだありません。「新規」ボタンから作成してください。
              </Typography>
            </Box>
          )}
        </Paper>

        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" onClick={handleImport}>
              読み込み
            </Button>
            <Button
              variant="outlined"
              disabled={!selectedSongId}
              onClick={handleExport}
            >
              書き出し
            </Button>
          </Stack>

          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={handleNewSong}>
              新規
            </Button>
            <Button
              variant="contained"
              disabled={!selectedSongId}
              onClick={handleOpenSong}
            >
              開く
            </Button>
          </Stack>
        </Stack>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            developed by{' '}
            <Link
              href="https://jun-murakami.com/"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
            >
              Jun Murakami
            </Link>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            すべてのデータはお使いの端末で処理・保存され、外部に送信されることはありません。
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};
