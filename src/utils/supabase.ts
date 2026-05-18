import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase config — reads from Admin Settings (localStorage) or env vars
function getSupabaseConfig(): { url: string; anonKey: string } | null {
  // Try env vars first (for Vercel deployment)
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return {
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
  }
  // Try localStorage (Admin Settings)
  try {
    const settings = localStorage.getItem('spotaware_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.backend?.supabaseUrl && parsed.backend?.supabaseAnonKey) {
        return { url: parsed.backend.supabaseUrl, anonKey: parsed.backend.supabaseAnonKey };
      }
    }
  } catch { /* ignore */ }
  return null;
}

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  const config = getSupabaseConfig();
  if (!config) return null;
  _supabase = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
  return _supabase;
}

export function resetSupabaseClient(): void {
  _supabase = null;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

// Stripe config
export function getStripeConfig(): { publishableKey: string; } | null {
  if (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    return { publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY };
  }
  try {
    const settings = localStorage.getItem('spotaware_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.backend?.stripePublishableKey) {
        return { publishableKey: parsed.backend.stripePublishableKey };
      }
    }
  } catch { /* ignore */ }
  return null;
}
