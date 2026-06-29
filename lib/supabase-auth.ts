// Supabase Auth — anonymous session bootstrap + token management.
// No SDK; plain fetch against the GoTrue endpoints, same pattern as community-cloud.ts.

import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'fresh-greens.supabase-session.v1';

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; is_anonymous?: boolean };
};

let currentSession: SupabaseSession | null = null;

function authBase(): string {
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')}/auth/v1`;
}

function anonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
}

export async function getSession(): Promise<SupabaseSession | null> {
  if (currentSession && currentSession.expires_at > Date.now() / 1000 + 60) {
    return currentSession;
  }

  const stored = await AsyncStorage.getItem(SESSION_KEY);
  if (stored) {
    const parsed = JSON.parse(stored) as SupabaseSession;
    if (parsed.expires_at > Date.now() / 1000 + 60) {
      currentSession = parsed;
      return parsed;
    }
    const refreshed = await refreshSession(parsed.refresh_token);
    if (refreshed) return refreshed;
  }

  return null;
}

export async function signInAnonymously(): Promise<SupabaseSession | null> {
  const existing = await getSession();
  if (existing) return existing;

  try {
    const res = await fetch(`${authBase()}/signup`, {
      method: 'POST',
      headers: {
        apikey: anonKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      console.warn('[supabase-auth] anon signup failed:', res.status);
      return null;
    }

    const data = await res.json();
    const session = extractSession(data);
    if (session) await persistSession(session);
    return session;
  } catch (error) {
    console.warn('[supabase-auth] anon signup error:', error);
    return null;
  }
}

async function refreshSession(
  refreshToken: string,
): Promise<SupabaseSession | null> {
  try {
    const res = await fetch(`${authBase()}/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: anonKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const session = extractSession(data);
    if (session) await persistSession(session);
    return session;
  } catch {
    return null;
  }
}

function extractSession(data: any): SupabaseSession | null {
  if (!data?.access_token || !data?.refresh_token) return null;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ?? Date.now() / 1000 + 3600,
    user: {
      id: data.user?.id,
      is_anonymous: data.user?.is_anonymous ?? true,
    },
  };
}

async function persistSession(session: SupabaseSession): Promise<void> {
  currentSession = session;
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function signOut(): Promise<void> {
  currentSession = null;
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  if (!session) {
    return {
      apikey: anonKey(),
      'Content-Type': 'application/json',
    };
  }
  return {
    apikey: anonKey(),
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export async function getAuthUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}
