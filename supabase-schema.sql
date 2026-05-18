-- ═══════════════════════════════════════════════════════════════
-- SpotAware.dev — Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
-- ═══════════════════════════════════════════════════════════════

-- 1. PROFILES (extends Supabase Auth users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('owner', 'admin', 'viewer', 'client')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'client'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  package TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','review','revision','completed','cancelled','on_hold')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  notes TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  payment_plan TEXT NOT NULL DEFAULT 'full' CHECK (payment_plan IN ('full', 'installment')),
  total_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  on_hold BOOLEAN NOT NULL DEFAULT FALSE,
  hold_reason TEXT CHECK (hold_reason IN ('payment_overdue', 'client_delay', 'admin_pause')),
  hold_message TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PAYMENT INSTALLMENTS
CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  label TEXT NOT NULL,
  paid_at TIMESTAMPTZ,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CLIENT DEADLINES
CREATE TABLE public.client_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'overdue')),
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ORDER UPDATES (messages)
CREATE TABLE public.order_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  by TEXT NOT NULL CHECK (by IN ('admin', 'client', 'system')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. INVOICES
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  package_name TEXT,
  subtotal DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 8.25,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  note TEXT,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  stripe_invoice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. INVOICE LINE ITEMS
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  rate DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  item_type TEXT DEFAULT 'custom' CHECK (item_type IN ('package', 'addon', 'monthly', 'custom')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 8. LEADS (from chat/forms)
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  source TEXT NOT NULL DEFAULT 'chat' CHECK (source IN ('chat', 'form')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. CHAT SESSIONS
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. CHAT MESSAGES
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. PROJECT SUBMISSIONS (brief form)
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  project_type TEXT NOT NULL,
  budget TEXT NOT NULL,
  timeline TEXT NOT NULL,
  industry TEXT NOT NULL,
  features TEXT[] DEFAULT '{}',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'proposal_sent', 'converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. SUPPORT TICKETS
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_client', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. SUPPORT MESSAGES
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  by TEXT NOT NULL CHECK (by IN ('client', 'admin')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  action_type TEXT NOT NULL,
  action_label TEXT NOT NULL,
  detail TEXT NOT NULL,
  entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Helper: Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES: Users see own, admins see all
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL USING (public.is_admin());

-- ORDERS: Clients see own, admins see all
CREATE POLICY "Clients view own orders" ON public.orders FOR SELECT USING (client_id = auth.uid() OR public.is_admin());
CREATE POLICY "Clients create orders" ON public.orders FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Admins manage orders" ON public.orders FOR ALL USING (public.is_admin());

-- INSTALLMENTS: Via order access
CREATE POLICY "View installments" ON public.installments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (client_id = auth.uid() OR public.is_admin()))
);
CREATE POLICY "Admins manage installments" ON public.installments FOR ALL USING (public.is_admin());

-- CLIENT DEADLINES
CREATE POLICY "View deadlines" ON public.client_deadlines FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (client_id = auth.uid() OR public.is_admin()))
);
CREATE POLICY "Admins manage deadlines" ON public.client_deadlines FOR ALL USING (public.is_admin());

-- ORDER UPDATES: Both can view, both can insert
CREATE POLICY "View updates" ON public.order_updates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (client_id = auth.uid() OR public.is_admin()))
);
CREATE POLICY "Add updates" ON public.order_updates FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (client_id = auth.uid() OR public.is_admin()))
);

-- INVOICES
CREATE POLICY "Clients view own invoices" ON public.invoices FOR SELECT USING (client_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins manage invoices" ON public.invoices FOR ALL USING (public.is_admin());

-- INVOICE ITEMS
CREATE POLICY "View invoice items" ON public.invoice_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_id AND (client_id = auth.uid() OR public.is_admin()))
);
CREATE POLICY "Admins manage invoice items" ON public.invoice_items FOR ALL USING (public.is_admin());

-- LEADS, CHATS, SUBMISSIONS: Admin only
CREATE POLICY "Admins manage leads" ON public.leads FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage chat sessions" ON public.chat_sessions FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can insert chat sessions" ON public.chat_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage chat messages" ON public.chat_messages FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can insert chat messages" ON public.chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage submissions" ON public.submissions FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can insert submissions" ON public.submissions FOR INSERT WITH CHECK (true);

-- SUPPORT: clients own tickets, admins all
CREATE POLICY "Clients view own tickets" ON public.support_tickets FOR SELECT USING (client_id = auth.uid() OR public.is_admin());
CREATE POLICY "Clients insert own tickets" ON public.support_tickets FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "Admins manage tickets" ON public.support_tickets FOR ALL USING (public.is_admin());

CREATE POLICY "Clients view own support messages" ON public.support_messages FOR SELECT USING (client_id = auth.uid() OR public.is_admin());
CREATE POLICY "Clients insert own support messages" ON public.support_messages FOR INSERT WITH CHECK (client_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins manage support messages" ON public.support_messages FOR ALL USING (public.is_admin());

-- NOTIFICATIONS
CREATE POLICY "Clients view own notifications" ON public.notifications FOR SELECT USING (client_id = auth.uid() OR public.is_admin());
CREATE POLICY "Clients update own notifications" ON public.notifications FOR UPDATE USING (client_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL USING (public.is_admin());

-- ACTIVITY LOGS (admin-only)
CREATE POLICY "Admins view activity logs" ON public.activity_logs FOR SELECT USING (public.is_admin());
CREATE POLICY "Authenticated insert activity logs" ON public.activity_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX idx_orders_client ON public.orders(client_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_installments_order ON public.installments(order_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_order_updates_order ON public.order_updates(order_id);
CREATE INDEX idx_leads_email ON public.leads(email);
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX idx_support_tickets_client ON public.support_tickets(client_id);
CREATE INDEX idx_support_messages_ticket ON public.support_messages(ticket_id);
CREATE INDEX idx_notifications_client ON public.notifications(client_id);
CREATE INDEX idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- AUTO UPDATE TIMESTAMPS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_timestamp BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_orders_timestamp BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_invoices_timestamp BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_support_tickets_timestamp BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- SEED ADMIN USER (run after first signup)
-- Replace 'YOUR_USER_ID' with your actual Supabase Auth user ID
-- ═══════════════════════════════════════════════════════════════
-- UPDATE public.profiles SET role = 'owner' WHERE email = 'ayaz@spotaware.dev';
