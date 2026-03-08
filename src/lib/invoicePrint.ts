import { numberToWords } from '@/lib/subscription';
import type { Invoice, User, FirmSettings } from '@/lib/types';

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
    termsAndConditions: '1. Goods once sold will not be taken back.\n2. E&OE',
    showBankDetails: true, showTerms: true, showEwayBill: false,
    invoiceCopyLabel: 'original',
  };

  const copies = copyType === 'all'
    ? ['original', 'duplicate', 'triplicate']
    : [copyType || fs.invoiceCopyLabel || 'original'];

  const hsnBreakup: Record<string, { hsn: string; desc: string; uqc: string; qty: number; taxable: number; rate: number; cgst: number; sgst: number; igst: number }> = {};
  inv.items.forEach(it => {
    const key = `${it.hsn}_${it.gstPercent}`;
    const taxable = it.price * it.quantity;
    const gstAmt = taxable * it.gstPercent / 100;
    if (!hsnBreakup[key]) {
      hsnBreakup[key] = { hsn: it.hsn, desc: it.productName, uqc: it.unit, qty: 0, taxable: 0, rate: it.gstPercent, cgst: 0, sgst: 0, igst: 0 };
    }
    hsnBreakup[key].qty += it.quantity;
    hsnBreakup[key].taxable += taxable;
    if (inv.isInterState) {
      hsnBreakup[key].igst += gstAmt;
    } else {
      hsnBreakup[key].cgst += gstAmt / 2;
      hsnBreakup[key].sgst += gstAmt / 2;
    }
  });

  const pagesHtml = copies.map(copy => `
    <div class="page">
      <div class="header">
        <h2>TAX INVOICE</h2>
        <p class="copy-label">(${COPY_LABELS[copy] || 'Original for Recipient'})</p>
      </div>
      <div class="two-col">
        <div class="col">
          <h4>SELLER DETAILS:</h4>
          <p class="bold">${firm?.firmName || ''}</p>
          <p>${fs.address}${fs.city ? ', ' + fs.city : ''}</p>
          <p>${fs.state}${fs.pincode ? ' - ' + fs.pincode : ''}</p>
          <p>GSTIN: ${firm?.gstNumber || 'N/A'}</p>
          <p>Phone: ${firm?.phone || ''} | Email: ${firm?.email || ''}</p>
          <p>State: ${fs.state} | Code: ${fs.stateCode}</p>
        </div>
        <div class="col">
          <h4>BUYER DETAILS:</h4>
          <p class="bold">${inv.customerName}</p>
          <p>${inv.customerAddress}</p>
          <p>GSTIN: ${inv.customerGst || 'N/A'}</p>
          <p>State: ${inv.customerState || ''} | Code: ${inv.customerStateCode || ''}</p>
        </div>
      </div>
      <div class="info-row">
        <span>Invoice No: <strong>${inv.invoiceNumber}</strong></span>
        <span>Date: <strong>${inv.date}</strong></span>
        <span>Place of Supply: <strong>${inv.placeOfSupply || ''}</strong></span>
        ${inv.vehicleNumber ? `<span>Vehicle: <strong>${inv.vehicleNumber}</strong></span>` : ''}
        ${inv.ewayBillNumber ? `<span>E-Way Bill: <strong>${inv.ewayBillNumber}</strong></span>` : ''}
      </div>
      <table class="items">
        <tr>
          <th>Sr</th><th>Description</th><th>HSN</th><th>Qty</th><th>Unit</th>
          <th>MRP</th><th>Rate</th><th>Disc%</th><th>Taxable</th>
        </tr>
        ${inv.items.map((it, i) => {
    const taxable = it.price * it.quantity;
    const discPct = it.mrp > it.price ? Math.round(((it.mrp - it.price) / it.mrp) * 100 * 100) / 100 : 0;
    return `<tr>
      <td>${i + 1}</td><td>${it.productName}</td><td>${it.hsn}</td>
      <td>${it.quantity}</td><td>${it.unit}</td>
      <td>₹${it.mrp.toLocaleString('en-IN')}</td>
      <td>₹${it.price.toLocaleString('en-IN')}</td>
      <td>${discPct > 0 ? discPct + '%' : '-'}</td>
      <td>₹${taxable.toLocaleString('en-IN')}</td>
    </tr>`;
  }).join('')}
      </table>
      <h4 style="margin-top:8px">${inv.isInterState ? 'INTER-STATE (IGST)' : 'INTRA-STATE (CGST + SGST)'} Tax Breakup:</h4>
      <table class="tax-table">
        <tr>
          <th>HSN</th><th>Taxable</th>
          ${inv.isInterState
    ? '<th>IGST Rate</th><th>IGST Amt</th>'
    : '<th>CGST Rate</th><th>CGST Amt</th><th>SGST Rate</th><th>SGST Amt</th>'}
        </tr>
        ${Object.values(hsnBreakup).map(h => `<tr>
          <td>${h.hsn}</td><td>₹${h.taxable.toLocaleString('en-IN')}</td>
          ${inv.isInterState
    ? `<td>${h.rate}%</td><td>₹${h.igst.toFixed(2)}</td>`
    : `<td>${h.rate / 2}%</td><td>₹${h.cgst.toFixed(2)}</td><td>${h.rate / 2}%</td><td>₹${h.sgst.toFixed(2)}</td>`}
        </tr>`).join('')}
      </table>
      <div class="totals">
        <p>Taxable Value: ₹${inv.totalAmount.toLocaleString('en-IN')}</p>
        ${inv.isInterState
    ? `<p>Add: IGST: ₹${inv.totalIgst.toLocaleString('en-IN')}</p>`
    : `<p>Add: CGST: ₹${inv.totalCgst.toLocaleString('en-IN')}</p><p>Add: SGST: ₹${inv.totalSgst.toLocaleString('en-IN')}</p>`}
        ${inv.roundOff !== 0 ? `<p>Round Off: ₹${inv.roundOff > 0 ? '+' : ''}${inv.roundOff.toFixed(2)}</p>` : ''}
        <p class="grand-total">GRAND TOTAL: ₹${inv.grandTotal.toLocaleString('en-IN')}</p>
        <p class="words">Amount in Words: ${numberToWords(Math.round(inv.grandTotal))} Rupees Only</p>
      </div>
      ${fs.showBankDetails && fs.bankName ? `
      <div class="bank-section">
        <div>
          <h4>Bank Details:</h4>
          <p>Bank: ${fs.bankName}</p>
          <p>A/C No: ${fs.accountNumber}</p>
          <p>IFSC: ${fs.ifscCode}</p>
          <p>Branch: ${fs.branchName}</p>
        </div>
        <div class="signatory">
          <p>Authorised Signatory</p>
          <br/><br/>
          <p class="bold">${firm?.firmName || ''}</p>
        </div>
      </div>` : `
      <div class="bank-section">
        <div></div>
        <div class="signatory">
          <p>Authorised Signatory</p>
          <br/><br/>
          <p class="bold">${firm?.firmName || ''}</p>
        </div>
      </div>`}
      ${fs.showTerms ? `
      <div class="terms">
        <h4>Terms & Conditions:</h4>
        <p>${fs.termsAndConditions.replace(/\n/g, '<br/>')}</p>
      </div>` : ''}
    </div>
  `).join('<div class="page-break"></div>');

  const html = `<html><head><title>Invoice ${inv.invoiceNumber}</title>
  <style>
    @media print { .page-break { page-break-after: always; } }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 15px; font-size: 11px; color: #333; }
    .page { border: 2px solid #1a237e; padding: 15px; margin-bottom: 20px; }
    .header { text-align: center; border-bottom: 2px solid #1a237e; padding-bottom: 8px; margin-bottom: 10px; }
    .header h2 { font-size: 16px; color: #1a237e; }
    .copy-label { font-size: 10px; color: #666; }
    .two-col { display: flex; gap: 15px; margin-bottom: 10px; }
    .col { flex: 1; border: 1px solid #ccc; padding: 8px; }
    .col h4 { font-size: 10px; color: #1a237e; margin-bottom: 4px; text-transform: uppercase; }
    .bold { font-weight: bold; }
    .info-row { display: flex; flex-wrap: wrap; gap: 15px; padding: 6px 0; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; margin-bottom: 10px; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; font-size: 10px; }
    th { background: #1a237e; color: white; font-size: 9px; }
    .tax-table th { background: #283593; }
    .totals { text-align: right; padding: 8px 0; border-top: 2px solid #1a237e; }
    .totals p { margin: 2px 0; }
    .grand-total { font-size: 14px; font-weight: bold; color: #1a237e; margin-top: 4px !important; }
    .words { font-style: italic; font-size: 10px; margin-top: 4px !important; }
    .bank-section { display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 8px; margin-top: 8px; }
    .bank-section h4 { font-size: 10px; color: #1a237e; margin-bottom: 3px; }
    .signatory { text-align: right; }
    .terms { border-top: 1px solid #ccc; padding-top: 6px; margin-top: 8px; font-size: 9px; color: #666; }
    .terms h4 { font-size: 10px; color: #1a237e; margin-bottom: 3px; }
  </style></head><body>${pagesHtml}</body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}
