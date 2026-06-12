import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_cors';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const emailServiceId = process.env.EMAILJS_SERVICE_ID;
const emailTemplateId = process.env.EMAILJS_TEMPLATE_ID_ADMIN || process.env.EMAILJS_TEMPLATE_ID;
const emailPublicKey = process.env.EMAILJS_PUBLIC_KEY;
const fallbackAdminEmail = process.env.ADMIN_EMAIL;

function sendError(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message });
}

async function sendEmail(toEmail: string, params: Record<string, string>) {
  if (!emailServiceId || !emailTemplateId || !emailPublicKey) return false;

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: emailServiceId,
      template_id: emailTemplateId,
      user_id: emailPublicKey,
      template_params: {
        ...params,
        to_email: toEmail,
      },
    }),
  });

  return response.ok;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return sendError(res, 500, 'Supabase notification API is not configured.');
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return sendError(res, 401, 'Missing authorization token.');

  const { type, title, message, entityId } = req.body || {};
  if (!type || !title || !message) {
    return sendError(res, 400, 'type, title, and message are required.');
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: authUser, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authUser.user) return sendError(res, 401, 'Invalid session.');

  const { data: actorProfile } = await adminClient
    .from('profiles')
    .select('email,name,role')
    .eq('id', authUser.user.id)
    .single();

  const actorEmail = actorProfile?.email || authUser.user.email || 'unknown';

  await adminClient.from('activity_logs').insert({
    actor_id: authUser.user.id,
    actor_email: actorEmail,
    action_type: type,
    action_label: title,
    detail: message,
    entity_id: entityId || null,
  });

  const { data: admins } = await adminClient
    .from('profiles')
    .select('email')
    .in('role', ['owner', 'admin']);

  const recipients = new Set<string>();
  admins?.forEach((admin) => admin.email && recipients.add(admin.email));
  if (fallbackAdminEmail) recipients.add(fallbackAdminEmail);

  let emailSent = false;
  for (const toEmail of recipients) {
    const sent = await sendEmail(toEmail, {
      subject: title,
      message,
      from_email: actorEmail,
      client_email: actorEmail,
      event_type: type,
      entity_id: entityId || '',
    });
    emailSent = emailSent || sent;
  }

  return res.status(200).json({ ok: true, emailSent, recipients: recipients.size });
}
