import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { INDIAN_STATES, DEFAULT_FIRM_SETTINGS, FirmSettings } from '@/lib/types';

export default function SettingsPanel() {
  const { currentUser, users, customers, products, invoices, payments, purchases, setUsers } = useApp();
  const [backupProgress, setBackupProgress] = useState<string | null>(null);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [msg, setMsg] = useState('');
  const [firmName, setFirmName] = useState(currentUser?.firmName || '');
  const [gstNumber, setGstNumber] = useState(currentUser?.gstNumber || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');

  const fs = currentUser?.firmSettings || DEFAULT_FIRM_SETTINGS;
  const [settings, setSettings] = useState<FirmSettings>(fs);

  if (!currentUser) return null;

  const updateSetting = (key: keyof FirmSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handlePasswordChange = () => {
    if (oldPw !== currentUser.password) { setMsg('Purana password galat hai!'); return; }
    if (newPw !== confirmPw) { setMsg('Passwords match nahi karte!'); return; }
    if (newPw.length < 4) { setMsg('Kam se kam 4 characters!'); return; }
    setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, password: newPw } : u));
    setMsg('✅ Password badal diya gaya!');
    setOldPw(''); setNewPw(''); setConfirmPw('');
  };

  const handleFirmUpdate = () => {
    setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, firmName, gstNumber, email, phone, firmSettings: settings } : u));
    setMsg('✅ Firm details aur settings update ho gayi!');
  };

  const toggleStockVisibility = () => {
    setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, showStockToEmployees: !u.showStockToEmployees } : u));
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-foreground">Settings</h2>

      {/* Password Change */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">🔐 Password Badlein</h3>
        <div className="space-y-3">
          <Input placeholder="Purana Password" type="password" value={oldPw} onChange={e => { setOldPw(e.target.value); setMsg(''); }} />
          <Input placeholder="Naya Password" type="password" value={newPw} onChange={e => { setNewPw(e.target.value); setMsg(''); }} />
          <Input placeholder="Confirm Naya Password" type="password" value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setMsg(''); }} />
          <Button onClick={handlePasswordChange} size="sm" className="min-h-[44px]">Password Badlein</Button>
        </div>
      </div>

      {/* Firm Details */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">🏢 Firm Details</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">Firm Name</label><Input value={firmName} onChange={e => setFirmName(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">GST Number</label><Input value={gstNumber} onChange={e => setGstNumber(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Email</label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Phone</label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-muted-foreground">Address</label><Input value={settings.address} onChange={e => updateSetting('address', e.target.value)} /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="text-xs text-muted-foreground">City</label><Input value={settings.city} onChange={e => updateSetting('city', e.target.value)} /></div>
            <div>
              <label className="text-xs text-muted-foreground">State</label>
              <select value={settings.stateCode} onChange={e => {
                const st = INDIAN_STATES.find(s => s.code === e.target.value);
                if (st) { updateSetting('state', st.name); updateSetting('stateCode', st.code); }
              }} className="w-full border rounded-md px-3 py-2 text-sm bg-card text-foreground min-h-[48px] md:min-h-0">
                {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-muted-foreground">PIN Code</label><Input value={settings.pincode} onChange={e => updateSetting('pincode', e.target.value)} /></div>
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">🏦 Bank Details (Invoice pe dikhega)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="text-xs text-muted-foreground">Bank Name</label><Input value={settings.bankName} onChange={e => updateSetting('bankName', e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Account Number</label><Input value={settings.accountNumber} onChange={e => updateSetting('accountNumber', e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">IFSC Code</label><Input value={settings.ifscCode} onChange={e => updateSetting('ifscCode', e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Branch Name</label><Input value={settings.branchName} onChange={e => updateSetting('branchName', e.target.value)} /></div>
        </div>
      </div>

      {/* Invoice Settings */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">📄 Invoice Settings</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">Invoice Prefix</label><Input value={settings.invoicePrefix} onChange={e => updateSetting('invoicePrefix', e.target.value)} placeholder="INV" /></div>
            <div>
              <label className="text-xs text-muted-foreground">Invoice Copy</label>
              <select value={settings.invoiceCopyLabel} onChange={e => updateSetting('invoiceCopyLabel', e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-card text-foreground min-h-[48px] md:min-h-0">
                <option value="original">Original for Recipient</option>
                <option value="duplicate">Duplicate for Transporter</option>
                <option value="triplicate">Triplicate for Supplier</option>
                <option value="all">All 3 Copies</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between min-h-[44px]">
              <span className="text-sm text-foreground">Bank details invoice pe dikhayein</span>
              <Switch checked={settings.showBankDetails} onCheckedChange={v => updateSetting('showBankDetails', v)} />
            </div>
            <div className="flex items-center justify-between min-h-[44px]">
              <span className="text-sm text-foreground">Terms & Conditions dikhayein</span>
              <Switch checked={settings.showTerms} onCheckedChange={v => updateSetting('showTerms', v)} />
            </div>
            <div className="flex items-center justify-between min-h-[44px]">
              <span className="text-sm text-foreground">E-Way Bill field dikhayein</span>
              <Switch checked={settings.showEwayBill} onCheckedChange={v => updateSetting('showEwayBill', v)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Terms & Conditions</label>
            <Textarea rows={4} value={settings.termsAndConditions} onChange={e => updateSetting('termsAndConditions', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Employee Stock Toggle */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between min-h-[44px]">
          <div>
            <h3 className="text-sm font-semibold text-foreground">👷 Employees ko Stock Dikhayein</h3>
            <p className="text-xs text-muted-foreground">Toggle on karein toh employees stock dekh sakenge</p>
          </div>
          <Switch checked={currentUser.showStockToEmployees} onCheckedChange={toggleStockVisibility} />
        </div>
      </div>

      <Button onClick={handleFirmUpdate} className="w-full min-h-[48px]">💾 Sab Settings Save Karein</Button>

      {/* Data Backup */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">💾 Data Backup</h3>
        <p className="text-xs text-muted-foreground mb-3">Poora data ek ZIP mein download karein.</p>
        <Button className="w-full min-h-[48px]" variant="outline"
          disabled={!!backupProgress}
          onClick={async () => {
            if (!currentUser) return;
            const { downloadFullBackup } = await import('@/lib/exportUtils');
            setBackupProgress('Taiyaar ho raha hai...');
            await downloadFullBackup(
              currentUser, users, customers.filter(c => c.userId === currentUser.id), products.filter(p => p.userId === currentUser.id),
              invoices.filter(i => i.userId === currentUser.id), payments.filter(p => p.userId === currentUser.id),
              purchases.filter(p => p.userId === currentUser.id),
              (step, total) => setBackupProgress(`Files ban rahi hain: ${step}/${total}`)
            );
            setBackupProgress('✅ Backup download ho gaya!');
            setTimeout(() => setBackupProgress(null), 3000);
          }}>
          {backupProgress || '📦 Poora Data Backup Karein'}
        </Button>
      </div>

      {msg && <p className="text-sm" style={{ color: msg.startsWith('✅') ? 'hsl(var(--success))' : 'hsl(var(--critical))' }}>{msg}</p>}
    </div>
  );
}
