import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { getSubscriptionStatus, formatDate } from '@/lib/subscription';
import { Button } from '@/components/ui/button';
import SubscriptionBadge from '@/components/SubscriptionBadge';
import ChatbotInvoice from '@/components/ChatbotInvoice';
import CustomerManager from '@/components/CustomerManager';
import ProductManager from '@/components/ProductManager';
import ReportsPanel from '@/components/ReportsPanel';
import EmployeeManager from '@/components/EmployeeManager';
import SettingsPanel from '@/components/SettingsPanel';
import InvoiceList from '@/components/InvoiceList';
import PurchaseRegister from '@/components/PurchaseRegister';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LayoutDashboard, MessageSquare, Users, Package, BarChart3,
  UserPlus, Settings, LogOut, FileText, AlertTriangle, ClipboardList, ShoppingCart, Menu, X, ChevronDown, ArrowLeft
} from 'lucide-react';

type Tab = 'dashboard' | 'chatbot' | 'invoices' | 'customers' | 'products' | 'reports' | 'employees' | 'settings' | 'purchases';

export default function UserDashboard() {
  const { currentUser, users, invoices, products, customers, setCurrentUser } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile();

  if (!currentUser) return null;

  const sub = getSubscriptionStatus(currentUser.subscriptionEnd);
  const myInvoices = invoices.filter(i => i.userId === currentUser.id);
  const myProducts = products.filter(p => p.userId === currentUser.id);
  const todaySales = myInvoices.filter(i => i.date === new Date().toISOString().split('T')[0]).reduce((s, i) => s + i.grandTotal, 0);
  const totalPending = myInvoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.grandTotal, 0);
  const totalRevenue = myInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const lowStockProducts = myProducts.filter(p => p.stock <= p.lowStockThreshold);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'chatbot', label: 'Invoice Banao', icon: <MessageSquare className="w-5 h-5" /> },
    { id: 'invoices', label: 'Invoices', icon: <ClipboardList className="w-5 h-5" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-5 h-5" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-5 h-5" /> },
    { id: 'purchases', label: 'Purchases', icon: <ShoppingCart className="w-5 h-5" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'employees', label: 'Employees', icon: <UserPlus className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  // Bottom nav: first 4 + More
  const bottomNavTabs = tabs.slice(0, 4);
  const moreTabs = tabs.slice(4);

  const switchTab = (id: Tab) => {
    setActiveTab(id);
    setSidebarOpen(false);
    setMoreOpen(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar overlay */}
      {sidebarOpen && !isMobile && (
        <div className="fixed inset-0 bg-foreground/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className={`fixed md:static inset-y-0 left-0 z-50 w-60 sidebar-gradient text-sidebar-foreground flex flex-col shrink-0 transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
          <div className="p-5 border-b border-sidebar-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm text-sidebar-accent-foreground truncate">{currentUser.firmName}</h1>
                <p className="text-xs text-sidebar-foreground/60">{currentUser.plan} Plan</p>
              </div>
            </div>
            <div className="mt-3">
              <SubscriptionBadge endDate={currentUser.subscriptionEnd} compact />
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => switchTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50'
                }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </nav>
          <div className="p-3 border-t border-sidebar-border">
            <button onClick={() => setCurrentUser(null)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50 transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Header */}
        {isMobile && (
          <header className="fixed top-0 left-0 right-0 z-30 bg-card border-b flex items-center justify-between h-[60px]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex items-center gap-2 px-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm text-foreground">BillSaathi</span>
            </div>
            <p className="text-xs text-muted-foreground truncate flex-1 text-center">{currentUser.firmName}</p>
            <button onClick={() => switchTab('settings')} className="px-4 text-muted-foreground">
              <Settings className="w-5 h-5" />
            </button>
          </header>
        )}

        {sub.status === 'critical' && (
          <div className={`bg-warning/10 border-b border-warning/20 px-4 md:px-6 py-2 flex items-center gap-2 text-xs md:text-sm ${isMobile ? 'mt-[60px]' : ''}`}>
            <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
            <span className="text-warning font-medium">⚠️ Subscription {sub.daysLeft} din mein khatam hogi!</span>
          </div>
        )}

        <main className={`flex-1 overflow-auto ${isMobile ? 'pt-[60px] pb-[70px]' : 'p-6'} ${isMobile && sub.status !== 'critical' ? '' : ''}`}>
          <div className={isMobile ? 'p-3' : ''}>
            {activeTab === 'dashboard' && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-lg md:text-xl font-bold text-foreground">Dashboard</h2>
                <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
                  <div className="stat-card"><p className="text-[10px] md:text-xs text-muted-foreground">Aaj ki Sales</p><p className="text-lg md:text-2xl font-bold text-foreground">₹{todaySales.toLocaleString('en-IN')}</p></div>
                  <div className="stat-card"><p className="text-[10px] md:text-xs text-muted-foreground">Total Pending</p><p className="text-lg md:text-2xl font-bold text-warning">₹{totalPending.toLocaleString('en-IN')}</p></div>
                  <div className="stat-card"><p className="text-[10px] md:text-xs text-muted-foreground">Total Revenue</p><p className="text-lg md:text-2xl font-bold text-success">₹{totalRevenue.toLocaleString('en-IN')}</p></div>
                  <div className="stat-card"><p className="text-[10px] md:text-xs text-muted-foreground">Total Invoices</p><p className="text-lg md:text-2xl font-bold text-foreground">{myInvoices.length}</p></div>
                </div>

                <div className="glass-card p-4 md:p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Subscription Details</h3>
                  <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                    <div><p className="text-xs text-muted-foreground">Plan</p><p className="font-medium text-foreground text-sm">{currentUser.plan}</p></div>
                    <div><p className="text-xs text-muted-foreground">End Date</p><p className="font-medium text-foreground text-sm">{formatDate(currentUser.subscriptionEnd)}</p></div>
                    <SubscriptionBadge endDate={currentUser.subscriptionEnd} compact />
                  </div>
                </div>

                <div className="glass-card p-4 md:p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Recent Invoices</h3>
                  {myInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Koi invoice nahi hai abhi</p>
                  ) : (
                    <div className="space-y-2">
                      {myInvoices.slice(-5).reverse().map(inv => (
                        <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{inv.invoiceNumber}</p>
                            <p className="text-xs text-muted-foreground truncate">{inv.customerName} • {formatDate(inv.date)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium text-foreground">₹{inv.grandTotal.toLocaleString('en-IN')}</p>
                            <span className={inv.status === 'paid' ? 'badge-success' : inv.status === 'partial' ? 'badge-warning' : 'badge-critical'}>
                              {inv.status === 'paid' ? 'Paid' : inv.status === 'partial' ? 'Partial' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {lowStockProducts.length > 0 && (
                  <div className="glass-card p-4 md:p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" /> Low Stock Alerts
                    </h3>
                    <div className="space-y-2">
                      {lowStockProducts.map(p => (
                        <div key={p.id} className="flex items-center justify-between py-1.5 text-sm gap-2">
                          <span className="text-foreground truncate">{p.name}</span>
                          <span className="badge-critical shrink-0">{p.stock} {p.unit} bache</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'chatbot' && <ChatbotInvoice />}
            {activeTab === 'invoices' && <InvoiceList />}
            {activeTab === 'customers' && <CustomerManager />}
            {activeTab === 'products' && <ProductManager />}
            {activeTab === 'reports' && <ReportsPanel />}
            {activeTab === 'purchases' && <PurchaseRegister />}
            {activeTab === 'employees' && <EmployeeManager />}
            {activeTab === 'settings' && <SettingsPanel />}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <>
          <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex justify-around items-stretch h-[60px]">
              {bottomNavTabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => switchTab(tab.id)}
                    className={`flex flex-col items-center justify-center gap-0.5 flex-1 relative transition-colors min-h-[44px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {isActive && <div className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-b" />}
                    {tab.icon}
                    <span className="text-[10px] leading-tight">{tab.label}</span>
                  </button>
                );
              })}
              <button onClick={() => setMoreOpen(true)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] ${moreTabs.some(t => t.id === activeTab) ? 'text-primary' : 'text-muted-foreground'}`}>
                {moreTabs.some(t => t.id === activeTab) && <div className="absolute top-0 left-2 right-2 h-0.5 bg-primary rounded-b" />}
                <Menu className="w-5 h-5" />
                <span className="text-[10px] leading-tight">More</span>
              </button>
            </div>
          </nav>

          {/* More Drawer */}
          {moreOpen && (
            <>
              <div className="fixed inset-0 bg-foreground/30 z-40 animate-fade-in" onClick={() => setMoreOpen(false)} />
              <div className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl shadow-lg animate-in slide-in-from-bottom duration-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="grid grid-cols-3 gap-4 p-4 pb-6">
                  {moreTabs.map(tab => (
                    <button key={tab.id} onClick={() => switchTab(tab.id)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl min-h-[44px] transition-colors ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}>
                      {tab.icon}
                      <span className="text-xs font-medium">{tab.label}</span>
                    </button>
                  ))}
                  <button onClick={() => { setMoreOpen(false); setCurrentUser(null); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl text-muted-foreground hover:bg-muted min-h-[44px]">
                    <LogOut className="w-5 h-5" />
                    <span className="text-xs font-medium">Logout</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
