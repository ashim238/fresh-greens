import {
  Jost_400Regular,
  Jost_700Bold,
  Jost_800ExtraBold,
} from '@expo-google-fonts/jost';
import {
  LibreFranklin_400Regular,
  LibreFranklin_500Medium,
  LibreFranklin_600SemiBold,
  LibreFranklin_700Bold,
} from '@expo-google-fonts/libre-franklin';
import { useFonts } from 'expo-font';

/**
 * Loads Jost + Libre Franklin once at app root. Gate navigation on the
 * returned boolean (see app/_layout.tsx).
 */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Jost_400Regular,
    Jost_700Bold,
    Jost_800ExtraBold,
    LibreFranklin_400Regular,
    LibreFranklin_500Medium,
    LibreFranklin_600SemiBold,
    LibreFranklin_700Bold,
  });
  return loaded;
}
