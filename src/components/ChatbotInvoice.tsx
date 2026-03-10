import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { numberToWords } from '@/lib/subscription';
import { getStateFromGST } from '@/lib/types';
import { printGSTInvoice } from '@/lib/invoicePrint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Printer, Pencil, Trash2, RotateCcw, Home, FileText, Download, Share2, ArrowLeft, Plus, Package, Car, User, Hash } from 'lucide-react';
import type { Customer, Product, InvoiceItem, Invoice, Payment } from '@/lib/types';

// State machine — clear, non-overlapping states
type ChatStep =
  | 'select-customer'
  | 'confirm-customer'
  | 'new-customer-name'
  | 'new-customer-phone'
  | 'new-customer-gst'
  | 'new-customer-address'
  | 'vehicle'
  | 'add-product'
  | 'product-selling-price'
  | 'product-discount'
  | 'product-quantity'
  | 'new-product-name'
  | 'new-product-hsn'
  | 'new-product-price'
  | 'new-product-gst'
  | 'new-product-unit'
  | 'more-products'
  | 'payment-ask'
  | 'payment-mode'
  | 'payment-partial-amount'
  | 'payment-partial-mode';

// These are separate UI panels, NOT chat states
type PanelMode = 'chat' | 'preview' | 'edit' | 'done';

interface Message {
  from: 'bot' | 'user';
  text: string;
  options?: string[];
}

export default function ChatbotInvoice() {
  const { currentUser, users, customers, products, invoices, payments, setCustomers, setProducts, setInvoices, setPayments } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    { from: 'bot', text: '🙏 Namaskar! Naya invoice banayein?\nCustomer naya hai ya purana?', options: ['Purana Customer', 'Naya Customer'] }
  ]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState<ChatStep>('select-customer');
  const [panelMode, setPanelMode] = useState<PanelMode>('chat');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCust, setNewCust] = useState({ name: '', phone: '', gstNumber: '', address: '' });
  const [vehicle, setVehicle] = useState('');
  const [ewayBill, setEwayBill] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<InvoiceItem>>({});
  const [newProd, setNewProd] = useState({ name: '', hsn: '', price: 0, gstPercent: 18, unit: 'Piece' });
  const [suggestions, setSuggestions] = useState<(Customer | Product)[]>([]);
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<Invoice | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [startChoice, setStartChoice] = useState(false); // whether user chose purana/naya

  // Edit mode sub-state
  const [editField, setEditField] = useState<string | null>(null);
  const [editInput, setEditInput] = useState('');

  const userId = currentUser?.role === 'employee' ? currentUser.parentUserId! : currentUser?.id!;
  const myCustomers = customers.filter(c => c.userId === userId);
  const myProducts = products.filter(p => p.userId === userId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (panelMode === 'chat') inputRef.current?.focus();
  }, [step, panelMode]);

  const addMsg = (from: 'bot' | 'user', text: string, options?: string[]) => {
    setMessages(prev => [...prev, { from, text, options }]);
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (step === 'select-customer' && value.trim().length >= 1) {
      const q = value.toLowerCase();
      setSuggestions(myCustomers.filter(c =>
        c.name.toLowerCase().includes(q) || c.phone.includes(q) ||
        (c.gstNumber && c.gstNumber.toLowerCase().includes(q))
      ).slice(0, 5));
    } else if (step === 'add-product' && value.trim().length >= 1) {
      const q = value.toLowerCase();
      setSuggestions(myProducts.filter(p =>
        p.name.toLowerCase().includes(q) || p.hsn.toLowerCase().includes(q)
      ).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const selectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setSuggestions([]);
    setInput('');
    addMsg('user', cust.name);
    addMsg('bot', `Sahi hai? ${cust.name}, ${cust.phone}${cust.gstNumber ? ', GST: ' + cust.gstNumber : ''}`, ['Haan ✅', 'Nahi, badlein ✏️']);
    setStep('confirm-customer');
  };

  const selectProduct = (p: Product) => {
    setCurrentItem({ productId: p.id, productName: p.name, hsn: p.hsn, mrp: p.price, gstPercent: p.gstPercent, unit: p.unit });
    setSuggestions([]);
    setInput('');
    addMsg('user', p.name);
    addMsg('bot', `${p.name} — MRP: ₹${p.price}/${p.unit} (Stock: ${p.stock})\nSelling price kya rakhni hai? (MRP se alag ho to likhein, warna Enter dabao)`);
    setStep('product-selling-price');
  };

  // Go to preview panel — NO message added
  const goToPreview = () => {
    setPanelMode('preview');
  };

  const handleStartOption = (opt: string) => {
    addMsg('user', opt);
    setStartChoice(true);
    if (opt === 'Purana Customer') {
      addMsg('bot', 'Customer ka naam ya number likhein:');
      setStep('select-customer');
    } else {
      addMsg('bot', 'Naye customer ka naam batayein:');
      setStep('new-customer-name');
    }
  };

  const handleOptionClick = (opt: string) => {
    // Start options
    if (!startChoice) {
      handleStartOption(opt);
      return;
    }

    addMsg('user', opt);

    if (step === 'confirm-customer') {
      if (opt === 'Haan ✅') {
        addMsg('bot', 'Gaadi number? (optional — khali Enter = skip)');
        setStep('vehicle');
      } else {
        setSelectedCustomer(null);
        addMsg('bot', 'Customer ka naam ya number likhein:');
        setStep('select-customer');
      }
      return;
    }
    if (step === 'more-products') {
      if (opt === 'Haan ➕') {
        addMsg('bot', 'Kaun sa product chahiye? Naam likhein:');
        setStep('add-product');
      } else {
        goToPreview();
      }
      return;
    }

    // Payment flow
    if (step === 'payment-ask') {
      handlePaymentAsk(opt);
      return;
    }
    if (step === 'payment-mode') {
      handlePaymentMode(opt);
      return;
    }
    if (step === 'payment-partial-mode') {
      handlePartialPaymentMode(opt);
      return;
    }

    // Misc
    if (opt === 'Naya Customer') {
      addMsg('bot', 'Naye customer ka naam batayein:');
      setStep('new-customer-name');
      return;
    }
    if (opt === 'Phir se likhein') {
      addMsg('bot', 'Customer ka naam ya number likhein:');
      setStep('select-customer');
      return;
    }
    if (step === 'select-customer') {
      const name = opt.split(' (')[0];
      const cust = myCustomers.find(c => c.name === name);
      if (cust) selectCustomer(cust);
      return;
    }
    if (step === 'add-product') {
      const pName = opt.split(' (₹')[0];
      const p = myProducts.find(pr => pr.name === pName);
      if (p) selectProduct(p);
      return;
    }
    if (opt === 'Haan, add karein') {
      addMsg('bot', 'Naye product ka naam?');
      setStep('new-product-name');
      return;
    }
    if (opt === 'Nahi') {
      addMsg('bot', 'Kaun sa product chahiye? Naam likhein:');
      setStep('add-product');
      return;
    }
  };

  const handleSend = () => {
    const text = input.trim();
    const skippableSteps: ChatStep[] = ['vehicle', 'new-customer-gst', 'new-customer-address', 'new-product-hsn', 'product-selling-price', 'product-discount'];
    if (!text && !skippableSteps.includes(step)) return;
    setInput('');
    setSuggestions([]);
    if (text) addMsg('user', text);
    else addMsg('user', '(skip)');

    switch (step) {
      case 'select-customer': {
        const matches = myCustomers.filter(c => c.name.toLowerCase().includes(text.toLowerCase()));
        if (matches.length === 1) selectCustomer(matches[0]);
        else if (matches.length > 1) addMsg('bot', 'Kaun sa customer?', matches.map(c => `${c.name} (${c.phone})`));
        else addMsg('bot', 'Koi customer nahi mila. Naya add karein?', ['Naya Customer', 'Phir se likhein']);
        break;
      }
      case 'new-customer-name':
        setNewCust(prev => ({ ...prev, name: text }));
        addMsg('bot', 'Phone number?');
        setStep('new-customer-phone');
        break;
      case 'new-customer-phone':
        setNewCust(prev => ({ ...prev, phone: text }));
        addMsg('bot', 'GST Number? (optional — khali Enter = skip)');
        setStep('new-customer-gst');
        break;
      case 'new-customer-gst':
        setNewCust(prev => ({ ...prev, gstNumber: text }));
        addMsg('bot', 'Address? (optional — khali Enter = skip)');
        setStep('new-customer-address');
        break;
      case 'new-customer-address': {
        const custId = 'c_' + Date.now();
        const cust: Customer = { id: custId, userId, name: newCust.name, phone: newCust.phone, gstNumber: newCust.gstNumber, address: text };
        setCustomers(prev => [...prev, cust]);
        setSelectedCustomer(cust);
        setNewCust({ name: '', phone: '', gstNumber: '', address: '' });
        addMsg('bot', `✅ Customer "${cust.name}" save ho gaya!\nGaadi number? (optional — khali Enter = skip)`);
        setStep('vehicle');
        break;
      }
      case 'vehicle':
        setVehicle(text);
        addMsg('bot', 'Kaun sa product chahiye? Naam likhein:');
        setStep('add-product');
        break;
      case 'add-product': {
        const matches = myProducts.filter(p => p.name.toLowerCase().includes(text.toLowerCase()));
        if (matches.length === 1) selectProduct(matches[0]);
        else if (matches.length > 1) addMsg('bot', 'Kaun sa product?', matches.map(p => `${p.name} (₹${p.price})`));
        else addMsg('bot', 'Product nahi mila. Naya product add karein?', ['Haan, add karein', 'Nahi']);
        break;
      }
      case 'product-selling-price': {
        const mrp = currentItem.mrp || 0;
        let sellingPrice = mrp;
        if (text) {
          const sp = Number(text);
          if (isNaN(sp) || sp <= 0) { addMsg('bot', 'Sahi price daalein!'); return; }
          sellingPrice = sp;
        }
        const discountFromMrp = mrp > 0 && sellingPrice < mrp ? Math.round(((mrp - sellingPrice) / mrp) * 100 * 100) / 100 : 0;
        setCurrentItem(prev => ({ ...prev, sellingPrice }));
        let msg = `Selling Price: ₹${sellingPrice}/${currentItem.unit}`;
        if (discountFromMrp > 0) msg += `\n🏷️ MRP se ${discountFromMrp}% discount!`;
        msg += `\nKoi aur discount dena hai selling price pe? (% mein likhein, ya Enter = no discount)`;
        addMsg('bot', msg);
        setStep('product-discount');
        break;
      }
      case 'product-discount': {
        let discountPct = 0;
        if (text) {
          const d = Number(text);
          if (isNaN(d) || d < 0 || d > 100) { addMsg('bot', 'Sahi discount % daalein (0-100)!'); return; }
          discountPct = d;
        }
        const sellingPrice = currentItem.sellingPrice || currentItem.mrp || 0;
        const finalPrice = Math.round(sellingPrice * (1 - discountPct / 100) * 100) / 100;
        setCurrentItem(prev => ({ ...prev, discount: discountPct, price: finalPrice }));
        let msg = `✅ Final Price: ₹${finalPrice}/${currentItem.unit}`;
        if (discountPct > 0) msg += ` (${discountPct}% discount on ₹${sellingPrice})`;
        if (currentItem.mrp && finalPrice < currentItem.mrp) {
          const totalDisc = Math.round(((currentItem.mrp - finalPrice) / currentItem.mrp) * 100 * 100) / 100;
          msg += `\n🏷️ MRP ₹${currentItem.mrp} se kul ${totalDisc}% off`;
        }
        msg += `\nKitni quantity?`;
        addMsg('bot', msg);
        setStep('product-quantity');
        break;
      }
      case 'product-quantity': {
        const qty = Number(text);
        if (isNaN(qty) || qty <= 0) { addMsg('bot', 'Sahi quantity daalein!'); return; }
        const item: InvoiceItem = { ...currentItem as InvoiceItem, quantity: qty };
        setItems(prev => [...prev, item]);
        setCurrentItem({});
        addMsg('bot', `✅ ${item.productName} x ${qty} add ho gaya!\nAur product add karein?`, ['Haan ➕', 'Nahi, Invoice Banao ✅']);
        setStep('more-products');
        break;
      }
      case 'new-product-name':
        setNewProd(prev => ({ ...prev, name: text }));
        addMsg('bot', 'HSN Code? (optional — khali Enter = skip)');
        setStep('new-product-hsn');
        break;
      case 'new-product-hsn':
        setNewProd(prev => ({ ...prev, hsn: text }));
        addMsg('bot', 'MRP / Price (₹)?');
        setStep('new-product-price');
        break;
      case 'new-product-price': {
        const price = Number(text);
        if (isNaN(price) || price <= 0) { addMsg('bot', 'Sahi price daalein!'); return; }
        setNewProd(prev => ({ ...prev, price }));
        addMsg('bot', 'GST %? (default 18)');
        setStep('new-product-gst');
        break;
      }
      case 'new-product-gst': {
        const gst = text ? Number(text) : 18;
        setNewProd(prev => ({ ...prev, gstPercent: gst }));
        addMsg('bot', 'Unit? (Piece/Kg/Box/Coil/Quintal/Bag)');
        setStep('new-product-unit');
        break;
      }
      case 'new-product-unit': {
        const unit = text || 'Piece';
        const prodId = 'p_' + Date.now();
        const prod: Product = { id: prodId, userId, name: newProd.name, hsn: newProd.hsn, price: newProd.price, gstPercent: newProd.gstPercent, unit, stock: 0, lowStockThreshold: 5 };
        setProducts(prev => [...prev, prod]);
        setCurrentItem({ productId: prod.id, productName: prod.name, hsn: prod.hsn, mrp: prod.price, gstPercent: prod.gstPercent, unit: prod.unit });
        setNewProd({ name: '', hsn: '', price: 0, gstPercent: 18, unit: 'Piece' });
        addMsg('bot', `✅ Product "${prod.name}" save ho gaya! MRP: ₹${prod.price}/${prod.unit}\nSelling price kya rakhni hai?`);
        setStep('product-selling-price');
        break;
      }
      case 'payment-partial-amount': {
        const amt = Number(text);
        if (isNaN(amt) || amt <= 0) { addMsg('bot', 'Sahi amount daalein!'); return; }
        setCurrentItem(prev => ({ ...prev, price: amt } as any));
        addMsg('bot', `₹${amt.toLocaleString('en-IN')} payment — kis tarike se mila?`, ['💵 Cash', '📱 UPI', '🏦 Bank Transfer', '🏦 RTGS', '📝 Cheque']);
        setStep('payment-partial-mode');
        break;
      }
    }
  };

  // ---- Invoice creation (from preview) ----
  const createInvoice = () => {
    if (items.length === 0) return;
    const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalGst = items.reduce((s, i) => s + (i.price * i.quantity * i.gstPercent) / 100, 0);
    const firmUser = currentUser?.role === 'employee' ? users.find(u => u.id === currentUser.parentUserId) : currentUser;
    const sellerStateCode = firmUser?.firmSettings?.stateCode || firmUser?.gstNumber?.substring(0, 2) || '';
    const buyerStateCode = selectedCustomer?.stateCode || (selectedCustomer?.gstNumber ? selectedCustomer.gstNumber.substring(0, 2) : sellerStateCode);
    const isInterState = sellerStateCode !== buyerStateCode;
    const totalCgst = isInterState ? 0 : totalGst / 2;
    const totalSgst = isInterState ? 0 : totalGst / 2;
    const totalIgst = isInterState ? totalGst : 0;
    const rawGrand = totalAmount + totalGst;
    const grandTotal = Math.round(rawGrand);
    const roundOff = Math.round((grandTotal - rawGrand) * 100) / 100;
    const buyerState = getStateFromGST(selectedCustomer?.gstNumber || '');
    const sellerState = getStateFromGST(firmUser?.gstNumber || '');
    const invNum = `${firmUser?.firmSettings?.invoicePrefix || 'INV'}-${new Date().getFullYear()}-${String(invoices.filter(i => i.userId === userId).length + 1).padStart(4, '0')}`;
    const invId = 'inv_' + Date.now();
    const invoice: Invoice = {
      id: invId, userId, invoiceNumber: invNum, date: new Date().toISOString().split('T')[0],
      customerId: selectedCustomer!.id, customerName: selectedCustomer!.name,
      customerGst: selectedCustomer!.gstNumber, customerAddress: selectedCustomer!.address,
      customerState: buyerState?.name || selectedCustomer?.state || '',
      customerStateCode: buyerStateCode, vehicleNumber: vehicle, ewayBillNumber: ewayBill,
      items, totalAmount, totalGst, totalCgst, totalSgst, totalIgst,
      grandTotal, roundOff, isInterState,
      placeOfSupply: buyerState?.name || selectedCustomer?.state || sellerState?.name || '',
      status: 'pending', paidAmount: 0,
      createdBy: { id: currentUser!.id, name: currentUser!.role === 'employee' ? currentUser!.username : currentUser!.firmName || currentUser!.username, role: currentUser!.role, timestamp: new Date().toISOString() },
    };
    setInvoices(prev => [...prev, invoice]);
    setProducts(prev => prev.map(p => { const item = items.find(i => i.productId === p.id); return item ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p; }));
    setLastCreatedInvoice(invoice);
    // Go to payment flow in chat
    setPanelMode('chat');
    addMsg('bot', `🎉 Invoice ban gayi! Invoice No: ${invNum}\nGrand Total: ₹${grandTotal.toLocaleString('en-IN')}\n\n💰 Payment mila hai?`, [
      '✅ Poora Mila (Full Paid)', '🟡 Thoda Mila (Partial)', '🔴 Abhi Nahi (Credit/Pending)',
    ]);
    setStep('payment-ask');
  };

  const handlePaymentAsk = (opt: string) => {
    if (opt === '✅ Poora Mila (Full Paid)') {
      addMsg('bot', '💰 Kis tarike se mila?', ['💵 Cash', '📱 UPI', '🏦 Bank Transfer', '🏦 RTGS', '📝 Cheque']);
      setStep('payment-mode');
    } else if (opt === '🟡 Thoda Mila (Partial)') {
      addMsg('bot', `Grand Total: ₹${lastCreatedInvoice?.grandTotal?.toLocaleString('en-IN') || '0'}\nKitna mila hai (₹)?`);
      setStep('payment-partial-amount');
    } else {
      setPanelMode('done');
    }
  };

  const handlePaymentMode = (opt: string) => {
    const modeMap: Record<string, Payment['mode']> = { '💵 Cash': 'Cash', '📱 UPI': 'UPI', '🏦 Bank Transfer': 'Bank Transfer', '🏦 RTGS': 'RTGS', '📝 Cheque': 'Cheque' };
    const mode = modeMap[opt] || 'Cash';
    const inv = lastCreatedInvoice;
    if (inv) {
      const payment: Payment = { id: 'pay_' + Date.now(), userId, customerId: inv.customerId, invoiceId: inv.id, amount: inv.grandTotal, date: new Date().toISOString().split('T')[0], mode, note: `Full payment for ${inv.invoiceNumber}`, timestamp: new Date().toISOString() };
      setPayments(prev => [...prev, payment]);
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid' as const, paidAmount: inv.grandTotal } : i));
      setLastCreatedInvoice({ ...inv, status: 'paid', paidAmount: inv.grandTotal });
    }
    setPanelMode('done');
  };

  const handlePartialPaymentMode = (opt: string) => {
    const modeMap: Record<string, Payment['mode']> = { '💵 Cash': 'Cash', '📱 UPI': 'UPI', '🏦 Bank Transfer': 'Bank Transfer', '🏦 RTGS': 'RTGS', '📝 Cheque': 'Cheque' };
    const mode = modeMap[opt] || 'Cash';
    const partialAmt = (currentItem as any)?.price || 0;
    const inv = lastCreatedInvoice;
    if (inv) {
      const payment: Payment = { id: 'pay_' + Date.now(), userId, customerId: inv.customerId, invoiceId: inv.id, amount: partialAmt, date: new Date().toISOString().split('T')[0], mode, note: `Partial payment for ${inv.invoiceNumber}`, timestamp: new Date().toISOString() };
      setPayments(prev => [...prev, payment]);
      const newPaid = (inv.paidAmount || 0) + partialAmt;
      const newStatus = newPaid >= inv.grandTotal ? 'paid' as const : 'partial' as const;
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: newStatus, paidAmount: newPaid } : i));
      setLastCreatedInvoice({ ...inv, status: newStatus, paidAmount: newPaid });
    }
    setCurrentItem({});
    setPanelMode('done');
  };

  const resetChat = () => {
    setMessages([{ from: 'bot', text: '🙏 Namaskar! Naya invoice banayein?\nCustomer naya hai ya purana?', options: ['Purana Customer', 'Naya Customer'] }]);
    setStep('select-customer');
    setPanelMode('chat');
    setStartChoice(false);
    setSelectedCustomer(null);
    setNewCust({ name: '', phone: '', gstNumber: '', address: '' });
    setVehicle('');
    setEwayBill('');
    setItems([]);
    setCurrentItem({});
    setSuggestions([]);
    setEditField(null);
    setEditInput('');
    setLastCreatedInvoice(null);
  };

  const printInvoice = () => {
    const inv = lastCreatedInvoice || invoices[invoices.length - 1];
    if (!inv) return;
    const firm = currentUser?.role === 'employee' ? users.find(u => u.id === currentUser.parentUserId) : currentUser;
    printGSTInvoice(inv, firm);
  };

  const getPlaceholder = (): string => {
    switch (step) {
      case 'select-customer': return 'Customer ka naam, phone ya GST likhein...';
      case 'new-customer-name': return 'Customer ka naam likhein...';
      case 'new-customer-phone': return 'Phone number likhein...';
      case 'new-customer-gst': return 'GST likhein ya khali Enter dabao skip karne ke liye';
      case 'new-customer-address': return 'Address likhein ya khali Enter dabao skip karne ke liye';
      case 'vehicle': return 'Jaise DL01AB1234, ya Enter dabao skip karne ke liye';
      case 'add-product': return 'Product ka naam ya HSN likhein...';
      case 'product-selling-price': return 'Selling price likhein ya Enter = MRP same rakhein';
      case 'product-discount': return 'Discount % likhein ya Enter = no discount';
      case 'product-quantity': return 'Quantity likhein...';
      case 'new-product-name': return 'Product ka naam...';
      case 'new-product-hsn': return 'HSN code ya khali Enter = skip';
      case 'new-product-price': return 'MRP / Price ₹...';
      case 'new-product-gst': return 'GST % (default 18)';
      case 'new-product-unit': return 'Unit (Piece/Kg/Box...)';
      case 'payment-partial-amount': return 'Amount ₹ likhein...';
      default: return 'Type karein...';
    }
  };

  const noInputSteps: ChatStep[] = ['confirm-customer', 'more-products', 'payment-ask', 'payment-mode', 'payment-partial-mode'];
  const showInput = panelMode === 'chat' && startChoice && !noInputSteps.includes(step);

  // ---- Compute invoice totals for preview ----
  const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalGst = items.reduce((s, i) => s + (i.price * i.quantity * i.gstPercent) / 100, 0);
  const grandTotal = Math.round(totalAmount + totalGst);

  // ===== EDIT MODE HANDLERS =====
  const handleEditAction = (action: string) => {
    setEditField(action);
    setEditInput('');
    if (action === 'customer') {
      // Show customer search inline in edit panel
    } else if (action === 'vehicle') {
      setEditInput(vehicle);
    } else if (action === 'eway') {
      setEditInput(ewayBill);
    }
  };

  const applyEdit = () => {
    if (editField === 'vehicle') {
      setVehicle(editInput);
    } else if (editField === 'eway') {
      setEwayBill(editInput);
    }
    setEditField(null);
    setEditInput('');
  };

  const removeProduct = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // ===== RENDER =====
  return (
    <div className="animate-fade-in h-full flex flex-col">
      <h2 className="text-xl font-bold text-foreground mb-4">🤖 Invoice Banao - Chatbot</h2>

      <div className="glass-card flex-1 flex flex-col overflow-hidden">
        {/* ====== PANEL: PREVIEW ====== */}
        {panelMode === 'preview' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <h3 className="text-lg font-bold text-foreground">📋 Invoice Preview</h3>

            <div className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="text-sm font-medium text-foreground">{selectedCustomer?.name || 'N/A'}</p>
                {selectedCustomer?.phone && <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>}
                {selectedCustomer?.gstNumber && <p className="text-xs text-muted-foreground">GST: {selectedCustomer.gstNumber}</p>}
              </div>

              {vehicle && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Gaadi No</p>
                  <p className="text-sm font-medium text-foreground">{vehicle}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Products</p>
                {items.map((it, i) => (
                  <div key={i} className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{it.productName} × {it.quantity}</p>
                      <p className="text-xs text-muted-foreground">
                        ₹{it.price}/{it.unit} • GST {it.gstPercent}%
                        {it.mrp && it.mrp !== it.price && ` • MRP ₹${it.mrp}`}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-foreground">₹{(it.price * it.quantity).toLocaleString('en-IN')}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">₹{totalAmount.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST</span><span className="text-foreground">₹{totalGst.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between text-base font-bold border-t pt-2"><span className="text-foreground">Grand Total</span><span className="text-primary">₹{grandTotal.toLocaleString('en-IN')}</span></div>
                <p className="text-xs text-muted-foreground italic">({numberToWords(grandTotal)} Rupees Only)</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={createInvoice} className="flex-1 min-h-[48px]" disabled={items.length === 0}>
                ✅ Invoice Banao
              </Button>
              <Button variant="outline" onClick={() => setPanelMode('edit')} className="min-h-[48px]">
                ✏️ Kuch Badlein
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-destructive min-h-[44px]" onClick={resetChat}>
              🗑️ Sab Cancel
            </Button>
          </div>
        )}

        {/* ====== PANEL: EDIT ====== */}
        {panelMode === 'edit' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <h3 className="text-lg font-bold text-foreground">✏️ Kya Badalna Hai?</h3>

            {!editField ? (
              <div className="space-y-2">
                <button onClick={() => handleEditAction('customer')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left min-h-[48px]">
                  <User className="w-5 h-5 text-primary" />
                  <div><p className="text-sm font-medium text-foreground">Customer Badlo</p><p className="text-xs text-muted-foreground">{selectedCustomer?.name || 'N/A'}</p></div>
                </button>
                <button onClick={() => handleEditAction('vehicle')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left min-h-[48px]">
                  <Car className="w-5 h-5 text-primary" />
                  <div><p className="text-sm font-medium text-foreground">Gaadi Number Badlo</p><p className="text-xs text-muted-foreground">{vehicle || 'N/A'}</p></div>
                </button>
                <button onClick={() => handleEditAction('eway')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left min-h-[48px]">
                  <Hash className="w-5 h-5 text-primary" />
                  <div><p className="text-sm font-medium text-foreground">E-Way Bill Badlo</p><p className="text-xs text-muted-foreground">{ewayBill || 'N/A'}</p></div>
                </button>
                <button onClick={() => handleEditAction('add-product')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left min-h-[48px]">
                  <Plus className="w-5 h-5 text-primary" />
                  <div><p className="text-sm font-medium text-foreground">Naya Product Jodo</p></div>
                </button>
                <button onClick={() => handleEditAction('remove-product')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left min-h-[48px]">
                  <Trash2 className="w-5 h-5 text-destructive" />
                  <div><p className="text-sm font-medium text-foreground">Product Hatao</p><p className="text-xs text-muted-foreground">{items.length} products</p></div>
                </button>
              </div>
            ) : editField === 'customer' ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Customer select karein:</p>
                <Input value={editInput} onChange={e => setEditInput(e.target.value)} placeholder="Customer ka naam likhein..." />
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {myCustomers.filter(c => !editInput || c.name.toLowerCase().includes(editInput.toLowerCase()) || c.phone.includes(editInput)).slice(0, 8).map(c => (
                    <button key={c.id} onClick={() => { setSelectedCustomer(c); setEditField(null); setEditInput(''); }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.phone}</span>
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditField(null)} className="min-h-[44px]">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Wapas
                </Button>
              </div>
            ) : editField === 'vehicle' || editField === 'eway' ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{editField === 'vehicle' ? 'Gaadi Number' : 'E-Way Bill Number'}:</p>
                <Input value={editInput} onChange={e => setEditInput(e.target.value)}
                  placeholder={editField === 'vehicle' ? 'DL01AB1234' : 'E-Way Bill No.'} />
                <div className="flex gap-2">
                  <Button onClick={applyEdit} className="flex-1 min-h-[44px]">✅ Save</Button>
                  <Button variant="ghost" onClick={() => setEditField(null)} className="min-h-[44px]">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Wapas
                  </Button>
                </div>
              </div>
            ) : editField === 'add-product' ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Product add karne ke liye wapas chat par jaayein:</p>
                <Button onClick={() => { setPanelMode('chat'); addMsg('bot', 'Kaun sa product chahiye? Naam likhein:'); setStep('add-product'); setEditField(null); }} className="w-full min-h-[44px]">
                  ➕ Product Add Karo
                </Button>
                <Button variant="ghost" onClick={() => setEditField(null)} className="w-full min-h-[44px]">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Wapas
                </Button>
              </div>
            ) : editField === 'remove-product' ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Kaun sa product hatana hai?</p>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Koi product nahi hai.</p>
                ) : items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-foreground">{it.productName} × {it.quantity}</span>
                    <Button size="sm" variant="destructive" onClick={() => removeProduct(i)} className="min-h-[36px]">
                      <Trash2 className="w-3 h-3 mr-1" /> Hatao
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" onClick={() => setEditField(null)} className="w-full min-h-[44px]">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Wapas
                </Button>
              </div>
            ) : null}

            {!editField && (
              <Button variant="outline" onClick={() => setPanelMode('preview')} className="w-full min-h-[48px]">
                ← Wapas Review Par Jao
              </Button>
            )}
          </div>
        )}

        {/* ====== PANEL: DONE ====== */}
        {panelMode === 'done' && lastCreatedInvoice && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-foreground">✅ Invoice Ban Gayi!</h3>
              <p className="text-sm text-muted-foreground">Invoice No: {lastCreatedInvoice.invoiceNumber}</p>
              <p className="text-sm text-muted-foreground">Customer: {lastCreatedInvoice.customerName}</p>
              <p className="text-xl font-bold text-foreground">₹{lastCreatedInvoice.grandTotal.toLocaleString('en-IN')}</p>
              <p className="text-xs text-muted-foreground">
                Status: {lastCreatedInvoice.status === 'paid' ? '🟢 Paid' : lastCreatedInvoice.status === 'partial' ? '🟡 Partial' : '🔴 Pending'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={printInvoice} className="flex flex-col items-center gap-1 min-h-[64px] py-3">
                <Printer className="w-5 h-5" />
                <span className="text-[10px]">Print</span>
              </Button>
              <Button variant="outline" onClick={async () => {
                const { downloadInvoicePDF } = await import('@/lib/exportUtils');
                const firm = currentUser?.role === 'employee' ? users.find(u => u.id === currentUser.parentUserId) : currentUser;
                downloadInvoicePDF(lastCreatedInvoice, firm);
              }} className="flex flex-col items-center gap-1 min-h-[64px] py-3">
                <Download className="w-5 h-5" />
                <span className="text-[10px]">PDF</span>
              </Button>
              <Button variant="outline" onClick={async () => {
                const { downloadInvoiceExcel } = await import('@/lib/exportUtils');
                downloadInvoiceExcel(lastCreatedInvoice);
              }} className="flex flex-col items-center gap-1 min-h-[64px] py-3">
                <FileText className="w-5 h-5" />
                <span className="text-[10px]">Excel</span>
              </Button>
            </div>

            <Button variant="outline" className="w-full min-h-[44px]" onClick={() => {
              const inv = lastCreatedInvoice;
              const text = `Invoice: ${inv.invoiceNumber}%0ACustomer: ${inv.customerName}%0AAmount: ₹${inv.grandTotal.toLocaleString('en-IN')}%0ADate: ${inv.date}`;
              window.open(`https://wa.me/?text=${text}`, '_blank');
            }}>
              <Share2 className="w-4 h-4 mr-2" /> 📱 WhatsApp Share
            </Button>

            <Button onClick={resetChat} className="w-full min-h-[48px]">
              ➕ Nayi Invoice Banao
            </Button>
            <Button variant="ghost" className="w-full min-h-[44px] text-muted-foreground" onClick={resetChat}>
              🏠 Dashboard Par Jao
            </Button>
          </div>
        )}

        {/* ====== PANEL: CHAT (normal chatbot flow) ====== */}
        {panelMode === 'chat' && (
          <>
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-line ${msg.from === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                    {msg.text}
                    {msg.options && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {msg.options.map(opt => (
                          <button key={opt} onClick={() => handleOptionClick(opt)}
                            className="px-3 py-1.5 bg-card border rounded-lg text-xs font-medium hover:bg-muted transition-colors text-foreground">
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions Dropdown */}
            {suggestions.length > 0 && (step === 'select-customer' || step === 'add-product') && (
              <div className="border-t bg-card px-3 py-2 space-y-1 max-h-48 overflow-y-auto">
                <p className="text-xs text-muted-foreground font-medium mb-1">
                  {step === 'select-customer' ? 'Customers:' : 'Products:'}
                </p>
                {step === 'select-customer' && (suggestions as Customer[]).map(c => (
                  <button key={c.id} onClick={() => selectCustomer(c)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}{c.gstNumber ? ` • ${c.gstNumber}` : ''}</span>
                  </button>
                ))}
                {step === 'add-product' && (suggestions as Product[]).map(p => (
                  <button key={p.id} onClick={() => selectProduct(p)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="text-xs text-muted-foreground">₹{p.price} • Stock: {p.stock}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            {showInput && (
              <div className="border-t p-3 flex gap-2">
                <Input ref={inputRef} value={input} onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend(); }} placeholder={getPlaceholder()} className="flex-1" />
                <Button size="sm" onClick={handleSend}><Send className="w-4 h-4" /></Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
