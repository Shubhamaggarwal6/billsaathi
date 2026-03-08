import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { numberToWords } from '@/lib/subscription';
import { getStateFromGST } from '@/lib/types';
import { printGSTInvoice } from '@/lib/invoicePrint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Printer, Pencil, Trash2, RotateCcw, Home } from 'lucide-react';
import type { Customer, Product, InvoiceItem, Invoice, Payment } from '@/lib/types';

type Step =
  | 'start'
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
  | 'preview'
  | 'payment-ask'
  | 'payment-mode'
  | 'payment-partial-amount'
  | 'payment-partial-mode'
  | 'done';

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
  const [step, setStep] = useState<Step>('start');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCust, setNewCust] = useState({ name: '', phone: '', gstNumber: '', address: '' });
  const [vehicle, setVehicle] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [currentItem, setCurrentItem] = useState<Partial<InvoiceItem>>({});
  const [newProd, setNewProd] = useState({ name: '', hsn: '', price: 0, gstPercent: 18, unit: 'Piece' });
  const [showInvoice, setShowInvoice] = useState(false);
  const [suggestions, setSuggestions] = useState<(Customer | Product)[]>([]);
  const [lastCreatedInvoiceId, setLastCreatedInvoiceId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [returnStep, setReturnStep] = useState<Step | null>(null);

  const userId = currentUser?.role === 'employee' ? currentUser.parentUserId! : currentUser?.id!;
  const myCustomers = customers.filter(c => c.userId === userId);
  const myProducts = products.filter(p => p.userId === userId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const addMsg = (from: 'bot' | 'user', text: string, options?: string[]) => {
    setMessages(prev => [...prev, { from, text, options }]);
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    if (step === 'select-customer' && value.trim().length >= 1) {
      const q = value.toLowerCase();
      const matches = myCustomers.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.gstNumber && c.gstNumber.toLowerCase().includes(q))
      ).slice(0, 5);
      setSuggestions(matches);
    } else if ((step === 'add-product') && value.trim().length >= 1) {
      const q = value.toLowerCase();
      const matches = myProducts.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.hsn.toLowerCase().includes(q)
      ).slice(0, 5);
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  };

  const handleOption = (opt: string) => {
    addMsg('user', opt);
    if (step === 'start') {
      if (opt === 'Purana Customer') {
        addMsg('bot', 'Customer ka naam ya number likhein:');
        setStep('select-customer');
      } else {
        addMsg('bot', 'Naye customer ka naam batayein:');
        setStep('new-customer-name');
      }
    } else if (step === 'more-products') {
      if (opt === 'Haan ➕') {
        addMsg('bot', 'Kaun sa product chahiye? Naam likhein:');
        setStep('add-product');
      } else {
        showPreview();
      }
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

  const handleSend = () => {
    const text = input.trim();
    const skippableSteps: Step[] = ['vehicle', 'new-customer-gst', 'new-customer-address', 'new-product-hsn', 'product-selling-price', 'product-discount'];
    if (!text && !skippableSteps.includes(step)) return;
    setInput('');
    setSuggestions([]);
    if (text) addMsg('user', text);
    else addMsg('user', '(skip)');

    switch (step) {
      case 'select-customer': {
        const matches = myCustomers.filter(c => c.name.toLowerCase().includes(text.toLowerCase()));
        if (matches.length === 1) {
          selectCustomer(matches[0]);
        } else if (matches.length > 1) {
          addMsg('bot', 'Kaun sa customer?', matches.map(c => `${c.name} (${c.phone})`));
        } else {
          addMsg('bot', 'Koi customer nahi mila. Naya add karein?', ['Naya Customer', 'Phir se likhein']);
        }
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
        const cust: Customer = {
          id: custId, userId, name: newCust.name, phone: newCust.phone,
          gstNumber: newCust.gstNumber, address: text
        };
        setCustomers(prev => [...prev, cust]);
        setSelectedCustomer(cust);
        setNewCust({ name: '', phone: '', gstNumber: '', address: '' });
        addMsg('bot', `✅ Customer "${cust.name}" save ho gaya!\nGaadi number? (optional — khali Enter = skip)`);
        setStep('vehicle');
        break;
      }
      case 'vehicle':
        setVehicle(text);
        if (editTarget === 'vehicle' && returnStep) {
          addMsg('bot', '✅ Gaadi number update ho gaya!');
          setEditTarget(null);
          const rs = returnStep;
          setReturnStep(null);
          if (rs === 'preview') { setTimeout(() => showPreview(), 0); }
          else setStep(rs);
        } else {
          addMsg('bot', 'Kaun sa product chahiye? Naam likhein:');
          setStep('add-product');
        }
        break;
      case 'add-product': {
        const matches = myProducts.filter(p => p.name.toLowerCase().includes(text.toLowerCase()));
        if (matches.length === 1) {
          selectProduct(matches[0]);
        } else if (matches.length > 1) {
          addMsg('bot', 'Kaun sa product?', matches.map(p => `${p.name} (₹${p.price})`));
        } else {
          addMsg('bot', 'Product nahi mila. Naya product add karein?', ['Haan, add karein', 'Nahi']);
        }
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
        const discountFromMrp = mrp > 0 && sellingPrice < mrp
          ? Math.round(((mrp - sellingPrice) / mrp) * 100 * 100) / 100
          : 0;
        setCurrentItem(prev => ({ ...prev, sellingPrice }));

        let msg = `Selling Price: ₹${sellingPrice}/${currentItem.unit}`;
        if (discountFromMrp > 0) {
          msg += `\n🏷️ MRP se ${discountFromMrp}% discount!`;
        }
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
        if (discountPct > 0) {
          msg += ` (${discountPct}% discount on ₹${sellingPrice})`;
        }
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
        const item: InvoiceItem = {
          ...currentItem as InvoiceItem,
          quantity: qty,
        };
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
        const prod: Product = {
          id: prodId, userId, name: newProd.name, hsn: newProd.hsn,
          price: newProd.price, gstPercent: newProd.gstPercent, unit, stock: 0, lowStockThreshold: 5
        };
        setProducts(prev => [...prev, prod]);
        setCurrentItem({ productId: prod.id, productName: prod.name, hsn: prod.hsn, mrp: prod.price, gstPercent: prod.gstPercent, unit: prod.unit });
        setNewProd({ name: '', hsn: '', price: 0, gstPercent: 18, unit: 'Piece' });
        addMsg('bot', `✅ Product "${prod.name}" save ho gaya! MRP: ₹${prod.price}/${prod.unit}\nSelling price kya rakhni hai? (MRP se alag ho to likhein, warna Enter dabao)`);
        setStep('product-selling-price');
        break;
      }
      case 'payment-partial-amount': {
        const amt = Number(text);
        if (isNaN(amt) || amt <= 0) { addMsg('bot', 'Sahi amount daalein!'); return; }
        // Store partial amount temporarily
        setCurrentItem(prev => ({ ...prev, price: amt } as any));
        addMsg('bot', `₹${amt.toLocaleString('en-IN')} payment — kis tarike se mila?`, ['💵 Cash', '📱 UPI', '🏦 Bank Transfer', '🏦 RTGS', '📝 Cheque']);
        setStep('payment-partial-mode');
        break;
      }
    }
  };

  const handleOptionClick = (opt: string) => {
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
    if (step === 'start' || step === 'more-products') {
      handleOption(opt);
      return;
    }
    if (step === 'preview') {
      handleConfirm(opt);
      return;
    }
    if (step === 'done') {
      if (opt === '📋 Nayi Invoice Banao') resetChat();
      return;
    }

    // Payment flow options
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
    if (opt === '✏️ Kuch Badlein') {
      addMsg('bot', 'Kya badalna hai?', [
        '✏️ Customer Badlein',
        '✏️ Gaadi No. Badlein',
        '🗑️ Product Hatao',
        '⬅️ Wapas Jaao'
      ]);
      return;
    }
    if (opt === '🗑️ Sab Cancel') {
      resetChat();
      return;
    }
    if (opt === '✏️ Customer Badlein') {
      setSelectedCustomer(null);
      addMsg('bot', 'Customer ka naam ya number likhein:');
      setEditTarget('customer');
      setReturnStep('preview');
      setStep('select-customer');
      return;
    }
    if (opt === '✏️ Gaadi No. Badlein') {
      addMsg('bot', 'Naya gaadi number likhein (ya khali Enter = skip):');
      setEditTarget('vehicle');
      setReturnStep('preview');
      setStep('vehicle');
      return;
    }
    if (opt === '🗑️ Product Hatao') {
      if (items.length === 0) {
        addMsg('bot', 'Koi product nahi hai abhi.');
        showPreview();
      } else {
        addMsg('bot', 'Kaun sa product hatana hai?', items.map((it, i) => `🗑️ ${it.productName} x${it.quantity}`));
      }
      return;
    }
    if (opt.startsWith('🗑️ ')) {
      const prodName = opt.replace('🗑️ ', '').split(' x')[0];
      setItems(prev => {
        const idx = prev.findIndex(i => i.productName === prodName);
        if (idx >= 0) return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        return prev;
      });
      addMsg('bot', `${prodName} hata diya gaya.`);
      setTimeout(() => showPreview(), 100);
      return;
    }
    if (opt === '⬅️ Wapas Jaao') {
      showPreview();
      return;
    }
  };

  const showPreview = () => {
    setStep('preview');
    setEditTarget(null);
    setReturnStep(null);
    const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalGst = items.reduce((s, i) => s + (i.price * i.quantity * i.gstPercent) / 100, 0);
    const grandTotal = totalAmount + totalGst;
    const itemList = items.map((it, i) => {
      let line = `${i + 1}. ${it.productName} x${it.quantity}`;
      if (it.mrp && it.mrp !== it.price) {
        line += ` | MRP: ₹${it.mrp} → ₹${it.price}`;
        const totalDisc = Math.round(((it.mrp - it.price) / it.mrp) * 100 * 100) / 100;
        line += ` (${totalDisc}% off)`;
      }
      line += ` = ₹${(it.price * it.quantity).toLocaleString('en-IN')} (+${it.gstPercent}% GST)`;
      return line;
    }).join('\n');
    addMsg('bot',
      `📋 Invoice Preview:\n\nCustomer: ${selectedCustomer?.name || 'N/A'}${vehicle ? `\nGaadi No: ${vehicle}` : ''}\n\n${itemList}\n\nSubtotal: ₹${totalAmount.toLocaleString('en-IN')}\nGST: ₹${totalGst.toLocaleString('en-IN')}\n━━━━━━━━━━━━━━━━━\nGrand Total: ₹${grandTotal.toLocaleString('en-IN')}\n(${numberToWords(Math.round(grandTotal))} Rupees Only)`,
      ['✅ Invoice Banao', '✏️ Kuch Badlein', '🗑️ Sab Cancel']
    );
  };

  useEffect(() => {
    if (editTarget === 'customer' && selectedCustomer && step === 'vehicle' && returnStep === 'preview') {
      setStep('preview');
      setEditTarget(null);
      setReturnStep(null);
      setTimeout(() => showPreview(), 0);
    }
  }, [selectedCustomer, step, editTarget, returnStep]);

  const handleConfirm = (opt: string) => {
    if (opt === '✅ Invoice Banao') {
      if (items.length === 0) {
        addMsg('bot', 'Pehle koi product add karein!');
        return;
      }
      const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const totalGst = items.reduce((s, i) => s + (i.price * i.quantity * i.gstPercent) / 100, 0);

      const firmUser = currentUser?.role === 'employee'
        ? users.find(u => u.id === currentUser.parentUserId)
        : currentUser;
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
        id: invId,
        userId,
        invoiceNumber: invNum,
        date: new Date().toISOString().split('T')[0],
        customerId: selectedCustomer!.id,
        customerName: selectedCustomer!.name,
        customerGst: selectedCustomer!.gstNumber,
        customerAddress: selectedCustomer!.address,
        customerState: buyerState?.name || selectedCustomer?.state || '',
        customerStateCode: buyerStateCode,
        vehicleNumber: vehicle,
        items,
        totalAmount,
        totalGst,
        totalCgst,
        totalSgst,
        totalIgst,
        grandTotal,
        roundOff,
        isInterState,
        placeOfSupply: buyerState?.name || selectedCustomer?.state || sellerState?.name || '',
        status: 'pending',
        paidAmount: 0,
        createdBy: {
          id: currentUser!.id,
          name: currentUser!.role === 'employee'
            ? currentUser!.username
            : currentUser!.firmName || currentUser!.username,
          role: currentUser!.role,
          timestamp: new Date().toISOString(),
        },
      };
      setInvoices(prev => [...prev, invoice]);
      setProducts(prev => prev.map(p => {
        const item = items.find(i => i.productId === p.id);
        return item ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p;
      }));
      setLastCreatedInvoiceId(invId);
      addMsg('bot', `🎉 Invoice ban gayi! Invoice No: ${invNum}\nGrand Total: ₹${grandTotal.toLocaleString('en-IN')}\n\n💰 Payment mila hai?`, [
        '✅ Poora Mila (Full Paid)',
        '🟡 Thoda Mila (Partial)',
        '🔴 Abhi Nahi (Credit/Pending)',
      ]);
      setShowInvoice(true);
      setStep('payment-ask');
    } else {
      handleOptionClick(opt);
    }
  };

  const handlePaymentAsk = (opt: string) => {
    if (opt === '✅ Poora Mila (Full Paid)') {
      addMsg('bot', '💰 Kis tarike se mila?', ['💵 Cash', '📱 UPI', '🏦 Bank Transfer', '🏦 RTGS', '📝 Cheque']);
      setStep('payment-mode');
    } else if (opt === '🟡 Thoda Mila (Partial)') {
      const inv = invoices.find(i => i.id === lastCreatedInvoiceId) || invoices[invoices.length - 1];
      addMsg('bot', `Grand Total: ₹${inv?.grandTotal?.toLocaleString('en-IN') || '0'}\nKitna mila hai (₹)?`);
      setStep('payment-partial-amount');
    } else if (opt === '🔴 Abhi Nahi (Credit/Pending)') {
      // Keep as pending
      addMsg('bot', '✅ Invoice pending / credit mein save ho gayi.', ['🖨️ Print Karein', '📋 Nayi Invoice Banao']);
      setStep('done');
    }
  };

  const handlePaymentMode = (opt: string) => {
    const modeMap: Record<string, Payment['mode']> = {
      '💵 Cash': 'Cash',
      '📱 UPI': 'UPI',
      '🏦 Bank Transfer': 'Bank Transfer',
      '🏦 RTGS': 'RTGS',
      '📝 Cheque': 'Cheque',
    };
    const mode = modeMap[opt] || 'Cash';
    const inv = invoices.find(i => i.id === lastCreatedInvoiceId) || invoices[invoices.length - 1];
    if (inv) {
      const payment: Payment = {
        id: 'pay_' + Date.now(),
        userId,
        customerId: inv.customerId,
        invoiceId: inv.id,
        amount: inv.grandTotal,
        date: new Date().toISOString().split('T')[0],
        mode,
        note: `Full payment for ${inv.invoiceNumber}`,
        timestamp: new Date().toISOString(),
      };
      setPayments(prev => [...prev, payment]);
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: 'paid' as const, paidAmount: inv.grandTotal } : i));
    }
    addMsg('bot', `✅ ₹${inv?.grandTotal?.toLocaleString('en-IN')} ${mode} se receive ho gaya!\nInvoice status: 🟢 Paid`, ['🖨️ Print Karein', '📋 Nayi Invoice Banao']);
    setStep('done');
  };

  const handlePartialPaymentMode = (opt: string) => {
    const modeMap: Record<string, Payment['mode']> = {
      '💵 Cash': 'Cash',
      '📱 UPI': 'UPI',
      '🏦 Bank Transfer': 'Bank Transfer',
      '🏦 RTGS': 'RTGS',
      '📝 Cheque': 'Cheque',
    };
    const mode = modeMap[opt] || 'Cash';
    const partialAmt = (currentItem as any)?.price || 0;
    const inv = invoices.find(i => i.id === lastCreatedInvoiceId) || invoices[invoices.length - 1];
    if (inv) {
      const payment: Payment = {
        id: 'pay_' + Date.now(),
        userId,
        customerId: inv.customerId,
        invoiceId: inv.id,
        amount: partialAmt,
        date: new Date().toISOString().split('T')[0],
        mode,
        note: `Partial payment for ${inv.invoiceNumber}`,
        timestamp: new Date().toISOString(),
      };
      setPayments(prev => [...prev, payment]);
      const newPaid = (inv.paidAmount || 0) + partialAmt;
      const newStatus = newPaid >= inv.grandTotal ? 'paid' as const : 'partial' as const;
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: newStatus, paidAmount: newPaid } : i));
      const remaining = inv.grandTotal - newPaid;
      addMsg('bot', `✅ ₹${partialAmt.toLocaleString('en-IN')} ${mode} se receive ho gaya!\nPaid: ₹${newPaid.toLocaleString('en-IN')} | Baaki: ₹${remaining.toLocaleString('en-IN')}\nInvoice status: ${newStatus === 'paid' ? '🟢 Paid' : '🟡 Partial'}`, ['🖨️ Print Karein', '📋 Nayi Invoice Banao']);
    }
    setCurrentItem({});
    setStep('done');
  };

  const resetChat = () => {
    setMessages([{ from: 'bot', text: '🙏 Namaskar! Naya invoice banayein?\nCustomer naya hai ya purana?', options: ['Purana Customer', 'Naya Customer'] }]);
    setStep('start');
    setSelectedCustomer(null);
    setNewCust({ name: '', phone: '', gstNumber: '', address: '' });
    setVehicle('');
    setItems([]);
    setCurrentItem({});
    setShowInvoice(false);
    setSuggestions([]);
    setEditTarget(null);
    setReturnStep(null);
    setLastCreatedInvoiceId(null);
  };

  const printInvoice = () => {
    const inv = lastCreatedInvoiceId
      ? invoices.find(i => i.id === lastCreatedInvoiceId)
      : invoices[invoices.length - 1];
    if (!inv) return;
    const firm = currentUser?.role === 'employee'
      ? users.find(u => u.id === currentUser.parentUserId)
      : currentUser;
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

  const hasSummaryData = selectedCustomer || vehicle || items.length > 0;
  const showSummary = hasSummaryData && step !== 'start' && step !== 'done';
  const showInput = !['done', 'start', 'confirm-customer', 'more-products', 'preview', 'payment-ask', 'payment-mode', 'payment-partial-mode'].includes(step);

  return (
    <div className="animate-fade-in h-full flex flex-col">
      <h2 className="text-xl font-bold text-foreground mb-4">🤖 Invoice Banao - Chatbot</h2>

      <div className="glass-card flex-1 flex flex-col overflow-hidden">
        {/* Summary Card */}
        {showSummary && (
          <div className="border-b bg-muted/30 p-3 text-sm space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs">📋 Invoice Summary (abhi tak)</span>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={resetChat}>
                <RotateCcw className="w-3 h-3 mr-1" /> Sab clear
              </Button>
            </div>
            {selectedCustomer && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Customer: <span className="text-foreground font-medium">{selectedCustomer.name}</span></span>
                {step !== 'select-customer' && step !== 'confirm-customer' && (
                  <button className="text-xs text-primary hover:underline" onClick={() => {
                    setSelectedCustomer(null);
                    setEditTarget('customer');
                    setReturnStep(step);
                    addMsg('bot', 'Customer ka naam ya number likhein:');
                    setStep('select-customer');
                  }}>✏️ Badlein</button>
                )}
              </div>
            )}
            {vehicle && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gaadi No: <span className="text-foreground font-medium">{vehicle}</span></span>
                <button className="text-xs text-primary hover:underline" onClick={() => {
                  setEditTarget('vehicle');
                  setReturnStep(step);
                  addMsg('bot', 'Naya gaadi number likhein (ya khali Enter = skip):');
                  setStep('vehicle');
                }}>✏️ Badlein</button>
              </div>
            )}
            {items.length > 0 && (
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Products:</span>
                {items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between pl-2">
                    <span className="text-foreground text-xs">
                      • {it.productName} x{it.quantity} = ₹{(it.price * it.quantity).toLocaleString('en-IN')}
                      {it.mrp && it.mrp !== it.price && (
                        <span className="text-destructive ml-1 text-[10px]">
                          (MRP ₹{it.mrp} → ₹{it.price}, {Math.round(((it.mrp - it.price) / it.mrp) * 100)}% off)
                        </span>
                      )}
                    </span>
                    <button className="text-destructive hover:text-destructive/80 text-xs" onClick={() => {
                      setItems(prev => prev.filter((_, idx) => idx !== i));
                      addMsg('bot', `🗑️ ${it.productName} hata diya.`);
                    }}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-line ${msg.from === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
                }`}>
                {msg.text}
                {msg.options && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {msg.options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => {
                          if (opt === '🖨️ Print Karein') { printInvoice(); return; }
                          handleOptionClick(opt);
                        }}
                        className="px-3 py-1.5 bg-card border rounded-lg text-xs font-medium hover:bg-muted transition-colors text-foreground"
                      >
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
              <button
                key={c.id}
                onClick={() => selectCustomer(c)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-between text-sm"
              >
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.phone}{c.gstNumber ? ` • ${c.gstNumber}` : ''}</span>
              </button>
            ))}
            {step === 'add-product' && (suggestions as Product[]).map(p => (
              <button
                key={p.id}
                onClick={() => selectProduct(p)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-between text-sm"
              >
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground">₹{p.price} • Stock: {p.stock}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        {showInput && (
          <div className="border-t p-3 flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder={getPlaceholder()}
              className="flex-1"
            />
            <Button size="sm" onClick={handleSend}><Send className="w-4 h-4" /></Button>
          </div>
        )}

        {step === 'done' && (
          <div className="border-t p-3 flex gap-2">
            {showInvoice && (
              <Button size="sm" variant="outline" onClick={printInvoice}>
                <Printer className="w-4 h-4 mr-1" /> Print Invoice
              </Button>
            )}
            <Button size="sm" onClick={resetChat}>📋 Nayi Invoice Banao</Button>
          </div>
        )}
      </div>
    </div>
  );
}
