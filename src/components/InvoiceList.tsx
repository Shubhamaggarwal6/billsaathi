import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatDate, numberToWords } from '@/lib/subscription';
import { printGSTInvoice } from '@/lib/invoicePrint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, Printer, X } from 'lucide-react';
import type { Invoice } from '@/lib/types';

interface Props {
  readOnly?: boolean;
  filterUserId?: string;
  filterEmployeeId?: string;
}

export default function InvoiceList({ readOnly, filterUserId, filterEmployeeId }: Props) {
  const { currentUser, users, invoices, setInvoices } = useApp();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [creatorFilter, setCreatorFilter] = useState('all');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<Invoice | null>(null);

  const userId = filterUserId || (currentUser?.role === 'employee' ? currentUser?.parentUserId! : currentUser?.id!);
  const allEmployees = users.filter(u => u.parentUserId === userId);
  const owner = users.find(u => u.id === userId);

  const filtered = useMemo(() => {
    let invs = invoices.filter(i => i.userId === userId);
    if (filterEmployeeId) invs = invs.filter(i => i.createdBy.id === filterEmployeeId);
    if (search) {
      const q = search.toLowerCase();
      invs = invs.filter(i => i.invoiceNumber.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q));
    }
    if (dateFrom) invs = invs.filter(i => i.date >= dateFrom);
    if (dateTo) invs = invs.filter(i => i.date <= dateTo);
    if (statusFilter !== 'all') invs = invs.filter(i => i.status === statusFilter);
    if (creatorFilter !== 'all') invs = invs.filter(i => i.createdBy.id === creatorFilter);
    return invs;
  }, [invoices, userId, filterEmployeeId, search, dateFrom, dateTo, statusFilter, creatorFilter]);

  const totalAmount = filtered.reduce((s, i) => s + i.grandTotal, 0);
  const paidAmount = filtered.filter(i => i.status === 'paid').reduce((s, i) => s + i.grandTotal, 0);
  const pendingAmount = filtered.filter(i => i.status !== 'paid').reduce((s, i) => s + i.grandTotal, 0);

  const setQuickRange = (range: string) => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    const fmt = (dt: Date) => dt.toISOString().split('T')[0];
    switch (range) {
      case 'aaj': setDateFrom(fmt(now)); setDateTo(fmt(now)); break;
      case 'kal': { const yd = new Date(y, m, d - 1); setDateFrom(fmt(yd)); setDateTo(fmt(yd)); break; }
      case 'is-hafte': { const mon = new Date(now); mon.setDate(d - now.getDay()); setDateFrom(fmt(mon)); setDateTo(fmt(now)); break; }
      case 'pichhle-hafte': { const s = new Date(now); s.setDate(d - now.getDay() - 7); const e = new Date(s); e.setDate(s.getDate() + 6); setDateFrom(fmt(s)); setDateTo(fmt(e)); break; }
      case 'is-mahine': setDateFrom(new Date(y, m, 1).toISOString().split('T')[0]); setDateTo(new Date(y, m + 1, 0).toISOString().split('T')[0]); break;
      case 'pichhle-mahine': setDateFrom(new Date(y, m - 1, 1).toISOString().split('T')[0]); setDateTo(new Date(y, m, 0).toISOString().split('T')[0]); break;
      case 'is-saal': setDateFrom(new Date(y, 0, 1).toISOString().split('T')[0]); setDateTo(fmt(now)); break;
      case 'sab': setDateFrom(''); setDateTo(''); break;
    }
  };

  const handleStatusChange = (inv: Invoice, newStatus: Invoice['status']) => {
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: newStatus } : i));
    setShowStatusModal(null);
  };

  const firm = owner || currentUser;

  // Invoice detail view
  if (viewInvoice) {
    const inv = viewInvoice;
    return (
      <div className="space-y-4 animate-fade-in">
        {readOnly && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
            <Eye className="w-4 h-4 text-warning" />
            <span className="text-warning font-medium">👁️ Admin View — Sirf dekhne ka mode</span>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={() => setViewInvoice(null)}>← Wapas</Button>
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-foreground">Invoice: {inv.invoiceNumber}</h3>
              <p className="text-sm text-muted-foreground">Date: {formatDate(inv.date)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {inv.createdBy.role === 'user' ? '👑' : '👷'} Banaya: <span className="font-medium text-foreground">{inv.createdBy.name}</span>
                ({inv.createdBy.role === 'user' ? 'Owner' : 'Employee'})
              </p>
              {inv.createdBy.timestamp && <p className="text-xs text-muted-foreground">Time: {new Date(inv.createdBy.timestamp).toLocaleString('hi-IN')}</p>}
            </div>
            <span className={inv.status === 'paid' ? 'badge-success' : inv.status === 'partial' ? 'badge-warning' : 'badge-critical'}>
              {inv.status === 'paid' ? '🟢 Paid' : inv.status === 'partial' ? '🟡 Partial' : '🔴 Pending'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div><span className="text-muted-foreground">Customer:</span> <span className="text-foreground">{inv.customerName}</span></div>
            <div><span className="text-muted-foreground">GST:</span> <span className="text-foreground">{inv.customerGst || 'N/A'}</span></div>
            <div><span className="text-muted-foreground">Address:</span> <span className="text-foreground">{inv.customerAddress}</span></div>
            {inv.vehicleNumber && <div><span className="text-muted-foreground">Vehicle:</span> <span className="text-foreground">{inv.vehicleNumber}</span></div>}
          </div>
          <table className="w-full text-sm border">
            <thead><tr className="bg-primary text-primary-foreground">
              <th className="p-2 text-left">#</th><th className="p-2 text-left">Product</th><th className="p-2">HSN</th>
              <th className="p-2">Qty</th><th className="p-2">Rate</th><th className="p-2">Amount</th>
              <th className="p-2">GST%</th><th className="p-2">GST</th><th className="p-2">Total</th>
            </tr></thead>
            <tbody>
              {inv.items.map((item, i) => {
                const amt = item.price * item.quantity;
                const gst = amt * item.gstPercent / 100;
                return (
                  <tr key={i} className="border-b">
                    <td className="p-2">{i + 1}</td><td className="p-2">{item.productName}</td><td className="p-2 text-center">{item.hsn}</td>
                    <td className="p-2 text-center">{item.quantity} {item.unit}</td><td className="p-2 text-center">₹{item.price}</td>
                    <td className="p-2 text-center">₹{amt.toLocaleString('en-IN')}</td><td className="p-2 text-center">{item.gstPercent}%</td>
                    <td className="p-2 text-center">₹{gst.toFixed(2)}</td><td className="p-2 text-center">₹{(amt + gst).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 text-right space-y-1">
            <p className="text-sm text-muted-foreground">Subtotal: ₹{inv.totalAmount.toLocaleString('en-IN')}</p>
            <p className="text-sm text-muted-foreground">GST: ₹{inv.totalGst.toLocaleString('en-IN')}</p>
            <p className="text-lg font-bold text-foreground">Grand Total: ₹{inv.grandTotal.toLocaleString('en-IN')}</p>
            <p className="text-xs text-muted-foreground italic">{numberToWords(Math.round(inv.grandTotal))} Rupees Only</p>
          </div>
          <div className="mt-4 flex gap-2">
            {!readOnly && <Button size="sm" variant="outline" onClick={() => setShowStatusModal(inv)}>✏️ Status Badlo</Button>}
            <Button size="sm" variant="ghost" onClick={() => setViewInvoice(null)}>❌ Close</Button>
          </div>
        </div>

        {showStatusModal && (
          <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-sm p-6 animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-foreground">Status Badlo</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowStatusModal(null)}><X className="w-4 h-4" /></Button>
              </div>
              <div className="space-y-2">
                {(['paid', 'pending', 'partial'] as const).map(s => (
                  <Button key={s} variant={showStatusModal.status === s ? 'default' : 'outline'} className="w-full justify-start"
                    onClick={() => handleStatusChange(showStatusModal, s)}>
                    {s === 'paid' ? '🟢 Paid' : s === 'partial' ? '🟡 Partial' : '🔴 Pending'}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-xl font-bold text-foreground">📋 Invoices</h2>

      {readOnly && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
          <Eye className="w-4 h-4 text-warning" />
          <span className="text-warning font-medium">👁️ Admin View — Sirf dekhne ka mode</span>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Invoice no ya customer naam search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
          {!filterEmployeeId && (
            <Select value={creatorFilter} onValueChange={setCreatorFilter}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Banaya Kisne" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sabhi</SelectItem>
                {owner && <SelectItem value={owner.id}>👑 {owner.firmName}</SelectItem>}
                {allEmployees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>👷 {emp.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {[
            { label: 'Aaj', value: 'aaj' }, { label: 'Kal', value: 'kal' },
            { label: 'Is Hafte', value: 'is-hafte' }, { label: 'Pichhle Hafte', value: 'pichhle-hafte' },
            { label: 'Is Mahine', value: 'is-mahine' }, { label: 'Pichhle Mahine', value: 'pichhle-mahine' },
            { label: 'Is Saal', value: 'is-saal' }, { label: 'Sab', value: 'sab' },
          ].map(r => (
            <Button key={r.value} size="sm" variant="ghost" className="text-xs h-7" onClick={() => setQuickRange(r.value)}>{r.label}</Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} invoices mili</p>

      {/* Invoice Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground bg-muted/30">
              <th className="text-left py-2.5 px-3">#</th>
              <th className="text-left py-2.5 px-3">Invoice No</th>
              <th className="text-left py-2.5 px-3">Date</th>
              <th className="text-left py-2.5 px-3">Customer</th>
              <th className="text-center py-2.5 px-3">Items</th>
              <th className="text-right py-2.5 px-3">Subtotal</th>
              <th className="text-right py-2.5 px-3">GST</th>
              <th className="text-right py-2.5 px-3">Total</th>
              <th className="text-center py-2.5 px-3">Status</th>
              <th className="text-left py-2.5 px-3">Banaya Kisne</th>
              <th className="text-left py-2.5 px-3">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((inv, idx) => (
                <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 text-muted-foreground">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-medium text-foreground">{inv.invoiceNumber}</td>
                  <td className="py-2.5 px-3 text-muted-foreground text-xs">{formatDate(inv.date)}</td>
                  <td className="py-2.5 px-3 text-foreground">{inv.customerName}</td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">{inv.items.length}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">₹{inv.totalAmount.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">₹{inv.totalGst.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-foreground">₹{inv.grandTotal.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={inv.status === 'paid' ? 'badge-success' : inv.status === 'partial' ? 'badge-warning' : 'badge-critical'}>
                      {inv.status === 'paid' ? '🟢 Paid' : inv.status === 'partial' ? '🟡 Partial' : '🔴 Pending'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${inv.createdBy.role === 'user' ? 'bg-primary/10 text-primary' : 'bg-accent/20 text-accent-foreground'}`}
                      title={`${inv.createdBy.name} • ${inv.createdBy.timestamp ? new Date(inv.createdBy.timestamp).toLocaleString('hi-IN') : ''}`}>
                      {inv.createdBy.role === 'user' ? '👑' : '👷'} {inv.createdBy.name}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setViewInvoice(inv)}>👁️</Button>
                      {!readOnly && <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowStatusModal(inv)}>✏️</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Koi invoice nahi mila</p>}
      </div>

      {/* Summary Row */}
      <div className="glass-card p-4 flex flex-wrap gap-6 text-sm">
        <span className="text-muted-foreground">Total: <span className="font-bold text-foreground">{filtered.length} invoices</span></span>
        <span className="text-muted-foreground">Amount: <span className="font-bold text-foreground">₹{totalAmount.toLocaleString('en-IN')}</span></span>
        <span className="text-muted-foreground">Paid: <span className="font-bold text-success">₹{paidAmount.toLocaleString('en-IN')}</span></span>
        <span className="text-muted-foreground">Pending: <span className="font-bold text-critical">₹{pendingAmount.toLocaleString('en-IN')}</span></span>
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-foreground">Status Badlo — {showStatusModal.invoiceNumber}</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowStatusModal(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2">
              {(['paid', 'pending', 'partial'] as const).map(s => (
                <Button key={s} variant={showStatusModal.status === s ? 'default' : 'outline'} className="w-full justify-start"
                  onClick={() => handleStatusChange(showStatusModal, s)}>
                  {s === 'paid' ? '🟢 Paid' : s === 'partial' ? '🟡 Partial' : '🔴 Pending'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
