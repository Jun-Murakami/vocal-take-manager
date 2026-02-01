import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { Box, IconButton, Typography } from '@mui/material';

import type React from 'react';
import type { Take } from '@/types/models';

interface TakeColumnHeaderProps {
  take: Take;
  isCollapsed: boolean;
  takeColumnWidth: number;
  getTakeHeaderColor: (color: string) => string;
  onToggleCollapse: (takeId: string) => void;
}

export const TakeColumnHeader: React.FC<TakeColumnHeaderProps> = ({
  take,
  isCollapsed,
  takeColumnWidth,
  getTakeHeaderColor,
  onToggleCollapse,
}) => (
  <Box
    sx={{
      px: isCollapsed ? 0 : 2,
      py: 1,
      width: isCollapsed ? 40 : takeColumnWidth,
      flexShrink: 0,
      borderRight: 1,
      borderRightColor: 'divider',
      borderBottom: 1,
      borderBottomColor: 'divider',
      boxSizing: 'border-box',
      bgcolor: 'background.paper',
    }}
  >
    <Box
      onClick={() => isCollapsed && onToggleCollapse(take.id)}
      sx={{
        minHeight: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isCollapsed ? 'pointer' : 'default',
        bgcolor: getTakeHeaderColor(take.color),
        '@media print': { bgcolor: take.color },
        border: 1,
        borderColor: 'divider',
        boxSizing: 'border-box',
        width: isCollapsed ? 32 : '100%',
        height: isCollapsed ? 32 : 40,
        mx: 'auto',
        position: 'relative',
        px: 0,
        maxWidth: '100%',
      }}
    >
      {!isCollapsed && (
        <IconButton
          size="small"
          aria-label="テイクを折りたたむ"
          onClick={() => onToggleCollapse(take.id)}
          sx={{
            position: 'absolute',
            left: 2,
            opacity: 0.4,
            '&:hover': { opacity: 0.8 },
          }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
      )}
      <Typography variant="body2" fontWeight="bold">
        {isCollapsed ? take.order : take.label}
      </Typography>
    </Box>
  </Box>
);
