/**
 * MUI Theme Configuration
 */

import { createTheme } from '@mui/material';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';

export const theme = createTheme({
  palette: {
    mode: 'light',
    divider: 'rgba(0, 0, 0, 0.2)', // デフォルトより濃い罫線
  },
  typography: {
    fontFamily: [
      'Noto Sans JP',
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
