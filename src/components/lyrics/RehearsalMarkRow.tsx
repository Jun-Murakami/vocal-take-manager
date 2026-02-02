import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, IconButton, TextField, Typography } from '@mui/material';

import type { Phrase } from '@/types/models';

interface RehearsalMarkRowProps {
  rehearsalMark: Phrase;
  rowGap: number | string;
  rowHeightPx: number;
  isEditing: boolean;
  isEditModeEnabled: boolean;
  editingText: string;
  onEditingTextChange: (text: string) => void;
  onSave: () => void;
  onClick: (phraseId: string) => void;
  onDelete: (phraseId: string) => void;
}

export function RehearsalMarkRow({
  rehearsalMark,
  rowGap,
  rowHeightPx,
  isEditing,
  isEditModeEnabled,
  editingText,
  onEditingTextChange,
  onSave,
  onClick,
  onDelete,
}: RehearsalMarkRowProps) {
  return (
    <Box
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
      {isEditing ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
              value={editingText}
              onChange={(e) => onEditingTextChange(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSave();
                }
              }}
              variant="standard"
              size="small"
              autoFocus
              placeholder="1A, 2B, 3C ..."
              sx={{ width: 100 }}
            />
            <Button variant="contained" size="small" onClick={onSave}>
              確定
            </Button>
          </Box>
          {isEditModeEnabled && (
            <IconButton
              size="small"
              aria-label="リハーサルマークを削除"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(rehearsalMark.id);
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            onClick={() => {
              if (isEditModeEnabled) {
                onClick(rehearsalMark.id);
              }
            }}
            sx={{
              border: 2,
              borderColor: 'primary.main',
              borderRadius: 1,
              px: 1.5,
              py: 0.5,
              display: 'inline-block',
              cursor: isEditModeEnabled ? 'pointer' : 'default',
              '&:hover': isEditModeEnabled ? { bgcolor: 'action.hover' } : {},
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
          {isEditModeEnabled && (
            <IconButton
              size="small"
              aria-label="リハーサルマークを削除"
              onClick={(event) => {
                event.stopPropagation();
                onDelete(rehearsalMark.id);
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      )}
    </Box>
  );
}
