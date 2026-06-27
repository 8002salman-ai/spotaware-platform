import type { Invoice } from './storage';
import { getClients } from './storage';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateInvoiceHTML(inv: Invoice): string {
  const client = getClients().find(c => c.id === inv.clientId);

  const pkgBadge = inv.packageName ? `<div style="display:inline-block;padding:6px 16px;border-radius:8px;font-size:12px;font-weight:600;background:rgba(0,229,255,0.1);color:#00e5ff;border:1px solid rgba(0,229,255,0.2);margin-bottom:16px">📦 Package: ${escapeHtml(inv.packageName)}</div>` : '';

  const typeLabels: Record<string, string> = { package: '📦 Package', addon: '➕ Add-on', monthly: '🔄 Monthly', custom: '🔧 Custom' };

  const itemsHTML = inv.items.map(it => `
    <tr style="border-bottom:1px solid #1e2035">
      <td style="padding:14px 0;color:#c5c9e0;font-size:14px">${it.description}${it.type ? `<br><span style="font-size:10px;color:#5a5f7a;text-transform:uppercase;letter-spacing:0.5px">${typeLabels[it.type] || it.type}</span>` : ''}</td>
      <td style="padding:14px 0;color:#8b90b0;font-size:14px;text-align:center">${it.quantity}</td>
      <td style="padding:14px 0;color:#8b90b0;font-size:14px;text-align:right">$${it.rate.toLocaleString()}</td>
      <td style="padding:14px 0;color:#e2e4ed;font-size:14px;text-align:right;font-weight:600">$${it.amount.toLocaleString()}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${inv.invoiceNumber} — SpotAware.dev</title>
<style>
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
body{margin:0;padding:40px;background:#08090f;color:#e2e4ed;font-family:Inter,system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5}
.inv{max-width:750px;margin:0 auto;background:#0e1019;border:1px solid #232640;border-radius:16px;overflow:hidden}
.no-print{margin:20px auto;max-width:750px;display:flex;gap:8px}
@media print{
  .no-print{display:none!important}
  body{background:#fff;padding:20px}
  .inv{border:1px solid #e5e7eb;background:#fff}
  .inv *{color:#111!important;border-color:#e5e7eb!important}
  .hdr{background:#f8f9fb!important}
  .terms-box{background:#f8f9fb!important;border-color:#e5e7eb!important}
  .pkg-badge{background:#f0f9ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important}
  .type-tag{color:#6b7280!important}
}
</style></head><body>
<div class="no-print">
  <button onclick="window.print()" style="flex:1;padding:14px;border-radius:12px;background:#00e5ff;color:#0c0e1a;font-weight:600;font-size:14px;border:none;cursor:pointer">🖨 Print / Save as PDF</button>
  <button onclick="window.close()" style="padding:14px 24px;border-radius:12px;background:transparent;color:#8b90b0;font-size:14px;border:1px solid #232640;cursor:pointer">Close</button>
</div>
<div class="inv">
  <!-- HEADER -->
  <div class="hdr" style="padding:32px;border-bottom:1px solid #1e2035;background:#131520">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
      <div>
        <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px">Spot<span style="color:#00e5ff">Aware</span>.dev</div>
        <div style="font-size:12px;color:#5a5f7a;margin-top:4px">Premium Digital Studio</div>
        <div style="font-size:12px;color:#6b7094;margin-top:12px;line-height:1.8">
          SpotAware Digital LLC<br>
          1234 Innovation Blvd, Suite 500<br>
          Austin, TX 78701, United States<br>
          📞 +1 (440) 941-8002<br>
          📧 hello@spotaware.dev<br>
          🌐 spotaware.dev
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px">${inv.invoiceNumber}</div>
        <div style="display:inline-block;padding:5px 14px;border-radius:20px;font-size:11px;font-weight:600;margin-top:8px;
          ${inv.status === 'paid' ? 'background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.3)' :
            inv.status === 'sent' ? 'background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3)' :
            inv.status === 'overdue' ? 'background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3)' :
            'background:rgba(107,114,128,0.15);color:#9ca3af;border:1px solid rgba(107,114,128,0.3)'}">${inv.status.toUpperCase()}</div>
      </div>
    </div>

    <div style="display:flex;gap:40px;flex-wrap:wrap">
      <div style="flex:1;min-width:180px">
        <div style="font-size:10px;text-transform:uppercase;color:#5a5f7a;letter-spacing:1px;margin-bottom:6px">Bill To</div>
        <div style="font-size:15px;color:#fff;font-weight:700">${escapeHtml(client?.name || 'Client')}</div>
        <div style="font-size:13px;color:#8b90b0;line-height:1.8;margin-top:4px">
          ${escapeHtml(client?.email || '')}<br>
          ${client?.company ? `${escapeHtml(client.company)}<br>` : ''}
          ${client?.phone ? `📞 ${escapeHtml(client.phone)}<br>` : ''}
        </div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;color:#5a5f7a;letter-spacing:1px;margin-bottom:6px">Invoice Date</div>
        <div style="font-size:14px;color:#fff">${new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        <div style="font-size:10px;text-transform:uppercase;color:#5a5f7a;letter-spacing:1px;margin-bottom:6px;margin-top:12px">Due Date</div>
        <div style="font-size:14px;color:#fff;font-weight:600">${inv.dueDate}</div>
      </div>
    </div>
  </div>

  <!-- BODY -->
  <div style="padding:32px">
    ${pkgBadge}
    
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="border-bottom:2px solid #232640">
        <th style="padding:10px 0;text-align:left;font-size:11px;text-transform:uppercase;color:#5a5f7a;letter-spacing:1px;width:50%">Description</th>
        <th style="padding:10px 0;text-align:center;font-size:11px;text-transform:uppercase;color:#5a5f7a;letter-spacing:1px;width:10%">Qty</th>
        <th style="padding:10px 0;text-align:right;font-size:11px;text-transform:uppercase;color:#5a5f7a;letter-spacing:1px;width:20%">Rate</th>
        <th style="padding:10px 0;text-align:right;font-size:11px;text-transform:uppercase;color:#5a5f7a;letter-spacing:1px;width:20%">Amount</th>
      </tr></thead>
      <tbody>${itemsHTML}</tbody>
    </table>

    <!-- TOTALS -->
    <div style="display:flex;justify-content:flex-end">
      <div style="width:260px">
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px"><span style="color:#8b90b0">Subtotal</span><span style="color:#e2e4ed">$${inv.subtotal.toLocaleString()}</span></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;font-size:14px"><span style="color:#8b90b0">Sales Tax (${inv.taxRate}% TX)</span><span style="color:#e2e4ed">$${inv.taxAmount.toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:14px 0;font-size:20px;font-weight:800;border-top:2px solid #232640;margin-top:8px"><span style="color:#fff">Total Due</span><span style="color:#00e5ff">$${inv.total.toLocaleString()}</span></div>
      </div>
    </div>

    ${inv.note ? `
    <div style="margin-top:24px;padding:16px;background:#131520;border:1px solid #1e2035;border-radius:12px">
      <div style="font-size:10px;text-transform:uppercase;color:#5a5f7a;letter-spacing:1px;margin-bottom:8px">📝 Notes</div>
      <div style="font-size:13px;color:#8b90b0;line-height:1.7;white-space:pre-wrap">${escapeHtml(inv.note)}</div>
    </div>` : ''}

    <!-- TERMS & CONDITIONS -->
    <div class="terms-box" style="margin-top:24px;padding:20px;background:#0b0d17;border:1px solid #1a1c30;border-radius:12px">
      <div style="font-size:11px;text-transform:uppercase;color:#00e5ff;letter-spacing:1px;margin-bottom:12px;font-weight:600">📋 Terms & Conditions</div>
      <div style="font-size:11px;color:#6b7094;line-height:1.9">
        <strong style="color:#8b90b0">Payment Terms:</strong><br>
        1. Payment is due by the date specified above. Late payments may incur a 1.5% monthly fee.<br>
        2. 50% upfront deposit is required before project commencement.<br>
        3. Remaining 50% balance is due upon project delivery and client approval.<br>
        4. All prices are in USD. Payment accepted via bank transfer, Stripe, or PayPal.<br><br>

        <strong style="color:#8b90b0">Deliverables & Support:</strong><br>
        5. Post-delivery support: 30 calendar days of bug fixes included at no additional cost.<br>
        6. After the 30-day support period, ongoing maintenance is available at $197/month.<br>
        7. Revision rounds as specified in the selected package. Additional revisions billed at $97/hour.<br>
        8. Project timeline commences after receipt of upfront payment and required project materials.<br><br>

        <strong style="color:#8b90b0">Intellectual Property:</strong><br>
        9. Full source code ownership and intellectual property rights transfer to client upon receipt of final payment.<br>
        10. SpotAware.dev retains the right to showcase the project in its portfolio unless a separate NDA is executed.<br>
        11. Third-party assets (stock photos, fonts, plugins) are subject to their respective licenses.<br><br>

        <strong style="color:#8b90b0">Cancellation & Refund Policy:</strong><br>
        12. Cancellation before design phase: Full refund of deposit minus 10% administrative fee.<br>
        13. Cancellation during design phase: 50% of deposit is non-refundable.<br>
        14. Cancellation during development phase: Deposit is non-refundable. Client receives all completed work.<br><br>

        <strong style="color:#8b90b0">Limitation of Liability:</strong><br>
        15. SpotAware.dev's total liability shall not exceed the total amount paid under this invoice.<br>
        16. SpotAware.dev is not liable for any indirect, incidental, or consequential damages.<br>
        17. Client is responsible for content accuracy, legal compliance, and domain/hosting management post-delivery.<br><br>

        <strong style="color:#8b90b0">Governing Law:</strong><br>
        18. This agreement is governed by the laws of the State of Texas, United States.<br>
        19. Any disputes shall be resolved through arbitration in Austin, TX before litigation.
      </div>
    </div>

    <!-- AGREEMENT -->
    <div style="margin-top:20px;padding:20px;background:#131520;border:1px solid #1e2035;border-radius:12px">
      <div style="font-size:11px;text-transform:uppercase;color:#a78bfa;letter-spacing:1px;margin-bottom:12px;font-weight:600">📜 Memorandum of Understanding (MOU)</div>
      <div style="font-size:11px;color:#6b7094;line-height:1.9">
        This invoice serves as a binding agreement between <strong style="color:#8b90b0">SpotAware Digital LLC</strong> ("Service Provider") and <strong style="color:#8b90b0">${escapeHtml(client?.name || 'Client')}</strong>${client?.company ? ` of <strong style="color:#8b90b0">${escapeHtml(client.company)}</strong>` : ''} ("Client").<br><br>
        By making payment against this invoice, the Client acknowledges and agrees to all terms, conditions, deliverables, and timelines outlined herein. This document constitutes the complete agreement between both parties regarding the services described above.<br><br>
        Both parties agree to act in good faith and maintain open communication throughout the project duration. Any modifications to the scope of work must be agreed upon in writing by both parties and may result in adjusted pricing and timelines.
      </div>
    </div>

    <!-- FOOTER -->
    <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #1e2035">
      <div style="font-size:14px;color:#5a5f7a">Thank you for choosing <strong style="color:#00e5ff">SpotAware.dev</strong></div>
      <div style="font-size:11px;color:#3a3f5a;margin-top:6px">SpotAware Digital LLC • 1234 Innovation Blvd, Suite 500 • Austin, TX 78701</div>
      <div style="font-size:11px;color:#3a3f5a;margin-top:2px">📞 +1 (440) 941-8002 • 📧 hello@spotaware.dev • 🌐 spotaware.dev</div>
      <div style="font-size:10px;color:#2a2d45;margin-top:10px">This invoice was generated electronically and is valid without signature.</div>
    </div>
  </div>
</div></body></html>`;
}

export function downloadInvoice(inv: Invoice) {
  const html = generateInvoiceHTML(inv);
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

export function emailInvoiceToClient(inv: Invoice, emailSettings: { enabled: boolean; serviceId: string; publicKey: string; templateIdBrief: string; templateIdLead: string; adminEmail: string }) {
  const client = getClients().find(c => c.id === inv.clientId);
  if (!client || !emailSettings.enabled || !emailSettings.serviceId || !emailSettings.publicKey) return Promise.resolve();
  const templateId = emailSettings.templateIdBrief || emailSettings.templateIdLead;
  if (!templateId) return Promise.resolve();
  return import('@emailjs/browser').then(ejs =>
    ejs.send(emailSettings.serviceId, templateId, {
      to_email: client.email,
      from_name: 'SpotAware.dev',
      from_email: emailSettings.adminEmail,
      message: `Invoice ${inv.invoiceNumber} for $${inv.total.toLocaleString()} has been sent.\n\nPackage: ${inv.packageName || 'Custom'}\nDue Date: ${inv.dueDate}\nTax (TX ${inv.taxRate}%): $${inv.taxAmount.toFixed(2)}\n\nLogin to your Client Portal to view and download.`,
      client_email: client.email,
    }, emailSettings.publicKey)
  ).catch(e => console.error('Email failed:', e));
}
