import { useState, useEffect } from 'react';

interface Theme {
  id: string; name: string; light?: boolean;
  accent: string; accentSoft: string; violet: string;
  bg: string; card: string; elevated: string; input: string;
  border: string; borderLight: string; textPrimary: string; textSec: string; textMut: string;
  glass: string; glassStrong: string;
}

const themes: Theme[] = [
  {
    id: 'ocean', name: '🌊 Ocean Night',
    accent: '#00e5ff', accentSoft: '#67f0ff', violet: '#a78bfa',
    bg: '#0f1923', card: '#152230', elevated: '#1a2d3d', input: '#1f3344',
    border: '#264055', borderLight: '#1e3548', textPrimary: '#eaecf4', textSec: '#8ab4d0', textMut: '#4d7a96',
    glass: 'rgba(21,34,48,0.7)', glassStrong: 'rgba(26,45,61,0.9)',
  },
  {
    id: 'midnight', name: '🌙 Midnight',
    accent: '#c084fc', accentSoft: '#d8b4fe', violet: '#a78bfa',
    bg: '#130f1e', card: '#1e1830', elevated: '#251e3a', input: '#2c2444',
    border: '#3d3260', borderLight: '#342a52', textPrimary: '#eaecf4', textSec: '#b8a5d4', textMut: '#6e5c8e',
    glass: 'rgba(30,24,48,0.7)', glassStrong: 'rgba(37,30,58,0.9)',
  },
  {
    id: 'emerald', name: '🌿 Emerald',
    accent: '#34d399', accentSoft: '#6ee7b7', violet: '#a78bfa',
    bg: '#0c1a14', card: '#122620', elevated: '#17302a', input: '#1c3a32',
    border: '#2a5040', borderLight: '#234538', textPrimary: '#eaecf4', textSec: '#8cc5aa', textMut: '#4d8a6e',
    glass: 'rgba(18,38,32,0.7)', glassStrong: 'rgba(23,48,42,0.9)',
  },
  {
    id: 'rose', name: '🌹 Rose Gold',
    accent: '#fb7185', accentSoft: '#fda4af', violet: '#c084fc',
    bg: '#1a1015', card: '#281820', elevated: '#30202a', input: '#382830',
    border: '#503040', borderLight: '#452838', textPrimary: '#eaecf4', textSec: '#d4a0b0', textMut: '#8e5c6e',
    glass: 'rgba(40,24,32,0.7)', glassStrong: 'rgba(48,32,42,0.9)',
  },
  {
    id: 'warm', name: '🌅 Warm Night',
    accent: '#f59e0b', accentSoft: '#fbbf24', violet: '#f472b6',
    bg: '#1a1610', card: '#252018', elevated: '#2e2820', input: '#362f26',
    border: '#4a4030', borderLight: '#403828', textPrimary: '#eaecf4', textSec: '#c4b498', textMut: '#8a7a5e',
    glass: 'rgba(37,32,24,0.7)', glassStrong: 'rgba(46,40,32,0.9)',
  },
  {
    id: 'skywork', name: '✨ Skywork Dark',
    accent: '#3385ff', accentSoft: '#5c9eff', violet: '#7357ff',
    bg: '#181d24', card: '#1f2529', elevated: '#252b31', input: '#2b3239',
    border: '#333b43', borderLight: '#2a3139', textPrimary: '#e4e7eb', textSec: '#979fab', textMut: '#5c6470',
    glass: 'rgba(31,37,41,0.82)', glassStrong: 'rgba(37,43,49,0.93)',
  },
  // ── Light Themes ──
  {
    id: 'light', name: '☀️ Clean White', light: true,
    accent: '#0891b2', accentSoft: '#06b6d4', violet: '#7c3aed',
    bg: '#f8f9fb', card: '#ffffff', elevated: '#f1f3f8', input: '#e8ebf0',
    border: '#d5d9e2', borderLight: '#e2e5ed', textPrimary: '#0f172a', textSec: '#475569', textMut: '#94a3b8',
    glass: 'rgba(255,255,255,0.8)', glassStrong: 'rgba(255,255,255,0.95)',
  },
  {
    id: 'cream', name: '🍦 Soft Cream', light: true,
    accent: '#0d9488', accentSoft: '#14b8a6', violet: '#7c3aed',
    bg: '#f6f2ec', card: '#ebe4db', elevated: '#e1d8ce', input: '#d8cec2',
    border: '#b8ada0', borderLight: '#c9beb1', textPrimary: '#120f0c', textSec: '#2c2620', textMut: '#5f564b',
    glass: 'rgba(235,228,219,0.9)', glassStrong: 'rgba(241,236,229,0.96)',
  },
];

function applyTheme(theme: Theme) {
  const r = document.documentElement.style;
  r.setProperty('--ta', theme.accent);
  r.setProperty('--ta-soft', theme.accentSoft);
  r.setProperty('--tv', theme.violet);
  r.setProperty('--t-bg', theme.bg);
  r.setProperty('--t-card', theme.card);
  r.setProperty('--t-el', theme.elevated);
  r.setProperty('--t-in', theme.input);
  r.setProperty('--t-bd', theme.border);
  r.setProperty('--t-bdl', theme.borderLight);
  r.setProperty('--t-sec', theme.textSec);
  r.setProperty('--t-mut', theme.textMut);
  r.setProperty('--t-glass', theme.glass);
  r.setProperty('--t-glass-s', theme.glassStrong);
  r.setProperty('--t-primary', theme.textPrimary);
  r.setProperty('--t-light', theme.light ? '1' : '0');

  document.body.style.background = theme.bg;
  document.body.style.color = theme.textPrimary;

  // Toggle light class on html for tailwind overrides
  if (theme.light) {
    document.documentElement.classList.add('light-theme');
  } else {
    document.documentElement.classList.remove('light-theme');
  }

  localStorage.setItem('spotaware_theme', theme.id);
}

export default function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('skywork');

  useEffect(() => {
    const saved = localStorage.getItem('spotaware_theme') || 'skywork';
    setActive(saved);
    const t = themes.find(t => t.id === saved) || themes.find(t => t.id === 'skywork') || themes[0];
    applyTheme(t);
  }, []);

  const select = (id: string) => {
    setActive(id);
    const t = themes.find(t => t.id === id)!;
    applyTheme(t);
    setOpen(false);
  };

  const activeTheme = themes.find(t => t.id === active);

  return (
    <div className="fixed top-3 right-3 z-[60]">
      <button onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm hover:scale-105 transition-all shadow-lg"
        style={{ background: 'var(--t-card)', border: '1px solid var(--t-bd)' }}>
        🎨
      </button>

      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="absolute top-11 right-0 w-52 rounded-xl overflow-hidden shadow-2xl z-10"
            style={{ background: 'var(--t-card)', border: '1px solid var(--t-bd)' }}>
            <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--t-bdl)' }}>
              <p className="text-[12px] font-semibold" style={{ color: 'var(--t-primary)' }}>Choose Theme</p>
              <span className="text-[10px]" style={{ color: 'var(--t-mut)' }}>{activeTheme?.name}</span>
            </div>
            
            <div className="p-1.5">
              <p className="px-2 py-1 text-[10px] font-medium" style={{ color: 'var(--t-mut)' }}>Dark</p>
              {themes.filter(t => !t.light).map(t => (
                <button key={t.id} onClick={() => select(t.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${active === t.id ? '' : 'hover:opacity-80'}`}
                  style={active === t.id ? { background: `${t.accent}15` } : undefined}>
                  <div className="flex gap-0.5">
                    <span className="w-3.5 h-3.5 rounded-full border" style={{ background: t.accent, borderColor: t.accent + '40' }} />
                    <span className="w-3.5 h-3.5 rounded-full" style={{ background: t.bg, border: `1px solid ${t.border}` }} />
                  </div>
                  <span className="text-[12px] font-medium flex-1" style={{ color: 'var(--t-primary)' }}>{t.name}</span>
                  {active === t.id && <span className="text-[11px]" style={{ color: t.accent }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
