/**
 * Brand typefaces:
 *   Libre Franklin — structural display + body / UI
 *   DM Serif Display — brand-voice moments (warmth, not geometry)
 *
 * Two-font system: Franklin covers the full hierarchy from 40pt
 * display down to 11pt captions. DM Serif breaks register only
 * at emotional moments (crisis reassurance, arrival, greeting).
 *
 * Loaded via `hooks/useAppFonts` at app root; OFL via @expo-google-fonts/*.
 *
 * RN maps one font file per `fontFamily` string — do not pair these names
 * with `fontWeight`; pick the weight file in typography tokens instead.
 */
export const fonts = {
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
