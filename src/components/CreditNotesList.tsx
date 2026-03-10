import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/subscription';
import { printGSTInvoice } from '@/lib/invoicePrint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { FileText, Download, Printer, Search, Filter } from 'lucide-react';
import type { CreditNote } from '@/lib/types';

export default function CreditNotesList() {
  const { currentUser, invoices } = useApp();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // For now, credit notes are stored locally - will integrate with context later
  const [creditNotes] = useState<CreditNote[]>([]);

  const filtered = creditNotes.filter(cn => {
    if (statusFilter !== 'all' && cn.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return cn.creditNoteNumber.toLowerCase().includes(q) ||
        cn.customerName.toLowerCase().includes(q);
    }
    return true;
  });

  const statusBadge = (status: string) => {
    const cls = status === 'active' ? 'badge-success' : status === 'adjusted' ? 'bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-semibold' : 'bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[10px] font-semibold';
    const label = status === 'active' ? 'Active' : status === 'adjusted' ? 'Adjusted' : 'Cancelled';
    return <span className={cls}>{label}</span>;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg md:text-xl font-bold text-foreground">📋 Credit Notes</h2>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search credit notes..." className="pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border bg-card text-foreground text-sm">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="adjusted">Adjusted</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No credit notes yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create credit notes from the chatbot</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cn => (
            <div key={cn.id} className="glass-card p-3 md:p-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{cn.creditNoteNumber}</p>
                <p className="text-xs text-muted-foreground truncate">{cn.customerName} • {formatDate(cn.date)}</p>
                <p className="text-xs text-muted-foreground">Against: {cn.originalInvoiceNumber}</p>
                <p className="text-xs text-muted-foreground">{cn.reason}</p>
              </div>
              <div className="text-right shrink-0 space-y-1">
                <p className="text-sm font-bold text-foreground">₹{cn.total.toLocaleString('en-IN')}</p>
                {statusBadge(cn.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
