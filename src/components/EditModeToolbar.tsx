import { Box, Button, Typography } from '@mui/material';

import type React from 'react';

export interface EditModeToolbarProps {
  isManualSplitMode: boolean;
  isManualDeleteMode: boolean;
  isLyricEditMode: boolean;
  isRehearsalMarkMode: boolean;
  editingPhraseId: string | null;
  onToggleSplitMode: () => void;
  onToggleDeleteMode: () => void;
  onToggleLyricEditMode: () => void;
  onToggleRehearsalMarkMode: () => void;
}

export const EditModeToolbar: React.FC<EditModeToolbarProps> = ({
  isManualSplitMode,
  isManualDeleteMode,
  isLyricEditMode,
  isRehearsalMarkMode,
  editingPhraseId,
  onToggleSplitMode,
  onToggleDeleteMode,
  onToggleLyricEditMode,
  onToggleRehearsalMarkMode,
}) => {
  const isAnyModeActive =
    isManualSplitMode ||
    isManualDeleteMode ||
    isLyricEditMode ||
    isRehearsalMarkMode;

  const getHintText = (): string | null => {
    if (!isAnyModeActive) return null;

    if (isManualSplitMode) {
      return '文字間をクリックして分割線を追加します';
    }
    if (isManualDeleteMode) {
      return '分割線をクリックして削除します';
    }
    if (isLyricEditMode) {
      if (editingPhraseId) {
        return '編集後、「歌詞修正」ボタンを再度クリックして確定します';
      }
      return '修正したいフレーズをクリックしてください';
    }
    if (isRehearsalMarkMode) {
      return '行間をクリックしてリハーサルマークを追加します';
    }

    return null;
  };

  const hintText = getHintText();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 1,
        zIndex: isAnyModeActive ? 10 : 'auto',
      }}
    >
      <Button
        variant={isManualSplitMode ? 'contained' : 'outlined'}
        size="small"
        onClick={onToggleSplitMode}
      >
        分割線を追加
      </Button>
      <Button
        variant={isManualDeleteMode ? 'contained' : 'outlined'}
        size="small"
        onClick={onToggleDeleteMode}
      >
        分割線を削除
      </Button>
      <Button
        variant={isLyricEditMode ? 'contained' : 'outlined'}
        size="small"
        onClick={onToggleLyricEditMode}
      >
        歌詞修正
      </Button>
      <Button
        variant={isRehearsalMarkMode ? 'contained' : 'outlined'}
        size="small"
        onClick={onToggleRehearsalMarkMode}
      >
        リハーサルマーク
      </Button>

      {hintText && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          {hintText}
        </Typography>
      )}
    </Box>
  );
};
