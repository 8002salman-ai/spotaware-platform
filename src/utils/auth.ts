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

export function isSupabaseAuthEnabled(): boolean {
  return isSupabaseConfigured();
}

export async function getSupabasePortalSession(): Promise<PortalSession | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) return null;

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

export async function supabaseSignIn(email: string, password: string): Promise<{ session: PortalSession | null; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { session: null, error: 'Supabase not configured.' };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { session: null, error: error.message };

  const session = await getSupabasePortalSession();
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

  const session = await getSupabasePortalSession();
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
    options: { redirectTo },
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
