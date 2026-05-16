import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export default function Logo({ size = 'sm', animate = false }: LogoProps) {
  const sizes = {
    sm: { w: 34, h: 38, text: 'text-[17px]' },
    md: { w: 38, h: 42, text: 'text-[20px]' },
    lg: { w: 52, h: 58, text: 'text-[28px]' },
  };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* SA Mark — Shield/Diamond shape */}
      <motion.div
        className="relative flex items-center justify-center"
        style={{ width: s.w, height: s.h }}
        whileHover={animate ? { scale: 1.06, rotate: -2 } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      >
        <svg width={s.w} height={s.h} viewBox="0 0 34 38" fill="none">
          {/* Shield / gem shape — not a square */}
          <path
            d="M17 1L32 8.5V22C32 28 26 34 17 37C8 34 2 28 2 22V8.5L17 1Z"
            fill="url(#logo-grad)"
            stroke="url(#logo-stroke)" strokeWidth="0.5"
          />
          {/* S — clean, proper direction */}
          <path
            d="M14 13.5C14 13.5 12 12 10.5 13C9 14 10 15.5 12 16.5C14 17.5 15.5 18 15.5 19.5C15.5 21 14 22.5 11.5 22"
            stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"
          />
          {/* A — angular */}
          <path
            d="M18.5 22L22 12.5L25.5 22"
            stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"
          />
          {/* A crossbar */}
          <line x1="19.8" y1="19.5" x2="24.2" y2="19.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
          {/* Gradient defs */}
          <defs>
            <linearGradient id="logo-grad" x1="0" y1="0" x2="34" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--ta, #3385ff)" />
              <stop offset="1" stopColor="var(--tv, #7357ff)" />
            </linearGradient>
            <linearGradient id="logo-stroke" x1="0" y1="0" x2="34" y2="38" gradientUnits="userSpaceOnUse">
              <stop stopColor="rgba(255,255,255,0.3)" />
              <stop offset="1" stopColor="rgba(255,255,255,0.05)" />
            </linearGradient>
          </defs>
        </svg>
        {/* Shine */}
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: 'polygon(50% 2%, 95% 22%, 95% 58%, 50% 97%, 5% 58%, 5% 22%)' }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 40%)' }} />
        </div>
      </motion.div>

      {/* Wordmark */}
      <div className="flex items-baseline gap-0">
        <span className={`font-display ${s.text} font-bold tracking-[-0.02em] leading-none`}
          style={{ color: 'var(--t-primary, #111827)' }}>
          Spot
        </span>
        <span className={`font-display ${s.text} font-bold tracking-[-0.02em] leading-none`}
          style={{
            background: `linear-gradient(135deg, var(--ta, #4f46e5) 0%, var(--tv, #7c3aed) 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
          Aware
        </span>
        <span className={`font-display ${s.text} tracking-[-0.02em] leading-none`}
          style={{ fontWeight: 400, color: `color-mix(in srgb, var(--ta, #4f46e5) 40%, transparent)` }}>
          .dev
        </span>
      </div>
    </div>
  );
}
