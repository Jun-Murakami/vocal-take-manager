/**
 * Routing Types
 * Simple state-based routing without external router library
 */

export type Screen =
  | { type: 'home' }
  | { type: 'lyric-edit'; songId?: string }
  | { type: 'recording'; songId: string }
  | { type: 'comping'; songId: string };

export interface RouterState {
  currentScreen: Screen;
  navigate: (screen: Screen) => void;
}
