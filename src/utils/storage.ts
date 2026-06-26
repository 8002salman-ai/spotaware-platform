// Storage utilities for leads, chats, and settings

export interface Lead {
  id: string;
  email: string;
  name?: string;
  timestamp: Date;
  source: 'chat' | 'form';
  status: 'new' | 'contacted' | 'converted';
}

export interface ChatSession {
  id: string;
  leadId: string;
  email: string;
  messages: ChatMessage[];
  startedAt: Date;
  lastMessageAt: Date;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface ProjectSubmission {
  id: string;
  email: string;
  name: string;
  company?: string;
  projectType: string;
  budget: string;
  timeline: string;
  industry: string;
  features: string[];
  description?: string;
  timestamp: Date;
  status: 'new' | 'reviewed' | 'proposal_sent' | 'converted';
}

export interface EmailSettings {
  enabled: boolean;
  serviceId: string;
  templateIdLead: string;
  templateIdBrief: string;
  publicKey: string;
  adminEmail: string;
}

export interface APISettings {
  openrouterApiKey: string;
  openrouterModel: string;
  useCustomKey: boolean;
}

export interface WhatsAppSettings {
  enabled: boolean;
  phoneNumber: string;
  welcomeMessage: string;
}

export interface BackendSettings {
  supabaseUrl: string;
  supabaseAnonKey: string;
  stripePublishableKey: string;
  stripeMode: 'test' | 'live';
  useSupabase: boolean;
}

export interface SiteSettings {
  email: EmailSettings;
  api: APISettings;
  whatsapp: WhatsAppSettings;
  backend: BackendSettings;
}

const STORAGE_KEYS = {
  LEADS: 'spotaware_leads',
  CHATS: 'spotaware_chats',
  SUBMISSIONS: 'spotaware_submissions',
  ADMIN_AUTH: 'spotaware_admin_auth',
  SETTINGS: 'spotaware_settings',
  CLIENTS: 'spotaware_clients',
  ORDERS: 'spotaware_orders',
  INVOICES: 'spotaware_invoices',
  CLIENT_AUTH: 'spotaware_client_auth',
};

// ── Client System ──
// NOTE: localStorage password storage is for development/demo only.
// Production deployments MUST enable Supabase auth (settings.backend.useSupabase = true).
export interface ClientUser {
  id: string;
  name: string;
  email: string;
  password: string;
  company?: string;
  phone?: string;
  createdAt: Date;
}

export type OrderStatus = 'pending' | 'in_progress' | 'review' | 'revision' | 'completed' | 'cancelled' | 'on_hold';

export interface PaymentInstallment {
  id: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: Date;
  label: string;
}

export interface Order {
  id: string;
  clientId: string;
  service: string;
  package: string;
  price: number;
  status: OrderStatus;
  progress: number;
  notes: string;
  adminNotes?: string;
  updates: OrderUpdate[];
  createdAt: Date;
  dueDate?: string;
  paymentPlan: 'full' | 'installment';
  installments: PaymentInstallment[];
  totalPaid: number;
  onHold: boolean;
  holdReason?: 'payment_overdue' | 'client_delay' | 'admin_pause';
  holdMessage?: string;
  clientDeadlines: ClientDeadline[];
}

export interface ClientDeadline {
  id: string;
  item: string;
  dueDate: string;
  status: 'pending' | 'received' | 'overdue';
  receivedAt?: Date;
}

export interface OrderUpdate {
  id: string;
  message: string;
  by: 'admin' | 'client' | 'system';
  timestamp: Date;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  orderId?: string;
  packageName?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  note?: string;
  createdAt: Date;
  dueDate: string;
  paidAt?: Date;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  type?: 'package' | 'addon' | 'monthly' | 'custom';
}

// Texas tax rate
export const TX_TAX_RATE = 8.25; // 8.25% Texas state + local

// Collision-resistant ID: base-36 timestamp + 4-char random suffix
function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Persistent counter for invoice numbers — prevents reuse after deletion
function getNextInvoiceNumber(): string {
  const key = 'spotaware_inv_counter';
  const n = parseInt(localStorage.getItem(key) || '0', 10) + 1;
  localStorage.setItem(key, String(n));
  return `INV-${String(n + 1000).padStart(4, '0')}`;
}

// Client CRUD
export function getClients(): ClientUser[] {
  try {
    const d = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (d) return JSON.parse(d);
    return [];
  } catch { return []; }
}
function saveClients(c: ClientUser[]) { localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(c)); }

export function registerClient(name: string, email: string, password: string, company?: string): ClientUser | null {
  const clients = getClients();
  if (clients.find(c => c.email.toLowerCase() === email.toLowerCase())) return null;
  const client: ClientUser = { id: uid('client'), name, email, password, company, createdAt: new Date() };
  clients.push(client);
  saveClients(clients);
  saveNewLead(email, name, 'form');
  return client;
}

export function verifyClientLogin(email: string, password: string): ClientUser | null {
  return getClients().find(c => c.email.toLowerCase() === email.toLowerCase() && c.password === password) || null;
}

// Convert lead to client (admin action)
export function convertLeadToClient(leadId: string, password: string = 'Welcome123'): ClientUser | null {
  const lead = getLeads().find(l => l.id === leadId);
  if (!lead) return null;
  const existing = getClients().find(c => c.email.toLowerCase() === lead.email.toLowerCase());
  if (existing) return existing;
  const client = registerClient(lead.name || lead.email.split('@')[0], lead.email, password);
  if (client) {
    updateLeadStatus(leadId, 'converted');
    logActivity('client', 'Lead Converted', `${lead.email} converted to client`, client.id, lead.email);
    addNotification('Welcome!', 'Your client account has been created. Login to access your portal.', 'success', client.id);
  }
  return client;
}

// Admin creates order for a client
export function adminCreateOrder(clientId: string, service: string, pkg: string, price: number, notes: string, installmentCount?: number): Order {
  const order = createOrder({ clientId, service, package: pkg, price, status: 'pending', notes, adminNotes: '' });
  if (installmentCount && installmentCount > 1) {
    const amt = Math.round(price / installmentCount * 100) / 100;
    const insts = Array.from({ length: installmentCount }, (_, i) => ({
      id: uid(`inst${i}`),
      amount: i === installmentCount - 1 ? price - amt * (installmentCount - 1) : amt,
      dueDate: new Date(Date.now() + (i + 1) * 15 * 86400000).toISOString().split('T')[0],
      status: 'pending' as const,
      label: `Installment ${i + 1} of ${installmentCount}`,
    }));
    updateOrder(order.id, { paymentPlan: 'installment', installments: insts });
  }
  const client = getClients().find(c => c.id === clientId);
  logActivity('order', 'Order Created', `${service} — $${price} for ${client?.name || 'client'}`, order.id, client?.email);
  addNotification('New Project', `Your ${service} project has been created! View it in your portal.`, 'success', clientId);
  return order;
}

// Check and auto-hold overdue installments
export function checkOverdueInstallments(): number {
  const orders = getOrders();
  const today = new Date().toISOString().split('T')[0];
  let holdCount = 0;
  orders.forEach(o => {
    if (o.status === 'completed' || o.status === 'cancelled' || o.onHold) return;
    (o.installments || []).forEach(inst => {
      if (inst.status === 'pending' && inst.dueDate < today) {
        inst.status = 'overdue';
      }
    });
    const hasOverdue = (o.installments || []).some(i => i.status === 'overdue');
    if (hasOverdue && !o.onHold) {
      holdOrder(o.id, 'payment_overdue', 'Installment payment is overdue. Please complete payment to resume your project.');
      const client = getClients().find(c => c.id === o.clientId);
      addNotification('Payment Overdue', `Your installment for ${o.service} is overdue. Project paused.`, 'warning', o.clientId);
      logActivity('payment', 'Payment Overdue', `${o.service} — auto-held`, o.id, client?.email);
      holdCount++;
    }
  });
  if (holdCount > 0) {
    const ords = getOrders();
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(ords));
  }
  return holdCount;
}

// Check overdue client deadlines
export function checkOverdueDeadlines(): number {
  const orders = getOrders();
  const today = new Date().toISOString().split('T')[0];
  let count = 0;
  orders.forEach(o => {
    if (o.status === 'completed' || o.status === 'cancelled') return;
    (o.clientDeadlines || []).forEach(dl => {
      if (dl.status === 'pending' && dl.dueDate < today) {
        markDeadlineOverdue(o.id, dl.id);
        count++;
      }
    });
  });
  return count;
}

export function updateClientProfile(clientId: string, updates: Partial<Pick<ClientUser, 'name' | 'email' | 'company' | 'phone' | 'password'>>): boolean {
  const clients = getClients();
  const c = clients.find(x => x.id === clientId);
  if (!c) return false;
  Object.assign(c, updates);
  saveClients(clients);
  return true;
}

export function setClientAuth(client: ClientUser | null) {
  if (client) localStorage.setItem(STORAGE_KEYS.CLIENT_AUTH, JSON.stringify({ id: client.id, name: client.name, email: client.email }));
  else localStorage.removeItem(STORAGE_KEYS.CLIENT_AUTH);
}

export function getClientSession(): { id: string; name: string; email: string } | null {
  try { const d = localStorage.getItem(STORAGE_KEYS.CLIENT_AUTH); return d ? JSON.parse(d) : null; } catch { return null; }
}

// Orders CRUD
export function getOrders(): Order[] {
  try { const d = localStorage.getItem(STORAGE_KEYS.ORDERS); return d ? JSON.parse(d) : []; } catch { return []; }
}
function saveOrders(o: Order[]) { localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(o)); }

export function getClientOrders(clientId: string): Order[] { return getOrders().filter(o => o.clientId === clientId); }

export function createOrder(order: Omit<Order, 'id' | 'updates' | 'createdAt' | 'progress' | 'paymentPlan' | 'installments' | 'totalPaid' | 'onHold' | 'clientDeadlines'> & Partial<Pick<Order, 'paymentPlan' | 'installments' | 'totalPaid' | 'onHold' | 'clientDeadlines'>>): Order {
  const orders = getOrders();
  const o: Order = { paymentPlan: 'full', installments: [], totalPaid: 0, onHold: false, clientDeadlines: [], ...order, id: uid('ord'), progress: 0, updates: [], createdAt: new Date() };
  orders.unshift(o);
  saveOrders(orders);
  return o;
}

export function updateOrder(orderId: string, updates: Partial<Order>): void {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (o) { Object.assign(o, updates); saveOrders(orders); }
}

export function holdOrder(orderId: string, reason: Order['holdReason'], message: string): void {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  o.onHold = true;
  o.holdReason = reason;
  o.holdMessage = message;
  o.status = 'on_hold';
  o.updates.push({ id: uid('upd'), message: `⚠️ Project on hold: ${message}`, by: 'system', timestamp: new Date() });
  saveOrders(orders);
}

export function resumeOrder(orderId: string): void {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  o.onHold = false;
  o.holdReason = undefined;
  o.holdMessage = undefined;
  o.status = 'in_progress';
  o.updates.push({ id: uid('upd'), message: '✅ Project resumed! Work continues.', by: 'system', timestamp: new Date() });
  saveOrders(orders);
}

export function markInstallmentPaid(orderId: string, installmentId: string): void {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  const inst = o.installments.find(i => i.id === installmentId);
  if (inst) { inst.status = 'paid'; inst.paidAt = new Date(); o.totalPaid = o.installments.filter(i => i.status === 'paid').reduce((a, i) => a + i.amount, 0); }
  const hasOverdueInstallments = o.installments.some(i => i.status === 'overdue');
  if (o.onHold && o.holdReason === 'payment_overdue' && !hasOverdueInstallments) {
    o.onHold = false;
    o.holdReason = undefined;
    o.holdMessage = undefined;
    o.status = 'in_progress';
    o.updates.push({ id: uid('upd'), message: '✅ Payment received — project resumed!', by: 'system', timestamp: new Date() });
  }
  saveOrders(orders);
}

export function addClientDeadline(orderId: string, item: string, dueDate: string): void {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  o.clientDeadlines.push({ id: uid('dl'), item, dueDate, status: 'pending' });
  o.updates.push({ id: uid('upd'), message: `📋 Item requested from you: "${item}" — Due by ${dueDate}`, by: 'system', timestamp: new Date() });
  saveOrders(orders);
}

export function markDeadlineReceived(orderId: string, deadlineId: string): void {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  const dl = o.clientDeadlines.find(d => d.id === deadlineId);
  if (dl) { dl.status = 'received'; dl.receivedAt = new Date(); }
  saveOrders(orders);
}

export function markDeadlineOverdue(orderId: string, deadlineId: string): void {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  const dl = o.clientDeadlines.find(d => d.id === deadlineId);
  if (!dl) return;
  dl.status = 'overdue';
  o.onHold = true;
  o.holdReason = 'client_delay';
  o.holdMessage = `Waiting for: ${dl.item}. Project timeline paused — payment schedule unaffected.`;
  o.status = 'on_hold';
  o.updates.push({ id: uid('upd'), message: `⏸ Project paused — waiting for "${dl.item}" from you. Note: Your payment schedule remains unchanged.`, by: 'system', timestamp: new Date() });
  saveOrders(orders);
}

export function addOrderUpdate(orderId: string, message: string, by: 'admin' | 'client' | 'system'): void {
  const orders = getOrders();
  const o = orders.find(x => x.id === orderId);
  if (o) { o.updates.push({ id: uid('upd'), message, by, timestamp: new Date() }); saveOrders(orders); }
}

// Invoices CRUD
export function getInvoices(): Invoice[] {
  try { const d = localStorage.getItem(STORAGE_KEYS.INVOICES); return d ? JSON.parse(d) : []; } catch { return []; }
}
function saveInvoices(i: Invoice[]) { localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(i)); }

export function getClientInvoices(clientId: string): Invoice[] { return getInvoices().filter(i => i.clientId === clientId); }

export function createInvoice(inv: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>): Invoice {
  const invoices = getInvoices();
  const i: Invoice = { ...inv, id: uid('inv'), invoiceNumber: getNextInvoiceNumber(), createdAt: new Date() };
  invoices.unshift(i);
  saveInvoices(invoices);
  return i;
}

export function updateInvoice(invoiceId: string, updates: Partial<Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>>): Invoice | null {
  const invoices = getInvoices();
  const inv = invoices.find(i => i.id === invoiceId);
  if (!inv) return null;
  Object.assign(inv, updates);
  saveInvoices(invoices);
  return inv;
}

export function calcTax(subtotal: number, rate: number = TX_TAX_RATE): { taxAmount: number; total: number } {
  const taxAmount = Math.round(subtotal * rate) / 100;
  return { taxAmount, total: subtotal + taxAmount };
}

export function updateInvoiceStatus(invoiceId: string, status: Invoice['status']): void {
  const invoices = getInvoices();
  const i = invoices.find(x => x.id === invoiceId);
  if (i) { i.status = status; if (status === 'paid') i.paidAt = new Date(); saveInvoices(invoices); }
}

export function deleteInvoice(invoiceId: string): void {
  saveInvoices(getInvoices().filter(i => i.id !== invoiceId));
}

// Default Settings
const DEFAULT_SETTINGS: SiteSettings = {
  email: {
    enabled: false,
    serviceId: '',
    templateIdLead: '',
    templateIdBrief: '',
    publicKey: '',
    adminEmail: '8002salman@gmail.com',
  },
  api: {
    openrouterApiKey: '',
    openrouterModel: 'deepseek/deepseek-chat-v3-0324:free',
    useCustomKey: false,
  },
  whatsapp: {
    enabled: true,
    phoneNumber: '+14409418002',
    welcomeMessage: 'Hi! I visited SpotAware.dev and I\'m interested in your services.',
  },
  backend: {
    supabaseUrl: '',
    supabaseAnonKey: '',
    stripePublishableKey: '',
    stripeMode: 'test',
    useSupabase: false,
  },
};

// Settings
export function getSettings(): SiteSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (data) {
      const saved = JSON.parse(data);
      return {
        email: { ...DEFAULT_SETTINGS.email, ...saved.email },
        api: { ...DEFAULT_SETTINGS.api, ...saved.api },
        whatsapp: { ...DEFAULT_SETTINGS.whatsapp, ...saved.whatsapp },
        backend: { ...DEFAULT_SETTINGS.backend, ...saved.backend },
      };
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: SiteSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function updateEmailSettings(emailSettings: Partial<EmailSettings>): void {
  const settings = getSettings();
  settings.email = { ...settings.email, ...emailSettings };
  saveSettings(settings);
}

export function updateAPISettings(apiSettings: Partial<APISettings>): void {
  const settings = getSettings();
  settings.api = { ...settings.api, ...apiSettings };
  saveSettings(settings);
}

export function updateWhatsAppSettings(whatsappSettings: Partial<WhatsAppSettings>): void {
  const settings = getSettings();
  settings.whatsapp = { ...settings.whatsapp, ...whatsappSettings };
  saveSettings(settings);
}

// Leads
export function saveNewLead(email: string, name?: string, source: 'chat' | 'form' = 'chat'): Lead {
  const leads = getLeads();
  const existingLead = leads.find(l => l.email.toLowerCase() === email.toLowerCase());
  if (existingLead) return existingLead;
  const newLead: Lead = {
    id: uid('lead'),
    email,
    name,
    timestamp: new Date(),
    source,
    status: 'new',
  };
  leads.unshift(newLead);
  localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
  return newLead;
}

export function getLeads(): Lead[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LEADS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function updateLeadStatus(leadId: string, status: Lead['status']): void {
  const leads = getLeads();
  const lead = leads.find(l => l.id === leadId);
  if (lead) {
    lead.status = status;
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
  }
}

export function deleteLead(leadId: string): void {
  const leads = getLeads().filter(l => l.id !== leadId);
  localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
}

// Chat Sessions
export function saveChatSession(session: ChatSession): void {
  const chats = getChatSessions();
  const existingIndex = chats.findIndex(c => c.id === session.id);
  if (existingIndex >= 0) {
    chats[existingIndex] = session;
  } else {
    chats.unshift(session);
  }
  localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
}

export function getChatSessions(): ChatSession[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CHATS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getChatByLeadId(leadId: string): ChatSession | undefined {
  return getChatSessions().find(c => c.leadId === leadId);
}

export function deleteChatSession(sessionId: string): void {
  const chats = getChatSessions().filter(c => c.id !== sessionId);
  localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
}

// Project Submissions
export function saveProjectSubmission(submission: Omit<ProjectSubmission, 'id' | 'timestamp' | 'status'>): ProjectSubmission {
  const submissions = getProjectSubmissions();
  const newSubmission: ProjectSubmission = {
    ...submission,
    id: uid('sub'),
    timestamp: new Date(),
    status: 'new',
  };
  submissions.unshift(newSubmission);
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
  saveNewLead(submission.email, submission.name, 'form');
  return newSubmission;
}

export function getProjectSubmissions(): ProjectSubmission[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function updateSubmissionStatus(submissionId: string, status: ProjectSubmission['status']): void {
  const submissions = getProjectSubmissions();
  const submission = submissions.find(s => s.id === submissionId);
  if (submission) {
    submission.status = status;
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
  }
}

export function deleteSubmission(submissionId: string): void {
  const submissions = getProjectSubmissions().filter(s => s.id !== submissionId);
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
}

// Admin Users
export interface AdminUser {
  id: string;
  email: string;
  password: string;
  role: 'owner' | 'admin' | 'viewer';
  createdAt: Date;
}

export function getAdminUsers(): AdminUser[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH + '_users');
    if (data) return JSON.parse(data);
    return [];
  } catch {
    return [];
  }
}

function saveAdminUsers(users: AdminUser[]): void {
  localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH + '_users', JSON.stringify(users));
}

export function verifyAdminLogin(email: string, password: string): AdminUser | null {
  const users = getAdminUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password) || null;
}

export function createLocalOwner(email: string, password: string): AdminUser | null {
  const users = getAdminUsers();
  if (users.length > 0) return null;
  const owner: AdminUser = { id: uid('owner'), email, password, role: 'owner', createdAt: new Date() };
  users.push(owner);
  saveAdminUsers(users);
  return owner;
}

export function resetLocalOwner(email: string, password: string): AdminUser {
  const owner: AdminUser = { id: uid('owner'), email, password, role: 'owner', createdAt: new Date() };
  saveAdminUsers([owner]);
  return owner;
}

export function addAdminUser(email: string, password: string, role: 'admin' | 'viewer'): AdminUser | null {
  const users = getAdminUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return null;
  const newUser: AdminUser = { id: uid('user'), email, password, role, createdAt: new Date() };
  users.push(newUser);
  saveAdminUsers(users);
  return newUser;
}

export function updateAdminUser(userId: string, updates: Partial<Pick<AdminUser, 'email' | 'password' | 'role'>>): boolean {
  const users = getAdminUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return false;
  if (updates.email) user.email = updates.email;
  if (updates.password) user.password = updates.password;
  if (updates.role) user.role = updates.role;
  saveAdminUsers(users);
  return true;
}

export function deleteAdminUser(userId: string): boolean {
  const users = getAdminUsers();
  const user = users.find(u => u.id === userId);
  if (!user || user.role === 'owner') return false;
  saveAdminUsers(users.filter(u => u.id !== userId));
  return true;
}

export function setAdminAuth(user: AdminUser | null): void {
  if (user) {
    localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify({ id: user.id, email: user.email, role: user.role }));
  } else {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
  }
}

export function getAdminSession(): { id: string; email: string; role: string } | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function isAdminAuthenticated(): boolean {
  return getAdminSession() !== null;
}

// Stats
export function getDashboardStats() {
  const leads = getLeads();
  const submissions = getProjectSubmissions();
  const chats = getChatSessions();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLeads = leads.filter(l => new Date(l.timestamp) >= today).length;
  const todaySubmissions = submissions.filter(s => new Date(s.timestamp) >= today).length;
  return {
    totalLeads: leads.length,
    todayLeads,
    newLeads: leads.filter(l => l.status === 'new').length,
    totalSubmissions: submissions.length,
    todaySubmissions,
    newSubmissions: submissions.filter(s => s.status === 'new').length,
    totalChats: chats.length,
    totalMessages: chats.reduce((acc, c) => acc + c.messages.length, 0),
  };
}

// Clear all data
export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.LEADS);
  localStorage.removeItem(STORAGE_KEYS.CHATS);
  localStorage.removeItem(STORAGE_KEYS.SUBMISSIONS);
}

// Export data as JSON — passwords and API keys are redacted
export function exportAllData(): string {
  const clients = getClients().map(({ password: _pw, ...c }) => c);
  const adminUsers = getAdminUsers().map(({ password: _pw, ...u }) => u);
  const settings = getSettings();
  const safeSettings = {
    ...settings,
    backend: { ...settings.backend, supabaseAnonKey: '[redacted]', stripePublishableKey: '[redacted]' },
    api: { ...settings.api, openrouterApiKey: '[redacted]' },
  };
  return JSON.stringify({
    leads: getLeads(),
    chats: getChatSessions(),
    submissions: getProjectSubmissions(),
    clients,
    adminUsers,
    orders: getOrders(),
    invoices: getInvoices(),
    activities: getActivities(),
    settings: safeSettings,
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

// ── Activity Log System ──
export interface Activity {
  id: string;
  type: 'lead' | 'submission' | 'chat' | 'order' | 'invoice' | 'payment' | 'client' | 'system';
  action: string;
  detail: string;
  entityId?: string;
  email?: string;
  timestamp: Date;
}

export function getActivities(): Activity[] {
  try { const d = localStorage.getItem('spotaware_activities'); return d ? JSON.parse(d) : []; } catch { return []; }
}

export function logActivity(type: Activity['type'], action: string, detail: string, entityId?: string, email?: string): void {
  const acts = getActivities();
  acts.unshift({ id: uid('act'), type, action, detail, entityId, email, timestamp: new Date() });
  if (acts.length > 200) acts.length = 200;
  localStorage.setItem('spotaware_activities', JSON.stringify(acts));
}

// ── Support Tickets ──
export interface SupportTicket {
  id: string;
  clientId: string;
  orderId?: string;
  subject: string;
  messages: TicketMessage[];
  status: 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketMessage {
  id: string;
  content: string;
  by: 'client' | 'admin';
  timestamp: Date;
}

export function getTickets(): SupportTicket[] {
  try { const d = localStorage.getItem('spotaware_tickets'); return d ? JSON.parse(d) : []; } catch { return []; }
}
function saveTickets(t: SupportTicket[]) { localStorage.setItem('spotaware_tickets', JSON.stringify(t)); }

export function getClientTickets(clientId: string): SupportTicket[] { return getTickets().filter(t => t.clientId === clientId); }

export function createTicket(clientId: string, subject: string, message: string, orderId?: string, priority: SupportTicket['priority'] = 'medium'): SupportTicket {
  const tickets = getTickets();
  const t: SupportTicket = {
    id: uid('tkt'), clientId, orderId, subject, priority, status: 'open',
    messages: [{ id: uid('tm'), content: message, by: 'client', timestamp: new Date() }],
    createdAt: new Date(), updatedAt: new Date(),
  };
  tickets.unshift(t); saveTickets(tickets);
  logActivity('client', 'New Ticket', `${subject}`, t.id);
  return t;
}

export function addTicketMessage(ticketId: string, content: string, by: 'client' | 'admin'): void {
  const tickets = getTickets();
  const t = tickets.find(x => x.id === ticketId);
  if (!t) return;
  t.messages.push({ id: uid('tm'), content, by, timestamp: new Date() });
  t.updatedAt = new Date();
  if (by === 'admin' && t.status === 'open') t.status = 'in_progress';
  saveTickets(tickets);
}

export function updateTicketStatus(ticketId: string, status: SupportTicket['status']): void {
  const tickets = getTickets();
  const t = tickets.find(x => x.id === ticketId);
  if (t) { t.status = status; t.updatedAt = new Date(); saveTickets(tickets); }
}

// ── Notifications ──
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  link?: string;
  createdAt: Date;
}

export function getNotifications(forClient?: string): AppNotification[] {
  try {
    const key = forClient ? `spotaware_notif_${forClient}` : 'spotaware_notif_admin';
    const d = localStorage.getItem(key); return d ? JSON.parse(d) : [];
  } catch { return []; }
}

export function addNotification(title: string, message: string, type: AppNotification['type'] = 'info', forClient?: string): void {
  const key = forClient ? `spotaware_notif_${forClient}` : 'spotaware_notif_admin';
  const notifs = getNotifications(forClient);
  notifs.unshift({ id: uid('n'), title, message, type, read: false, createdAt: new Date() });
  if (notifs.length > 50) notifs.length = 50;
  localStorage.setItem(key, JSON.stringify(notifs));
}

export function markNotifRead(notifId: string, forClient?: string): void {
  const key = forClient ? `spotaware_notif_${forClient}` : 'spotaware_notif_admin';
  const notifs = getNotifications(forClient);
  const n = notifs.find(x => x.id === notifId);
  if (n) { n.read = true; localStorage.setItem(key, JSON.stringify(notifs)); }
}

export function markAllNotifsRead(forClient?: string): void {
  const key = forClient ? `spotaware_notif_${forClient}` : 'spotaware_notif_admin';
  const notifs = getNotifications(forClient);
  notifs.forEach(n => n.read = true);
  localStorage.setItem(key, JSON.stringify(notifs));
}

// ── Order Notes / Files ──
export interface OrderNote {
  id: string;
  orderId: string;
  content: string;
  by: 'admin' | 'client';
  pinned: boolean;
  timestamp: Date;
}

export function getOrderNotes(orderId: string): OrderNote[] {
  try { const d = localStorage.getItem(`spotaware_notes_${orderId}`); return d ? JSON.parse(d) : []; } catch { return []; }
}

export function addOrderNote(orderId: string, content: string, by: 'admin' | 'client', pinned: boolean = false): void {
  const notes = getOrderNotes(orderId);
  notes.unshift({ id: uid('note'), orderId, content, by, pinned, timestamp: new Date() });
  localStorage.setItem(`spotaware_notes_${orderId}`, JSON.stringify(notes));
}

export function toggleNotePin(orderId: string, noteId: string): void {
  const notes = getOrderNotes(orderId);
  const n = notes.find(x => x.id === noteId);
  if (n) { n.pinned = !n.pinned; localStorage.setItem(`spotaware_notes_${orderId}`, JSON.stringify(notes)); }
}

// ── Enhanced Dashboard Stats ──
export function getFullDashboardStats() {
  const leads = getLeads();
  const subs = getProjectSubmissions();
  const chats = getChatSessions();
  const clients = getClients();
  const orders = getOrders();
  const invoices = getInvoices();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const week = new Date(today); week.setDate(week.getDate() - 7);
  const month = new Date(today); month.setMonth(month.getMonth() - 1);

  const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status));
  const onHoldOrders = orders.filter(o => o.onHold);
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const totalRevenue = paidInvoices.reduce((a, i) => a + i.total, 0);
  const monthRevenue = paidInvoices.filter(i => {
    const d = i.paidAt ? new Date(i.paidAt) : new Date(i.createdAt);
    return d >= month;
  }).reduce((a, i) => a + i.total, 0);
  const conversionRate = leads.length > 0 ? Math.round(leads.filter(l => l.status === 'converted').length / leads.length * 100) : 0;

  return {
    leads: { total: leads.length, new: leads.filter(l => l.status === 'new').length, today: leads.filter(l => new Date(l.timestamp) >= today).length, week: leads.filter(l => new Date(l.timestamp) >= week).length },
    submissions: { total: subs.length, new: subs.filter(s => s.status === 'new').length, today: subs.filter(s => new Date(s.timestamp) >= today).length },
    chats: { total: chats.length, messages: chats.reduce((a, c) => a + c.messages.length, 0) },
    clients: { total: clients.length },
    orders: { total: orders.length, active: activeOrders.length, onHold: onHoldOrders.length, completed: orders.filter(o => o.status === 'completed').length },
    invoices: { total: invoices.length, pending: pendingInvoices.length, overdue: overdueInvoices.length, pendingAmount: pendingInvoices.reduce((a, i) => a + i.total, 0) },
    revenue: { total: totalRevenue, month: monthRevenue },
    conversionRate,
  };
}
