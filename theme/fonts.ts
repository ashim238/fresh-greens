/**
 * Brand typefaces — Jost (display / wayfinding) + Libre Franklin (body).
 * Loaded via `hooks/useAppFonts` at app root; OFL via @expo-google-fonts/*.
 *
 * RN maps one font file per `fontFamily` string — do not pair these names
 * with `fontWeight`; pick the weight file in typography tokens instead.
 */
export const fonts = {
  jost: {
    regular: 'Jost_400Regular',
    bold: 'Jost_700Bold',
    extraBold: 'Jost_800ExtraBold',
  },
  franklin: {
    regular: 'LibreFranklin_400Regular',
    medium: 'LibreFranklin_500Medium',
    semiBold: 'LibreFranklin_600SemiBold',
    bold: 'LibreFranklin_700Bold',
  },
} as const;
