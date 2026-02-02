/**
 * App Root Component
 * Main entry point with routing and theme setup
 */

import { useEffect, useState } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';

import { GlobalDialog } from '@/components/GlobalDialog';
import { CompingScreen } from '@/screens/CompingScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { LyricEditScreen } from '@/screens/LyricEditScreen';
import { RecordingScreen } from '@/screens/RecordingScreen';
import { createAppTheme, type FontFamilyOption } from '@/theme';
import { preloadTokenizer } from '@/utils/kuromojiAnalyzer';

import type { Screen } from '@/types/routing';

function App() {
  const themeStorageKey = 'vtm-theme-mode';
  const fontStorageKey = 'vtm-font-family';

  const [userPaletteMode, setUserPaletteMode] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const storedMode = window.localStorage.getItem(themeStorageKey);
    return storedMode === 'dark' ? 'dark' : 'light';
  });

  const [fontFamily, setFontFamily] = useState<FontFamilyOption>(() => {
    if (typeof window === 'undefined') return 'noto-sans-jp';
    const storedFont = window.localStorage.getItem(fontStorageKey);
    const validFonts: FontFamilyOption[] = ['noto-sans-jp', 'line-seed-jp', 'biz-udpgothic', 'resource-han-rounded'];
    return validFonts.includes(storedFont as FontFamilyOption) ? (storedFont as FontFamilyOption) : 'noto-sans-jp';
  });

  // 印刷/PDF出力時はライトモードで固定する
  const [isPrintMode, setIsPrintMode] = useState(false);
  const resolvedMode = isPrintMode ? 'light' : userPaletteMode;

  const theme = createAppTheme(resolvedMode, fontFamily);

  const toggleDarkMode = () => {
    setUserPaletteMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(themeStorageKey, next);
      }
      return next;
    });
  };

  const handleFontFamilyChange = (newFont: FontFamilyOption) => {
    setFontFamily(newFont);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(fontStorageKey, newFont);
    }
  };

  /**
   * 印刷プレビュー時は一時的にライトモードへ切り替える
   * - beforeprint/afterprint と matchMedia の両方で補足する
   * - ユーザー設定は維持し、印刷終了後に元へ戻す
   */
  useEffect(() => {
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

  const [currentScreen, setCurrentScreen] = useState<Screen>({
    type: 'home',
  });

  // Preload kuromoji tokenizer on app startup
  useEffect(() => {
    preloadTokenizer().catch((err) => {
      console.error('Failed to preload kuromoji tokenizer:', err);
    });
  }, []);

  const navigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const renderScreen = () => {
    switch (currentScreen.type) {
      case 'home':
        return (
          <HomeScreen
            onNavigate={navigate}
            isDarkMode={userPaletteMode === 'dark'}
            onToggleDarkMode={toggleDarkMode}
            fontFamily={fontFamily}
            onFontFamilyChange={handleFontFamilyChange}
          />
        );
      case 'lyric-edit':
        return <LyricEditScreen onNavigate={navigate} />;
      case 'recording':
        return <RecordingScreen songId={currentScreen.songId} onNavigate={navigate} />;
      case 'comping':
        return <CompingScreen songId={currentScreen.songId} onNavigate={navigate} />;
      default:
        return (
          <HomeScreen
            onNavigate={navigate}
            isDarkMode={userPaletteMode === 'dark'}
            onToggleDarkMode={toggleDarkMode}
            fontFamily={fontFamily}
            onFontFamilyChange={handleFontFamilyChange}
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
