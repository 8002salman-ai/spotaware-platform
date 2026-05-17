import { getSupabase } from './supabase';
import type {
  Lead,
  ProjectSubmission,
  ChatSession,
  ChatMessage,
  ClientUser,
  Order,
  OrderUpdate,
  PaymentInstallment,
  ClientDeadline,
  Invoice,
  InvoiceItem,
  SupportTicket,
  TicketMessage,
  AppNotification,
  Activity,
  AdminUser,
} from './storage';

type DbOrderRow = {
  id: string;
  client_id: string;
  service: string;
  package: string;
  price: number;
  status: Order['status'];
  progress: number;
  notes: string;
  admin_notes: string | null;
  payment_plan: 'full' | 'installment';
  total_paid: number;
  on_hold: boolean;
  hold_reason: Order['holdReason'] | null;
  hold_message: string | null;
  due_date: string | null;
  created_at: string;
  installments?: Array<{
    id: string;
    amount: number;
    due_date: string;
    status: PaymentInstallment['status'];
    label: string;
    paid_at: string | null;
  }>;
  client_deadlines?: Array<{
    id: string;
    item: string;
    due_date: string;
    status: ClientDeadline['status'];
    received_at: string | null;
  }>;
  order_updates?: Array<{
    id: string;
    message: string;
    by: OrderUpdate['by'];
    created_at: string;
  }>;
};

function toDate(value: string | null | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

function mapOrder(row: DbOrderRow): Order {
  return {
    id: row.id,
    clientId: row.client_id,
    service: row.service,
    package: row.package,
    price: Number(row.price || 0),
    status: row.status,
    progress: row.progress || 0,
    notes: row.notes || '',
    adminNotes: row.admin_notes || '',
    paymentPlan: row.payment_plan || 'full',
    installments: (row.installments || []).map((i) => ({
      id: i.id,
      amount: Number(i.amount || 0),
      dueDate: i.due_date,
      status: i.status,
      label: i.label,
      paidAt: toDate(i.paid_at),
    })),
    totalPaid: Number(row.total_paid || 0),
    onHold: !!row.on_hold,
    holdReason: row.hold_reason || undefined,
    holdMessage: row.hold_message || undefined,
    clientDeadlines: (row.client_deadlines || []).map((d) => ({
      id: d.id,
      item: d.item,
      dueDate: d.due_date,
      status: d.status,
      receivedAt: toDate(d.received_at),
    })),
    updates: (row.order_updates || []).map((u) => ({
      id: u.id,
      message: u.message,
      by: u.by,
      timestamp: new Date(u.created_at),
    })),
    createdAt: new Date(row.created_at),
    dueDate: row.due_date || undefined,
  };
}

function mapInvoice(row: {
  id: string;
  invoice_number: string;
  client_id: string;
  order_id: string | null;
  package_name: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: Invoice['status'];
  note: string | null;
  due_date: string;
  paid_at: string | null;
  created_at: string;
  invoice_items?: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
    item_type: InvoiceItem['type'] | null;
  }>;
}): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id,
    orderId: row.order_id || undefined,
    packageName: row.package_name || undefined,
    items: (row.invoice_items || []).map((i) => ({
      description: i.description,
      quantity: i.quantity,
      rate: Number(i.rate || 0),
      amount: Number(i.amount || 0),
      type: i.item_type || 'custom',
    })),
    subtotal: Number(row.subtotal || 0),
    taxRate: Number(row.tax_rate || 0),
    taxAmount: Number(row.tax_amount || 0),
    total: Number(row.total || 0),
    status: row.status,
    note: row.note || undefined,
    createdAt: new Date(row.created_at),
    dueDate: row.due_date,
    paidAt: toDate(row.paid_at),
  };
}

export async function fetchClientOrders(clientId: string): Promise<Order[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('orders')
    .select('*, installments(*), client_deadlines(*), order_updates(*)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return (data as DbOrderRow[]).map(mapOrder);
}

export async function fetchClientInvoices(clientId: string): Promise<Invoice[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r) => mapInvoice(r as never));
}

export async function createClientOrderInSupabase(input: {
  clientId: string;
  service: string;
  package: string;
  price: number;
  notes: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('orders').insert({
    client_id: input.clientId,
    service: input.service,
    package: input.package,
    price: input.price,
    notes: input.notes,
    status: 'pending',
    progress: 0,
    payment_plan: 'full',
  });
}

export async function addOrderUpdateInSupabase(orderId: string, message: string, by: OrderUpdate['by']): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('order_updates').insert({ order_id: orderId, message, by });
}

export async function updateProfileInSupabase(clientId: string, updates: {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('profiles').update(updates).eq('id', clientId);
}

export async function fetchAdminSnapshot(): Promise<{
  leads: Lead[];
  submissions: ProjectSubmission[];
  chats: ChatSession[];
  adminUsers: AdminUser[];
  clients: ClientUser[];
  orders: Order[];
  invoices: Invoice[];
  tickets: SupportTicket[];
}> {
  const supabase = getSupabase();
  if (!supabase) return { leads: [], submissions: [], chats: [], adminUsers: [], clients: [], orders: [], invoices: [], tickets: [] };

  const [leadsRes, subsRes, chatsRes, chatMsgsRes, clientsRes, ordersRes, invoicesRes, ticketsRes, ticketMsgsRes] = await Promise.all([
    supabase.from('leads').select('*').order('created_at', { ascending: false }),
    supabase.from('submissions').select('*').order('created_at', { ascending: false }),
    supabase.from('chat_sessions').select('*').order('last_message_at', { ascending: false }),
    supabase.from('chat_messages').select('*').order('created_at', { ascending: true }),
    supabase.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false }),
    supabase.from('orders').select('*, installments(*), client_deadlines(*), order_updates(*)').order('created_at', { ascending: false }),
    supabase.from('invoices').select('*, invoice_items(*)').order('created_at', { ascending: false }),
    supabase.from('support_tickets').select('*').order('updated_at', { ascending: false }),
    supabase.from('support_messages').select('*').order('created_at', { ascending: true }),
  ]);

  const leads: Lead[] = (leadsRes.data || []).map((l) => ({
    id: l.id,
    email: l.email,
    name: l.name || undefined,
    timestamp: new Date(l.created_at),
    source: l.source,
    status: l.status,
  }));

  const submissions: ProjectSubmission[] = (subsRes.data || []).map((s) => ({
    id: s.id,
    email: s.email,
    name: s.name,
    company: s.company || undefined,
    projectType: s.project_type,
    budget: s.budget,
    timeline: s.timeline,
    industry: s.industry,
    features: s.features || [],
    description: s.description || undefined,
    timestamp: new Date(s.created_at),
    status: s.status,
  }));

  const messagesBySession = new Map<string, ChatMessage[]>();
  for (const msg of chatMsgsRes.data || []) {
    const arr = messagesBySession.get(msg.session_id) || [];
    arr.push({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at),
    });
    messagesBySession.set(msg.session_id, arr);
  }

  const chats: ChatSession[] = (chatsRes.data || []).map((c) => ({
    id: c.id,
    leadId: c.lead_id || `lead_${c.id}`,
    email: c.email,
    messages: messagesBySession.get(c.id) || [],
    startedAt: new Date(c.started_at),
    lastMessageAt: new Date(c.last_message_at),
  }));

  const clients: ClientUser[] = (clientsRes.data || []).map((c) => ({
    id: c.id,
    name: c.name || c.email?.split('@')[0] || 'Client',
    email: c.email,
    password: '',
    company: c.company || undefined,
    phone: c.phone || undefined,
    createdAt: new Date(c.created_at),
  }));
  const adminProfilesRes = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['owner', 'admin', 'viewer'])
    .order('created_at', { ascending: true });

  const adminUsersMapped: AdminUser[] = (adminProfilesRes.data || []).map((u) => ({
    id: u.id,
    email: u.email,
    password: '',
    role: u.role,
    createdAt: new Date(u.created_at),
  }));

  const orders: Order[] = ((ordersRes.data as DbOrderRow[] | null) || []).map(mapOrder);
  const invoices: Invoice[] = (invoicesRes.data || []).map((r) => mapInvoice(r as never));
  const ticketMsgs = new Map<string, TicketMessage[]>();
  for (const m of ticketMsgsRes.data || []) {
    const arr = ticketMsgs.get(m.ticket_id) || [];
    arr.push({
      id: m.id,
      content: m.content,
      by: m.by,
      timestamp: new Date(m.created_at),
    });
    ticketMsgs.set(m.ticket_id, arr);
  }
  const tickets: SupportTicket[] = (ticketsRes.data || []).map((t) => ({
    id: t.id,
    clientId: t.client_id,
    orderId: t.order_id || undefined,
    subject: t.subject,
    messages: ticketMsgs.get(t.id) || [],
    status: t.status,
    priority: t.priority,
    createdAt: new Date(t.created_at),
    updatedAt: new Date(t.updated_at),
  }));

  return { leads, submissions, chats, adminUsers: adminUsersMapped, clients, orders, invoices, tickets };
}

export async function updateLeadStatusInSupabase(leadId: string, status: Lead['status']): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('leads').update({ status }).eq('id', leadId);
}

export async function updateSubmissionStatusInSupabase(submissionId: string, status: ProjectSubmission['status']): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('submissions').update({ status }).eq('id', submissionId);
}

export async function deleteLeadInSupabase(leadId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('leads').delete().eq('id', leadId);
}

export async function deleteSubmissionInSupabase(submissionId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('submissions').delete().eq('id', submissionId);
}

export async function deleteChatSessionInSupabase(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('chat_sessions').delete().eq('id', sessionId);
}

export async function upsertChatSessionInSupabase(input: {
  id: string;
  leadId?: string;
  email: string;
  startedAt: Date;
  lastMessageAt: Date;
  messages: ChatMessage[];
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase.from('chat_sessions').upsert({
    id: input.id,
    lead_id: input.leadId || null,
    email: input.email,
    started_at: input.startedAt.toISOString(),
    last_message_at: input.lastMessageAt.toISOString(),
  });

  if (input.messages.length > 0) {
    await supabase.from('chat_messages').delete().eq('session_id', input.id);
    await supabase.from('chat_messages').insert(
      input.messages.map((m) => ({
        session_id: input.id,
        role: m.role,
        content: m.content,
        created_at: m.timestamp.toISOString(),
      })),
    );
  }
}

export async function createLeadInSupabase(input: { email: string; name?: string; source: Lead['source'] }): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('leads').insert({ email: input.email, name: input.name || null, source: input.source, status: 'new' });
}

export async function createSubmissionInSupabase(input: {
  email: string;
  name: string;
  company?: string;
  projectType: string;
  budget: string;
  timeline: string;
  industry: string;
  features: string[];
  description?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('submissions').insert({
    email: input.email,
    name: input.name,
    company: input.company || null,
    project_type: input.projectType,
    budget: input.budget,
    timeline: input.timeline,
    industry: input.industry,
    features: input.features,
    description: input.description || null,
    status: 'new',
  });
}

export async function fetchClientSupport(clientId: string): Promise<{
  tickets: SupportTicket[];
  notifications: AppNotification[];
}> {
  const supabase = getSupabase();
  if (!supabase) return { tickets: [], notifications: [] };

  const [ticketsRes, msgsRes, notifRes] = await Promise.all([
    supabase.from('support_tickets').select('*').eq('client_id', clientId).order('updated_at', { ascending: false }),
    supabase.from('support_messages').select('*').eq('client_id', clientId).order('created_at', { ascending: true }),
    supabase.from('notifications').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
  ]);

  const msgsByTicket = new Map<string, TicketMessage[]>();
  for (const m of msgsRes.data || []) {
    const arr = msgsByTicket.get(m.ticket_id) || [];
    arr.push({
      id: m.id,
      content: m.content,
      by: m.by,
      timestamp: new Date(m.created_at),
    });
    msgsByTicket.set(m.ticket_id, arr);
  }

  const tickets: SupportTicket[] = (ticketsRes.data || []).map((t) => ({
    id: t.id,
    clientId: t.client_id,
    orderId: t.order_id || undefined,
    subject: t.subject,
    messages: msgsByTicket.get(t.id) || [],
    status: t.status,
    priority: t.priority,
    createdAt: new Date(t.created_at),
    updatedAt: new Date(t.updated_at),
  }));

  const notifications: AppNotification[] = (notifRes.data || []).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.read,
    link: n.link || undefined,
    createdAt: new Date(n.created_at),
  }));

  return { tickets, notifications };
}

export async function createSupportTicketInSupabase(input: {
  clientId: string;
  subject: string;
  content: string;
  orderId?: string;
  priority?: SupportTicket['priority'];
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data } = await supabase
    .from('support_tickets')
    .insert({
      client_id: input.clientId,
      order_id: input.orderId || null,
      subject: input.subject,
      priority: input.priority || 'medium',
      status: 'open',
    })
    .select('id')
    .single();

  if (data?.id) {
    await supabase.from('support_messages').insert({
      ticket_id: data.id,
      client_id: input.clientId,
      by: 'client',
      content: input.content,
    });
  }
}

export async function addSupportMessageInSupabase(ticketId: string, clientId: string, content: string, by: TicketMessage['by']): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    client_id: clientId,
    by,
    content,
  });
  await supabase.from('support_tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);
}

export async function updateSupportTicketStatusInSupabase(ticketId: string, status: SupportTicket['status']): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', ticketId);
}

export async function markAllNotificationsReadInSupabase(clientId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('notifications').update({ read: true }).eq('client_id', clientId).eq('read', false);
}

export async function fetchActivityLogsInSupabase(limit: number = 200): Promise<Activity[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map((a) => ({
    id: a.id,
    type: (a.action_type as Activity['type']) || 'system',
    action: a.action_label,
    detail: a.detail,
    entityId: a.entity_id || undefined,
    email: a.actor_email || undefined,
    timestamp: new Date(a.created_at),
  }));
}

export async function createActivityLogInSupabase(input: {
  actionType: Activity['type'];
  actionLabel: string;
  detail: string;
  entityId?: string;
  actorEmail?: string;
  actorId?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from('activity_logs').insert({
    actor_id: input.actorId || null,
    actor_email: input.actorEmail || null,
    action_type: input.actionType,
    action_label: input.actionLabel,
    detail: input.detail,
    entity_id: input.entityId || null,
  });
}
