import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/subscription';
import { printDoc, downloadDocPDF, debitNoteToDocData } from '@/lib/invoiceRenderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { FileText, Download, Printer, Search, Plus } from 'lucide-react';
import type { DebitNote } from '@/lib/types';

export default function DebitNotesList() {
  const { currentUser, users } = useApp();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [debitNotes] = useState<DebitNote[]>([]);

  const filtered = debitNotes.filter(dn => {
    if (statusFilter !== 'all' && dn.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return dn.debitNoteNumber.toLowerCase().includes(q) || dn.customerName.toLowerCase().includes(q);
    }
    return true;
  });

  const firm = currentUser?.role === 'employee' ? users.find(u => u.id === currentUser.parentUserId) : currentUser;
  const totalAmount = filtered.reduce((s, dn) => s + dn.total, 0);

  const statusBadge = (status: string) => {
    const cls = status === 'active' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      : status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      : 'bg-muted text-muted-foreground';
    const label = status === 'active' ? 'Active' : status === 'paid' ? 'Paid' : 'Cancelled';
    return <span className={`${cls} px-2 py-0.5 rounded-full text-[10px] font-semibold`}>{label}</span>;
  };

  const handlePrint = (dn: DebitNote) => {
    printDoc(debitNoteToDocData(dn), { type: 'debit_note', firm, againstInvoiceNumber: dn.originalInvoiceNumber });
  };

  const handlePDF = async (dn: DebitNote) => {
    await downloadDocPDF(debitNoteToDocData(dn), { type: 'debit_note', firm, againstInvoiceNumber: dn.originalInvoiceNumber });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg md:text-xl font-bold text-foreground">📋 Debit Notes</h2>
        <Button size="sm" className="min-h-[36px]"><Plus className="w-4 h-4 mr-1" /> New Debit Note</Button>
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
          <p className="text-xs text-muted-foreground mt-1">Debit notes are auto-created for partial/pending payments</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {filtered.map(dn => (
              <div key={dn.id} className="glass-card p-3 md:p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{dn.debitNoteNumber}</p>
                  <p className="text-xs text-muted-foreground truncate">{dn.customerName} • {formatDate(dn.date)}</p>
                  {dn.originalInvoiceNumber && <p className="text-xs text-muted-foreground">Against: {dn.originalInvoiceNumber}</p>}
                  {dn.reason && <p className="text-xs text-muted-foreground">{dn.reason}</p>}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-bold text-foreground">₹{dn.total.toLocaleString('en-IN')}</p>
                  {statusBadge(dn.status)}
                  <div className="flex gap-1 mt-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handlePrint(dn)}><Printer className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handlePDF(dn)}><Download className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="glass-card p-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Total: {filtered.length} debit notes</span>
            <span className="font-bold text-foreground">₹{totalAmount.toLocaleString('en-IN')}</span>
          </div>
        </>
      )}
    </div>
  );
}
