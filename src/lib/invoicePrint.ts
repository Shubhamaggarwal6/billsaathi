import { numberToWords } from '@/lib/subscription';
import type { Invoice, User, FirmSettings } from '@/lib/types';

const APP_NAME = 'BillSaathi';

const COPY_LABELS: Record<string, string> = {
  original: 'Original for Recipient',
  duplicate: 'Duplicate for Transporter',
  triplicate: 'Triplicate for Supplier',
};

export function printGSTInvoice(inv: Invoice, firm: User | null | undefined, copyType?: string) {
  const fs: FirmSettings = firm?.firmSettings || {
    address: '', city: '', state: '', stateCode: '', pincode: '',
    bankName: '', accountNumber: '', ifscCode: '', branchName: '',
    invoicePrefix: 'INV', financialYearStart: 4,
    termsAndConditions: '1. Goods once sold will not be taken back.\n2. Payment should be made to the mentioned account only.\n3. E&OE (Errors and Omissions Excepted)',
    showBankDetails: true, showTerms: true, showEwayBill: false,
    invoiceCopyLabel: 'original',
  };

  const copies = copyType === 'all'
    ? ['original', 'duplicate', 'triplicate']
    : [copyType || fs.invoiceCopyLabel || 'original'];

  // Calculate item-level tax
  const itemRows = inv.items.map((it, i) => {
    const taxable = it.price * it.quantity;
    const gstAmt = taxable * it.gstPercent / 100;
    const discPct = it.mrp > it.price ? Math.round(((it.mrp - it.price) / it.mrp) * 100 * 100) / 100 : 0;
    return {
      ...it, index: i + 1, taxable, gstAmt, discPct,
      cgst: inv.isInterState ? 0 : gstAmt / 2,
      sgst: inv.isInterState ? 0 : gstAmt / 2,
      igst: inv.isInterState ? gstAmt : 0,
      totalWithTax: taxable + gstAmt,
    };
  });

  // HSN breakup
  const hsnBreakup: Record<string, { hsn: string; qty: number; taxable: number; rate: number; cgst: number; sgst: number; igst: number }> = {};
  itemRows.forEach(it => {
    const key = `${it.hsn}_${it.gstPercent}`;
    if (!hsnBreakup[key]) {
      hsnBreakup[key] = { hsn: it.hsn, qty: 0, taxable: 0, rate: it.gstPercent, cgst: 0, sgst: 0, igst: 0 };
    }
    hsnBreakup[key].qty += it.quantity;
    hsnBreakup[key].taxable += it.taxable;
    hsnBreakup[key].cgst += it.cgst;
    hsnBreakup[key].sgst += it.sgst;
    hsnBreakup[key].igst += it.igst;
  });

  const totalTaxable = itemRows.reduce((s, i) => s + i.taxable, 0);
  const totalTax = inv.isInterState ? inv.totalIgst : (inv.totalCgst + inv.totalSgst);

  const pagesHtml = copies.map(copy => `
    <div class="page">
      <!-- Header with logo/brand and copy label -->
      <div class="header-row">
        <div class="brand">
          <div class="brand-icon">₹</div>
          <div>
            <div class="brand-name">${APP_NAME}</div>
            <div class="brand-tagline">Billing Made Easier</div>
          </div>
        </div>
        <div class="invoice-title">
          <h1>TAX INVOICE</h1>
        </div>
        <div class="copy-label">${COPY_LABELS[copy] || 'Original for Recipient'}<br/><strong>${inv.invoiceNumber}</strong></div>
      </div>

      <!-- Firm Details -->
      <div class="firm-section">
        <div class="firm-details">
          <p class="firm-name">${firm?.firmName || APP_NAME}</p>
          <p>${fs.address}${fs.city ? ', ' + fs.city : ''}${fs.state ? ', ' + fs.state : ''}${fs.pincode ? ' - ' + fs.pincode : ''}</p>
          ${firm?.email ? `<p>${firm.email}</p>` : ''}
          ${firm?.gstNumber ? `<p>GSTIN: ${firm.gstNumber}</p>` : ''}
          ${firm?.phone ? `<p>Phone: ${firm.phone}</p>` : ''}
          <p>State: ${fs.state || ''} | Code: ${fs.stateCode || ''}</p>
        </div>
        <div class="invoice-meta">
          <div class="amount-due">Amount Due: <strong>₹${(inv.grandTotal - (inv.paidAmount || 0)).toLocaleString('en-IN')}</strong></div>
          <table class="meta-table">
            <tr><td>Invoice Date:</td><td><strong>${inv.date}</strong></td></tr>
            <tr><td>Place of Supply:</td><td><strong>${inv.placeOfSupply || fs.state || ''}</strong></td></tr>
            ${inv.vehicleNumber ? `<tr><td>Vehicle No:</td><td><strong>${inv.vehicleNumber}</strong></td></tr>` : ''}
            ${inv.ewayBillNumber ? `<tr><td>E-Way Bill:</td><td><strong>${inv.ewayBillNumber}</strong></td></tr>` : ''}
          </table>
        </div>
      </div>

      <!-- Client Details -->
      <div class="client-section">
        <div class="client-box">
          <h4>Client Details</h4>
          <p class="client-name">${inv.customerName}</p>
          <p>${inv.customerAddress || ''}</p>
          ${inv.customerGst ? `<p>GSTIN: ${inv.customerGst}</p>` : ''}
          <p>State: ${inv.customerState || ''} | Code: ${inv.customerStateCode || ''}</p>
        </div>
        <div class="client-box">
          <h4>Ship To</h4>
          <p class="client-name">${inv.customerName}</p>
          <p>${inv.customerAddress || ''}</p>
          ${inv.vehicleNumber ? `<p>Vehicle No: ${inv.vehicleNumber}</p>` : ''}
        </div>
      </div>

      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th class="desc-col">Item Description</th>
            <th>HSN/SAC</th>
            <th>Qty<br/>UoM</th>
            <th>Price (₹)</th>
            <th>Taxable Value (₹)</th>
            ${inv.isInterState
              ? '<th>IGST (₹)</th>'
              : '<th>CGST (₹)</th><th>SGST (₹)</th>'}
            <th>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows.map(it => `
            <tr>
              <td>${it.index}</td>
              <td class="desc-col">
                <strong>${it.productName}</strong>
                ${it.discPct > 0 ? `<br/><span class="sub-text">Disc: ${it.discPct}%</span>` : ''}
              </td>
              <td>${it.hsn}</td>
              <td>${it.quantity}<br/>${it.unit}</td>
              <td class="num">₹${it.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="num">₹${it.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              ${inv.isInterState
                ? `<td class="num">₹${it.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br/><span class="sub-text">${it.gstPercent}%</span></td>`
                : `<td class="num">₹${it.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br/><span class="sub-text">${it.gstPercent / 2}%</span></td>
                   <td class="num">₹${it.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br/><span class="sub-text">${it.gstPercent / 2}%</span></td>`}
              <td class="num"><strong>₹${it.totalWithTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="${inv.isInterState ? 4 : 4}"></td>
            <td class="num"><strong>Total</strong></td>
            <td class="num"><strong>₹${totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            ${inv.isInterState
              ? `<td class="num"><strong>₹${inv.totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>`
              : `<td class="num"><strong>₹${inv.totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                 <td class="num"><strong>₹${inv.totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>`}
            <td class="num"><strong>₹${inv.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          </tr>
        </tfoot>
      </table>

      <!-- Totals Summary -->
      <div class="totals-section">
        ${fs.showBankDetails && fs.bankName ? `
        <div class="bank-details">
          <p><strong>Account Holder Name:</strong> ${firm?.firmName || ''}</p>
          <p><strong>Bank Name:</strong> ${fs.bankName}</p>
          <p><strong>Account Number:</strong> ${fs.accountNumber}</p>
          <p><strong>Branch Name:</strong> ${fs.branchName}</p>
          <p><strong>IFSC Code:</strong> ${fs.ifscCode}</p>
        </div>` : '<div></div>'}
        <div class="amount-summary">
          <table class="summary-table">
            <tr><td>Total Taxable Value</td><td class="num">₹${totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
            <tr><td>Total Tax Amount</td><td class="num">₹${totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
            ${inv.roundOff !== 0 ? `<tr><td>Round Off</td><td class="num">₹${inv.roundOff > 0 ? '+' : ''}${inv.roundOff.toFixed(2)}</td></tr>` : ''}
            <tr class="grand"><td>Total Value (in figure)</td><td class="num">₹${inv.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td></tr>
            <tr><td>Total Value (in words)</td><td class="num words-val">₹ ${numberToWords(Math.round(inv.grandTotal))} Only</td></tr>
          </table>
        </div>
      </div>

      <!-- Payment Methods -->
      <div class="payment-icons">
        <span>💳</span> <span>🏦</span> <span>📱 UPI</span>
      </div>

      <!-- Footer: Terms + Signature -->
      <div class="footer-section">
        ${fs.showTerms ? `
        <div class="terms">
          <h4>Terms & Conditions</h4>
          <p><em>Note for Invoice</em></p>
          <p>${fs.termsAndConditions.replace(/\n/g, '<br/>')}</p>
        </div>` : '<div></div>'}
        <div class="signature-box">
          <p class="sig-line"><em>Signature</em></p>
          <p class="sig-company">For, ${firm?.firmName || APP_NAME}</p>
          <p class="sig-label">Provider Signature</p>
        </div>
      </div>

      <!-- App Branding -->
      <div class="app-footer">
        Generated by <strong>${APP_NAME}</strong> — billsaathi.lovable.app
      </div>
    </div>
  `).join('<div class="page-break"></div>');

  const html = `<html><head><title>Invoice ${inv.invoiceNumber}</title>
  <style>
    @media print { .page-break { page-break-after: always; } @page { margin: 10mm; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 10px; font-size: 11px; color: #333; }
    .page { border: 1.5px solid #2563eb; padding: 0; margin-bottom: 20px; max-width: 210mm; }
    
    /* Header */
    .header-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1.5px solid #2563eb; }
    .brand { display: flex; align-items: center; gap: 8px; }
    .brand-icon { width: 36px; height: 36px; background: #2563eb; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; }
    .brand-name { font-size: 16px; font-weight: 800; color: #2563eb; }
    .brand-tagline { font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .invoice-title h1 { font-size: 20px; color: #2563eb; font-weight: 700; }
    .copy-label { text-align: right; font-size: 10px; color: #666; }
    .copy-label strong { font-size: 16px; color: #1e40af; display: block; }

    /* Firm */
    .firm-section { display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid #e5e7eb; }
    .firm-details { flex: 1; }
    .firm-name { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 2px; }
    .firm-details p { font-size: 10px; margin: 1px 0; }
    .invoice-meta { text-align: right; }
    .amount-due { background: #2563eb; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; margin-bottom: 6px; display: inline-block; }
    .amount-due strong { font-size: 13px; }
    .meta-table { font-size: 10px; margin-left: auto; }
    .meta-table td { padding: 1px 4px; }
    .meta-table td:first-child { color: #666; text-align: right; }

    /* Client */
    .client-section { display: flex; gap: 0; border-bottom: 1px solid #e5e7eb; }
    .client-box { flex: 1; padding: 10px 16px; }
    .client-box:first-child { border-right: 1px solid #e5e7eb; }
    .client-box h4 { font-size: 9px; color: #2563eb; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.5px; }
    .client-name { font-size: 12px; font-weight: 700; color: #111; }
    .client-box p { font-size: 10px; margin: 1px 0; }

    /* Items Table */
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table th { background: #2563eb; color: white; font-size: 9px; padding: 6px 4px; text-align: center; font-weight: 600; text-transform: uppercase; }
    .items-table td { border: 1px solid #e5e7eb; padding: 6px 4px; font-size: 10px; text-align: center; vertical-align: top; }
    .desc-col { text-align: left !important; min-width: 120px; }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .sub-text { font-size: 8px; color: #666; }
    .total-row td { border-top: 2px solid #2563eb; background: #f8fafc; }

    /* Totals */
    .totals-section { display: flex; justify-content: space-between; padding: 10px 16px; border-top: 1px solid #e5e7eb; gap: 16px; }
    .bank-details { flex: 1; font-size: 10px; }
    .bank-details p { margin: 2px 0; }
    .amount-summary { flex: 1; }
    .summary-table { width: 100%; font-size: 10px; }
    .summary-table td { padding: 3px 6px; }
    .summary-table td:first-child { color: #555; }
    .summary-table .grand td { font-weight: 700; font-size: 12px; color: #111; border-top: 1px solid #2563eb; }
    .words-val { font-style: italic; font-size: 10px; color: #2563eb; }

    /* Payment */
    .payment-icons { padding: 6px 16px; font-size: 14px; border-top: 1px solid #e5e7eb; }

    /* Footer */
    .footer-section { display: flex; justify-content: space-between; padding: 10px 16px; border-top: 1px solid #e5e7eb; }
    .terms { flex: 1; font-size: 9px; color: #666; }
    .terms h4 { font-size: 10px; color: #333; font-weight: 700; margin-bottom: 4px; }
    .signature-box { text-align: right; min-width: 150px; }
    .sig-line { font-size: 18px; color: #555; margin-bottom: 4px; }
    .sig-company { font-size: 10px; font-weight: 700; color: #333; }
    .sig-label { font-size: 9px; color: #666; margin-top: 2px; }

    .app-footer { text-align: center; font-size: 8px; color: #999; padding: 4px; border-top: 1px solid #e5e7eb; }
  </style></head><body>${pagesHtml}</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}
