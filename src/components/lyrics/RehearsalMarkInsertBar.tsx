import { Box, Typography } from '@mui/material';

interface RehearsalMarkInsertBarProps {
  afterLineIndex: number;
  onInsert: (afterLineIndex: number) => void;
}

export function RehearsalMarkInsertBar({
  afterLineIndex,
  onInsert,
}: RehearsalMarkInsertBarProps) {
  return (
    <Box
      onClick={() => onInsert(afterLineIndex)}
      sx={{
        height: 3,
        mb: 1,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        pl: 2,
        color: 'primary.main',
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    >
      <Typography
        variant="body2"
        fontWeight="bold"
        sx={{ transform: 'scale(3,1)' }}
      >
        ←
      </Typography>
    </Box>
  );
}
