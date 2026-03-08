import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatDate } from '@/lib/subscription';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ReportsPanel() {
  const { currentUser, invoices, products, customers } = useApp();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const userId = currentUser?.id!;
  let myInvoices = invoices.filter(i => i.userId === userId);
  if (dateFrom) myInvoices = myInvoices.filter(i => i.date >= dateFrom);
  if (dateTo) myInvoices = myInvoices.filter(i => i.date <= dateTo);
  const myProducts = products.filter(p => p.userId === userId);

  // Daily sales
  const dailySales = myInvoices.reduce((acc, inv) => {
    acc[inv.date] = (acc[inv.date] || 0) + inv.grandTotal;
    return acc;
  }, {} as Record<string, number>);
  const chartData = Object.entries(dailySales).map(([date, total]) => ({ date: formatDate(date), total }));

  // Top products
  const productCounts: Record<string, number> = {};
  myInvoices.forEach(inv => inv.items.forEach(item => {
    productCounts[item.productName] = (productCounts[item.productName] || 0) + item.quantity;
  }));
  const topProducts = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Top customers
  const customerTotals: Record<string, number> = {};
  myInvoices.forEach(inv => {
    customerTotals[inv.customerName] = (customerTotals[inv.customerName] || 0) + inv.grandTotal;
  });
  const topCustomers = Object.entries(customerTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // GSTR-1 summary
  const totalTaxable = myInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalCgst = myInvoices.reduce((s, i) => s + i.totalGst / 2, 0);
  const totalSgst = totalCgst;
  const totalGst = myInvoices.reduce((s, i) => s + i.totalGst, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold text-foreground">GST Reports</h2>

      <div className="flex gap-3 items-center flex-wrap">
        <div>
          <label className="text-xs text-muted-foreground">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="block border rounded-md px-3 py-1.5 text-sm bg-card text-foreground" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="block border rounded-md px-3 py-1.5 text-sm bg-card text-foreground" />
        </div>
      </div>

      {/* Daily Sales Chart */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Daily Sales Trend</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Sales']} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Koi data nahi hai</p>
        )}
      </div>

      {/* GSTR-1 Summary */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">GSTR-1 Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card"><p className="text-xs text-muted-foreground">Total Invoices</p><p className="text-xl font-bold text-foreground">{myInvoices.length}</p></div>
          <div className="stat-card"><p className="text-xs text-muted-foreground">Taxable Amount</p><p className="text-xl font-bold text-foreground">₹{totalTaxable.toLocaleString('en-IN')}</p></div>
          <div className="stat-card"><p className="text-xs text-muted-foreground">CGST + SGST</p><p className="text-xl font-bold text-foreground">₹{totalGst.toLocaleString('en-IN')}</p></div>
          <div className="stat-card"><p className="text-xs text-muted-foreground">Grand Total</p><p className="text-xl font-bold text-foreground">₹{(totalTaxable + totalGst).toLocaleString('en-IN')}</p></div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Products</h3>
          {topProducts.length === 0 ? <p className="text-sm text-muted-foreground">Koi data nahi</p> : (
            <div className="space-y-2">
              {topProducts.map(([name, qty], i) => (
                <div key={name} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                  <span className="text-foreground">{i + 1}. {name}</span>
                  <span className="badge-success">{qty} sold</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Customers</h3>
          {topCustomers.length === 0 ? <p className="text-sm text-muted-foreground">Koi data nahi</p> : (
            <div className="space-y-2">
              {topCustomers.map(([name, total], i) => (
                <div key={name} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                  <span className="text-foreground">{i + 1}. {name}</span>
                  <span className="font-medium text-foreground">₹{total.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inventory Status */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Inventory Status</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="stat-card"><p className="text-xs text-muted-foreground">Total Products</p><p className="text-xl font-bold text-foreground">{myProducts.length}</p></div>
          <div className="stat-card"><p className="text-xs text-muted-foreground">Low Stock</p><p className="text-xl font-bold text-critical">{myProducts.filter(p => p.stock <= p.lowStockThreshold).length}</p></div>
          <div className="stat-card"><p className="text-xs text-muted-foreground">In Stock</p><p className="text-xl font-bold text-success">{myProducts.filter(p => p.stock > p.lowStockThreshold).length}</p></div>
        </div>
      </div>
    </div>
  );
}
