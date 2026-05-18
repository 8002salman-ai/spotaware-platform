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

type SupabaseAuthSession = {
  access_token: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
};

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T | null> {
  let timer: number | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = window.setTimeout(() => {
      resolve(null);
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
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
  return Boolean(url.searchParams.get('code') || url.searchParams.get('state'));
}

async function ensureProfileViaApi(accessToken: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch('/api/ensure-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
    await response.json().catch(() => null);
  } catch {
    // Best-effort helper for environments where API isn't reachable.
  } finally {
    window.clearTimeout(timer);
  }
}

async function exchangeOAuthCodeFromUrl(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return;

  const clearOAuthParams = () => {
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  };

  // If session is already set, just clean URL and continue.
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) {
    clearOAuthParams();
    return;
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      clearOAuthParams();
      return;
    }
  } catch {
    // Supabase may already be processing this in detectSessionInUrl.
  }

  // Mobile browsers can be slower; only clear params once a session exists.
  const { data: afterExchange } = await supabase.auth.getSession();
  if (afterExchange.session?.user) {
    clearOAuthParams();
  }
}

export function isSupabaseAuthEnabled(): boolean {
  return isSupabaseConfigured();
}

export async function hydrateSupabasePortalSession(authSession: SupabaseAuthSession): Promise<PortalSession | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  await ensureProfileViaApi(authSession.access_token);

  const user = authSession.user;
  let profile: { id: string; email: string | null; name: string | null; role: string | null } | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const profileResult = await withTimeout(
      supabase
        .from('profiles')
        .select('id,email,name,role')
        .eq('id', user.id)
        .maybeSingle(),
      2500,
    );
    const profileRow = profileResult?.data;
    if (profileRow) {
      profile = profileRow;
      break;
    }
    await ensureProfileViaApi(authSession.access_token);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!profile) {
    return null;
  }

  return {
    id: user.id,
    email: profile.email || user.email || '',
    name: profile.name || (user.user_metadata?.name as string | undefined) || user.email?.split('@')[0] || 'User',
    role: normalizeRole(profile.role),
  };
}

export async function getSupabasePortalSession(): Promise<PortalSession | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  await exchangeOAuthCodeFromUrl();

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    return null;
  }
  return hydrateSupabasePortalSession(data.session as SupabaseAuthSession);
}

export async function waitForSupabasePortalSession(retries = 12, delayMs = 350): Promise<PortalSession | null> {
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

  const redirectTo = `${window.location.origin}/${target}`;
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
    return { error: error.message };
  }
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
