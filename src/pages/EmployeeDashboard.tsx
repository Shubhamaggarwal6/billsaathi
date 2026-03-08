import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getSubscriptionStatus } from '@/lib/subscription';
import { Button } from '@/components/ui/button';
import SubscriptionBadge from '@/components/SubscriptionBadge';
import ChatbotInvoice from '@/components/ChatbotInvoice';
import CustomerManager from '@/components/CustomerManager';
import ProductManager from '@/components/ProductManager';
import { MessageSquare, Users, Package, LogOut, FileText, AlertTriangle } from 'lucide-react';

type Tab = 'invoice' | 'customers' | 'products' | 'stock';

export default function EmployeeDashboard() {
  const { currentUser, users, setCurrentUser } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('invoice');

  if (!currentUser) return null;

  const parentUser = users.find(u => u.id === currentUser.parentUserId);
  const subEnd = parentUser?.subscriptionEnd || currentUser.subscriptionEnd;
  const sub = getSubscriptionStatus(subEnd);
  const showStock = parentUser?.showStockToEmployees || false;

  if (sub.status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="glass-card p-8 text-center max-w-md animate-fade-in">
          <AlertTriangle className="w-12 h-12 text-critical mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Access Blocked</h2>
          <p className="text-muted-foreground mb-4">Aapke business owner ki subscription khatam ho gayi hai. Unse sampark karein.</p>
          <Button onClick={() => setCurrentUser(null)}>Login pe wapas jaayein</Button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'invoice', label: 'Invoice Banao', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'customers', label: 'Customer Add', icon: <Users className="w-4 h-4" /> },
    { id: 'products', label: 'Product Add', icon: <Package className="w-4 h-4" /> },
    ...(showStock ? [{ id: 'stock' as Tab, label: 'Stock', icon: <Package className="w-4 h-4" /> }] : []),
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 sidebar-gradient text-sidebar-foreground flex flex-col shrink-0">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-sidebar-accent-foreground">{currentUser.firmName}</h1>
              <p className="text-xs text-sidebar-foreground/60">Employee: {currentUser.username}</p>
            </div>
          </div>
          <div className="mt-3">
            <SubscriptionBadge endDate={subEnd} compact />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => setCurrentUser(null)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        {sub.status === 'critical' && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-warning font-medium">⚠️ Subscription {sub.daysLeft} din mein khatam hogi!</span>
          </div>
        )}
        {activeTab === 'invoice' && <ChatbotInvoice />}
        {activeTab === 'customers' && <CustomerManager />}
        {activeTab === 'products' && <ProductManager />}
        {activeTab === 'stock' && <ProductManager stockOnly />}
      </main>
    </div>
  );
}
