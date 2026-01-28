/**
 * App Root Component
 * Main entry point with routing and theme setup
 */

import React from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';

import { GlobalDialog } from '@/components/GlobalDialog';
import { CompingScreen } from '@/screens/CompingScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { LyricEditScreen } from '@/screens/LyricEditScreen';
import { RecordingScreen } from '@/screens/RecordingScreen';
import { createAppTheme } from '@/theme';
import { preloadTokenizer } from '@/utils/kuromojiAnalyzer';

import type { Screen } from '@/types/routing';

function App() {
  // ダークモード設定の永続化キー
  const themeStorageKey = 'vtm-theme-mode';
  // テーマモード（初期値は localStorage を優先）
  const [userPaletteMode, setUserPaletteMode] = React.useState<
    'light' | 'dark'
  >(() => {
    // ブラウザ環境でのみ localStorage を参照する
    if (typeof window === 'undefined') return 'light';
    const storedMode = window.localStorage.getItem(themeStorageKey);
    return storedMode === 'dark' ? 'dark' : 'light';
  });

  // 印刷/PDF出力時はライトモードで固定する
  const [isPrintMode, setIsPrintMode] = React.useState(false);
  const resolvedMode = isPrintMode ? 'light' : userPaletteMode;

  // テーマ生成は mode の変更時だけ行う
  const theme = React.useMemo(
    () => createAppTheme(resolvedMode),
    [resolvedMode],
  );

  // ユーザー操作でテーマを切り替え、永続化する
  const toggleDarkMode = React.useCallback(() => {
    setUserPaletteMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      // 設定は localStorage に保存して次回も適用する
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(themeStorageKey, next);
      }
      return next;
    });
  }, []);

  /**
   * 印刷プレビュー時は一時的にライトモードへ切り替える
   * - beforeprint/afterprint と matchMedia の両方で補足する
   * - ユーザー設定は維持し、印刷終了後に元へ戻す
   */
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const enterPrintMode = () => setIsPrintMode(true);
    const exitPrintMode = () => setIsPrintMode(false);

    const handleBeforePrint = () => enterPrintMode();
    const handleAfterPrint = () => exitPrintMode();

    // ブラウザの印刷イベントに追従する
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    // matchMedia(print) の変更を補足する
    const printMedia = window.matchMedia('print');
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsPrintMode(event.matches);
    };
    if (printMedia.addEventListener) {
      printMedia.addEventListener('change', handleMediaChange);
    } else {
      // Safari などの古い実装向け
      printMedia.addListener(handleMediaChange);
    }

    // アプリ内の印刷ボタンからも確実に切り替える
    const handlePrintStart = () => enterPrintMode();
    const handlePrintEnd = () => exitPrintMode();
    window.addEventListener('vtm:print:start', handlePrintStart);
    window.addEventListener('vtm:print:end', handlePrintEnd);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      if (printMedia.removeEventListener) {
        printMedia.removeEventListener('change', handleMediaChange);
      } else {
        printMedia.removeListener(handleMediaChange);
      }
      window.removeEventListener('vtm:print:start', handlePrintStart);
      window.removeEventListener('vtm:print:end', handlePrintEnd);
    };
  }, []);

  /**
   * 印刷プレビュー時にライトモードへ切り替える
   * - beforeprint/afterprint と matchMedia の両方で補足する
   * - 印刷中のみ切り替え、終了時に元へ戻す
   */
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforePrint = () => setIsPrintMode(true);
    const handleAfterPrint = () => setIsPrintMode(false);

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    const printMedia = window.matchMedia('print');
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsPrintMode(event.matches);
    };
    if (printMedia.addEventListener) {
      printMedia.addEventListener('change', handleMediaChange);
    } else {
      // Safari などの古い実装向け
      printMedia.addListener(handleMediaChange);
    }

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      if (printMedia.removeEventListener) {
        printMedia.removeEventListener('change', handleMediaChange);
      } else {
        printMedia.removeListener(handleMediaChange);
      }
    };
  }, []);

  const [currentScreen, setCurrentScreen] = React.useState<Screen>({
    type: 'home',
  });

  // Preload kuromoji tokenizer on app startup
  React.useEffect(() => {
    preloadTokenizer().catch((err) => {
      console.error('Failed to preload kuromoji tokenizer:', err);
    });
  }, []);

  const navigate = React.useCallback((screen: Screen) => {
    setCurrentScreen(screen);
  }, []);

  const renderScreen = () => {
    switch (currentScreen.type) {
      case 'home':
        return (
          <HomeScreen
            onNavigate={navigate}
            isDarkMode={userPaletteMode === 'dark'}
            onToggleDarkMode={toggleDarkMode}
          />
        );
      case 'lyric-edit':
        return <LyricEditScreen onNavigate={navigate} />;
      case 'recording':
        return (
          <RecordingScreen
            songId={currentScreen.songId}
            onNavigate={navigate}
          />
        );
      case 'comping':
        return (
          <CompingScreen songId={currentScreen.songId} onNavigate={navigate} />
        );
      default:
        return (
          <HomeScreen
            onNavigate={navigate}
            isDarkMode={userPaletteMode === 'dark'}
            onToggleDarkMode={toggleDarkMode}
          />
        );
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {renderScreen()}
      <GlobalDialog />
    </ThemeProvider>
  );
}

export default App;
