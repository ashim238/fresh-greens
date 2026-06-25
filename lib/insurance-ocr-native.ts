import Constants from 'expo-constants';

/**
 * Lazy bridge to expo-text-extractor. The native module is not in Expo Go —
 * importing the package at all calls requireNativeModule and throws. Probe
 * appOwnership first; only dynamic-import on dev/standalone builds.
 */

let ocrSupportedCache: boolean | null = null;

/** Custom native modules are unavailable in the Expo Go client. */
export function isInsuranceOcrEnvironment(): boolean {
  return Constants.appOwnership !== 'expo';
}

export async function isInsuranceOcrSupported(): Promise<boolean> {
  if (!isInsuranceOcrEnvironment()) {
    ocrSupportedCache = false;
    return false;
  }
  if (ocrSupportedCache !== null) return ocrSupportedCache;
  try {
    const mod = await import('expo-text-extractor');
    ocrSupportedCache = mod.isSupported;
    return ocrSupportedCache;
  } catch {
    ocrSupportedCache = false;
    return false;
  }
}

export async function extractInsuranceCardText(uri: string): Promise<string[]> {
  if (!(await isInsuranceOcrSupported())) {
    throw new Error('Insurance card OCR is not available on this build.');
  }
  const mod = await import('expo-text-extractor');
  return mod.extractTextFromImage(uri);
}
