import { useState } from 'react';
import CreateIcon from '@mui/icons-material/Create';
import { Box, Button, TextField, Typography } from '@mui/material';

import type { TypographyProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { FC } from 'react';

interface EditableFieldProps {
  value: string;
  onSave: (newValue: string) => void;
  variant?: TypographyProps['variant'];
  color?: TypographyProps['color'];
  textFieldWidth?: number | string;
  textSx?: SxProps<Theme>;
}

export const EditableField: FC<EditableFieldProps> = ({
  value,
  onSave,
  variant = 'body1',
  color,
  textFieldWidth = 'auto',
  textSx,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState('');

  const handleStartEdit = () => {
    setEditingText(value);
    setIsEditing(true);
  };

  const handleSave = () => {
    onSave(editingText);
    setIsEditing(false);
  };

  const iconSize = variant === 'h5' ? '1.2rem' : '1rem';

  return (
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
      {isEditing ? (
        <>
          <TextField
            value={editingText}
            onChange={(e) => setEditingText(e.target.value)}
            variant="standard"
            size="small"
            autoFocus
            sx={{
              width: textFieldWidth,
              flex: textFieldWidth === 'auto' ? 1 : undefined,
            }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            sx={{ mr: -50 }}
          >
            変更
          </Button>
        </>
      ) : (
        <>
          <Typography
            variant={variant}
            color={color}
            onClick={handleStartEdit}
            sx={{ cursor: 'pointer', ...textSx }}
          >
            {value}
          </Typography>
          <CreateIcon
            className="edit-icon"
            sx={{
              opacity: 0,
              transition: 'opacity 0.2s',
              fontSize: iconSize,
              cursor: 'pointer',
              color: 'text.secondary',
            }}
            onClick={handleStartEdit}
          />
        </>
      )}
    </Box>
  );
};
