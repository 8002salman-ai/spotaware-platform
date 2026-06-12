import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_cors';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sendError(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return sendError(res, 500, 'Supabase admin API is not configured.');
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return sendError(res, 401, 'Missing authorization token.');
  }

  const { email, password, role } = req.body || {};
  if (!email || !password || !['admin', 'viewer'].includes(role)) {
    return sendError(res, 400, 'Email, password, and admin/viewer role are required.');
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authUser, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authUser.user) {
    return sendError(res, 401, 'Invalid session.');
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role,email')
    .eq('id', authUser.user.id)
    .single();

  if (profileError || !profile || !['owner', 'admin'].includes(profile.role)) {
    return sendError(res, 403, 'Only owner/admin users can create admin accounts.');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      name: normalizedEmail.split('@')[0],
    },
  });

  if (createError || !created.user) {
    return sendError(res, 400, createError?.message || 'Unable to create user.');
  }

  const { error: upsertError } = await adminClient.from('profiles').upsert({
    id: created.user.id,
    email: normalizedEmail,
    name: created.user.user_metadata?.name || normalizedEmail.split('@')[0],
    role,
  });

  if (upsertError) {
    return sendError(res, 500, upsertError.message);
  }

  await adminClient.from('activity_logs').insert({
    actor_id: authUser.user.id,
    actor_email: profile.email,
    action_type: 'system',
    action_label: 'Admin User Created',
    detail: `${normalizedEmail} created as ${role}`,
    entity_id: created.user.id,
  });

  return res.status(200).json({
    user: {
      id: created.user.id,
      email: normalizedEmail,
      role,
    },
  });
}
