import CreateIcon from '@mui/icons-material/Create';
import { Box, ToggleButton, Typography } from '@mui/material';

import type { FC } from 'react';

interface MarkFilterBarProps {
  markSymbols: Record<number, string>;
  activeMarkFilters: number[];
  onToggleFilter: (key: number) => void;
}

export const MarkFilterBar: FC<MarkFilterBarProps> = ({
  markSymbols,
  activeMarkFilters,
  onToggleFilter,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        alignItems: 'center',
        pl: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        フィルター：
      </Typography>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((key) => (
        <ToggleButton
          key={key}
          value={key}
          selected={activeMarkFilters.includes(key)}
          onChange={() => onToggleFilter(key)}
          size="small"
          sx={{
            px: 0.6,
            py: 0.2,
            minWidth: 31,
            borderRadius: 1,
            textTransform: 'none',
            fontSize: '0.75rem',
          }}
        >
          <Typography variant="body2" fontWeight="bold">
            {markSymbols[key] || '—'}
          </Typography>
        </ToggleButton>
      ))}
      <ToggleButton
        value={0}
        selected={activeMarkFilters.includes(0)}
        onChange={() => onToggleFilter(0)}
        size="small"
        sx={{
          px: 0.6,
          py: 0.2,
          minWidth: 30,
          borderRadius: 1,
          textTransform: 'none',
          fontSize: '0.75rem',
        }}
      >
        <CreateIcon sx={{ fontSize: 16, my: 0.25 }} />
      </ToggleButton>
    </Box>
  );
};
