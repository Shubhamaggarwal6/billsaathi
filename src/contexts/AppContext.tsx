import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Customer, Product, Invoice, Payment, PurchaseEntry } from '@/lib/types';
import { initialUsers, initialCustomers, initialProducts, initialInvoices, initialPayments, initialPurchases } from '@/lib/demoData';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
  } catch {}
  return fallback;
}

function saveToStorage(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

interface AppState {
  currentUser: User | null;
  users: User[];
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  payments: Payment[];
  purchases: PurchaseEntry[];
  setCurrentUser: (u: User | null) => void;
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  setPurchases: React.Dispatch<React.SetStateAction<PurchaseEntry[]>>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadFromStorage('bs_currentUser', null));
  const [users, setUsers] = useState<User[]>(() => loadFromStorage('bs_users', initialUsers));
  const [customers, setCustomers] = useState<Customer[]>(() => loadFromStorage('bs_customers', initialCustomers));
  const [products, setProducts] = useState<Product[]>(() => loadFromStorage('bs_products', initialProducts));
  const [invoices, setInvoices] = useState<Invoice[]>(() => loadFromStorage('bs_invoices', initialInvoices));
  const [payments, setPayments] = useState<Payment[]>(() => loadFromStorage('bs_payments', initialPayments));
  const [purchases, setPurchases] = useState<PurchaseEntry[]>(() => loadFromStorage('bs_purchases', initialPurchases));

  useEffect(() => { saveToStorage('bs_currentUser', currentUser); }, [currentUser]);
  useEffect(() => { saveToStorage('bs_users', users); }, [users]);
  useEffect(() => { saveToStorage('bs_customers', customers); }, [customers]);
  useEffect(() => { saveToStorage('bs_products', products); }, [products]);
  useEffect(() => { saveToStorage('bs_invoices', invoices); }, [invoices]);
  useEffect(() => { saveToStorage('bs_payments', payments); }, [payments]);
  useEffect(() => { saveToStorage('bs_purchases', purchases); }, [purchases]);

  return (
    <AppContext.Provider value={{
      currentUser, users, customers, products, invoices, payments, purchases,
      setCurrentUser, setUsers, setCustomers, setProducts, setInvoices, setPayments, setPurchases,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
