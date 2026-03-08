export type Role = 'admin' | 'user' | 'employee';
export type PlanType = 'Basic' | 'Pro' | 'Enterprise';
export type SubscriptionDuration = '1month' | '3months' | '6months' | '1year' | 'custom';

export interface User {
  id: string;
  username: string;
  password: string;
  role: Role;
  firmName: string;
  gstNumber: string;
  email: string;
  phone: string;
  plan: PlanType;
  maxEmployees: number;
  subscriptionStart: string;
  subscriptionEnd: string;
  active: boolean;
  parentUserId?: string; // for employees
  showStockToEmployees: boolean;
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  phone: string;
  gstNumber: string;
  address: string;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  hsn: string;
  price: number;
  gstPercent: number;
  unit: string;
  stock: number;
  lowStockThreshold: number;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  hsn: string;
  quantity: number;
  price: number;
  gstPercent: number;
  unit: string;
}

export interface Invoice {
  id: string;
  userId: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  customerGst: string;
  customerAddress: string;
  vehicleNumber: string;
  items: InvoiceItem[];
  totalAmount: number;
  totalGst: number;
  grandTotal: number;
  status: 'paid' | 'pending';
  createdBy: string;
}

export interface SubscriptionStatus {
  status: 'active' | 'warning' | 'critical' | 'expired';
  color: string;
  label: string;
  daysLeft: number;
}
