import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ClearIcon from '@mui/icons-material/Clear';
import { Box, IconButton, Tooltip, Typography, useTheme } from '@mui/material';

import { TAKE_COLUMN_WIDTH } from '@/constants/layout';
import { getTakeHeaderColor } from '@/utils/takeHelpers';

import type { FC } from 'react';
import type { Take } from '@/types/models';

interface RecordingTakeHeaderProps {
  take: Take;
  isCollapsed: boolean;
  isSelected: boolean;
  onToggleCollapse: () => void;
  onClearMarks: () => void;
  onSelectTake: () => void;
}

export const RecordingTakeHeader: FC<RecordingTakeHeaderProps> = ({
  take,
  isCollapsed,
  isSelected,
  onToggleCollapse,
  onClearMarks,
  onSelectTake,
}) => {
  const theme = useTheme();

  return (
    <Box
      key={take.id}
      sx={{
        px: isCollapsed ? 0 : 2,
        py: 1,
        width: isCollapsed ? 40 : TAKE_COLUMN_WIDTH,
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
        onClick={() => {
          if (isCollapsed) {
            onToggleCollapse();
            return;
          }
          onSelectTake();
        }}
        sx={{
          minHeight: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          bgcolor: getTakeHeaderColor(take.color, theme.palette.mode),
          '@media print': {
            bgcolor: take.color,
          },
          border: isSelected ? '3px solid' : '1px solid',
          borderColor: isSelected ? 'primary.main' : 'divider',
          boxSizing: 'border-box',
          maxWidth: '100%',
          width: isCollapsed ? 32 : '100%',
          height: isCollapsed ? 32 : 40,
          mx: 'auto',
          position: 'relative',
          px: 0,
        }}
      >
        {!isCollapsed && (
          <Tooltip title="折りたたむ" arrow>
            <IconButton
              size="small"
              aria-label="テイクを折りたたむ"
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapse();
              }}
              sx={{
                position: 'absolute',
                left: 2,
                opacity: 0.4,
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {!isCollapsed && (
          <Tooltip title="このテイクをクリア" arrow>
            <IconButton
              size="small"
              aria-label="テイクをクリア"
              onClick={(event) => {
                event.stopPropagation();
                onClearMarks();
              }}
              sx={{
                position: 'absolute',
                right: 2,
                opacity: 0.4,
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Typography variant="body2" fontWeight="bold">
          {isCollapsed ? take.order : take.label}
        </Typography>
      </Box>
    </Box>
  );
};
