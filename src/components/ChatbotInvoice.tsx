import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { numberToWords } from '@/lib/subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Printer, Pencil, Trash2, RotateCcw, Home } from 'lucide-react';
import type { Customer, Product, InvoiceItem } from '@/lib/types';

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
  | 'product-quantity'
  | 'new-product-name'
  | 'new-product-hsn'
  | 'new-product-price'
  | 'new-product-gst'
  | 'new-product-unit'
  | 'more-products'
  | 'preview'
  | 'done';

interface Message {
  from: 'bot' | 'user';
  text: string;
  options?: string[];
}

export default function ChatbotInvoice() {
  const { currentUser, users, customers, products, invoices, setCustomers, setProducts, setInvoices } = useApp();
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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editTarget, setEditTarget] = useState<string | null>(null); // 'customer' | 'vehicle' | null
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

  // Live suggestions on input change
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
    setCurrentItem({ productId: p.id, productName: p.name, hsn: p.hsn, price: p.price, gstPercent: p.gstPercent, unit: p.unit });
    setSuggestions([]);
    setInput('');
    addMsg('user', p.name);
    addMsg('bot', `${p.name} — ₹${p.price}/${p.unit} (Stock: ${p.stock})\nKitni quantity?`);
    setStep('product-quantity');
  };

  const handleSend = () => {
    const text = input.trim();
    // Allow empty for skippable fields
    const skippableSteps: Step[] = ['vehicle', 'new-customer-gst', 'new-customer-address', 'new-product-hsn'];
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
        addMsg('bot', 'Kaun sa product chahiye? Naam likhein:');
        setStep('add-product');
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
        addMsg('bot', 'Price (₹)?');
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
        setCurrentItem({ productId: prod.id, productName: prod.name, hsn: prod.hsn, price: prod.price, gstPercent: prod.gstPercent, unit: prod.unit });
        setNewProd({ name: '', hsn: '', price: 0, gstPercent: 18, unit: 'Piece' });
        addMsg('bot', `✅ Product "${prod.name}" save ho gaya! ₹${prod.price}/${prod.unit}\nKitni quantity?`);
        setStep('product-quantity');
        break;
      }
    }
  };

  const handleOptionClick = (opt: string) => {
    addMsg('user', opt);
    // Handle various option clicks contextually
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
    // "Naya Customer" from no-match
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
    // Customer selection from multiple matches
    if (step === 'select-customer') {
      const name = opt.split(' (')[0];
      const cust = myCustomers.find(c => c.name === name);
      if (cust) selectCustomer(cust);
      return;
    }
    // Product selection from multiple matches
    if (step === 'add-product') {
      const pName = opt.split(' (₹')[0];
      const p = myProducts.find(pr => pr.name === pName);
      if (p) selectProduct(p);
      return;
    }
    // New product flow
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
    // Preview edit
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
    const itemList = items.map((it, i) => `${i + 1}. ${it.productName} x${it.quantity} = ₹${(it.price * it.quantity).toLocaleString('en-IN')} (+${it.gstPercent}% GST)`).join('\n');
    addMsg('bot',
      `📋 Invoice Preview:\n\nCustomer: ${selectedCustomer?.name || 'N/A'}${vehicle ? `\nGaadi No: ${vehicle}` : ''}\n\n${itemList}\n\nSubtotal: ₹${totalAmount.toLocaleString('en-IN')}\nGST: ₹${totalGst.toLocaleString('en-IN')}\n━━━━━━━━━━━━━━━━━\nGrand Total: ₹${grandTotal.toLocaleString('en-IN')}\n(${numberToWords(Math.round(grandTotal))} Rupees Only)`,
      ['✅ Invoice Banao', '✏️ Kuch Badlein', '🗑️ Sab Cancel']
    );
  };

  // After editing, if returnStep was preview, go back to preview
  useEffect(() => {
    if (editTarget === 'customer' && selectedCustomer && step === 'vehicle' && returnStep === 'preview') {
      // Customer was re-selected, skip vehicle and show preview
      setStep('preview');
      setEditTarget(null);
      setReturnStep(null);
      setTimeout(() => showPreview(), 0);
    }
  }, [selectedCustomer, step, editTarget, returnStep]);

  // Override vehicle step on edit to go back to preview
  const originalVehicleStep = step === 'vehicle' && editTarget === 'vehicle' && returnStep === 'preview';

  const handleConfirm = (opt: string) => {
    if (opt === '✅ Invoice Banao') {
      if (items.length === 0) {
        addMsg('bot', 'Pehle koi product add karein!');
        return;
      }
      const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);
      const totalGst = items.reduce((s, i) => s + (i.price * i.quantity * i.gstPercent) / 100, 0);
      const invNum = `INV-${Date.now().toString().slice(-6)}`;
      const invoice = {
        id: 'inv_' + Date.now(),
        userId,
        invoiceNumber: invNum,
        date: new Date().toISOString().split('T')[0],
        customerId: selectedCustomer!.id,
        customerName: selectedCustomer!.name,
        customerGst: selectedCustomer!.gstNumber,
        customerAddress: selectedCustomer!.address,
        vehicleNumber: vehicle,
        items,
        totalAmount,
        totalGst,
        grandTotal: totalAmount + totalGst,
        status: 'pending' as const,
        createdBy: currentUser!.username,
      };
      setInvoices(prev => [...prev, invoice]);
      setProducts(prev => prev.map(p => {
        const item = items.find(i => i.productId === p.id);
        return item ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p;
      }));
      addMsg('bot', `🎉 Invoice ban gayi! Invoice no: ${invNum}\nGrand Total: ₹${(totalAmount + totalGst).toLocaleString('en-IN')}`, ['🖨️ Print Karein', '📋 Nayi Invoice Banao']);
      setShowInvoice(true);
      setStep('done');
    } else {
      handleOptionClick(opt);
    }
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
  };

  const printInvoice = () => {
    const inv = invoices[invoices.length - 1];
    if (!inv) return;
    const firm = currentUser?.role === 'employee'
      ? users.find(u => u.id === currentUser.parentUserId)
      : currentUser;

    const printContent = `
      <html><head><title>Invoice ${inv.invoiceNumber}</title>
      <style>body{font-family:Arial;padding:20px;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:6px;text-align:left}th{background:#1a237e;color:white}.header{text-align:center;margin-bottom:20px}.total{font-weight:bold;font-size:14px}</style></head>
      <body>
        <div class="header">
          <h2>${firm?.firmName || ''}</h2>
          <p>GST: ${firm?.gstNumber || 'N/A'}</p>
        </div>
        <p><strong>Invoice:</strong> ${inv.invoiceNumber} | <strong>Date:</strong> ${inv.date}</p>
        <p><strong>Customer:</strong> ${inv.customerName} | <strong>GST:</strong> ${inv.customerGst || 'N/A'}</p>
        <p><strong>Address:</strong> ${inv.customerAddress}</p>
        ${inv.vehicleNumber ? `<p><strong>Vehicle:</strong> ${inv.vehicleNumber}</p>` : ''}
        <table>
          <tr><th>#</th><th>Product</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th><th>GST%</th><th>GST Amt</th><th>Total</th></tr>
          ${inv.items.map((item, i) => {
      const amt = item.price * item.quantity;
      const gst = amt * item.gstPercent / 100;
      return `<tr><td>${i + 1}</td><td>${item.productName}</td><td>${item.hsn}</td><td>${item.quantity} ${item.unit}</td><td>₹${item.price}</td><td>₹${amt}</td><td>${item.gstPercent}%</td><td>₹${gst.toFixed(2)}</td><td>₹${(amt + gst).toFixed(2)}</td></tr>`;
    }).join('')}
        </table>
        <p style="margin-top:10px"><strong>Total:</strong> ₹${inv.totalAmount.toLocaleString('en-IN')} | <strong>GST:</strong> ₹${inv.totalGst.toLocaleString('en-IN')}</p>
        <p class="total">Grand Total: ₹${inv.grandTotal.toLocaleString('en-IN')}</p>
        <p><em>Amount in words: ${numberToWords(Math.round(inv.grandTotal))} Rupees Only</em></p>
      </body></html>
    `;
    const w = window.open('', '_blank');
    if (w) { w.document.write(printContent); w.document.close(); w.print(); }
  };

  // Get placeholder based on step
  const getPlaceholder = (): string => {
    switch (step) {
      case 'select-customer': return 'Customer ka naam, phone ya GST likhein...';
      case 'new-customer-name': return 'Customer ka naam likhein...';
      case 'new-customer-phone': return 'Phone number likhein...';
      case 'new-customer-gst': return 'GST likhein ya khali Enter dabao skip karne ke liye';
      case 'new-customer-address': return 'Address likhein ya khali Enter dabao skip karne ke liye';
      case 'vehicle': return 'Jaise DL01AB1234, ya Enter dabao skip karne ke liye';
      case 'add-product': return 'Product ka naam ya HSN likhein...';
      case 'product-quantity': return 'Quantity likhein...';
      case 'new-product-name': return 'Product ka naam...';
      case 'new-product-hsn': return 'HSN code ya khali Enter = skip';
      case 'new-product-price': return 'Price ₹...';
      case 'new-product-gst': return 'GST % (default 18)';
      case 'new-product-unit': return 'Unit (Piece/Kg/Box...)';
      default: return 'Type karein...';
    }
  };

  // Summary card data
  const hasSummaryData = selectedCustomer || vehicle || items.length > 0;
  const showSummary = hasSummaryData && step !== 'start' && step !== 'done';

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
                    <span className="text-foreground text-xs">• {it.productName} x{it.quantity} = ₹{(it.price * it.quantity).toLocaleString('en-IN')}</span>
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
        {step !== 'done' && step !== 'start' && step !== 'confirm-customer' && step !== 'more-products' && step !== 'preview' && (
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
