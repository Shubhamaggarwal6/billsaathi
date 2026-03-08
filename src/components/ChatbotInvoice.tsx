import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { numberToWords } from '@/lib/subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Printer } from 'lucide-react';
import type { Customer, Product, InvoiceItem } from '@/lib/types';

type Step = 'start' | 'select-customer' | 'new-customer' | 'vehicle' | 'add-product' | 'new-product' | 'more-products' | 'preview' | 'done';

interface Message {
  from: 'bot' | 'user';
  text: string;
  options?: string[];
}

export default function ChatbotInvoice() {
  const { currentUser, customers, products, invoices, setCustomers, setProducts, setInvoices } = useApp();
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
  const [suggestions, setSuggestions] = useState<(Customer | Product)[]>([]);
  const [showInvoice, setShowInvoice] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const userId = currentUser?.role === 'employee' ? currentUser.parentUserId! : currentUser?.id!;
  const myCustomers = customers.filter(c => c.userId === userId);
  const myProducts = products.filter(p => p.userId === userId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMsg = (from: 'bot' | 'user', text: string, options?: string[]) => {
    setMessages(prev => [...prev, { from, text, options }]);
  };

  const handleOption = (opt: string) => {
    addMsg('user', opt);
    if (step === 'start') {
      if (opt === 'Purana Customer') {
        addMsg('bot', 'Customer ka naam type karein (initials bhi chalenge):');
        setStep('select-customer');
      } else {
        addMsg('bot', 'Naye customer ka naam batayein:');
        setStep('new-customer');
      }
    } else if (step === 'more-products') {
      if (opt === 'Haan') {
        addMsg('bot', 'Product ka naam type karein:');
        setStep('add-product');
      } else {
        showPreview();
      }
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    addMsg('user', text);

    switch (step) {
      case 'select-customer': {
        const matches = myCustomers.filter(c => c.name.toLowerCase().includes(text.toLowerCase()));
        if (matches.length === 1) {
          setSelectedCustomer(matches[0]);
          addMsg('bot', `✅ ${matches[0].name} select hua! GST: ${matches[0].gstNumber || 'N/A'}\nGaadi number? (skip karne ke liye Enter dabayein)`);
          setStep('vehicle');
        } else if (matches.length > 1) {
          addMsg('bot', 'Ye customers mile:', matches.map(c => c.name));
        } else {
          addMsg('bot', 'Koi customer nahi mila. Phir se try karein ya "Naya" likhen.');
        }
        break;
      }
      case 'new-customer': {
        if (!newCust.name) {
          setNewCust(prev => ({ ...prev, name: text }));
          addMsg('bot', 'Phone number?');
        } else if (!newCust.phone) {
          setNewCust(prev => ({ ...prev, phone: text }));
          addMsg('bot', 'GST Number? (optional, skip ke liye Enter)');
        } else if (!newCust.address) {
          if (!newCust.gstNumber && newCust.gstNumber !== '_skip') {
            setNewCust(prev => ({ ...prev, gstNumber: text === '' ? '' : text }));
            addMsg('bot', 'Address?');
          } else {
            setNewCust(prev => ({ ...prev, address: text }));
            const custId = 'c_' + Date.now();
            const cust: Customer = { id: custId, userId, name: newCust.name, phone: newCust.phone, gstNumber: newCust.gstNumber === '_skip' ? '' : newCust.gstNumber, address: text };
            setCustomers(prev => [...prev, cust]);
            setSelectedCustomer(cust);
            addMsg('bot', `✅ Customer "${newCust.name}" save ho gaya!\nGaadi number? (skip ke liye Enter)`);
            setStep('vehicle');
          }
        }
        break;
      }
      case 'vehicle': {
        setVehicle(text);
        addMsg('bot', 'Product ka naam type karein:');
        setStep('add-product');
        break;
      }
      case 'add-product': {
        if (!currentItem.productName) {
          const matches = myProducts.filter(p => p.name.toLowerCase().includes(text.toLowerCase()));
          if (matches.length === 1) {
            const p = matches[0];
            setCurrentItem({ productId: p.id, productName: p.name, hsn: p.hsn, price: p.price, gstPercent: p.gstPercent, unit: p.unit });
            addMsg('bot', `✅ ${p.name} - ₹${p.price}/${p.unit}\nKitni quantity?`);
          } else if (matches.length > 1) {
            addMsg('bot', 'Ye products mile:', matches.map(p => `${p.name} (₹${p.price})`));
          } else {
            addMsg('bot', 'Product nahi mila. Naya product add karein?', ['Haan', 'Nahi']);
            setStep('new-product');
          }
        } else if (!currentItem.quantity) {
          const qty = Number(text);
          if (isNaN(qty) || qty <= 0) { addMsg('bot', 'Sahi quantity daalein!'); return; }
          const item: InvoiceItem = { ...currentItem as InvoiceItem, quantity: qty };
          setItems(prev => [...prev, item]);
          setCurrentItem({});
          addMsg('bot', `✅ ${item.productName} x ${qty} add ho gaya!\nAur product add karein?`, ['Haan', 'Nahi']);
          setStep('more-products');
        }
        break;
      }
      case 'new-product': {
        // handled by options
        break;
      }
    }
  };

  const handleCustomerSelect = (name: string) => {
    const cust = myCustomers.find(c => c.name === name);
    if (cust) {
      setSelectedCustomer(cust);
      addMsg('user', name);
      addMsg('bot', `✅ ${cust.name} select hua! GST: ${cust.gstNumber || 'N/A'}\nGaadi number? (skip ke liye Enter)`);
      setStep('vehicle');
    }
  };

  const handleProductSelect = (name: string) => {
    const pName = name.split(' (₹')[0];
    const p = myProducts.find(pr => pr.name === pName);
    if (p) {
      setCurrentItem({ productId: p.id, productName: p.name, hsn: p.hsn, price: p.price, gstPercent: p.gstPercent, unit: p.unit });
      addMsg('user', name);
      addMsg('bot', `✅ ${p.name} - ₹${p.price}/${p.unit}\nKitni quantity?`);
    }
  };

  const showPreview = () => {
    setStep('preview');
    const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalGst = items.reduce((s, i) => s + (i.price * i.quantity * i.gstPercent) / 100, 0);
    addMsg('bot', `📋 Invoice Preview:\nCustomer: ${selectedCustomer?.name}\nItems: ${items.length}\nTotal: ₹${totalAmount.toLocaleString('en-IN')}\nGST: ₹${totalGst.toLocaleString('en-IN')}\nGrand Total: ₹${(totalAmount + totalGst).toLocaleString('en-IN')}\n\nConfirm karein?`, ['Confirm & Save', 'Cancel']);
  };

  const handleConfirm = (opt: string) => {
    addMsg('user', opt);
    if (opt === 'Confirm & Save') {
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
      // Update stock
      setProducts(prev => prev.map(p => {
        const item = items.find(i => i.productId === p.id);
        return item ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p;
      }));
      addMsg('bot', `🎉 Invoice ${invNum} save ho gaya! Grand Total: ₹${(totalAmount + totalGst).toLocaleString('en-IN')}`);
      setShowInvoice(true);
      setStep('done');
    } else {
      addMsg('bot', 'Invoice cancel ho gaya. Naya banayein?', ['Haan', 'Nahi']);
      setStep('done');
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
  };

  // Print invoice
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
            return `<tr><td>${i+1}</td><td>${item.productName}</td><td>${item.hsn}</td><td>${item.quantity} ${item.unit}</td><td>₹${item.price}</td><td>₹${amt}</td><td>${item.gstPercent}%</td><td>₹${gst.toFixed(2)}</td><td>₹${(amt+gst).toFixed(2)}</td></tr>`;
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

  

  return (
    <div className="animate-fade-in h-full flex flex-col">
      <h2 className="text-xl font-bold text-foreground mb-4">🤖 Invoice Banao - Chatbot</h2>
      <div className="glass-card flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-line ${
                msg.from === 'user'
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
                          if (step === 'start' || step === 'more-products') handleOption(opt);
                          else if (step === 'select-customer') handleCustomerSelect(opt);
                          else if (step === 'add-product') handleProductSelect(opt);
                          else if (step === 'preview') handleConfirm(opt);
                          else if (step === 'done') { if (opt === 'Haan') resetChat(); }
                          else if (step === 'new-product') {
                            if (opt === 'Haan') {
                              addMsg('user', 'Haan');
                              addMsg('bot', 'Naye product ka naam?');
                            } else {
                              addMsg('user', 'Nahi');
                              addMsg('bot', 'Product ka naam phir se type karein:');
                              setStep('add-product');
                            }
                          }
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

        {step !== 'done' && (
          <div className="border-t p-3 flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Type karein..."
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
            <Button size="sm" onClick={resetChat}>Naya Invoice Banao</Button>
          </div>
        )}
      </div>
    </div>
  );
}
