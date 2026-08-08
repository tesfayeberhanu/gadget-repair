const CheckGroup = ({ title, amharic, name, options }) => <fieldset className="intake-check-group">
  <legend>{title} <span>/ {amharic}</span></legend>
  <div className="check-grid">{options.map((option) => <label key={option} className="check-pill"><input type="checkbox" name={name} value={`${title}: ${option}`} /><span>{option}</span></label>)}</div>
</fieldset>;

export default function IntakeModal({ close, submit }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <form className="modal intake-modal card" onSubmit={submit}>
      <div className="modal-head"><div><p>REPAIR INTAKE / የጥገና መቀበያ</p><h2>Quick device check-in</h2><small>Check what applies — type only the essentials.</small></div><button type="button" onClick={close}>×</button></div>
      <div className="intake-scroll">
        <section className="intake-section"><h3>Customer / ደንበኛ</h3><div className="form-grid">
          <label>Name / ስም<input name="customer" placeholder="Full name" autoComplete="name" required /></label>
          <label>Phone / ስልክ<input name="phone" type="tel" placeholder="+211 ..." autoComplete="tel" required /></label>
        </div></section>
        <section className="intake-section"><h3>Device / መሣሪያ</h3>
          <div className="device-type-row">{['Phone', 'Tablet', 'Laptop', 'Other'].map((type) => <label className="check-pill" key={type}><input type="radio" name="deviceType" value={type} defaultChecked={type === 'Phone'} /><span>{type}</span></label>)}</div>
          <div className="form-grid compact-fields">
            <label>Brand & model / ብራንድ<input name="device" placeholder="e.g. iPhone 14 Pro" required /></label>
            <label>IMEI / Serial<input name="imei" placeholder="Scan or type" required /></label>
            <label>Color / ቀለም<input name="color" placeholder="Color" /></label>
            <label>Estimate ($)<input name="estimate" type="number" min="0" step="0.01" placeholder="0.00" /></label>
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
