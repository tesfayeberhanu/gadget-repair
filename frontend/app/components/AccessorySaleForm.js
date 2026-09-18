'use client';

import { useState } from 'react';
import { money } from './SharedUI';
import '../accessory-sales.css';

const accessoryCategories = new Set(['Accessory', 'Cable']);

export default function AccessorySaleForm({ inventory, onSale, close }) {
  const [sku, setSku] = useState('');
  const [lines, setLines] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [requestKey] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const accessories = inventory.filter((part) => accessoryCategories.has(part.category));
  const total = lines.reduce((sum, line) => sum + Math.round(Number(line.unitPrice || 0) * 100) * Number(line.quantity || 0), 0) / 100;

  const addSku = () => {
    const normalized = sku.trim().toUpperCase();
    const part = accessories.find((item) => item.sku.toUpperCase() === normalized);
    if (!part) return setError('No accessory matches this SKU.');
    if (part.stock < 1) return setError(`${part.name} is out of stock.`);
    if (lines.some((line) => line.sku === part.sku)) return setError('This SKU is already in the sale.');
    if (lines.length >= 30) return setError('A sale can contain up to 30 accessories.');
    setLines((current) => [...current, { sku: part.sku, name: part.name, stock: part.stock, quantity: 1, unitPrice: '' }]);
    setSku('');
    setError('');
  };

  const changeLine = (skuValue, field, value) => setLines((current) => current.map((line) => line.sku === skuValue ? { ...line, [field]: value } : line));
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!lines.length) return setError('Add at least one accessory by SKU.');
    if (lines.some((line) => !line.unitPrice || Number(line.unitPrice) <= 0 || Number(line.quantity) > line.stock)) return setError('Enter a selling price and available quantity for every accessory.');
    setSaving(true);
    setError('');
    const saved = await onSale({
      items: lines.map(({ sku: itemSku, quantity, unitPrice }) => ({ sku: itemSku, quantity: Number(quantity), unitPrice })),
      paymentMethod,
      idempotencyKey: requestKey,
    });
    setSaving(false);
    if (saved) close();
  };

  return <div className="modal-backdrop"><form className="modal card accessory-sale-modal" onSubmit={submit}>
    <div className="modal-head"><div><p>POINT OF SALE</p><h2>Sell accessories</h2><small>Scan or enter each SKU, then enter its selling price.</small></div><button type="button" onClick={close} disabled={saving} aria-label="Close">×</button></div>
    <div className="accessory-sku-entry"><label>Accessory SKU<input value={sku} onChange={(event) => setSku(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSku(); } }} list="accessory-skus" placeholder="Scan or type SKU" autoFocus /></label><datalist id="accessory-skus">{accessories.filter((part) => part.stock > 0).map((part) => <option value={part.sku} key={part.id}>{part.name}</option>)}</datalist><button type="button" className="outline" onClick={addSku}>Add SKU</button></div>
    {lines.length > 0 && <div className="accessory-cart"><div className="accessory-cart-head"><span>Accessory</span><span>Qty</span><span>Selling price</span><span></span></div>{lines.map((line) => <div className="accessory-cart-line" key={line.sku}><div><strong>{line.name}</strong><small>{line.sku} · {line.stock} in stock</small></div><input type="number" min="1" max={line.stock} step="1" aria-label={`Quantity for ${line.name}`} value={line.quantity} onChange={(event) => changeLine(line.sku, 'quantity', event.target.value)} required /><input type="number" min="0.01" step="0.01" aria-label={`Selling price for ${line.name} in ETB`} placeholder="ETB" value={line.unitPrice} onChange={(event) => changeLine(line.sku, 'unitPrice', event.target.value)} required /><button type="button" onClick={() => setLines((current) => current.filter((item) => item.sku !== line.sku))} aria-label={`Remove ${line.name}`}>×</button></div>)}</div>}
    <div className="accessory-sale-bottom"><label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="CASH">Cash</option><option value="CARD">Card</option><option value="DIGITAL_TRANSFER">Transfer</option></select></label><div><small>Customer total</small><strong>{money(total)}</strong></div></div>
    {error && <p className="accessory-sale-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="outline" onClick={close} disabled={saving}>Cancel</button><button className="primary" disabled={saving || lines.length === 0}>{saving ? 'Saving…' : `Complete sale · ${money(total)}`}</button></div>
  </form></div>;
}
