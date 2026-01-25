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
import { theme } from '@/theme';
import { preloadTokenizer } from '@/utils/kuromojiAnalyzer';

import type { Screen } from '@/types/routing';

function App() {
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
        return <HomeScreen onNavigate={navigate} />;
      case 'lyric-edit':
        return (
          <LyricEditScreen
            songId={currentScreen.songId}
            onNavigate={navigate}
          />
        );
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
        return <HomeScreen onNavigate={navigate} />;
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
