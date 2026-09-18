'use client';

import { useState } from 'react';

export default function ReceiveStockModal({ inventory, receiveStock, close }) {
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [buyingPrice, setBuyingPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = inventory.find((part) => part.sku.toUpperCase() === sku.trim().toUpperCase());

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const saved = await receiveStock({ sku, quantity: Number(quantity), buyingPrice });
    setSaving(false);
    if (saved) close();
  };

  return <div className="modal-backdrop"><form className="modal card inventory-modal" onSubmit={submit}>
    <div className="modal-head"><div><p>STOCK CONTROL</p><h2>Receive stock</h2><small>Enter the buying cost for this delivery.</small></div><button type="button" onClick={close} disabled={saving} aria-label="Close">×</button></div>
    <div className="form-grid"><label className="wide">SKU<input value={sku} onChange={(event) => setSku(event.target.value)} list="stock-skus" placeholder="Scan or type existing SKU" required autoFocus /><datalist id="stock-skus">{inventory.map((part) => <option value={part.sku} key={part.id}>{part.name}</option>)}</datalist></label>{selected && <div className="wide notice">{selected.name} · {selected.stock} currently in stock</div>}<label>Quantity received<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label><label>Buying cost per item (ETB)<input type="number" min="0" step="0.01" value={buyingPrice} onChange={(event) => setBuyingPrice(event.target.value)} placeholder="Enter this delivery's cost" required /></label></div>
    <div className="modal-actions"><button type="button" className="outline" onClick={close} disabled={saving}>Cancel</button><button className="primary" disabled={saving || !selected}>{saving ? 'Saving…' : 'Receive stock'}</button></div>
  </form></div>;
}
