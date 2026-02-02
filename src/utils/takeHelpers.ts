import { darken } from '@mui/material/styles';

import { increaseSaturation } from '@/utils/colorHelpers';

import type { Theme } from '@mui/material/styles';

export function getTakeHeaderColor(
  color: string,
  themeMode: Theme['palette']['mode'],
): string {
  if (themeMode === 'dark') {
    return darken(increaseSaturation(color, 0.95), 0.4);
  }
  return color;
}
