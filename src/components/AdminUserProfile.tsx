import { useApp } from '@/contexts/AppContext';
import { formatDate, numberToWords } from '@/lib/subscription';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, FileText } from 'lucide-react';
import type { User, Invoice } from '@/lib/types';
import { useState } from 'react';

interface Props {
  user: User;
  onBack: () => void;
}

export default function AdminUserProfile({ user, onBack }: Props) {
  const { invoices, customers, products } = useApp();
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const userInvoices = invoices.filter(i => i.userId === user.id);
  const userCustomers = customers.filter(c => c.userId === user.id);
  const userProducts = products.filter(p => p.userId === user.id);
  const totalRevenue = userInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const pendingAmount = userInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.grandTotal, 0);

  if (viewInvoice) {
    const inv = viewInvoice;
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="bg-warning/10 border border-warning/20 rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
          <Eye className="w-4 h-4 text-warning" />
          <span className="text-warning font-medium">👁️ Sirf dekhne ka mode — Admin view (Read Only)</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setViewInvoice(null)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Wapas
        </Button>
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Invoice: {inv.invoiceNumber}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div><span className="text-muted-foreground">Date:</span> <span className="text-foreground">{formatDate(inv.date)}</span></div>
            <div><span className="text-muted-foreground">Customer:</span> <span className="text-foreground">{inv.customerName}</span></div>
            <div><span className="text-muted-foreground">GST:</span> <span className="text-foreground">{inv.customerGst || 'N/A'}</span></div>
            <div><span className="text-muted-foreground">Address:</span> <span className="text-foreground">{inv.customerAddress}</span></div>
            {inv.vehicleNumber && <div><span className="text-muted-foreground">Vehicle:</span> <span className="text-foreground">{inv.vehicleNumber}</span></div>}
            <div><span className="text-muted-foreground">Status:</span> <span className={inv.status === 'paid' ? 'badge-success' : 'badge-warning'}>{inv.status}</span></div>
          </div>
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="p-2 text-left">#</th><th className="p-2 text-left">Product</th><th className="p-2">HSN</th>
                <th className="p-2">Qty</th><th className="p-2">Rate</th><th className="p-2">Amount</th>
                <th className="p-2">GST%</th><th className="p-2">GST</th><th className="p-2">Total</th>
              </tr>
            </thead>
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-warning/10 border border-warning/20 rounded-lg px-4 py-2 flex items-center gap-2 text-sm">
        <Eye className="w-4 h-4 text-warning" />
        <span className="text-warning font-medium">👁️ Sirf dekhne ka mode — Admin view (Read Only)</span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Wapas</Button>
        <h2 className="text-lg font-bold text-foreground">{user.firmName} — {user.username}</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-xl font-bold text-foreground">₹{totalRevenue.toLocaleString('en-IN')}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">Invoices</p><p className="text-xl font-bold text-foreground">{userInvoices.length}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold text-warning">₹{pendingAmount.toLocaleString('en-IN')}</p></div>
        <div className="stat-card"><p className="text-xs text-muted-foreground">Customers</p><p className="text-xl font-bold text-foreground">{userCustomers.length}</p></div>
      </div>

      {/* Invoices */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Invoices ({userInvoices.length})</h3>
        {userInvoices.length === 0 ? <p className="text-sm text-muted-foreground">Koi invoice nahi</p> : (
          <div className="space-y-2">
            {userInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded px-2 transition-colors" onClick={() => setViewInvoice(inv)}>
                <div>
                  <p className="text-sm font-medium text-foreground">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">{inv.customerName} • {formatDate(inv.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">₹{inv.grandTotal.toLocaleString('en-IN')}</p>
                  <span className={inv.status === 'paid' ? 'badge-success' : 'badge-warning'}>{inv.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customers */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Customers ({userCustomers.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Naam</th><th className="text-left py-2">Phone</th><th className="text-left py-2">GST</th><th className="text-left py-2">Address</th></tr></thead>
            <tbody>
              {userCustomers.map(c => (
                <tr key={c.id} className="border-b"><td className="py-2 text-foreground">{c.name}</td><td className="py-2 text-muted-foreground">{c.phone}</td><td className="py-2 text-muted-foreground">{c.gstNumber || 'N/A'}</td><td className="py-2 text-muted-foreground">{c.address || 'N/A'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Products */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Products ({userProducts.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">Naam</th><th className="text-left py-2">HSN</th><th className="text-left py-2">Price</th><th className="text-left py-2">Stock</th><th className="text-left py-2">GST%</th></tr></thead>
            <tbody>
              {userProducts.map(p => (
                <tr key={p.id} className="border-b"><td className="py-2 text-foreground">{p.name}</td><td className="py-2 text-muted-foreground">{p.hsn}</td><td className="py-2 text-muted-foreground">₹{p.price}</td><td className="py-2 text-muted-foreground">{p.stock} {p.unit}</td><td className="py-2 text-muted-foreground">{p.gstPercent}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
