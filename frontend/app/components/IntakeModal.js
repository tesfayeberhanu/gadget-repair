'use client';

import { useState } from 'react';

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

export default function IntakeModal({ close, submit }) {
  const [brand, setBrand] = useState('Apple');
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <form className="modal intake-modal card" onSubmit={submit}>
      <div className="modal-head"><div><p>REPAIR INTAKE / የጥገና መቀበያ</p><h2>Quick device check-in</h2><small>Check what applies — type only the essentials.</small></div><button type="button" onClick={close}>×</button></div>
      <div className="intake-scroll">
        <section className="intake-section"><h3>Customer / ደንበኛ</h3><div className="form-grid">
          <label>Name / ስም<input name="customer" placeholder="Full name" autoComplete="name" required /></label>
          <label>Phone / ስልክ<input name="phone" type="tel" placeholder="+251 9..." autoComplete="tel" required /></label>
        </div></section>
        <section className="intake-section"><h3>Device / መሣሪያ</h3>
          <div className="device-type-row">{['Phone', 'Tablet', 'Laptop', 'Other'].map((type) => <label className="check-pill" key={type}><input type="radio" name="deviceType" value={type} defaultChecked={type === 'Phone'} /><span>{type}</span></label>)}</div>
          <div className="form-grid compact-fields">
            <label>Brand / ብራንድ<select name="brand" value={brand} onChange={(event) => setBrand(event.target.value)}>{Object.keys(brandModels).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Model / ሞዴል<select name="device" key={brand} required>{brandModels[brand].map((model) => <option key={model}>{model}</option>)}</select></label>
            <label>IMEI / Serial<input name="imei" placeholder="Scan or type" required /></label>
            <label>Color / ቀለም<input name="color" placeholder="Color" /></label>
            <label>Estimate (ETB)<input name="estimate" type="number" min="0" step="0.01" placeholder="0.00" /></label>
          </div>
        </section>
        <section className="intake-section"><h3>Accessories / ተጨማሪ እቃዎች</h3><div className="check-grid">{['SIM', 'Memory card', 'Tray', 'Charger', 'Case'].map((item) => <label className="check-pill" key={item}><input type="checkbox" name="accessories" value={item} /><span>{item}</span></label>)}</div></section>
        <section className="intake-section"><h3>Condition / የመሣሪያ ሁኔታ</h3><div className="condition-grid">
          <CheckGroup title="Power" amharic="ኃይል" name="checks" options={['On', 'Dead', 'Bootloop', 'Overheating']} />
          <CheckGroup title="Screen" amharic="ስክሪን" name="checks" options={['OK', 'Cracked', 'No display', 'Touch issue']} />
          <CheckGroup title="Battery" amharic="ባትሪ" name="checks" options={['OK', 'Not charging', 'Fast drain', 'Loose port']} />
          <CheckGroup title="Network" amharic="ኔትወርክ" name="checks" options={['OK', 'No signal', 'No SIM', 'Wi-Fi fault']} />
          <CheckGroup title="Camera & audio" amharic="ካሜራ & ድምፅ" name="checks" options={['Camera fault', 'No sound', 'Mic issue']} />
          <CheckGroup title="Buttons" amharic="ቁልፎች" name="checks" options={['Power', 'Volume', 'Fingerprint', 'Face ID']} />
          <CheckGroup title="Physical" amharic="አካላዊ" name="physical" options={['Clean', 'Scratched', 'Bent', 'Water damage']} />
          <CheckGroup title="Software" amharic="ሶፍትዌር" name="checks" options={['Locked', 'Slow', 'Crashing', 'Needs update']} />
        </div></section>
        <section className="intake-section"><div className="form-grid"><label className="wide">Issue or notes / ችግር ወይም ማስታወሻ<textarea name="issueNotes" placeholder="Optional — add only what the checkboxes do not cover" /></label></div></section>
      </div>
      <div className="modal-actions"><button type="button" className="outline" onClick={close}>Cancel</button><button className="primary" type="submit">Create ticket & receipt</button></div>
    </form>
  </div>;
}
