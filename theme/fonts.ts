/**
 * Brand typefaces — Space Grotesk (display / wayfinding) + Libre Franklin
 * (body). Loaded via `hooks/useAppFonts` at app root; OFL via
 * @expo-google-fonts/*.
 *
 * RN maps one font file per `fontFamily` string — do not pair these names
 * with `fontWeight`; pick the weight file in typography tokens instead.
 *
 * Space Grotesk ships 300–700 only (no 800 ExtraBold); Bold is the heaviest
 * display weight, used for the SOS countdown numeral.
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
} as const;
