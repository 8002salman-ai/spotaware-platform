import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_cors';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const serverApiKey = process.env.OPENROUTER_API_KEY;

function sendError(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  const { model, messages, max_tokens, temperature } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return sendError(res, 400, 'messages array is required.');
  }

  const apiKey = serverApiKey;
  if (!apiKey) {
    return sendError(res, 503, 'AI chat is not configured on this server.');
  }

  try {
    const upstream = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://spotaware.dev',
        'X-Title': 'SpotAware.dev',
      },
      body: JSON.stringify({
        model: model || 'deepseek/deepseek-chat-v3-0324:free',
        messages,
        max_tokens: max_tokens || 200,
        temperature: temperature ?? 0.7,
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text().catch(() => 'Upstream error');
      return sendError(res, upstream.status, err);
    }

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (e) {
    return sendError(res, 500, 'AI request failed.');
  }
}
