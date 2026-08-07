export default function IntakeModal({ close, submit }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <form className="modal card" onSubmit={submit}>
      <div className="modal-head"><div><p>NEW REPAIR</p><h2>Device intake</h2></div><button type="button" onClick={close}>×</button></div>
      <div className="form-grid">
        <label>Customer name<input name="customer" placeholder="Full name" required /></label>
        <label>Phone number<input name="phone" placeholder="+211 ..." required /></label>
        <label>Device model<input name="device" placeholder="e.g. iPhone 14 Pro" required /></label>
        <label>Serial / IMEI<input name="imei" placeholder="Serial or IMEI" required /></label>
        <label className="wide">Reported issue<textarea name="issue" placeholder="Describe the customer-reported issue" required /></label>
        <label>Physical condition<select name="condition"><option>Good — normal wear</option><option>Damaged</option><option>Severely damaged</option></select></label>
        <label>Estimated cost ($)<input name="estimate" type="number" min="0" placeholder="0.00" /></label>
      </div>
      <div className="modal-actions"><button type="button" className="outline" onClick={close}>Cancel</button><button className="primary" type="submit">Create ticket & receipt</button></div>
    </form>
  </div>;
}
