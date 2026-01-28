/**
 * MUI Theme Configuration
 */

import { createTheme } from '@mui/material';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/noto-sans-jp/400.css';
import '@fontsource/noto-sans-jp/700.css';

/**
 * アプリ全体のテーマを生成する
 * - mode を切り替えてダークモードに対応する
 * - divider は見やすさを保つため少し濃さを上げる
 */
export const createAppTheme = (mode: 'light' | 'dark') =>
  createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#00a4e4' : '#1976d2',
      },
      divider:
        mode === 'dark'
          ? 'rgba(255, 255, 255, 0.2)'
          : 'rgba(0, 0, 0, 0.2)', // デフォルトより濃い罫線
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
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          /**
           * 印刷/PDF出力時は強制的にライト配色へ寄せる
           * - JSのテーマ切り替えが効かない環境でも白背景を保証する
           * - 印刷時の可読性を優先し、文字色を黒へ統一する
           */
          '@media print': {
            'html, body, #root': {
              backgroundColor: '#ffffff',
              color: '#000000',
            },
            // MUIのPaper/Boxに暗い背景が残らないように上書きする
            '.MuiPaper-root': {
              backgroundColor: '#ffffff',
              color: '#000000',
            },
            '.MuiBox-root': {
              color: '#000000',
            },
          },
        },
      },
    },
  });
