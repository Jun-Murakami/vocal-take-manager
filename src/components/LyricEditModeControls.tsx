import { Box, Button, Typography } from '@mui/material';

import type { FC } from 'react';

interface LyricEditModeControlsProps {
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

export const LyricEditModeControls: FC<LyricEditModeControlsProps> = ({
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
  const anyModeActive =
    isManualSplitMode ||
    isManualDeleteMode ||
    isLyricEditMode ||
    isRehearsalMarkMode;

  const getInstructionText = () => {
    if (isManualSplitMode) return '文字間をクリックして分割線を追加します';
    if (isManualDeleteMode) return '分割線をクリックして削除します';
    if (isLyricEditMode) {
      return editingPhraseId
        ? '編集後、「歌詞修正」ボタンを再度クリックして確定します'
        : '修正したいフレーズをクリックしてください';
    }
    if (isRehearsalMarkMode)
      return '行間をクリックしてリハーサルマークを追加します';
    return '';
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Button
        variant={isManualSplitMode ? 'contained' : 'outlined'}
        size="small"
        onClick={onToggleSplitMode}
        sx={{ zIndex: anyModeActive ? 10 : 'auto' }}
      >
        分割線を追加
      </Button>
      <Button
        variant={isManualDeleteMode ? 'contained' : 'outlined'}
        size="small"
        onClick={onToggleDeleteMode}
        sx={{ zIndex: anyModeActive ? 10 : 'auto' }}
      >
        分割線を削除
      </Button>
      <Button
        variant={isLyricEditMode ? 'contained' : 'outlined'}
        size="small"
        onClick={onToggleLyricEditMode}
        sx={{ zIndex: anyModeActive ? 10 : 'auto' }}
      >
        歌詞修正
      </Button>
      <Button
        variant={isRehearsalMarkMode ? 'contained' : 'outlined'}
        size="small"
        onClick={onToggleRehearsalMarkMode}
        sx={{ zIndex: anyModeActive ? 10 : 'auto' }}
      >
        リハーサルマーク
      </Button>
      {anyModeActive && (
        <Typography variant="caption" color="text.secondary">
          {getInstructionText()}
        </Typography>
      )}
    </Box>
  );
};
