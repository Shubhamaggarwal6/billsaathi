import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';
import SubscriptionBadge from '@/components/SubscriptionBadge';

export default function EmployeeManager() {
  const { currentUser, users, setUsers } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', email: '', phone: '' });

  if (!currentUser) return null;

  const myEmployees = users.filter(u => u.parentUserId === currentUser.id);
  const canAdd = myEmployees.length < currentUser.maxEmployees;

  const handleAdd = () => {
    if (!form.username || !form.password) return;
    setUsers(prev => [...prev, {
      id: 'emp_' + Date.now(),
      username: form.username,
      password: form.password,
      role: 'employee' as const,
      firmName: currentUser.firmName,
      gstNumber: '',
      email: form.email,
      phone: form.phone,
      plan: currentUser.plan,
      maxEmployees: 0,
      subscriptionStart: currentUser.subscriptionStart,
      subscriptionEnd: currentUser.subscriptionEnd,
      active: true,
      parentUserId: currentUser.id,
      showStockToEmployees: false,
    }]);
    setForm({ username: '', password: '', email: '', phone: '' });
    setShowAdd(false);
  };

  const toggleActive = (id: string) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u));
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Employees ({myEmployees.length}/{currentUser.maxEmployees})</h2>
        <Button size="sm" onClick={() => setShowAdd(true)} disabled={!canAdd}>
          <Plus className="w-4 h-4 mr-1" /> Employee Add
        </Button>
      </div>

      {!canAdd && <p className="text-sm text-warning">Maximum employee limit reach ho gaya hai ({currentUser.maxEmployees})</p>}

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-muted-foreground bg-muted/30">
            <th className="text-left py-2.5 px-3">Username</th>
            <th className="text-left py-2.5 px-3">Email</th>
            <th className="text-left py-2.5 px-3">Phone</th>
            <th className="text-left py-2.5 px-3">Status</th>
            <th className="text-left py-2.5 px-3">Subscription</th>
            <th className="text-left py-2.5 px-3">Action</th>
          </tr></thead>
          <tbody>
            {myEmployees.map(emp => (
              <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="py-2.5 px-3 font-medium text-foreground">{emp.username}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{emp.email}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{emp.phone}</td>
                <td className="py-2.5 px-3">
                  <span className={emp.active ? 'badge-success' : 'badge-critical'}>{emp.active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="py-2.5 px-3"><SubscriptionBadge endDate={currentUser.subscriptionEnd} compact /></td>
                <td className="py-2.5 px-3">
                  <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => toggleActive(emp.id)}>
                    {emp.active ? 'Disable' : 'Enable'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {myEmployees.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Koi employee nahi hai</p>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-foreground">Naya Employee</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-3">
              <Input placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
              <Input placeholder="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <Button onClick={handleAdd} className="w-full">Employee Banayein</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
