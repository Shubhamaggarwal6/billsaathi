import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, X, Upload } from 'lucide-react';
import type { Customer } from '@/lib/types';
import { formatDate } from '@/lib/subscription';

export default function CustomerManager() {
  const { currentUser, customers, invoices, setCustomers } = useApp();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showProfile, setShowProfile] = useState<string | null>(null);
  const [newCust, setNewCust] = useState({ name: '', phone: '', gstNumber: '', address: '' });

  const userId = currentUser?.role === 'employee' ? currentUser?.parentUserId! : currentUser?.id!;
  const myCustomers = customers.filter(c => c.userId === userId);
  const filtered = myCustomers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search));

  const handleAdd = () => {
    if (!newCust.name) return;
    setCustomers(prev => [...prev, { id: 'c_' + Date.now(), userId, ...newCust }]);
    setNewCust({ name: '', phone: '', gstNumber: '', address: '' });
    setShowAdd(false);
  };

  const profileCustomer = showProfile ? myCustomers.find(c => c.id === showProfile) : null;
  const profileInvoices = showProfile ? invoices.filter(i => i.customerId === showProfile) : [];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Customers</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Customer Add</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Naam ya phone se search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-muted-foreground bg-muted/30">
            <th className="text-left py-2.5 px-3">Naam</th>
            <th className="text-left py-2.5 px-3">Phone</th>
            <th className="text-left py-2.5 px-3">GST</th>
            <th className="text-left py-2.5 px-3">Address</th>
            {currentUser?.role === 'user' && <th className="text-left py-2.5 px-3">Actions</th>}
          </tr></thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-medium text-foreground">{c.name}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{c.phone}</td>
                <td className="py-2.5 px-3 text-muted-foreground text-xs">{c.gstNumber || '-'}</td>
                <td className="py-2.5 px-3 text-muted-foreground text-xs">{c.address}</td>
                {currentUser?.role === 'user' && (
                  <td className="py-2.5 px-3">
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowProfile(c.id)}>Profile</Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Koi customer nahi mila</p>}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-foreground">Naya Customer</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-3">
              <Input placeholder="Naam" value={newCust.name} onChange={e => setNewCust({ ...newCust, name: e.target.value })} />
              <Input placeholder="Phone" value={newCust.phone} onChange={e => setNewCust({ ...newCust, phone: e.target.value })} />
              <Input placeholder="GST Number (optional)" value={newCust.gstNumber} onChange={e => setNewCust({ ...newCust, gstNumber: e.target.value })} />
              <Input placeholder="Address" value={newCust.address} onChange={e => setNewCust({ ...newCust, address: e.target.value })} />
              <Button onClick={handleAdd} className="w-full">Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && profileCustomer && (
        <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg p-6 animate-fade-in max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-foreground">{profileCustomer.name} - Profile</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowProfile(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-foreground">{profileCustomer.phone}</p></div>
              <div><p className="text-xs text-muted-foreground">GST</p><p className="text-foreground">{profileCustomer.gstNumber || 'N/A'}</p></div>
              <div className="col-span-2"><p className="text-xs text-muted-foreground">Address</p><p className="text-foreground">{profileCustomer.address}</p></div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground">Total Invoices</p>
                  <p className="text-lg font-bold text-foreground">{profileInvoices.length}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="text-lg font-bold text-foreground">₹{profileInvoices.reduce((s, i) => s + i.grandTotal, 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="text-lg font-bold text-warning">₹{profileInvoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.grandTotal, 0).toLocaleString('en-IN')}</p>
                </div>
              </div>
              <h4 className="text-sm font-medium text-foreground">Invoices</h4>
              {profileInvoices.map(inv => (
                <div key={inv.id} className="flex justify-between items-center py-2 border-b text-sm">
                  <div>
                    <p className="font-medium text-foreground">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">₹{inv.grandTotal.toLocaleString('en-IN')}</p>
                    <span className={inv.status === 'paid' ? 'badge-success' : 'badge-warning'}>{inv.status}</span>
                  </div>
                </div>
              ))}
              {profileInvoices.length === 0 && <p className="text-sm text-muted-foreground">Koi invoice nahi</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
