import { useEffect } from 'react';
import { setStatusBarStyle } from 'expo-status-bar';

type StatusBarSurface = 'light' | 'dark' | 'auto';

/**
 * Sets the status bar text color based on the active surface.
 * - 'light' surface (white/cream bg) → dark status bar text
 * - 'dark' surface (wiltedgreen, modal scrim) → light status bar text
 * - 'auto' → dark (default for map screens)
 *
 * Call at the screen level. The last mounted screen's call wins
 * (standard expo-status-bar behavior).
 */
export function useAdaptiveStatusBar(surface: StatusBarSurface) {
  useEffect(() => {
    switch (surface) {
      case 'light':
        setStatusBarStyle('dark');
        break;
      case 'dark':
        setStatusBarStyle('light');
        break;
      case 'auto':
      default:
        setStatusBarStyle('dark');
        break;
    }
  }, [surface]);
}
