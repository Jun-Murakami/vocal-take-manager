/**
 * MUI Theme Configuration
 */

import { createTheme } from '@mui/material';

export const theme = createTheme({
  palette: {
    mode: 'light',
    divider: 'rgba(0, 0, 0, 0.2)', // デフォルトより濃い罫線
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
  },
});
