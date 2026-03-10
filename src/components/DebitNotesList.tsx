import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { FileText, Search } from 'lucide-react';
import type { DebitNote } from '@/lib/types';

export default function DebitNotesList() {
  const { currentUser } = useApp();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [debitNotes] = useState<DebitNote[]>([]);

  const filtered = debitNotes.filter(dn => {
    if (statusFilter !== 'all' && dn.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return dn.debitNoteNumber.toLowerCase().includes(q) ||
        dn.customerName.toLowerCase().includes(q);
    }
    return true;
  });

  const statusBadge = (status: string) => {
    const cls = status === 'active' ? 'badge-success' : status === 'paid' ? 'bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-semibold' : 'bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[10px] font-semibold';
    const label = status === 'active' ? 'Active' : status === 'paid' ? 'Paid' : 'Cancelled';
    return <span className={cls}>{label}</span>;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg md:text-xl font-bold text-foreground">📋 Debit Notes</h2>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search debit notes..." className="pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-card text-foreground text-sm">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No debit notes yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create debit notes from the chatbot</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(dn => (
            <div key={dn.id} className="glass-card p-3 md:p-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{dn.debitNoteNumber}</p>
                <p className="text-xs text-muted-foreground truncate">{dn.customerName} • {formatDate(dn.date)}</p>
                <p className="text-xs text-muted-foreground">Against: {dn.originalInvoiceNumber}</p>
                <p className="text-xs text-muted-foreground">{dn.reason}</p>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <p className="text-sm font-bold text-foreground">₹{dn.total.toLocaleString('en-IN')}</p>
                {statusBadge(dn.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
