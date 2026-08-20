'use client';

import { useEffect, useState } from 'react';
import { money } from './SharedUI';

const brandModels = {
  Apple: ['iPhone 16 Pro Max', 'iPhone 16', 'iPhone 15 Pro Max', 'iPhone 15', 'iPhone 14 Pro', 'iPhone 14', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 12', 'iPhone 11', 'iPhone X / XS', 'iPad', 'MacBook'],
  Samsung: ['Galaxy S25', 'Galaxy S24', 'Galaxy S23', 'Galaxy S22', 'Galaxy S21', 'Galaxy A55', 'Galaxy A35', 'Galaxy A15', 'Galaxy Note', 'Galaxy Tab'],
  Google: ['Pixel 9', 'Pixel 8', 'Pixel 7', 'Pixel 6', 'Pixel Fold'],
  Huawei: ['Pura Series', 'P Series', 'Mate Series', 'Nova Series', 'Y Series'],
  Xiaomi: ['Xiaomi 14', 'Xiaomi 13', 'Redmi Note Series', 'Redmi Series', 'Poco Series'],
  Tecno: ['Camon Series', 'Spark Series', 'Phantom Series', 'Pop Series'],
  Infinix: ['Note Series', 'Hot Series', 'Zero Series', 'Smart Series'],
  Nokia: ['G Series', 'C Series', 'X Series', 'Feature Phone'],
  Other: ['Other / not listed'],
};

const CheckGroup = ({ title, amharic, name, options }) => <fieldset className="intake-check-group">
  <legend>{title} <span>/ {amharic}</span></legend>
  <div className="check-grid">{options.map((option) => <label key={option} className="check-pill"><input type="checkbox" name={name} value={`${title}: ${option}`} /><span>{option}</span></label>)}</div>
</fieldset>;

function normalizeEthiopianPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (/^09\d{8}$/.test(digits)) return `+251${digits.slice(1)}`;
  if (/^2519\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

let deviceKeySeed = 0;
const newDevice = () => ({ key: `device-${++deviceKeySeed}`, brand: 'Apple' });

function DeviceBlock({ device, index, total, onBrandChange, onRemove }) {
  const prefix = `dev${index}_`;
  return <section className="intake-section intake-device-block">
    <div className="intake-device-block-head"><h3>Device {index + 1} of {total} / መሣሪያ {index + 1}</h3>{total > 1 && <button type="button" className="remove-device" onClick={onRemove}>✕ Remove this device</button>}</div>
    <div className="device-type-row">{['Phone', 'Tablet', 'Laptop', 'Other'].map((type) => <label className="check-pill" key={type}><input type="radio" name={`${prefix}deviceType`} value={type} defaultChecked={type === 'Phone'} /><span>{type}</span></label>)}</div>
    <div className="form-grid compact-fields">
      <label>Brand / ብራንድ<select name={`${prefix}brand`} value={device.brand} onChange={(event) => onBrandChange(event.target.value)}>{Object.keys(brandModels).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Model / ሞዴል<select name={`${prefix}device`} key={device.brand} required>{brandModels[device.brand].map((model) => <option key={model}>{model}</option>)}</select></label>
      <label>IMEI / Serial<input name={`${prefix}imei`} placeholder="Scan or type" onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }} required /></label>
      <label>Color / ቀለም<input name={`${prefix}color`} placeholder="Color" /></label>
      <label>Estimated Maintenance Charge (ETB)<input name={`${prefix}estimate`} type="number" min="0" step="0.01" placeholder="0.00" required /></label>
    </div>
    <fieldset className="intake-check-group"><legend>Accessories <span>/ ተጨማሪ እቃዎች</span></legend><div className="check-grid">{['SIM', 'Memory card', 'Tray', 'Charger', 'Case'].map((item) => <label className="check-pill" key={item}><input type="checkbox" name={`${prefix}accessories`} value={item} /><span>{item}</span></label>)}</div></fieldset>
    <div className="condition-grid">
      <CheckGroup title="Power" amharic="ኃይል" name={`${prefix}checks`} options={['On', 'Dead', 'Bootloop', 'Overheating']} />
      <CheckGroup title="Screen" amharic="ስክሪን" name={`${prefix}checks`} options={['OK', 'Cracked', 'No display', 'Touch issue']} />
      <CheckGroup title="Battery" amharic="ባትሪ" name={`${prefix}checks`} options={['OK', 'Not charging', 'Fast drain', 'Loose port']} />
      <CheckGroup title="Network" amharic="ኔትወርክ" name={`${prefix}checks`} options={['OK', 'No signal', 'No SIM', 'Wi-Fi fault']} />
      <CheckGroup title="Camera & audio" amharic="ካሜራ & ድምፅ" name={`${prefix}checks`} options={['Camera fault', 'No sound', 'Mic issue']} />
      <CheckGroup title="Buttons" amharic="ቁልፎች" name={`${prefix}checks`} options={['Power', 'Volume', 'Fingerprint', 'Face ID']} />
      <CheckGroup title="Physical" amharic="አካላዊ" name={`${prefix}physical`} options={['Clean', 'Scratched', 'Bent', 'Water damage']} />
      <CheckGroup title="Software" amharic="ሶፍትዌር" name={`${prefix}checks`} options={['Locked', 'Slow', 'Crashing', 'Needs update']} />
    </div>
    <div className="form-grid"><label className="wide">Issue or notes / ችግር ወይም ማስታወሻ<textarea name={`${prefix}issueNotes`} placeholder="Optional — add only what the checkboxes do not cover" /></label></div>
  </section>;
}

export default function IntakeModal({ customer = null, customers = [], close, submit }) {
  const [devices, setDevices] = useState([newDevice()]);
  const [submitting, setSubmitting] = useState(false);
  const [phoneValue, setPhoneValue] = useState(customer?.phone || '');
  const [showCustomerCard, setShowCustomerCard] = useState(false);
  const setDeviceBrand = (index, brand) => setDevices((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, brand } : row));
  const addDevice = () => setDevices((rows) => [...rows, newDevice()]);
  const removeDevice = (index) => setDevices((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
  const normalizedTypedPhone = !customer ? normalizeEthiopianPhone(phoneValue) : null;
  const matchedCustomer = normalizedTypedPhone ? customers.find((item) => item.phone === normalizedTypedPhone) : null;
  const effectiveCustomer = customer || matchedCustomer;
  const isNewCustomer = !customer && Boolean(normalizedTypedPhone) && !matchedCustomer;
  useEffect(() => setShowCustomerCard(false), [effectiveCustomer?.id]);
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const succeeded = await submit(event, devices.length);
    if (!succeeded) setSubmitting(false);
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !submitting && close()}>
    <form className="modal intake-modal card" onSubmit={handleSubmit}>
      <div className="modal-head"><div><p>REPAIR INTAKE / የጥገና መቀበያ</p><h2>{customer ? `New intake for ${customer.name}` : 'Quick device check-in'}</h2><small>{customer ? 'This repair will be added to the existing customer profile.' : 'Check what applies — type only the essentials.'}{devices.length > 1 ? ` Registering ${devices.length} devices for one customer.` : ''}</small></div><button type="button" onClick={close} disabled={submitting}>×</button></div>
      <div className="intake-scroll">
        <section className="intake-section"><h3>Customer / ደንበኛ</h3><div className="form-grid">
          {effectiveCustomer && <div className="existing-customer-banner clickable wide" role="button" tabIndex={0} onClick={() => setShowCustomerCard((open) => !open)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setShowCustomerCard((open) => !open); } }}><div><strong>Existing customer found</strong><span>This intake will stay linked to {effectiveCustomer.name}&apos;s repair history. {showCustomerCard ? 'Hide details ▲' : 'View details ▼'}</span></div><span className={`credit-badge ${effectiveCustomer.isCreditCustomer ? 'enabled' : ''}`}>{effectiveCustomer.isCreditCustomer ? 'Credit customer' : 'Regular customer'}</span></div>}
          {effectiveCustomer && showCustomerCard && <div className="intake-customer-card wide">
            <div className="intake-customer-card-head"><span className="avatar large">{effectiveCustomer.avatar}</span><div><h3>{effectiveCustomer.name}</h3><p>{effectiveCustomer.phone}</p></div></div>
            <div className="intake-customer-card-stats"><div><small>Repairs on file</small><strong>{effectiveCustomer.repairCount ?? 0}</strong></div><div><small>Balance due</small><strong>{money(effectiveCustomer.accountsReceivable)}</strong></div><div><small>Customer since</small><strong>{effectiveCustomer.createdAt ? new Date(effectiveCustomer.createdAt).toLocaleDateString() : '—'}</strong></div></div>
            {effectiveCustomer.invoices?.length > 0 ? <div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Item</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead><tbody>{effectiveCustomer.invoices.slice(0, 5).map((invoice) => <tr key={invoice.recordId}><td><strong>{invoice.id}</strong></td><td>{invoice.item}</td><td>{money(invoice.invoiceTotal)}</td><td>{money(invoice.balanceDue)}</td><td>{invoice.status}</td></tr>)}</tbody></table></div> : <p className="empty">No invoices on file yet.</p>}
          </div>}
          {isNewCustomer && <div className="new-customer-banner wide"><div><strong>New customer</strong><span>No account found for this number — enter their name below to create one.</span></div></div>}
          <label>Phone / ስልክ<input name="phone" type="tel" placeholder="0912345678 or +251912345678" autoComplete="tel" pattern="(?:09\d{8}|\+2519\d{8})" title="Use 09XXXXXXXX or +2519XXXXXXXX" value={phoneValue} onChange={(event) => setPhoneValue(event.target.value)} readOnly={Boolean(customer)} required /></label>
          <label>Name / ስም<input name="customer" placeholder="Full name" autoComplete="name" defaultValue={effectiveCustomer?.name || ''} key={effectiveCustomer?.id || 'blank'} readOnly={Boolean(effectiveCustomer)} required /></label>
          {effectiveCustomer ? <><input type="hidden" name="customerId" value={effectiveCustomer.id} /><input type="hidden" name="isCreditCustomer" value={String(Boolean(effectiveCustomer.isCreditCustomer))} /></> : <label>Credit Customer (new customer)<select name="isCreditCustomer" defaultValue="false"><option value="false">No</option><option value="true">Yes</option></select></label>}
        </div></section>
        {devices.map((device, index) => <DeviceBlock key={device.key} device={device} index={index} total={devices.length} onBrandChange={(brand) => setDeviceBrand(index, brand)} onRemove={() => removeDevice(index)} />)}
        <button type="button" className="outline add-part add-device" onClick={addDevice}>＋ Add another device (customer brought in more than one phone)</button>
      </div>
      <div className="modal-actions"><button type="button" className="outline" onClick={close} disabled={submitting}>Cancel</button><button className="primary" type="submit" disabled={submitting}>{submitting ? 'Creating ticket…' : devices.length > 1 ? `Create ticket for ${devices.length} devices` : 'Create ticket & receipt'}</button></div>
    </form>
  </div>;
}
