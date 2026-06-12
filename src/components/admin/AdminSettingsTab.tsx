import { type SiteSettings } from '../../utils/storage';
import { bgCard, bgElevated, bgInput, border, borderLight, textSecondary, textMuted } from './types';

const MODELS = [
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3 (Free)', free: true },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)', free: true },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B (Free)', free: true },
  { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)', free: true },
  { id: 'openrouter/auto', name: 'Auto (Best)', free: false },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', free: false },
  { id: 'openai/gpt-4o', name: 'GPT-4o', free: false },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', free: false },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', free: false },
];

interface Props {
  settings: SiteSettings;
  setSettings: (s: SiteSettings) => void;
  saved: boolean;
  testEmail: 'idle' | 'sending' | 'ok' | 'fail';
  handleSaveSettings: () => void;
  handleTestEmail: () => void;
}

export default function AdminSettingsTab({ settings, setSettings, saved, testEmail, handleSaveSettings, handleTestEmail }: Props) {
  return (
    <div className="max-w-2xl space-y-6">
      {/* Email */}
      <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: borderLight }}>
          <div className="flex items-center gap-3"><span className="text-xl">📧</span><div><h3 className="font-semibold text-white">Email Settings</h3><p className="text-xs" style={{ color: textMuted }}>EmailJS configuration</p></div></div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.email.enabled} onChange={e => setSettings({ ...settings, email: { ...settings.email, enabled: e.target.checked } })} className="w-4 h-4 rounded" /><span className="text-xs text-white">On</span></label>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl p-4 border" style={{ background: bgElevated, borderColor: borderLight }}>
            <p className="text-xs font-semibold text-white mb-2">📘 Setup:</p>
            <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: textSecondary }}>
              <li>Go to <a href="https://emailjs.com" target="_blank" rel="noopener noreferrer" className="text-cyan-glow underline">emailjs.com</a></li><li>Add Gmail service → copy Service ID</li><li>Create templates → copy Template IDs</li><li>Account → copy Public Key</li><li>Paste below and save</li>
            </ol>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ l: 'Service ID', v: settings.email.serviceId, k: 'serviceId', ph: 'service_xxx' }, { l: 'Public Key', v: settings.email.publicKey, k: 'publicKey', ph: 'xxx' }].map(f => (
              <div key={f.k}><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>{f.l}</label>
                <input value={f.v} onChange={e => setSettings({ ...settings, email: { ...settings.email, [f.k]: e.target.value } })} placeholder={f.ph} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ l: 'Template ID (Lead)', v: settings.email.templateIdLead, k: 'templateIdLead' }, { l: 'Template ID (Brief)', v: settings.email.templateIdBrief, k: 'templateIdBrief' }].map(f => (
              <div key={f.k}><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>{f.l}</label>
                <input value={f.v} onChange={e => setSettings({ ...settings, email: { ...settings.email, [f.k]: e.target.value } })} placeholder="template_xxx" className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
            ))}
          </div>
          <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Admin Email</label>
            <input value={settings.email.adminEmail} onChange={e => setSettings({ ...settings, email: { ...settings.email, adminEmail: e.target.value } })} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
          <button onClick={handleTestEmail} className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${testEmail === 'ok' ? 'bg-green-500/20 text-green-400' : testEmail === 'fail' ? 'bg-red-500/20 text-red-400' : 'border text-white hover:bg-white/5'}`} style={testEmail === 'idle' ? { borderColor: border } : undefined}>
            {testEmail === 'sending' ? 'Sending...' : testEmail === 'ok' ? '✓ Sent!' : testEmail === 'fail' ? '✕ Failed' : '📤 Test Email'}
          </button>
        </div>
      </div>
      {/* AI */}
      <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: borderLight }}>
          <div className="flex items-center gap-3"><span className="text-xl">🤖</span><div><h3 className="font-semibold text-white">AI Chat Settings</h3><p className="text-xs" style={{ color: textMuted }}>OpenRouter API</p></div></div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.api.useCustomKey} onChange={e => setSettings({ ...settings, api: { ...settings.api, useCustomKey: e.target.checked } })} className="w-4 h-4 rounded" /><span className="text-xs text-white">Custom Key</span></label>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>AI Model</label>
            <select value={settings.api.openrouterModel} onChange={e => setSettings({ ...settings, api: { ...settings.api, openrouterModel: e.target.value } })} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }}>
              <optgroup label="🆓 Free">{MODELS.filter(m => m.free).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
              <optgroup label="💳 Paid">{MODELS.filter(m => !m.free).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
            </select></div>
          {settings.api.useCustomKey && (
            <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>API Key</label>
              <input type="password" value={settings.api.openrouterApiKey} onChange={e => setSettings({ ...settings, api: { ...settings.api, openrouterApiKey: e.target.value } })} placeholder="sk-or-v1-xxx" className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white font-mono focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
          )}
          <div className="rounded-xl p-3 border" style={{ background: bgElevated, borderColor: borderLight }}>
            <p className="text-[11px]" style={{ color: textMuted }}>
              <strong className="text-white">SpotBot API status:</strong>{' '}
              {settings.api.useCustomKey
                ? (settings.api.openrouterApiKey.trim() ? '🟢 Custom key configured' : '🔴 Custom key enabled but empty')
                : '🟡 No custom key (chat uses best-effort routing + local fallback)'}
            </p>
          </div>
        </div>
      </div>
      {/* WhatsApp */}
      <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: borderLight }}>
          <div className="flex items-center gap-3"><span className="text-xl">📱</span><div><h3 className="font-semibold text-white">WhatsApp</h3><p className="text-xs" style={{ color: textMuted }}>Contact settings</p></div></div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.whatsapp.enabled} onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, enabled: e.target.checked } })} className="w-4 h-4 rounded" /><span className="text-xs text-white">On</span></label>
        </div>
        <div className="p-5 space-y-4">
          <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Phone Number</label>
            <input value={settings.whatsapp.phoneNumber} onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, phoneNumber: e.target.value } })} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
          <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Welcome Message</label>
            <textarea value={settings.whatsapp.welcomeMessage} onChange={e => setSettings({ ...settings, whatsapp: { ...settings.whatsapp, welcomeMessage: e.target.value } })} rows={2} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none resize-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
        </div>
      </div>
      {/* Backend / Infrastructure */}
      <div className="rounded-xl border overflow-hidden" style={{ background: bgCard, borderColor: border }}>
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: borderLight }}>
          <div className="flex items-center gap-3"><span className="text-xl">🏗</span><div><h3 className="font-semibold text-white">Backend & Infrastructure</h3><p className="text-xs" style={{ color: textMuted }}>Supabase, Stripe, Deployment</p></div></div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.backend.useSupabase} onChange={e => setSettings({ ...settings, backend: { ...settings.backend, useSupabase: e.target.checked } })} className="w-4 h-4 rounded" /><span className="text-xs text-white">Use Supabase</span></label>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl p-4 border" style={{ background: bgElevated, borderColor: borderLight }}>
            <p className="text-xs font-semibold text-white mb-2">📘 Production Setup Checklist:</p>
            <ol className="text-xs space-y-1 list-decimal list-inside" style={{ color: textSecondary }}>
              <li>Create project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-cyan-glow underline">supabase.com</a> → Copy URL & Anon Key</li>
              <li>Run <code className="text-cyan-glow/70 bg-cyan-glow/5 px-1 rounded">supabase-schema.sql</code> in SQL Editor</li>
              <li>Create <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-cyan-glow underline">Stripe</a> account → Copy Publishable Key</li>
              <li>Deploy to <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-cyan-glow underline">Vercel</a> via GitHub</li>
              <li>Set env vars: <code className="text-cyan-glow/70 bg-cyan-glow/5 px-1 rounded">VITE_SUPABASE_URL</code>, <code className="text-cyan-glow/70 bg-cyan-glow/5 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>, <code className="text-cyan-glow/70 bg-cyan-glow/5 px-1 rounded">VITE_STRIPE_PUBLISHABLE_KEY</code></li>
            </ol>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Supabase Project URL</label>
              <input value={settings.backend.supabaseUrl} onChange={e => setSettings({ ...settings, backend: { ...settings.backend, supabaseUrl: e.target.value } })} placeholder="https://xxxxx.supabase.co" className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white font-mono focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
            <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Supabase Anon Key</label>
              <input type="password" value={settings.backend.supabaseAnonKey} onChange={e => setSettings({ ...settings, backend: { ...settings.backend, supabaseAnonKey: e.target.value } })} placeholder="eyJhbGciOi..." className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white font-mono focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Stripe Publishable Key</label>
              <input value={settings.backend.stripePublishableKey} onChange={e => setSettings({ ...settings, backend: { ...settings.backend, stripePublishableKey: e.target.value } })} placeholder="pk_test_xxx" className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white font-mono focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }} /></div>
            <div><label className="text-xs font-medium mb-1.5 block" style={{ color: textSecondary }}>Stripe Mode</label>
              <select value={settings.backend.stripeMode} onChange={e => setSettings({ ...settings, backend: { ...settings.backend, stripeMode: e.target.value as 'test' | 'live' } })} className="w-full px-4 py-2.5 rounded-lg text-[13px] text-white focus:outline-none" style={{ background: bgInput, border: `1px solid ${border}` }}>
                <option value="test">🧪 Test Mode</option><option value="live">🟢 Live Mode</option>
              </select></div>
          </div>
          <div className="rounded-xl p-3 border" style={{ background: bgElevated, borderColor: borderLight }}>
            <p className="text-[11px]" style={{ color: textMuted }}>
              <strong className="text-white">Current Mode:</strong> {settings.backend.useSupabase && settings.backend.supabaseUrl ? '🟢 Supabase (Production)' : '🟡 localStorage (Demo)'}<br/>
              {settings.backend.stripePublishableKey ? `💳 Stripe: ${settings.backend.stripeMode === 'live' ? '🟢 Live' : '🧪 Test'}` : '💳 Stripe: Not configured'}
            </p>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: bgCard, borderColor: border }}>
        <p className="text-xs" style={{ color: saved ? '#34d399' : textMuted }}>{saved ? '✓ Saved!' : 'Save your changes'}</p>
        <button onClick={handleSaveSettings} className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-cyan-glow text-midnight hover:bg-cyan-soft transition-colors">Save Settings</button>
      </div>
    </div>
  );
}
