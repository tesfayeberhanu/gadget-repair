'use client';

import { useEffect, useState } from 'react';
import { money } from './SharedUI';

const brandModels = {
  Samsung: ['Galaxy S', 'Galaxy S2', 'Galaxy S3', 'Galaxy S4', 'Galaxy S5', 'Galaxy S6', 'Galaxy S6 Edge', 'Galaxy S7', 'Galaxy S7 Edge', 'Galaxy S8', 'Galaxy S8+', 'Galaxy S9', 'Galaxy S9+', 'Galaxy S10', 'Galaxy S10+', 'Galaxy S10e', 'Galaxy S20', 'Galaxy S20+', 'Galaxy S20 Ultra', 'Galaxy S21', 'Galaxy S21+', 'Galaxy S21 Ultra', 'Galaxy S22', 'Galaxy S22+', 'Galaxy S22 Ultra', 'Galaxy S23', 'Galaxy S23+', 'Galaxy S23 Ultra', 'Galaxy S24', 'Galaxy S24+', 'Galaxy S24 Ultra', 'Galaxy S25', 'Galaxy S25+', 'Galaxy S25 Ultra', 'Galaxy Note', 'Galaxy Note 2', 'Galaxy Note 3', 'Galaxy Note 4', 'Galaxy Note 5', 'Galaxy Note 8', 'Galaxy Note 9', 'Galaxy Note 10', 'Galaxy Note 10+', 'Galaxy Note 20', 'Galaxy Note 20 Ultra', 'Galaxy A10', 'Galaxy A10s', 'Galaxy A20', 'Galaxy A20s', 'Galaxy A21', 'Galaxy A21s', 'Galaxy A30', 'Galaxy A30s', 'Galaxy A31', 'Galaxy A32', 'Galaxy A33', 'Galaxy A34', 'Galaxy A35', 'Galaxy A50', 'Galaxy A50s', 'Galaxy A51', 'Galaxy A52', 'Galaxy A52s', 'Galaxy A53', 'Galaxy A54', 'Galaxy A55', 'Galaxy A70', 'Galaxy A70s', 'Galaxy A71', 'Galaxy A72', 'Galaxy A73', 'Galaxy A80', 'Galaxy A90', 'Galaxy A04', 'Galaxy A04s', 'Galaxy A05', 'Galaxy A05s', 'Galaxy A14', 'Galaxy A15', 'Galaxy A16', 'Galaxy A24', 'Galaxy A25', 'Galaxy A26', 'Galaxy A52 5G', 'Galaxy A53 5G', 'Galaxy A54 5G', 'Galaxy A55 5G', 'Galaxy M10', 'Galaxy M11', 'Galaxy M12', 'Galaxy M13', 'Galaxy M14', 'Galaxy M20', 'Galaxy M21', 'Galaxy M22', 'Galaxy M23', 'Galaxy M30', 'Galaxy M31', 'Galaxy M32', 'Galaxy M33', 'Galaxy M34', 'Galaxy M51', 'Galaxy M52', 'Galaxy M53', 'Galaxy M54', 'Galaxy M55', 'Galaxy Z Fold', 'Galaxy Z Fold2', 'Galaxy Z Fold3', 'Galaxy Z Fold4', 'Galaxy Z Fold5', 'Galaxy Z Fold6', 'Galaxy Z Flip', 'Galaxy Z Flip3', 'Galaxy Z Flip4', 'Galaxy Z Flip5', 'Galaxy Z Flip6'],
  Apple: ['iPhone', 'iPhone 3G', 'iPhone 3GS', 'iPhone 4', 'iPhone 4S', 'iPhone 5', 'iPhone 5c', 'iPhone 5s', 'iPhone 6', 'iPhone 6 Plus', 'iPhone 6s', 'iPhone 6s Plus', 'iPhone SE', 'iPhone 7', 'iPhone 7 Plus', 'iPhone 8', 'iPhone 8 Plus', 'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max', 'iPhone 11', 'iPhone 11 Pro', 'iPhone 11 Pro Max', 'iPhone SE 2', 'iPhone 12', 'iPhone 12 mini', 'iPhone 12 Pro', 'iPhone 12 Pro Max', 'iPhone 13', 'iPhone 13 mini', 'iPhone 13 Pro', 'iPhone 13 Pro Max', 'iPhone SE 3', 'iPhone 14', 'iPhone 14 Plus', 'iPhone 14 Pro', 'iPhone 14 Pro Max', 'iPhone 15', 'iPhone 15 Plus', 'iPhone 15 Pro', 'iPhone 15 Pro Max', 'iPhone 16', 'iPhone 16 Plus', 'iPhone 16 Pro', 'iPhone 16 Pro Max', 'iPhone 16e', 'iPhone 17', 'iPhone 17 Air', 'iPhone 17 Pro', 'iPhone 17 Pro Max'],
  Huawei: ['Ascend P6', 'Ascend P7', 'P8', 'P9', 'P9 Lite', 'P10', 'P10 Lite', 'P20', 'P20 Lite', 'P20 Pro', 'P30', 'P30 Lite', 'P30 Pro', 'P40', 'P40 Lite', 'P40 Pro', 'P40 Pro+', 'Mate 8', 'Mate 9', 'Mate 10', 'Mate 10 Lite', 'Mate 10 Pro', 'Mate 20', 'Mate 20 Lite', 'Mate 20 Pro', 'Mate 20 X', 'Mate 30', 'Mate 30 Pro', 'Mate 40', 'Mate 40 Pro', 'Nova', 'Nova 2', 'Nova 3', 'Nova 3i', 'Nova 4', 'Nova 5', 'Nova 5T', 'Nova 7', 'Nova 7i', 'Nova 8', 'Nova 9', 'Nova 10', 'Nova 11', 'Nova 12'],
  HONOR: ['Honor 8', 'Honor 9', 'Honor 10', 'Honor 20', 'Honor 20 Pro', 'Honor 50', 'Honor 50 Lite', 'Honor 70', 'Honor 90', 'Honor 200', 'Magic', 'Magic2', 'Magic3', 'Magic4', 'Magic5', 'Magic6', 'Magic7', 'X5', 'X6', 'X7', 'X8', 'X9', 'X9a', 'X9b', 'X9c', 'Play', 'Play 4', 'Play 5', 'Play 6', 'Play 7', 'Play 8', 'Play 9'],
  Xiaomi: ['Mi 1', 'Mi 2', 'Mi 2S', 'Mi 3', 'Mi 4', 'Mi 4i', 'Mi 5', 'Mi 5s', 'Mi 6', 'Mi 8', 'Mi 9', 'Mi 10', 'Mi 10 Pro', 'Mi 11', 'Mi 11 Lite', 'Mi 11 Ultra', '12', '12 Lite', '12 Pro', '12T', '12T Pro', '13', '13 Lite', '13 Pro', '13 Ultra', '14', '14 Pro', '14 Ultra', '15', '15 Pro', 'Redmi 1', 'Redmi 2', 'Redmi 3', 'Redmi 4', 'Redmi 5', 'Redmi 6', 'Redmi 7', 'Redmi 8', 'Redmi 9', 'Redmi 10', 'Redmi 12', 'Redmi 13', 'Redmi Note 3', 'Redmi Note 4', 'Redmi Note 5', 'Redmi Note 6 Pro', 'Redmi Note 7', 'Redmi Note 8', 'Redmi Note 9', 'Redmi Note 10', 'Redmi Note 11', 'Redmi Note 12', 'Redmi Note 13', 'Redmi Note 14', 'Redmi Note 15', 'POCO F1', 'POCO F2 Pro', 'POCO F3', 'POCO F4', 'POCO F5', 'POCO F6', 'POCO X2', 'POCO X3', 'POCO X3 Pro', 'POCO X4 Pro', 'POCO X5', 'POCO X5 Pro', 'POCO X6', 'POCO X6 Pro', 'POCO X7'],
  Tecno: ['Phantom 6', 'Phantom 8', 'Phantom 9', 'Phantom X', 'Phantom X2', 'Phantom V Fold', 'Camon 11', 'Camon 12', 'Camon 15', 'Camon 16', 'Camon 17', 'Camon 18', 'Camon 19', 'Camon 20', 'Camon 20 Pro', 'Camon 21', 'Camon 30', 'Camon 40', 'Spark', 'Spark 5', 'Spark 6', 'Spark 7', 'Spark 8', 'Spark 9', 'Spark 10', 'Spark 10 Pro', 'Spark 20', 'Spark 20 Pro', 'Spark 20 Pro+', 'Spark 30', 'Spark 30 Pro', 'Spark 40', 'Pova', 'Pova 2', 'Pova 3', 'Pova 4', 'Pova 5', 'Pova 5 Pro', 'Pova 6', 'Pova 6 Pro'],
  Infinix: ['Hot 8', 'Hot 9', 'Hot 10', 'Hot 11', 'Hot 12', 'Hot 20', 'Hot 30', 'Hot 40', 'Hot 50', 'Note 7', 'Note 8', 'Note 10', 'Note 11', 'Note 12', 'Note 30', 'Note 40', 'Zero 5', 'Zero 6', 'Zero 8', 'Zero 20', 'Zero 30', 'GT 10 Pro', 'GT 20 Pro'],
  OPPO: ['Find X', 'Find X2', 'Find X2 Pro', 'Find X3', 'Find X3 Pro', 'Find X5', 'Find X5 Pro', 'Find X6', 'Find X6 Pro', 'Find X7', 'Find X7 Ultra', 'Find X8', 'Find X8 Pro', 'Find X9', 'Reno', 'Reno 2', 'Reno 3', 'Reno 4', 'Reno 5', 'Reno 6', 'Reno 7', 'Reno 8', 'Reno 9', 'Reno 10', 'Reno 11', 'Reno 12', 'Reno 13', 'Reno 14', 'A3', 'A5', 'A9', 'A15', 'A16', 'A17', 'A18', 'A38', 'A54', 'A57', 'A58', 'A60', 'A78', 'A79', 'A98'],
  vivo: ['X50', 'X50 Pro', 'X60', 'X60 Pro', 'X70', 'X70 Pro', 'X80', 'X80 Pro', 'X90', 'X90 Pro', 'X100', 'X100 Pro', 'X200', 'X200 Pro', 'X300', 'X300 Pro', 'V15', 'V17', 'V19', 'V20', 'V21', 'V23', 'V25', 'V27', 'V29', 'V30', 'V40', 'Y12', 'Y15', 'Y16', 'Y17', 'Y19', 'Y20', 'Y21', 'Y22', 'Y27', 'Y30', 'Y31', 'Y33', 'Y35', 'Y36', 'Y55', 'Y72'],
  OnePlus: ['OnePlus One', '2', '3', '3T', '5', '5T', '6', '6T', '7', '7T', '8', '8T', '9', '9 Pro', '10 Pro', '11', '12', '13', 'Nord', 'Nord 2', 'Nord 3', 'Nord 4', 'Nord CE', 'Nord CE 2', 'Nord CE 3', 'Nord CE 4'],
  Realme: ['1', '2', '3', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'C2', 'C3', 'C11', 'C12', 'C15', 'C17', 'C20', 'C21', 'C25', 'C30', 'C31', 'C33', 'C35', 'C51', 'C53', 'C55', 'C67', 'C75'],
  Nokia: ['1', '2', '3', '4', '5', '6', '7', '8', '2.1', '3.1', '5.1', '6.1', '7.1', '8.1', '2.2', '3.2', '4.2', '5.3', '6.2', '7.2', '8.3', 'C01', 'C10', 'C20', 'C21', 'C22', 'C30', 'C31', 'C32', 'G10', 'G11', 'G20', 'G21', 'G22', 'X10', 'X20', 'X30'],
  Motorola: ['Moto G', 'Moto G2', 'Moto G3', 'Moto G4', 'Moto G5', 'Moto G6', 'Moto G7', 'Moto G8', 'Moto G9', 'Moto G10', 'Moto G20', 'Moto G30', 'Moto G40', 'Moto G50', 'Moto G60', 'Moto G70', 'Moto G80', 'Moto G100', 'Moto G200', 'Moto G Power', 'Moto G Stylus', 'Moto E', 'Moto E2', 'Moto E3', 'Moto E4', 'Moto E5', 'Moto E6', 'Moto E7', 'Moto E13', 'Moto E14'],
  Google: ['Pixel', 'Pixel 2', 'Pixel 3', 'Pixel 3a', 'Pixel 4', 'Pixel 4a', 'Pixel 5', 'Pixel 5a', 'Pixel 6', 'Pixel 6a', 'Pixel 6 Pro', 'Pixel 7', 'Pixel 7a', 'Pixel 7 Pro', 'Pixel 8', 'Pixel 8a', 'Pixel 8 Pro', 'Pixel 9', 'Pixel 9a', 'Pixel 9 Pro', 'Pixel 9 Pro XL', 'Pixel 10', 'Pixel 10 Pro'],
  Sony: ['Xperia Z', 'Xperia Z1', 'Xperia Z2', 'Xperia Z3', 'Xperia X', 'Xperia XZ', 'Xperia XZ1', 'Xperia XZ2', 'Xperia XZ3', 'Xperia 1', 'Xperia 1 II', 'Xperia 1 III', 'Xperia 1 IV', 'Xperia 1 V', 'Xperia 1 VI', 'Xperia 1 VII', 'Xperia 5', 'Xperia 5 II', 'Xperia 5 III', 'Xperia 5 IV', 'Xperia 10', 'Xperia 10 II', 'Xperia 10 III', 'Xperia 10 IV', 'Xperia 10 V', 'Xperia 10 VI'],
  ASUS: ['Zenfone', 'Zenfone 2', 'Zenfone 3', 'Zenfone 4', 'Zenfone 5', 'Zenfone 6', 'Zenfone 7', 'Zenfone 8', 'Zenfone 9', 'Zenfone 10', 'ROG Phone', 'ROG Phone 2', 'ROG Phone 3', 'ROG Phone 5', 'ROG Phone 6', 'ROG Phone 7', 'ROG Phone 8', 'ROG Phone 9'],
  Nothing: ['Phone 1', 'Phone 2', 'Phone 2a', 'Phone 3', 'Phone 3a', 'CMF Phone 1', 'CMF Phone 2 Pro'],
  Meizu: ['M1', 'M2', 'M3', 'M5', 'M6', '16', '16s', '17', '18', '20', '21'],
  ZTE: ['Axon 7', 'Axon 9 Pro', 'Axon 10 Pro', 'Axon 20', 'Axon 30', 'Axon 40', 'Axon 50', 'Axon 60', 'Blade A3', 'Blade A5', 'Blade A7', 'Blade A31', 'Blade A51', 'Blade A52', 'Blade A72', 'Blade V8', 'Blade V9', 'Blade V10', 'Blade V2020'],
  "Black Shark": ['Black Shark', 'Black Shark 2', 'Black Shark 3', 'Black Shark 4', 'Black Shark 5', 'Black Shark 6', 'Black Shark 7'],
  nubia: ['nubia Z9', 'nubia Z11', 'nubia Z17', 'nubia Z18', 'nubia Z20', 'Red Magic', 'Red Magic 3', 'Red Magic 5G', 'Red Magic 6', 'Red Magic 7', 'Red Magic 8', 'Red Magic 9'],
  Lenovo: ['K5', 'K6', 'K8', 'Z5', 'Z6', 'Legion Phone Duel', 'Legion Phone Duel 2'],
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
