import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import { saveProjectSubmission, getSettings, logActivity } from '../utils/storage';

const bdL = '#353850'; const tSec = '#9da2be'; const tMut = '#6b7094'; const bgIn = '#2e3148';

interface PricingSelection {
  plan: string; price: number; delivery: string;
  addons: { name: string; price: number; type: string }[];
  installments: number; installmentFee: number; total: number; perInstallment: number; monthly: number;
}

const industries = ['Technology', 'E-commerce', 'Healthcare', 'Finance', 'Real Estate', 'Education', 'Agency', 'Startup', 'Personal Brand', 'Other'];

export default function ProjectBrief() {
  const [step, setStep] = useState(1);
  const [pricing, setPricing] = useState<PricingSelection | null>(null);
  const [form, setForm] = useState({ name: '', email: '', company: '', phone: '', industry: '', description: '' });
  const [submitted, setSubmitted] = useState(false);
  const totalSteps = 3;

  // Listen for pricing selection from Pricing component
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as PricingSelection;
      setPricing(detail);
      setStep(1);
      setSubmitted(false);
    };
    window.addEventListener('pricing-selected', handler);
    return () => window.removeEventListener('pricing-selected', handler);
  }, []);

  const canProceed = () => {
    if (step === 1) return !!pricing;
    if (step === 2) return form.industry !== '';
    if (step === 3) return form.name !== '' && form.email !== '';
    return true;
  };

  const handleSubmit = async () => {
    const pricingSummary = pricing
      ? `Plan: ${pricing.plan} ($${pricing.price})\nAdd-ons: ${pricing.addons.length > 0 ? pricing.addons.map(a => `${a.name} ($${a.price}${a.type === 'monthly' ? '/mo' : ''})`).join(', ') : 'None'}\nPayment: ${pricing.installments > 1 ? `${pricing.installments} installments of $${pricing.perInstallment}${pricing.installmentFee > 0 ? ` (+$${pricing.installmentFee} fee)` : ''}` : `Full payment $${pricing.total}`}\nTotal: $${pricing.total}${pricing.monthly > 0 ? ` + $${pricing.monthly}/mo` : ''}\nDelivery: ${pricing.delivery}`
      : 'No plan selected';

    saveProjectSubmission({
      email: form.email, name: form.name, company: form.company,
      projectType: pricing?.plan || 'Not selected',
      budget: pricing ? `$${pricing.total}` : 'Not specified',
      timeline: pricing?.delivery || 'Not specified',
      industry: form.industry, features: pricing?.addons.map(a => a.name) || [],
      description: `${form.description}\n\n--- PRICING DETAILS ---\n${pricingSummary}`,
    });

    const settings = getSettings();
    if (settings.email.enabled && settings.email.serviceId && settings.email.publicKey) {
      try {
        const templateId = settings.email.templateIdBrief || settings.email.templateIdLead;
        if (templateId) {
          await emailjs.send(settings.email.serviceId, templateId, {
            to_email: settings.email.adminEmail,
            from_name: form.name,
            from_email: form.email,
            company: form.company || 'Not provided',
            project_type: pricing?.plan || 'Not selected',
            budget: pricing ? `$${pricing.total}` : 'Not specified',
            timeline: pricing?.delivery || 'Not specified',
            industry: form.industry,
            features: pricing?.addons.map(a => a.name).join(', ') || 'None',
            description: form.description || 'Not provided',
            message: `NEW PROJECT BRIEF\n\nClient: ${form.name}\nEmail: ${form.email}\nCompany: ${form.company || 'N/A'}\nPhone: ${form.phone || 'N/A'}\nIndustry: ${form.industry}\n\n${pricingSummary}\n\nNotes: ${form.description || 'None'}`,
          }, settings.email.publicKey);
        }
      } catch (e) { console.log('Email failed:', e); }
    }
    logActivity('submission', 'New Brief', `${pricing?.plan || 'Custom'} — ${form.name}`, undefined, form.email);
    setSubmitted(true);
  };

  const progress = (step / totalSteps) * 100;

  return (
    <section className="py-14 md:py-24 px-4" id="project-brief">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-glow/10 border border-cyan-glow/20 mb-3">
            <span className="text-[10px] uppercase tracking-wider text-cyan-glow font-semibold">🎯 Free • No Commitment</span>
          </span>
          <h2 className="font-display text-2xl md:text-4xl font-bold text-white tracking-tight">
            Start Your <span className="text-gradient">Project</span>
          </h2>
          <p className="text-[14px] max-w-md mx-auto mt-2" style={{ color: tSec }}>
            {pricing ? `${pricing.plan} package selected. Complete your details below.` : 'Select a plan above, then fill your details.'}
          </p>
        </motion.div>

        {/* Form */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="bg-surface-card rounded-2xl overflow-hidden border border-gray-soft/30 premium-shadow-lg">
          
          {/* Progress */}
          <div className="h-1 bg-gray-soft/30"><motion.div className="h-full bg-gradient-to-r from-cyan-glow to-violet-accent" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} /></div>

          <div className="p-5 md:p-6">
            {/* Step dots */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs" style={{ color: tMut }}>Step {step}/{totalSteps}</span>
              <div className="flex gap-1.5">{[1, 2, 3].map(s => <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? 'bg-cyan-glow w-5' : s < step ? 'bg-cyan-glow/40 w-1.5' : 'bg-gray-soft w-1.5'}`} />)}</div>
            </div>

            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-400/10 flex items-center justify-center mx-auto mb-4"><span className="text-3xl">🎉</span></div>
                  <h3 className="font-display text-xl font-bold text-white mb-2">Brief Received!</h3>
                  <p className="text-[14px] mb-4" style={{ color: tSec }}>We'll review and send a proposal within 24 hours.</p>
                  {pricing && (
                    <div className="p-4 rounded-xl border text-left" style={{ borderColor: bdL, background: bgIn }}>
                      <p className="text-xs font-medium text-white mb-2">Your Selection:</p>
                      <p className="text-[13px]" style={{ color: tSec }}>📦 {pricing.plan} — ${pricing.price.toLocaleString()}</p>
                      {pricing.addons.length > 0 && <p className="text-[13px]" style={{ color: tSec }}>➕ {pricing.addons.map(a => a.name).join(', ')}</p>}
                      <p className="text-[13px] text-cyan-glow font-semibold mt-1">Total: ${pricing.total.toLocaleString()}{pricing.installments > 1 ? ` (${pricing.installments}× $${pricing.perInstallment})` : ''}</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <>
                  {/* Step 1: Review Selection */}
                  {step === 1 && (
                    <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h3 className="font-display text-lg font-semibold text-white mb-4">Your Selected Package</h3>
                      {pricing ? (
                        <div className="space-y-3">
                          {/* Plan summary */}
                          <div className="p-4 rounded-xl border" style={{ borderColor: bdL, background: bgIn }}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-white text-[15px]">📦 {pricing.plan}</span>
                              <span className="text-cyan-glow font-bold text-lg">${pricing.price.toLocaleString()}</span>
                            </div>
                            <span className="text-[12px] px-2 py-0.5 rounded bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/15">⚡ {pricing.delivery}</span>
                          </div>

                          {/* Addons */}
                          {pricing.addons.length > 0 && (
                            <div className="p-4 rounded-xl border" style={{ borderColor: bdL, background: bgIn }}>
                              <p className="text-xs font-medium text-white mb-2">➕ Add-ons</p>
                              {pricing.addons.map(a => (
                                <div key={a.name} className="flex justify-between text-[13px] py-1">
                                  <span style={{ color: tSec }}>{a.name}</span>
                                  <span className="text-white">${a.price}{a.type === 'monthly' ? '/mo' : ''}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Payment plan */}
                          <div className="p-4 rounded-xl border" style={{ borderColor: bdL, background: bgIn }}>
                            <p className="text-xs font-medium text-white mb-2">💳 Payment Plan</p>
                            <div className="flex justify-between text-[13px]">
                              <span style={{ color: tSec }}>{pricing.installments === 1 ? 'Full Payment' : `${pricing.installments} Installments`}</span>
                              <span className="text-white">{pricing.installments > 1 ? `${pricing.installments}× $${pricing.perInstallment}` : `$${pricing.total.toLocaleString()}`}</span>
                            </div>
                            {pricing.installmentFee > 0 && (
                              <div className="flex justify-between text-[12px] mt-1"><span className="text-amber-400">Installment fee (20%)</span><span className="text-amber-400">+${pricing.installmentFee}</span></div>
                            )}
                            {pricing.monthly > 0 && (
                              <div className="flex justify-between text-[12px] mt-1"><span style={{ color: tMut }}>Monthly recurring</span><span className="text-violet-400">${pricing.monthly}/mo</span></div>
                            )}
                            <div className="flex justify-between pt-2 mt-2 border-t" style={{ borderColor: bdL }}>
                              <span className="text-white font-bold text-[14px]">Total</span>
                              <span className="text-cyan-glow font-bold text-[16px]">${pricing.total.toLocaleString()}</span>
                            </div>
                          </div>

                          <button onClick={() => { setPricing(null); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-xs hover:text-white transition-colors" style={{ color: tMut }}>← Change plan</button>
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-[14px] mb-4" style={{ color: tSec }}>No plan selected yet.</p>
                          <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="px-6 py-3 rounded-xl bg-cyan-glow text-midnight font-semibold text-[14px] hover:bg-cyan-soft transition-colors">
                            Choose a Plan ↑
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Step 2: Industry + Description */}
                  {step === 2 && (
                    <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h3 className="font-display text-lg font-semibold text-white mb-4">About Your Project</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-medium mb-2 block" style={{ color: tSec }}>Industry *</label>
                          <div className="flex flex-wrap gap-2">
                            {industries.map(ind => (
                              <button key={ind} onClick={() => setForm({ ...form, industry: ind })}
                                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all ${form.industry === ind ? 'border-cyan-glow/40 bg-cyan-glow/10 text-cyan-glow' : ''}`}
                                style={form.industry !== ind ? { borderColor: bdL, color: tSec } : undefined}>{ind}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-2 block" style={{ color: tSec }}>Project Notes <span style={{ color: tMut }}>(optional)</span></label>
                          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Describe your vision, target audience, or any references..."
                            rows={3} className="w-full px-4 py-3 rounded-xl text-[13px] text-white focus:outline-none focus:border-cyan-glow/50 placeholder:text-[#4a4f6a] resize-none"
                            style={{ background: bgIn, border: `1px solid ${bdL}` }} />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 3: Contact */}
                  {step === 3 && (
                    <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                      <h3 className="font-display text-lg font-semibold text-white mb-1">Almost There! 🎉</h3>
                      <p className="text-[13px] mb-4" style={{ color: tMut }}>Where should we send your proposal?</p>
                      <div className="space-y-3">
                        {[
                          { label: 'Full Name *', key: 'name', ph: 'John Doe', type: 'text' },
                          { label: 'Email *', key: 'email', ph: 'john@company.com', type: 'email' },
                          { label: 'Company', key: 'company', ph: 'Acme Inc.', type: 'text' },
                          { label: 'Phone', key: 'phone', ph: '+1 (555) 000-0000', type: 'tel' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="text-xs font-medium mb-1.5 block" style={{ color: tSec }}>{f.label}</label>
                            <input type={f.type} value={(form as Record<string, string>)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                              placeholder={f.ph} className="w-full px-4 py-3 rounded-xl text-[13px] text-white focus:outline-none focus:border-cyan-glow/50 placeholder:text-[#4a4f6a]"
                              style={{ background: bgIn, border: `1px solid ${bdL}` }} />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </AnimatePresence>

            {/* Navigation */}
            {!submitted && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t" style={{ borderColor: bdL }}>
                <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${step === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:text-white'}`} style={{ color: tMut }}>← Back</button>
                {step < totalSteps ? (
                  <button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}
                    className={`px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${canProceed() ? 'bg-cyan-glow text-midnight hover:bg-cyan-soft' : 'bg-gray-soft text-gray-medium cursor-not-allowed'}`}>
                    Continue →
                  </button>
                ) : (
                  <button onClick={handleSubmit} disabled={!canProceed()}
                    className={`px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${canProceed() ? 'bg-gradient-to-r from-cyan-glow to-violet-accent text-white shadow-[0_0_20px_rgba(0,229,255,0.15)]' : 'bg-gray-soft text-gray-medium cursor-not-allowed'}`}>
                    Submit Brief 🚀
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
