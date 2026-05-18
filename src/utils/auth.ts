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
  try {
    await fetch('/api/ensure-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    // Best-effort helper for environments where API isn't reachable.
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

export async function getSupabasePortalSession(): Promise<PortalSession | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  await exchangeOAuthCodeFromUrl();

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;
  await ensureProfileViaApi(data.session.access_token);

  const user = data.session.user;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id,email,name,role')
    .eq('id', user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: profile?.email || user.email || '',
    name: profile?.name || (user.user_metadata?.name as string | undefined) || user.email?.split('@')[0] || 'User',
    role: normalizeRole(profile?.role),
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

  if (error) return { error: error.message };
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
