import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getSubscriptionStatus } from '@/lib/subscription';
import { Button } from '@/components/ui/button';
import SubscriptionBadge from '@/components/SubscriptionBadge';
import ChatbotInvoice from '@/components/ChatbotInvoice';
import CustomerManager from '@/components/CustomerManager';
import ProductManager from '@/components/ProductManager';
import { MessageSquare, Users, Package, LogOut, FileText, AlertTriangle, Menu, X } from 'lucide-react';

type Tab = 'invoice' | 'customers' | 'products' | 'stock';

export default function EmployeeDashboard() {
  const { currentUser, users, setCurrentUser } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('invoice');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
    ...(showStock ? [{ id: 'stock' as Tab, label: 'Stock', icon: <Package className="w-4 h-4" /> }] : []),
  ];

  const switchTab = (id: Tab) => {
    setActiveTab(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-60 sidebar-gradient text-sidebar-foreground flex flex-col shrink-0 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 md:p-5 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm text-sidebar-accent-foreground truncate">{currentUser.firmName}</h1>
                <p className="text-xs text-sidebar-foreground/60 truncate">Employee: {currentUser.username}</p>
              </div>
            </div>
            <button className="md:hidden text-sidebar-foreground/70" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3">
            <SubscriptionBadge endDate={subEnd} compact />
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
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

      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <header className="md:hidden bg-card border-b px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-sm text-foreground truncate">{currentUser.firmName}</h1>
          <button onClick={() => setCurrentUser(null)} className="text-muted-foreground">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 p-3 md:p-6 overflow-auto">
          {sub.status === 'critical' && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg px-3 md:px-4 py-2 mb-4 flex items-center gap-2 text-xs md:text-sm">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
              <span className="text-warning font-medium">⚠️ Subscription {sub.daysLeft} din mein khatam hogi!</span>
            </div>
          )}
          {activeTab === 'invoice' && <ChatbotInvoice />}
          {activeTab === 'customers' && <CustomerManager />}
          {activeTab === 'products' && <ProductManager />}
          {activeTab === 'stock' && <ProductManager stockOnly />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-30 md:hidden">
        <div className="flex justify-around items-center h-14">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {tab.icon}
              <span className="text-[10px] leading-tight">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
