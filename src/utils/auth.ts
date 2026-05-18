import { getSupabase, isSupabaseConfigured } from './supabase';

export interface PortalSession {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'viewer' | 'client';
}

type SignUpInput = {
  email: string;
  password: string;
  name?: string;
  company?: string;
  role?: PortalSession['role'];
};

type AuthDebugListener = (entries: string[]) => void;
const AUTH_DEBUG_KEY = 'spotaware_auth_debug';

function loadStoredDebugEntries(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.sessionStorage.getItem(AUTH_DEBUG_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function storeDebugEntries(entries: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTH_DEBUG_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage failures; debug output is best effort.
  }
}

const authDebugEntries: string[] = loadStoredDebugEntries();
const authDebugListeners = new Set<AuthDebugListener>();

function emitAuthDebug(message: string): void {
  if (typeof window === 'undefined') return;
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  authDebugEntries.push(`${timestamp} ${message}`);
  if (authDebugEntries.length > 60) authDebugEntries.shift();
  storeDebugEntries(authDebugEntries);
  const snapshot = [...authDebugEntries];
  authDebugListeners.forEach((listener) => listener(snapshot));
}

export function logAuthDebug(message: string): void {
  emitAuthDebug(message);
}

export function clearAuthDebugEntries(): void {
  authDebugEntries.length = 0;
  storeDebugEntries(authDebugEntries);
  const snapshot = [...authDebugEntries];
  authDebugListeners.forEach((listener) => listener(snapshot));
}

export function getAuthDebugEntries(): string[] {
  return [...authDebugEntries];
}

export function subscribeAuthDebug(listener: AuthDebugListener): () => void {
  authDebugListeners.add(listener);
  listener([...authDebugEntries]);
  return () => {
    authDebugListeners.delete(listener);
  };
}

function normalizeRole(role: string | null | undefined): PortalSession['role'] {
  if (role === 'owner' || role === 'admin' || role === 'viewer' || role === 'client') {
    return role;
  }
  return 'client';
}

export function isOAuthReturnInProgress(): boolean {
  if (typeof window === 'undefined') return false;
  const url = new URL(window.location.href);
  const inProgress = Boolean(url.searchParams.get('code') || url.searchParams.get('state'));
  if (inProgress) {
    emitAuthDebug('OAuth redirect detected');
  }
  return inProgress;
}

async function ensureProfileViaApi(accessToken: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    emitAuthDebug('Profile ensure request started');
    const response = await fetch('/api/ensure-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const body = await response.json().catch(() => null) as { created?: boolean } | null;
    if (response.ok && body?.created) {
      emitAuthDebug('Profile created');
    } else if (response.ok) {
      emitAuthDebug('Profile already existed');
    } else {
      emitAuthDebug('Profile ensure request failed');
    }
  } catch {
    emitAuthDebug('Profile ensure request failed');
    // Best-effort helper for environments where API isn't reachable.
  }
}

async function exchangeOAuthCodeFromUrl(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return;
  emitAuthDebug('exchangeCodeForSession started');

  const clearOAuthParams = () => {
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  };

  // If session is already set, just clean URL and continue.
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) {
    emitAuthDebug('Session loaded (already present before exchange)');
    clearOAuthParams();
    return;
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      emitAuthDebug('exchangeCodeForSession completed');
      clearOAuthParams();
      return;
    }
    emitAuthDebug(`exchangeCodeForSession error: ${error.message}`);
  } catch {
    emitAuthDebug('exchangeCodeForSession threw exception');
    // Supabase may already be processing this in detectSessionInUrl.
  }

  // Mobile browsers can be slower; only clear params once a session exists.
  const { data: afterExchange } = await supabase.auth.getSession();
  if (afterExchange.session?.user) {
    emitAuthDebug('Session loaded after exchange fallback check');
    clearOAuthParams();
  }
}

export function isSupabaseAuthEnabled(): boolean {
  return isSupabaseConfigured();
}

export async function getSupabasePortalSession(): Promise<PortalSession | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  await exchangeOAuthCodeFromUrl();

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    emitAuthDebug(`Session load failed${error ? `: ${error.message}` : ''}`);
    return null;
  }
  emitAuthDebug('Session loaded');
  await ensureProfileViaApi(data.session.access_token);

  const user = data.session.user;
  let profile: { id: string; email: string | null; name: string | null; role: string | null } | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    emitAuthDebug('Profile fetch started');
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id,email,name,role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileRow) {
      profile = profileRow;
      break;
    }
    await ensureProfileViaApi(data.session.access_token);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!profile) {
    emitAuthDebug('Profile fetch failed: still missing');
    return null;
  }
  emitAuthDebug('Profile loaded');
  emitAuthDebug(`Role detected: ${normalizeRole(profile.role)}`);

  return {
    id: user.id,
    email: profile.email || user.email || '',
    name: profile.name || (user.user_metadata?.name as string | undefined) || user.email?.split('@')[0] || 'User',
    role: normalizeRole(profile.role),
  };
}

export async function waitForSupabasePortalSession(retries = 25, delayMs = 400): Promise<PortalSession | null> {
  for (let i = 0; i < retries; i++) {
    const session = await getSupabasePortalSession();
    if (session) return session;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

export async function supabaseSignIn(email: string, password: string): Promise<{ session: PortalSession | null; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { session: null, error: 'Supabase not configured.' };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { session: null, error: error.message };

  const session = await waitForSupabasePortalSession();
  return { session, error: session ? undefined : 'Unable to load profile after login.' };
}

export async function supabaseSignUp(input: SignUpInput): Promise<{ session: PortalSession | null; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { session: null, error: 'Supabase not configured.' };

  const { email, password, name, company, role = 'client' } = input;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || email.split('@')[0],
        company: company || null,
        role,
      },
    },
  });

  if (error) return { session: null, error: error.message };

  const session = await waitForSupabasePortalSession();
  return { session };
}

export async function supabaseSignOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function supabaseSignInWithGoogle(target: 'admin' | 'client'): Promise<{ error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase not configured.' };
  clearAuthDebugEntries();
  emitAuthDebug(`Google OAuth initiated for /${target}`);

  const redirectTo = `${window.location.origin}/${target}`;
  emitAuthDebug(`Redirect triggered to ${redirectTo}`);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    emitAuthDebug(`OAuth initiation failed: ${error.message}`);
    return { error: error.message };
  }
  emitAuthDebug('OAuth redirect requested');
  return {};
}

export async function supabaseSendPasswordReset(email: string, target: 'admin' | 'client'): Promise<{ error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase not configured.' };
  const redirectTo = `${window.location.origin}/${target}`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return { error: error.message };
  return {};
}
