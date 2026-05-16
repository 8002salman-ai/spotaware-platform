# SpotAware.dev — Deployment Guide

## Architecture
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Supabase   │     │    Stripe    │
│  (Vercel)    │     │  (Database   │     │  (Payments)  │
│  React/Vite  │     │   + Auth)    │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                     │
       ▼                    ▼                     ▼
  ┌──────────┐      ┌──────────────┐      ┌──────────────┐
  │ EmailJS  │      │  PostgreSQL  │      │   Webhooks   │
  │ (Emails) │      │     + RLS    │      │  (Auto pay)  │
  └──────────┘      └──────────────┘      └──────────────┘
```

## Step 1: Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** → paste contents of `supabase-schema.sql` → Run
3. Go to **Settings → API** → Copy:
   - `Project URL` → VITE_SUPABASE_URL
   - `anon public key` → VITE_SUPABASE_ANON_KEY
4. Go to **Authentication → Settings**:
   - Enable Email/Password signup
   - Set redirect URL to your domain
5. Sign up as first user, then run in SQL Editor:
   ```sql
   UPDATE public.profiles SET role = 'owner' WHERE email = 'ayaz@spotaware.dev';
   ```

## Step 2: Stripe Setup

1. Go to [stripe.com](https://stripe.com) and create account
2. Get **Publishable Key** from Dashboard → Developers → API Keys
3. For webhooks (later): Set up endpoint at your-domain/api/stripe-webhook

## Step 3: EmailJS Setup

1. Go to [emailjs.com](https://emailjs.com) → Create account
2. Add Gmail service → Copy Service ID
3. Create 2 templates (Lead notification, Invoice) → Copy Template IDs
4. Copy Public Key from Account settings

## Step 4: GitHub + Vercel Deployment

1. Push code to GitHub repository
2. Go to [vercel.com](https://vercel.com) → Import GitHub repo
3. Add Environment Variables:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   ```
4. Deploy!

## Step 5: Configure in Admin Panel

1. Login to Admin Panel → Settings tab
2. Fill in all API keys (or they'll auto-read from env vars)
3. Enable Supabase toggle
4. Test email notification
5. You're live!

## Environment Variables Reference

| Variable | Where to get | Required |
|----------|-------------|----------|
| VITE_SUPABASE_URL | Supabase → Settings → API | Yes (for production) |
| VITE_SUPABASE_ANON_KEY | Supabase → Settings → API | Yes (for production) |
| VITE_STRIPE_PUBLISHABLE_KEY | Stripe → Developers → API Keys | For payments |

## Current Mode

The app works in **hybrid mode**:
- **Without Supabase**: Uses localStorage (demo/development)
- **With Supabase**: Uses real database (production)

All features work in both modes. Just flip the toggle in Admin Settings.

## Files Reference

| File | Purpose |
|------|---------|
| `supabase-schema.sql` | Complete database schema — run in Supabase SQL Editor |
| `src/utils/supabase.ts` | Supabase client configuration |
| `src/utils/storage.ts` | Data layer (localStorage fallback) |
| `src/utils/invoice.ts` | Invoice template & email |
| `DEPLOYMENT.md` | This file |
