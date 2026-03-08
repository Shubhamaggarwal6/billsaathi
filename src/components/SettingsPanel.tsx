import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export default function SettingsPanel() {
  const { currentUser, setUsers } = useApp();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [msg, setMsg] = useState('');
  const [firmName, setFirmName] = useState(currentUser?.firmName || '');
  const [gstNumber, setGstNumber] = useState(currentUser?.gstNumber || '');

  if (!currentUser) return null;

  const handlePasswordChange = () => {
    if (oldPw !== currentUser.password) { setMsg('Purana password galat hai!'); return; }
    if (newPw !== confirmPw) { setMsg('Passwords match nahi karte!'); return; }
    if (newPw.length < 4) { setMsg('Kam se kam 4 characters!'); return; }
    setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, password: newPw } : u));
    setMsg('✅ Password badal diya gaya!');
    setOldPw(''); setNewPw(''); setConfirmPw('');
  };

  const handleFirmUpdate = () => {
    setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, firmName, gstNumber } : u));
    setMsg('✅ Firm details update ho gayi!');
  };

  const toggleStockVisibility = () => {
    setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, showStockToEmployees: !u.showStockToEmployees } : u));
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-lg">
      <h2 className="text-xl font-bold text-foreground">Settings</h2>

      {/* Password Change */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Password Badlein</h3>
        <div className="space-y-3">
          <Input placeholder="Purana Password" type="password" value={oldPw} onChange={e => { setOldPw(e.target.value); setMsg(''); }} />
          <Input placeholder="Naya Password" type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setMsg(''); }} />
          <Input placeholder="Confirm Naya Password" type="password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setMsg(''); }} />
          <Button onClick={handlePasswordChange} size="sm">Password Badlein</Button>
        </div>
      </div>

      {/* Firm Details */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Firm Details</h3>
        <div className="space-y-3">
          <Input placeholder="Firm Name" value={firmName} onChange={e => setFirmName(e.target.value)} />
          <Input placeholder="GST Number" value={gstNumber} onChange={e => setGstNumber(e.target.value)} />
          <Button onClick={handleFirmUpdate} size="sm">Update</Button>
        </div>
      </div>

      {/* Employee Stock Toggle */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Employees ko Stock Dikhayein</h3>
            <p className="text-xs text-muted-foreground">Toggle on karein toh employees stock dekh sakenge</p>
          </div>
          <Switch checked={currentUser.showStockToEmployees} onCheckedChange={toggleStockVisibility} />
        </div>
      </div>

      {msg && <p className="text-sm" style={{ color: msg.startsWith('✅') ? 'hsl(var(--success))' : 'hsl(var(--critical))' }}>{msg}</p>}
    </div>
  );
}
