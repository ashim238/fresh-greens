// Opens the system Messages composer to text the trusted contact.
// iOS does not let apps send SMS silently — the user taps Send in Messages.

import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

import type { TrustedContact } from './api/trusted-contact';

export type NotifyFlow = 'share-location' | 'unfamiliar' | 'roadside';

export type NotifyTrustedContactInput = {
  flow: NotifyFlow;
  /** User-facing reason or problem label. */
  reason: string;
  locationLabel?: string;
  coordinates?: { latitude: number; longitude: number };
};

function dialablePhone(phoneNumber: string): string {
  return phoneNumber.replace(/[^\d+]/g, '');
}

function mapsLine(coordinates?: { latitude: number; longitude: number }): string | null {
  if (!coordinates) return null;
  const { latitude, longitude } = coordinates;
  return `https://maps.apple.com/?ll=${latitude},${longitude}`;
}

function buildSmsBody(input: NotifyTrustedContactInput): string {
  const lines: string[] = ['Fresh Greens — safety check-in'];
  switch (input.flow) {
    case 'share-location':
      lines.push("I'm sharing where I am with you.");
      break;
    case 'unfamiliar':
      lines.push("I'm in an unfamiliar area and wanted you to know.");
      break;
    case 'roadside':
      lines.push("I need roadside help and wanted you to know.");
      break;
  }
  lines.push(`Situation: ${input.reason}`);
  if (input.locationLabel) {
    lines.push(`Location: ${input.locationLabel}`);
  }
  const maps = mapsLine(input.coordinates);
  if (maps) {
    lines.push(maps);
  }
  lines.push('Tap Send so I know you got this.');
  return lines.join('\n');
}

/**
 * Opens Messages with a pre-filled body. Returns whether the composer opened.
 */
export async function openTrustedContactSms(
  contact: TrustedContact,
  input: NotifyTrustedContactInput,
): Promise<boolean> {
  const dialable = dialablePhone(contact.phoneNumber);
  if (!dialable) {
    Alert.alert(
      'No phone number',
      'Your trusted contact has no usable phone number. Update their details in Safety settings.',
    );
    return false;
  }

  const body = encodeURIComponent(buildSmsBody(input));
  const url = `sms:${dialable}?body=${body}`;
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    Alert.alert('Unavailable', "This device can't send text messages.");
    return false;
  }
  await Linking.openURL(url);
  return true;
}

/**
 * Best-effort GPS read for the SMS body. Returns undefined when unavailable.
 */
export async function readNotifyCoordinates(): Promise<{
  coordinates?: { latitude: number; longitude: number };
  locationLabel?: string;
}> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return {};
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const coordinates = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    };
    const [geo] = await Location.reverseGeocodeAsync(coordinates);
    const locationLabel = geo
      ? [geo.name, geo.city, geo.region].filter(Boolean).join(', ') || undefined
      : undefined;
    return { coordinates, locationLabel };
  } catch {
    return {};
  }
}

/**
 * Loads the trusted contact and opens Messages. Used when share starts.
 */
export async function notifyTrustedContact(
  contact: TrustedContact | null,
  input: NotifyTrustedContactInput,
): Promise<{ opened: boolean; notifiedAtIso?: string }> {
  if (!contact) {
    Alert.alert(
      'Add a trusted contact',
      'Set someone up in Safety settings so Fresh Greens can open Messages for you.',
    );
    return { opened: false };
  }
  const opened = await openTrustedContactSms(contact, input);
  return opened
    ? { opened: true, notifiedAtIso: new Date().toISOString() }
    : { opened: false };
}
