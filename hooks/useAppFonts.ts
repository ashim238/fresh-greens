import {
  LibreFranklin_400Regular,
  LibreFranklin_500Medium,
  LibreFranklin_600SemiBold,
  LibreFranklin_700Bold,
} from '@expo-google-fonts/libre-franklin';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';
import { useFonts } from 'expo-font';

/**
 * Loads Libre Franklin + DM Serif Display once at app root.
 * Startup may continue on error with system fonts.
 */
export function useAppFonts(): { loaded: boolean; error: Error | null } {
  const [loaded, error] = useFonts({
    LibreFranklin_400Regular,
    LibreFranklin_500Medium,
    LibreFranklin_600SemiBold,
    LibreFranklin_700Bold,
    DMSerifDisplay_400Regular,
  });
  return { loaded, error: error ?? null };
}
