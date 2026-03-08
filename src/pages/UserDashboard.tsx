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
import {
  LayoutDashboard, MessageSquare, Users, Package, BarChart3,
  UserPlus, Settings, LogOut, FileText, AlertTriangle, ClipboardList, ShoppingCart
} from 'lucide-react';

type Tab = 'dashboard' | 'chatbot' | 'invoices' | 'customers' | 'products' | 'reports' | 'employees' | 'settings' | 'purchases';

export default function UserDashboard() {
  const { currentUser, users, invoices, products, customers, setCurrentUser } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  if (!currentUser) return null;

  const sub = getSubscriptionStatus(currentUser.subscriptionEnd);
  const myInvoices = invoices.filter(i => i.userId === currentUser.id);
  const myProducts = products.filter(p => p.userId === currentUser.id);
  const todaySales = myInvoices.filter(i => i.date === new Date().toISOString().split('T')[0]).reduce((s, i) => s + i.grandTotal, 0);
  const totalPending = myInvoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.grandTotal, 0);
  const totalRevenue = myInvoices.reduce((s, i) => s + i.grandTotal, 0);
  const lowStockProducts = myProducts.filter(p => p.stock <= p.lowStockThreshold);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'chatbot', label: 'Invoice Banao', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'invoices', label: 'Invoices', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'products', label: 'Products', icon: <Package className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'employees', label: 'Employees', icon: <UserPlus className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-60 sidebar-gradient text-sidebar-foreground flex flex-col shrink-0">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <FileText className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-sidebar-accent-foreground">{currentUser.firmName}</h1>
              <p className="text-xs text-sidebar-foreground/60">{currentUser.plan} Plan</p>
            </div>
          </div>
          <div className="mt-3">
            <SubscriptionBadge endDate={currentUser.subscriptionEnd} compact />
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {sub.status === 'critical' && (
          <div className="bg-warning/10 border-b border-warning/20 px-6 py-2.5 flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-warning font-medium">⚠️ Aapki subscription {sub.daysLeft} din mein khatam hogi! Admin se renew karwayein.</span>
          </div>
        )}

        <main className="flex-1 p-6 overflow-auto">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground">Aaj ki Sales</p>
                  <p className="text-2xl font-bold text-foreground">₹{todaySales.toLocaleString('en-IN')}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground">Total Pending</p>
                  <p className="text-2xl font-bold text-warning">₹{totalPending.toLocaleString('en-IN')}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-success">₹{totalRevenue.toLocaleString('en-IN')}</p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold text-foreground">{myInvoices.length}</p>
                </div>
              </div>

              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-2">Subscription Details</h3>
                <div className="flex items-center gap-4 flex-wrap">
                  <div><p className="text-xs text-muted-foreground">Plan</p><p className="font-medium text-foreground">{currentUser.plan}</p></div>
                  <div><p className="text-xs text-muted-foreground">End Date</p><p className="font-medium text-foreground">{formatDate(currentUser.subscriptionEnd)}</p></div>
                  <SubscriptionBadge endDate={currentUser.subscriptionEnd} compact />
                </div>
              </div>

              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Recent Invoices</h3>
                {myInvoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Koi invoice nahi hai abhi</p>
                ) : (
                  <div className="space-y-2">
                    {myInvoices.slice(-5).reverse().map(inv => (
                      <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{inv.customerName} • {formatDate(inv.date)}</p>
                        </div>
                        <div className="text-right">
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
                <div className="glass-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" /> Low Stock Alerts
                  </h3>
                  <div className="space-y-2">
                    {lowStockProducts.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-foreground">{p.name}</span>
                        <span className="badge-critical">{p.stock} {p.unit} bache</span>
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
          {activeTab === 'employees' && <EmployeeManager />}
          {activeTab === 'settings' && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
}
