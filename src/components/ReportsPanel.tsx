import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatDate } from '@/lib/subscription';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet, Package } from 'lucide-react';
import {
  downloadGSTR1Excel, downloadGSTR3BPDF, downloadMonthlyExcel,
  downloadOutstandingExcel, downloadStockExcel, downloadPurchaseExcel, downloadCAPackage,
} from '@/lib/exportUtils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['hsl(232,80%,30%)', 'hsl(37,95%,55%)', 'hsl(142,70%,40%)', 'hsl(0,72%,51%)', 'hsl(230,10%,45%)'];

export default function ReportsPanel() {
  const { currentUser, users, invoices, products, customers, payments, purchases } = useApp();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportTab, setReportTab] = useState<'overview' | 'gstr1' | 'gstr3b' | 'monthly' | 'outstanding'>('overview');

  const userId = currentUser?.id!;
  const firmUser = currentUser?.role === 'employee' ? users.find(u => u.id === currentUser.parentUserId) : currentUser;

  let myInvoices = invoices.filter(i => i.userId === userId);
  if (dateFrom) myInvoices = myInvoices.filter(i => i.date >= dateFrom);
  if (dateTo) myInvoices = myInvoices.filter(i => i.date <= dateTo);
  const myProducts = products.filter(p => p.userId === userId);
  const myCustomers = customers.filter(c => c.userId === userId);
  const myPayments = payments.filter(p => p.userId === userId);
  const myPurchases = purchases.filter(p => p.userId === userId);

  // Calculations
  const totalTaxable = myInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalCgst = myInvoices.reduce((s, i) => s + (i.totalCgst || i.totalGst / 2), 0);
  const totalSgst = myInvoices.reduce((s, i) => s + (i.totalSgst || i.totalGst / 2), 0);
  const totalIgst = myInvoices.reduce((s, i) => s + (i.totalIgst || 0), 0);
  const totalGst = totalCgst + totalSgst + totalIgst;
  const totalInvValue = myInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const totalPaid = myPayments.reduce((s, p) => s + p.amount, 0);
  const totalOutstanding = totalInvValue - totalPaid;

  // B2B invoices (customer has GST)
  const b2bInvoices = myInvoices.filter(i => i.customerGst);
  const b2cInvoices = myInvoices.filter(i => !i.customerGst);
  const b2clInvoices = b2cInvoices.filter(i => i.isInterState && i.grandTotal > 250000);
  const b2csInvoices = b2cInvoices.filter(i => !(i.isInterState && i.grandTotal > 250000));

  // Daily sales
  const dailySales = myInvoices.reduce((acc, inv) => {
    acc[inv.date] = (acc[inv.date] || 0) + inv.grandTotal;
    return acc;
  }, {} as Record<string, number>);
  const chartData = Object.entries(dailySales).sort().map(([date, total]) => ({ date: formatDate(date), total }));

  // Rate-wise
  const rateWise: Record<number, { count: number; taxable: number; cgst: number; sgst: number; igst: number }> = {};
  myInvoices.forEach(inv => {
    inv.items.forEach(it => {
      if (!rateWise[it.gstPercent]) rateWise[it.gstPercent] = { count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      const taxable = it.price * it.quantity;
      const gstAmt = taxable * it.gstPercent / 100;
      rateWise[it.gstPercent].taxable += taxable;
      if (inv.isInterState) rateWise[it.gstPercent].igst += gstAmt;
      else { rateWise[it.gstPercent].cgst += gstAmt / 2; rateWise[it.gstPercent].sgst += gstAmt / 2; }
    });
    if (!rateWise[inv.items[0]?.gstPercent]) return;
    rateWise[inv.items[0]?.gstPercent].count++;
  });

  // HSN Summary
  const hsnSummary: Record<string, { hsn: string; desc: string; unit: string; qty: number; value: number; taxable: number; rate: number; cgst: number; sgst: number; igst: number }> = {};
  myInvoices.forEach(inv => inv.items.forEach(it => {
    const key = `${it.hsn}_${it.gstPercent}`;
    const taxable = it.price * it.quantity;
    const gst = taxable * it.gstPercent / 100;
    if (!hsnSummary[key]) hsnSummary[key] = { hsn: it.hsn, desc: it.productName, unit: it.unit, qty: 0, value: 0, taxable: 0, rate: it.gstPercent, cgst: 0, sgst: 0, igst: 0 };
    hsnSummary[key].qty += it.quantity;
    hsnSummary[key].value += taxable + gst;
    hsnSummary[key].taxable += taxable;
    if (inv.isInterState) hsnSummary[key].igst += gst;
    else { hsnSummary[key].cgst += gst / 2; hsnSummary[key].sgst += gst / 2; }
  }));

  // Top products & customers
  const productCounts: Record<string, number> = {};
  myInvoices.forEach(inv => inv.items.forEach(item => { productCounts[item.productName] = (productCounts[item.productName] || 0) + item.quantity; }));
  const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const customerTotals: Record<string, number> = {};
  myInvoices.forEach(inv => { customerTotals[inv.customerName] = (customerTotals[inv.customerName] || 0) + inv.grandTotal; });
  const topCustomers = Object.entries(customerTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Outstanding by customer
  const outstandingByCustomer = myCustomers.map(c => {
    const custInvoices = myInvoices.filter(i => i.customerId === c.id);
    const custPayments = myPayments.filter(p => p.customerId === c.id);
    const totalBill = custInvoices.reduce((s, i) => s + i.grandTotal, 0);
    const totalPaid = custPayments.reduce((s, p) => s + p.amount, 0);
    const pending = totalBill - totalPaid;
    const oldestPending = custInvoices.filter(i => i.status !== 'paid').sort((a, b) => a.date.localeCompare(b.date))[0];
    const daysOld = oldestPending ? Math.ceil((Date.now() - new Date(oldestPending.date).getTime()) / 86400000) : 0;
    return { ...c, totalBill, totalPaid, pending, daysOld, oldestInvoice: oldestPending?.invoiceNumber || '' };
  }).filter(c => c.pending > 0).sort((a, b) => b.pending - a.pending);

  // ITC from purchases
  const purchaseIgst = myPurchases.reduce((s, p) => s + p.igst, 0);
  const purchaseCgst = myPurchases.reduce((s, p) => s + p.cgst, 0);
  const purchaseSgst = myPurchases.reduce((s, p) => s + p.sgst, 0);

  // B2B vs B2C pie
  const pieData = [
    { name: 'B2B', value: b2bInvoices.reduce((s, i) => s + i.grandTotal, 0) },
    { name: 'B2C', value: b2cInvoices.reduce((s, i) => s + i.grandTotal, 0) },
  ].filter(d => d.value > 0);

  // Rate pie
  const ratePieData = Object.entries(rateWise).map(([rate, d]) => ({
    name: `${rate}%`, value: d.cgst + d.sgst + d.igst,
  })).filter(d => d.value > 0);

  const agingPieData = [
    { name: '0-30 din', value: outstandingByCustomer.filter(c => c.daysOld <= 30).reduce((s, c) => s + c.pending, 0), color: 'hsl(142,70%,40%)' },
    { name: '31-60 din', value: outstandingByCustomer.filter(c => c.daysOld > 30 && c.daysOld <= 60).reduce((s, c) => s + c.pending, 0), color: 'hsl(37,95%,55%)' },
    { name: '61-90 din', value: outstandingByCustomer.filter(c => c.daysOld > 60 && c.daysOld <= 90).reduce((s, c) => s + c.pending, 0), color: 'hsl(0,72%,51%)' },
    { name: '90+ din', value: outstandingByCustomer.filter(c => c.daysOld > 90).reduce((s, c) => s + c.pending, 0), color: '#9e9e9e' },
  ].filter(d => d.value > 0);

  const exportCSV = (rows: any[][], filename: string) => {
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportGSTR1 = () => {
    const rows: any[][] = [
      ['GSTR-1 Report', firmUser?.firmName || '', `GST: ${firmUser?.gstNumber || ''}`],
      [],
      ['--- B2B Invoices ---'],
      ['GSTIN', 'Receiver', 'Invoice No', 'Date', 'Value', 'Place of Supply', 'Rate', 'Taxable', 'IGST', 'CGST', 'SGST'],
      ...b2bInvoices.map(i => [i.customerGst, i.customerName, i.invoiceNumber, i.date, i.grandTotal, i.placeOfSupply || '', '', i.totalAmount, i.totalIgst, i.totalCgst, i.totalSgst]),
      [],
      ['--- HSN Summary ---'],
      ['HSN', 'Description', 'UQC', 'Qty', 'Total Value', 'Rate', 'Taxable', 'IGST', 'CGST', 'SGST'],
      ...Object.values(hsnSummary).map(h => [h.hsn, h.desc, h.unit, h.qty, h.value.toFixed(2), h.rate + '%', h.taxable.toFixed(2), h.igst.toFixed(2), h.cgst.toFixed(2), h.sgst.toFixed(2)]),
    ];
    exportCSV(rows, `GSTR1_${firmUser?.firmName || 'Report'}.csv`);
  };

  const reportTabs = [
    { id: 'overview' as const, label: '📊 Overview' },
    { id: 'gstr1' as const, label: '📋 GSTR-1' },
    { id: 'gstr3b' as const, label: '📋 GSTR-3B' },
    { id: 'monthly' as const, label: '📅 Monthly' },
    { id: 'outstanding' as const, label: '💰 Outstanding' },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-xl font-bold text-foreground">📊 GST Reports — CA Ready</h2>

      {/* Report Tabs */}
      <div className="flex gap-2 flex-wrap">
        {reportTabs.map(t => (
          <button key={t.id} onClick={() => setReportTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${reportTab === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date Filter */}
      <div className="flex gap-3 items-end flex-wrap">
        <div><label className="text-xs text-muted-foreground">From</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="block border rounded-md px-3 py-1.5 text-sm bg-card text-foreground" /></div>
        <div><label className="text-xs text-muted-foreground">To</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="block border rounded-md px-3 py-1.5 text-sm bg-card text-foreground" /></div>
        <Button size="sm" variant="outline" onClick={() => { setDateFrom(''); setDateTo(''); }}>Reset</Button>
      </div>

      {/* OVERVIEW TAB */}
      {reportTab === 'overview' && (
        <div className="space-y-4">
          {/* Executive Summary */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Executive Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="stat-card"><p className="text-xs text-muted-foreground">Total Invoices</p><p className="text-xl font-bold text-foreground">{myInvoices.length}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Taxable Value</p><p className="text-xl font-bold text-foreground">₹{totalTaxable.toLocaleString('en-IN')}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Total GST</p><p className="text-xl font-bold text-foreground">₹{totalGst.toLocaleString('en-IN')}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Invoice Value</p><p className="text-xl font-bold text-foreground">₹{totalInvValue.toLocaleString('en-IN')}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">CGST</p><p className="text-lg font-bold text-foreground">₹{totalCgst.toLocaleString('en-IN')}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">SGST</p><p className="text-lg font-bold text-foreground">₹{totalSgst.toLocaleString('en-IN')}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">IGST</p><p className="text-lg font-bold text-foreground">₹{totalIgst.toLocaleString('en-IN')}</p></div>
              <div className="stat-card"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-xl font-bold" style={{ color: totalOutstanding > 0 ? 'hsl(var(--critical))' : 'hsl(var(--success))' }}>₹{totalOutstanding.toLocaleString('en-IN')}</p></div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Daily Sales</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Sales']} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Koi data nahi</p>}
            </div>
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">B2B vs B2C</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Koi data nahi</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Rate-wise Tax</h3>
              {ratePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={ratePieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name }) => name}>
                      {ratePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Koi data nahi</p>}
            </div>
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Outstanding Aging</h3>
              {agingPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={agingPieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name }) => name}>
                      {agingPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Sab clear hai ✅</p>}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Top 5 Products</h3>
              {topProducts.length === 0 ? <p className="text-sm text-muted-foreground">Koi data nahi</p> : (
                <div className="space-y-2">{topProducts.map(([name, qty], i) => (
                  <div key={name} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                    <span className="text-foreground">{i + 1}. {name}</span><span className="badge-success">{qty} sold</span>
                  </div>
                ))}</div>
              )}
            </div>
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Top 5 Customers</h3>
              {topCustomers.length === 0 ? <p className="text-sm text-muted-foreground">Koi data nahi</p> : (
                <div className="space-y-2">{topCustomers.map(([name, total], i) => (
                  <div key={name} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                    <span className="text-foreground">{i + 1}. {name}</span><span className="font-medium text-foreground">₹{total.toLocaleString('en-IN')}</span>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GSTR-1 TAB */}
      {reportTab === 'gstr1' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={exportGSTR1}><Download className="w-4 h-4 mr-1" /> GSTR-1 Export (CSV)</Button>
          </div>

          {/* B2B */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">B2B — Business to Business ({b2bInvoices.length} invoices)</h3>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground bg-muted/30">
                  <th className="text-left py-2 px-2">GSTIN</th><th className="text-left py-2 px-2">Receiver</th>
                  <th className="text-left py-2 px-2">Invoice No</th><th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Value</th><th className="text-left py-2 px-2">Taxable</th>
                  <th className="text-left py-2 px-2">IGST</th><th className="text-left py-2 px-2">CGST</th><th className="text-left py-2 px-2">SGST</th>
                </tr></thead>
                <tbody>
                  {b2bInvoices.map(i => (
                    <tr key={i.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 text-muted-foreground">{i.customerGst}</td>
                      <td className="py-2 px-2 font-medium text-foreground">{i.customerName}</td>
                      <td className="py-2 px-2 text-foreground">{i.invoiceNumber}</td>
                      <td className="py-2 px-2 text-muted-foreground">{formatDate(i.date)}</td>
                      <td className="py-2 px-2 text-foreground">₹{i.grandTotal.toLocaleString('en-IN')}</td>
                      <td className="py-2 px-2 text-foreground">₹{i.totalAmount.toLocaleString('en-IN')}</td>
                      <td className="py-2 px-2 text-foreground">₹{(i.totalIgst || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-2 text-foreground">₹{(i.totalCgst || 0).toLocaleString('en-IN')}</td>
                      <td className="py-2 px-2 text-foreground">₹{(i.totalSgst || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {b2bInvoices.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Koi B2B invoice nahi</p>}
            </div>
          </div>

          {/* B2C Large */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">B2C Large — Inter-state &gt; ₹2.5L ({b2clInvoices.length})</h3>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground bg-muted/30">
                  <th className="text-left py-2 px-2">Invoice No</th><th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Value</th><th className="text-left py-2 px-2">Place</th>
                  <th className="text-left py-2 px-2">Taxable</th><th className="text-left py-2 px-2">IGST</th>
                </tr></thead>
                <tbody>
                  {b2clInvoices.map(i => (
                    <tr key={i.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 text-foreground">{i.invoiceNumber}</td>
                      <td className="py-2 px-2 text-muted-foreground">{formatDate(i.date)}</td>
                      <td className="py-2 px-2 text-foreground">₹{i.grandTotal.toLocaleString('en-IN')}</td>
                      <td className="py-2 px-2 text-muted-foreground">{i.placeOfSupply}</td>
                      <td className="py-2 px-2 text-foreground">₹{i.totalAmount.toLocaleString('en-IN')}</td>
                      <td className="py-2 px-2 text-foreground">₹{(i.totalIgst || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {b2clInvoices.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Koi B2CL invoice nahi</p>}
            </div>
          </div>

          {/* B2CS */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">B2C Small ({b2csInvoices.length})</h3>
            <p className="text-xs text-muted-foreground mb-2">Summary: ₹{b2csInvoices.reduce((s, i) => s + i.grandTotal, 0).toLocaleString('en-IN')} total</p>
          </div>

          {/* HSN Summary */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">HSN Summary</h3>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b text-muted-foreground bg-muted/30">
                  <th className="text-left py-2 px-2">HSN</th><th className="text-left py-2 px-2">Description</th>
                  <th className="text-left py-2 px-2">UQC</th><th className="text-left py-2 px-2">Qty</th>
                  <th className="text-left py-2 px-2">Value</th><th className="text-left py-2 px-2">Rate</th>
                  <th className="text-left py-2 px-2">Taxable</th><th className="text-left py-2 px-2">IGST</th>
                  <th className="text-left py-2 px-2">CGST</th><th className="text-left py-2 px-2">SGST</th>
                </tr></thead>
                <tbody>
                  {Object.values(hsnSummary).map(h => (
                    <tr key={h.hsn + h.rate} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 font-medium text-foreground">{h.hsn}</td>
                      <td className="py-2 px-2 text-foreground">{h.desc}</td>
                      <td className="py-2 px-2 text-muted-foreground">{h.unit}</td>
                      <td className="py-2 px-2 text-foreground">{h.qty}</td>
                      <td className="py-2 px-2 text-foreground">₹{h.value.toFixed(0)}</td>
                      <td className="py-2 px-2 text-muted-foreground">{h.rate}%</td>
                      <td className="py-2 px-2 text-foreground">₹{h.taxable.toFixed(0)}</td>
                      <td className="py-2 px-2 text-foreground">₹{h.igst.toFixed(0)}</td>
                      <td className="py-2 px-2 text-foreground">₹{h.cgst.toFixed(0)}</td>
                      <td className="py-2 px-2 text-foreground">₹{h.sgst.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* GSTR-3B TAB */}
      {reportTab === 'gstr3b' && (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">3.1 — Outward Taxable Supplies</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-3">Nature of Supply</th>
                <th className="text-left py-2 px-3">Taxable Value</th>
                <th className="text-left py-2 px-3">IGST</th>
                <th className="text-left py-2 px-3">CGST</th>
                <th className="text-left py-2 px-3">SGST</th>
              </tr></thead>
              <tbody>
                <tr className="border-b"><td className="py-2 px-3 text-foreground">(a) Outward taxable supply</td>
                  <td className="py-2 px-3 font-medium text-foreground">₹{totalTaxable.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 text-foreground">₹{totalIgst.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 text-foreground">₹{totalCgst.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 text-foreground">₹{totalSgst.toLocaleString('en-IN')}</td>
                </tr>
                <tr className="border-b"><td className="py-2 px-3 text-muted-foreground">(b) Zero rated supply</td>
                  <td className="py-2 px-3 text-muted-foreground">₹0</td><td className="py-2 px-3 text-muted-foreground">₹0</td><td className="py-2 px-3 text-muted-foreground">₹0</td><td className="py-2 px-3 text-muted-foreground">₹0</td>
                </tr>
                <tr className="border-b"><td className="py-2 px-3 text-muted-foreground">(c) Nil rated / Exempt</td>
                  <td className="py-2 px-3 text-muted-foreground">₹0</td><td className="py-2 px-3 text-muted-foreground">—</td><td className="py-2 px-3 text-muted-foreground">—</td><td className="py-2 px-3 text-muted-foreground">—</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">4 — ITC (Input Tax Credit) — Purchase Register se</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-3"></th>
                <th className="text-left py-2 px-3">IGST</th>
                <th className="text-left py-2 px-3">CGST</th>
                <th className="text-left py-2 px-3">SGST</th>
              </tr></thead>
              <tbody>
                <tr className="border-b"><td className="py-2 px-3 text-foreground">(A) ITC Available</td>
                  <td className="py-2 px-3 font-medium text-foreground">₹{purchaseIgst.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 font-medium text-foreground">₹{purchaseCgst.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 font-medium text-foreground">₹{purchaseSgst.toLocaleString('en-IN')}</td>
                </tr>
                <tr className="border-b"><td className="py-2 px-3 text-muted-foreground">(B) ITC Reversed</td>
                  <td className="py-2 px-3 text-muted-foreground">₹0</td><td className="py-2 px-3 text-muted-foreground">₹0</td><td className="py-2 px-3 text-muted-foreground">₹0</td>
                </tr>
                <tr className="bg-muted/50"><td className="py-2 px-3 font-semibold text-foreground">(C) Net ITC</td>
                  <td className="py-2 px-3 font-bold text-foreground">₹{purchaseIgst.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 font-bold text-foreground">₹{purchaseCgst.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 font-bold text-foreground">₹{purchaseSgst.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">5 — Tax Payable & Paid</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-3"></th>
                <th className="text-left py-2 px-3">IGST</th>
                <th className="text-left py-2 px-3">CGST</th>
                <th className="text-left py-2 px-3">SGST</th>
              </tr></thead>
              <tbody>
                <tr className="border-b"><td className="py-2 px-3 text-foreground">Tax on outward supply</td>
                  <td className="py-2 px-3 text-foreground">₹{totalIgst.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 text-foreground">₹{totalCgst.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 text-foreground">₹{totalSgst.toLocaleString('en-IN')}</td>
                </tr>
                <tr className="border-b"><td className="py-2 px-3 text-foreground">Less: ITC</td>
                  <td className="py-2 px-3 text-foreground">₹{purchaseIgst.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 text-foreground">₹{purchaseCgst.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 text-foreground">₹{purchaseSgst.toLocaleString('en-IN')}</td>
                </tr>
                <tr className="bg-primary/5"><td className="py-2 px-3 font-bold text-foreground">Net Tax Payable</td>
                  <td className="py-2 px-3 font-bold text-primary">₹{Math.max(0, totalIgst - purchaseIgst).toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 font-bold text-primary">₹{Math.max(0, totalCgst - purchaseCgst).toLocaleString('en-IN')}</td>
                  <td className="py-2 px-3 font-bold text-primary">₹{Math.max(0, totalSgst - purchaseSgst).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MONTHLY TAB */}
      {reportTab === 'monthly' && (
        <div className="space-y-4">
          {/* Rate-wise Summary */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Rate-wise Tax Summary</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-3">GST Rate</th>
                <th className="text-left py-2 px-3">Invoices</th>
                <th className="text-left py-2 px-3">Taxable</th>
                <th className="text-left py-2 px-3">CGST</th>
                <th className="text-left py-2 px-3">SGST</th>
                <th className="text-left py-2 px-3">IGST</th>
                <th className="text-left py-2 px-3">Total Tax</th>
              </tr></thead>
              <tbody>
                {Object.entries(rateWise).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, d]) => (
                  <tr key={rate} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium text-foreground">{rate}%</td>
                    <td className="py-2 px-3 text-foreground">{d.count}</td>
                    <td className="py-2 px-3 text-foreground">₹{d.taxable.toLocaleString('en-IN')}</td>
                    <td className="py-2 px-3 text-foreground">₹{d.cgst.toFixed(0)}</td>
                    <td className="py-2 px-3 text-foreground">₹{d.sgst.toFixed(0)}</td>
                    <td className="py-2 px-3 text-foreground">₹{d.igst.toFixed(0)}</td>
                    <td className="py-2 px-3 font-medium text-foreground">₹{(d.cgst + d.sgst + d.igst).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Customer-wise Summary */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Customer-wise Summary</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-3">Customer</th>
                <th className="text-left py-2 px-3">GSTIN</th>
                <th className="text-left py-2 px-3">Invoices</th>
                <th className="text-left py-2 px-3">Taxable</th>
                <th className="text-left py-2 px-3">Tax</th>
                <th className="text-left py-2 px-3">Total</th>
              </tr></thead>
              <tbody>
                {myCustomers.map(c => {
                  const custInv = myInvoices.filter(i => i.customerId === c.id);
                  if (custInv.length === 0) return null;
                  const taxable = custInv.reduce((s, i) => s + i.totalAmount, 0);
                  const tax = custInv.reduce((s, i) => s + i.totalGst, 0);
                  return (
                    <tr key={c.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 font-medium text-foreground">{c.name}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{c.gstNumber || '-'}</td>
                      <td className="py-2 px-3 text-foreground">{custInv.length}</td>
                      <td className="py-2 px-3 text-foreground">₹{taxable.toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 text-foreground">₹{tax.toLocaleString('en-IN')}</td>
                      <td className="py-2 px-3 font-medium text-foreground">₹{(taxable + tax).toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Product/HSN Summary */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Product / HSN Summary</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-3">Product</th>
                <th className="text-left py-2 px-3">HSN</th>
                <th className="text-left py-2 px-3">Qty Sold</th>
                <th className="text-left py-2 px-3">Taxable</th>
                <th className="text-left py-2 px-3">Tax</th>
                <th className="text-left py-2 px-3">Total</th>
              </tr></thead>
              <tbody>
                {Object.values(hsnSummary).map(h => (
                  <tr key={h.hsn + h.rate} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium text-foreground">{h.desc}</td>
                    <td className="py-2 px-3 text-muted-foreground">{h.hsn}</td>
                    <td className="py-2 px-3 text-foreground">{h.qty} {h.unit}</td>
                    <td className="py-2 px-3 text-foreground">₹{h.taxable.toFixed(0)}</td>
                    <td className="py-2 px-3 text-foreground">₹{(h.cgst + h.sgst + h.igst).toFixed(0)}</td>
                    <td className="py-2 px-3 font-medium text-foreground">₹{h.value.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OUTSTANDING TAB */}
      {reportTab === 'outstanding' && (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">💰 Outstanding / Debtors Report (CA ke liye)</h3>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-3">Customer</th>
                <th className="text-left py-2 px-3">Phone</th>
                <th className="text-left py-2 px-3">GSTIN</th>
                <th className="text-left py-2 px-3">Oldest Invoice</th>
                <th className="text-left py-2 px-3">Days</th>
                <th className="text-left py-2 px-3">Amount Due</th>
              </tr></thead>
              <tbody>
                {outstandingByCustomer.map(c => (
                  <tr key={c.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium text-foreground">{c.name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{c.phone}</td>
                    <td className="py-2 px-3 text-muted-foreground text-xs">{c.gstNumber || '-'}</td>
                    <td className="py-2 px-3 text-foreground">{c.oldestInvoice}</td>
                    <td className="py-2 px-3">
                      <span className={
                        c.daysOld <= 30 ? 'badge-success' :
                        c.daysOld <= 60 ? 'badge-warning' :
                        c.daysOld <= 90 ? 'badge-critical' : 'badge-expired'
                      }>{c.daysOld} din</span>
                    </td>
                    <td className="py-2 px-3 font-bold text-critical">₹{c.pending.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {outstandingByCustomer.length === 0 && <p className="text-sm text-center py-4" style={{ color: 'hsl(var(--success))' }}>✅ Sab clear hai! Koi pending nahi.</p>}
            {outstandingByCustomer.length > 0 && (
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="font-semibold text-foreground">Total Outstanding:</span>
                <span className="text-lg font-bold text-critical">₹{outstandingByCustomer.reduce((s, c) => s + c.pending, 0).toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
