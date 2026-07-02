/**
 * Brand typefaces:
 *   Space Grotesk  — structural display / wayfinding
 *   Libre Franklin — body / UI
 *   DM Serif Display — brand-voice moments (warmth, not geometry)
 *
 * Loaded via `hooks/useAppFonts` at app root; OFL via @expo-google-fonts/*.
 *
 * RN maps one font file per `fontFamily` string — do not pair these names
 * with `fontWeight`; pick the weight file in typography tokens instead.
 */
export const fonts = {
  spaceGrotesk: {
    regular: 'SpaceGrotesk_400Regular',
    bold: 'SpaceGrotesk_700Bold',
  },
  franklin: {
    regular: 'LibreFranklin_400Regular',
    medium: 'LibreFranklin_500Medium',
    semiBold: 'LibreFranklin_600SemiBold',
    bold: 'LibreFranklin_700Bold',
  },
  dmSerif: {
    regular: 'DMSerifDisplay_400Regular',
  },
} as const;
