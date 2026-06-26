import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sendError(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return sendError(res, 500, 'Supabase profile API is not configured.');
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return sendError(res, 401, 'Missing authorization token.');

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authUser, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authUser.user) return sendError(res, 401, 'Invalid session.');

  const user = authUser.user;
  const fallbackName =
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
    (user.email ? user.email.split('@')[0] : 'Client');
  const normalizedEmail = user.email || '';

  const { data: existing, error: selectError } = await adminClient
    .from('profiles')
    .select('id,email,name,role')
    .eq('id', user.id)
    .maybeSingle();

  if (selectError) {
    return sendError(res, 500, selectError.message);
  }

  let created = false;
  if (!existing) {
    const { error: insertError } = await adminClient.from('profiles').insert({
      id: user.id,
      email: normalizedEmail,
      name: fallbackName,
      role: 'client',
    });
    // Ignore unique key violation (23505) — concurrent request already created the profile
    if (insertError && insertError.code !== '23505') {
      return sendError(res, 500, insertError.message);
    }
    created = !insertError;
  } else if (!existing.email || !existing.name) {
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        email: existing.email || normalizedEmail,
        name: existing.name || fallbackName,
      })
      .eq('id', user.id);
    if (updateError) return sendError(res, 500, updateError.message);
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id,email,name,role')
    .eq('id', user.id)
    .single();

  if (profileError) return sendError(res, 500, profileError.message);
  return res.status(200).json({ profile, created });
}
