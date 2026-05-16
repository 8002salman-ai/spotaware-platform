import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import { saveNewLead, saveChatSession, getSettings, logActivity, type ChatSession } from '../utils/storage';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `You are SpotBot, a friendly AI assistant for SpotAware.dev, a premium web development agency.

SERVICES & PRICING:
- Landing Page: $497 (5-7 days)
- Multi-page Website: $1,497 (10-14 days)  
- Web Application: $3,997+ (3-6 weeks)
- E-commerce Store: $2,997 (2-4 weeks)

- Redesign: $997+ (1-3 weeks)

PAYMENT: 50% upfront, 50% on completion. 100% satisfaction guarantee.
ADD-ONS: Logo $297, E-commerce $697, Rush +30%, Maintenance $197/mo
TECH: React, Next.js, TypeScript, Tailwind, Node.js, PostgreSQL

Be concise (2-3 sentences), friendly, guide toward Project Brief form. Ask clarifying questions if needed.`;

interface Message { id: string; role: 'user' | 'assistant'; content: string; timestamp: Date; }

const quickReplies = ["Services & pricing?", "How long does it take?", "Help me choose"];

function getNaturalFallbackReply(userInput: string): string {
  const text = userInput.toLowerCase();

  if (/(hi|hello|hey|salam|assalam)/.test(text)) {
    return "Assalam o Alaikum! Main SpotBot hoon. Aap website, app, pricing, ya timeline mein se kis cheez ke liye help chahte hain?";
  }
  if (/(price|pricing|cost|budget|kitna|charges)/.test(text)) {
    return "Sure! Starter $497, Professional $1,497, aur Enterprise $3,997 se start hota hai. Agar aap apna goal batain to main best package suggest kar deta hoon.";
  }
  if (/(time|timeline|kitne din|delivery|kab)/.test(text)) {
    return "Typical timeline: Landing 5-7 days, Business Website 10-14 days, aur Web App 3-6 weeks. Agar project urgent ho to rush delivery bhi available hai.";
  }
  if (/(ecommerce|shop|store)/.test(text)) {
    return "E-commerce package $2,997 se start hota hai aur 2-4 weeks lagte hain. Product count aur payment/shipping needs ke hisab se exact scope finalize hota hai.";
  }
  if (/(thank|thanks|shukriya)/.test(text)) {
    return "You're welcome! Agar aap chahein to main next step bhi bata doon: `Pricing` select karke `Project Brief` submit kar dein.";
  }

  return "Main aapki help kar sakta hoon services, pricing, timeline, aur package selection mein. Agar aap apna business type bata dein to main direct best option recommend kar deta hoon.";
}

export default function ChatAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [email, setEmail] = useState('');
  const [emailCaptured, setEmailCaptured] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [leadId, setLeadId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settings = getSettings();

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (isOpen && emailCaptured && inputRef.current) inputRef.current.focus(); }, [isOpen, emailCaptured]);

  useEffect(() => {
    if (sessionId && leadId && messages.length > 0) {
      saveChatSession({ id: sessionId, leadId, email: email || 'anonymous', messages: messages.map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp })), startedAt: messages[0]?.timestamp || new Date(), lastMessageAt: messages[messages.length - 1]?.timestamp || new Date() } as ChatSession);
    }
  }, [messages, sessionId, leadId, email]);

  const sendEmailNotification = async (clientEmail: string) => {
    if (!settings.email.enabled || !settings.email.serviceId || !settings.email.publicKey || !settings.email.templateIdLead) return;
    try { await emailjs.send(settings.email.serviceId, settings.email.templateIdLead, { to_email: settings.email.adminEmail, from_email: clientEmail, message: `New lead from SpotAware.dev!\nEmail: ${clientEmail}\nTime: ${new Date().toLocaleString()}`, client_email: clientEmail }, settings.email.publicKey); } catch (e) { console.log('Email failed:', e); }
  };

  const startChat = async (withEmail: boolean = true) => {
    if (withEmail && email.trim() && email.includes('@')) { setEmailSubmitting(true); const lead = saveNewLead(email.trim()); setLeadId(lead.id); logActivity('lead', 'New Lead', 'Captured via chatbot', lead.id, email.trim()); await sendEmailNotification(email.trim()); } else { setLeadId(`anon_${Date.now()}`); }
    setSessionId(`chat_${Date.now()}`); setEmailCaptured(true); setEmailSubmitting(false);
    setMessages([{ id: Date.now().toString(), role: 'assistant', content: email.trim() ? `Got it! 📧 We'll reach out at ${email}.\n\nI'm SpotBot — what can I help you with?` : `Hey! 👋 I'm SpotBot — your AI assistant.\n\nWhat would you like to know?`, timestamp: new Date() }]);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isTyping) return;
    setShowQuickReplies(false);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: content.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]); setInput(''); setIsTyping(true);
    try {
      const history = messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      history.push({ role: 'user', content: content.trim() });
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'HTTP-Referer': window.location.origin, 'X-Title': 'SpotAware.dev' };
      if (settings.api.useCustomKey && settings.api.openrouterApiKey) headers['Authorization'] = `Bearer ${settings.api.openrouterApiKey}`;
      const res = await fetch(OPENROUTER_API_URL, { method: 'POST', headers, body: JSON.stringify({ model: settings.api.openrouterModel, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history], max_tokens: 200, temperature: 0.7 }) });
      if (!res.ok) throw new Error('API failed');
      const data = await res.json();
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: data.choices?.[0]?.message?.content || "I'd love to help! What would you like to know?", timestamp: new Date() }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: getNaturalFallbackReply(content), timestamp: new Date() }]);
    } finally { setIsTyping(false); }
  };

  const scrollTo = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setIsOpen(false); };
  const openWhatsApp = () => {
    const p = settings.whatsapp.phoneNumber.replace(/\D/g, '');
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(settings.whatsapp.welcomeMessage)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 md:bottom-5 right-3 z-50 w-13 h-13 rounded-full bg-cyan-glow text-midnight flex items-center justify-center shadow-[0_0_25px_rgba(0,229,255,0.25)] hover:shadow-[0_0_35px_rgba(0,229,255,0.4)] transition-all ${isOpen ? 'scale-0' : 'scale-100'}`}
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5, type: 'spring' }}
      >
        <span className="text-xl">💬</span>
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-surface" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.95 }} transition={{ duration: 0.2 }}
            className="fixed bottom-20 md:bottom-5 right-3 z-50 w-[calc(100vw-24px)] md:w-[360px] rounded-2xl shadow-[0_8px_60px_rgba(0,0,0,0.5)] overflow-hidden border border-gray-soft/40 max-h-[72vh] md:max-h-[500px] flex flex-col"
            style={{ background: 'var(--t-card,#152230)' }}
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-gray-soft/30" style={{ background: 'var(--t-el,#1a2d3d)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-glow/25 to-violet-accent/25 flex items-center justify-center text-base border border-cyan-glow/20">🤖</div>
                <div>
                  <h4 className="font-semibold text-white text-[13px] leading-tight">SpotBot</h4>
                  <span className="text-[10px] text-green-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /> Online</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {settings.whatsapp.enabled && (
                  <button onClick={openWhatsApp} className="w-8 h-8 rounded-lg bg-green-500/15 hover:bg-green-500/25 flex items-center justify-center transition-colors border border-green-500/20" title="WhatsApp">
                    <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors">
                  <span className="text-gray-medium text-sm">✕</span>
                </button>
              </div>
            </div>

            {!emailCaptured ? (
              /* Email Capture */
              <div className="flex-1 flex flex-col items-center justify-center p-6" style={{ background: 'var(--t-bg,#0f1923)' }}>
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-glow/15 to-violet-accent/15 flex items-center justify-center mb-4 border border-cyan-glow/10">
                  <span className="text-2xl">👋</span>
                </div>
                <h3 className="font-display font-bold text-white text-[15px] mb-1">Hey there!</h3>
                <p className="text-[#7b82a0] text-[13px] text-center mb-5 leading-relaxed">Chat with AI or leave email for human follow-up</p>
                <div className="w-full space-y-2.5">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email.includes('@') && startChat(true)}
                    placeholder="your@email.com (optional)"
                    className="w-full px-4 py-3 rounded-xl border border-gray-soft/40 focus:border-cyan-glow/50 focus:outline-none text-[13px] text-white text-center placeholder:text-gray-medium"
                    style={{ background: 'var(--t-in,#1f3344)' }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => startChat(false)} className="flex-1 py-3 rounded-xl text-[13px] font-medium border border-gray-soft/40 text-gray-medium hover:text-white hover:border-gray-soft transition-colors">Skip</button>
                    <button onClick={() => startChat(true)} disabled={emailSubmitting} className="flex-1 py-3 rounded-xl text-[13px] font-semibold bg-cyan-glow text-midnight hover:bg-cyan-soft transition-colors disabled:opacity-50">{emailSubmitting ? '...' : 'Start →'}</button>
                  </div>
                </div>
                {settings.whatsapp.enabled && (
                  <button onClick={openWhatsApp} className="mt-4 flex items-center gap-1.5 text-[11px] text-green-400/80 hover:text-green-400 transition-colors">📱 Or chat on WhatsApp</button>
                )}
              </div>
            ) : (
              <>
                {/* Quick Actions */}
                <div className="px-3 py-2 border-b border-gray-soft/30 flex gap-1.5 flex-shrink-0" style={{ background: 'var(--t-bg,#0f1923)' }}>
                  {[{ label: '💰 Pricing', id: 'pricing' }, { label: '📝 Brief', id: 'project-brief' }, { label: '◆ Work', id: 'portfolio' }].map((btn) => (
                    <button key={btn.id} onClick={() => scrollTo(btn.id)} className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-gray-soft/40 text-gray-medium hover:text-white hover:border-cyan-glow/30 whitespace-nowrap transition-colors" style={{ background: 'var(--t-in,#1f3344)' }}>{btn.label}</button>
                  ))}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3" style={{ background: 'var(--t-bg,#0f1923)' }}>
                  {messages.map((msg) => (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-[1.6] whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-cyan-glow/15 text-[#c8f4ff] border border-cyan-glow/20 rounded-br-sm'
                          : 'text-charcoal-light border border-gray-soft/40 rounded-bl-sm'
                      }`} style={msg.role === 'assistant' ? { background: 'var(--t-in,#1f3344)' } : undefined}>
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-sm border border-gray-soft/40" style={{ background: 'var(--t-in,#1f3344)' }}>
                        <span className="flex gap-1.5 items-center">
                          <span className="w-2 h-2 rounded-full bg-cyan-glow/60 animate-bounce" />
                          <span className="w-2 h-2 rounded-full bg-cyan-glow/60 animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <span className="w-2 h-2 rounded-full bg-cyan-glow/60 animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </span>
                      </div>
                    </div>
                  )}

                  {showQuickReplies && messages.length === 1 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {quickReplies.map((r) => (
                        <button key={r} onClick={() => sendMessage(r)} className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-medium hover:text-white border border-gray-soft/40 hover:border-cyan-glow/30 transition-colors" style={{ background: 'var(--t-in,#1f3344)' }}>{r}</button>
                      ))}
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-2.5 border-t border-gray-soft/30 flex-shrink-0" style={{ background: 'var(--t-card,#152230)' }}>
                  <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2">
                    <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything..." disabled={isTyping}
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-soft/40 focus:border-cyan-glow/50 focus:outline-none text-[13px] text-white disabled:opacity-40 placeholder:text-gray-medium"
                      style={{ background: 'var(--t-in,#1f3344)' }}
                    />
                    <button type="submit" disabled={!input.trim() || isTyping}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${input.trim() && !isTyping ? 'bg-cyan-glow text-midnight shadow-[0_0_12px_rgba(0,229,255,0.3)]' : 'bg-gray-soft text-gray-medium'}`}>↑</button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
