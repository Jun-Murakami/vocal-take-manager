import EditIcon from '@mui/icons-material/Edit';
import { Box, Button, TextField, Typography } from '@mui/material';

import type React from 'react';

export interface SongHeaderProps {
  title: string;
  credits: string;
  isEditingTitle: boolean;
  isEditingCredits: boolean;
  editingTitleText: string;
  editingCreditsText: string;
  onTitleTextChange: (text: string) => void;
  onCreditsTextChange: (text: string) => void;
  onStartEditingTitle: () => void;
  onStartEditingCredits: () => void;
  onTitleSave: () => void;
  onCreditsSave: () => void;
  actionButtons?: React.ReactNode;
}

export const SongHeader: React.FC<SongHeaderProps> = ({
  title,
  credits,
  isEditingTitle,
  isEditingCredits,
  editingTitleText,
  editingCreditsText,
  onTitleTextChange,
  onCreditsTextChange,
  onStartEditingTitle,
  onStartEditingCredits,
  onTitleSave,
  onCreditsSave,
  actionButtons,
}) => {
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onTitleSave();
    }
  };

  const handleCreditsKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onCreditsSave();
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 3,
        width: '100%',
      }}
    >
      {/* Left side: Title and Credits */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          flex: 1,
        }}
      >
        {/* Title section */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            '&:hover .edit-icon': {
              opacity: 1,
            },
          }}
        >
          {isEditingTitle ? (
            <>
              <TextField
                value={editingTitleText}
                onChange={(e) => onTitleTextChange(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                variant="standard"
                size="small"
                autoFocus
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={onTitleSave}
                sx={{ mr: -50 }}
              >
                変更
              </Button>
            </>
          ) : (
            <>
              <Typography
                variant="h5"
                fontWeight="bold"
                onClick={onStartEditingTitle}
                sx={{ cursor: 'pointer' }}
              >
                {title}
              </Typography>
              <EditIcon
                className="edit-icon"
                sx={{
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  color: 'text.secondary',
                }}
                onClick={onStartEditingTitle}
              />
            </>
          )}
        </Box>

        {/* Credits section */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            '&:hover .edit-icon': {
              opacity: 1,
            },
          }}
        >
          {isEditingCredits ? (
            <>
              <TextField
                value={editingCreditsText}
                onChange={(e) => onCreditsTextChange(e.target.value)}
                onKeyDown={handleCreditsKeyDown}
                variant="standard"
                size="small"
                autoFocus
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={onCreditsSave}
                sx={{ mr: -50 }}
              >
                変更
              </Button>
            </>
          ) : (
            <>
              <Typography
                variant="body2"
                color="text.secondary"
                onClick={onStartEditingCredits}
                sx={{ cursor: 'pointer' }}
              >
                {credits}
              </Typography>
              <EditIcon
                className="edit-icon"
                sx={{
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  color: 'text.secondary',
                }}
                onClick={onStartEditingCredits}
              />
            </>
          )}
        </Box>
      </Box>

      {/* Right side: Action buttons */}
      {actionButtons && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {actionButtons}
        </Box>
      )}
    </Box>
  );
};
