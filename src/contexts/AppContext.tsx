import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, Customer, Product, Invoice, Payment, PurchaseEntry } from '@/lib/types';
import { initialUsers, initialCustomers, initialProducts, initialInvoices, initialPayments, initialPurchases } from '@/lib/demoData';

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [purchases, setPurchases] = useState<PurchaseEntry[]>(initialPurchases);

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
