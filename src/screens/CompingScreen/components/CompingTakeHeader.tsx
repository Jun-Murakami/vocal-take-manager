import { memo } from 'react';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { Box, IconButton, Typography, useTheme } from '@mui/material';

import { TAKE_COLUMN_WIDTH } from '@/constants/layout';
import { getTakeHeaderColor } from '@/utils/takeHelpers';

import type { FC } from 'react';
import type { Take } from '@/types/models';

interface CompingTakeHeaderProps {
  take: Take;
  isCollapsed: boolean;
  onToggleCollapse: (takeId: string) => void;
}

export const CompingTakeHeader: FC<CompingTakeHeaderProps> = memo(
  ({ take, isCollapsed, onToggleCollapse }) => {
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
              onToggleCollapse(take.id);
            }
          }}
          sx={{
            minHeight: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isCollapsed ? 'pointer' : 'default',
            bgcolor: getTakeHeaderColor(take.color, theme.palette.mode),
            '@media print': {
              bgcolor: take.color,
            },
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
              onClick={() => {
                onToggleCollapse(take.id);
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
          )}
          <Typography variant="body2" fontWeight="bold">
            {isCollapsed ? take.order : take.label}
          </Typography>
        </Box>
      </Box>
    );
  },
);

CompingTakeHeader.displayName = 'CompingTakeHeader';
