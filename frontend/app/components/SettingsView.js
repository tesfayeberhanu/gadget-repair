import { useEffect, useState } from 'react';
import { PageHead } from './SharedUI';
import { listQzPrinters } from '../utils/qz';
import { getPrinterSettings, setPrinterSettings } from '../utils/printerSettings';
import { printFullReceipt, printSmallTicket } from '../utils/printJobs';

const SAMPLE_TICKET = { id: 'TEST-0000', customer: 'Test Customer', phone: '+251911111111', device: 'Test Device', imei: '000000000000000', estimatedCost: 0, issue: 'Sample print used to confirm this printer is set up correctly.', condition: 'Not recorded', createdAt: new Date().toISOString() };

function PrinterSettingsCard() {
  const [printers, setPrinters] = useState([]);
  const [printerError, setPrinterError] = useState('');
  const [loadingPrinters, setLoadingPrinters] = useState(true);
  const [smallTicketPrinter, setSmallTicketPrinter] = useState('');
  const [fullReceiptPrinter, setFullReceiptPrinter] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [testStatus, setTestStatus] = useState({ small: '', full: '' });

  const loadPrinters = async () => {
    setLoadingPrinters(true); setPrinterError('');
    try { setPrinters(await listQzPrinters()); }
    catch { setPrinterError('QZ Tray was not detected. Install and start QZ Tray on this computer, then click Refresh.'); }
    setLoadingPrinters(false);
  };

  useEffect(() => {
    const saved = getPrinterSettings();
    setSmallTicketPrinter(saved.smallTicketPrinter);
    setFullReceiptPrinter(saved.fullReceiptPrinter);
    loadPrinters();
  }, []);

  const save = () => { setPrinterSettings({ smallTicketPrinter, fullReceiptPrinter }); setSaveMessage('Printer settings saved'); window.setTimeout(() => setSaveMessage(''), 2200); };
  const testSmall = async () => {
    setTestStatus((status) => ({ ...status, small: 'Printing…' }));
    try { await printSmallTicket(SAMPLE_TICKET, smallTicketPrinter); setTestStatus((status) => ({ ...status, small: 'Sent to printer' })); }
    catch (error) { setTestStatus((status) => ({ ...status, small: error.message })); }
  };
  const testFull = async () => {
    setTestStatus((status) => ({ ...status, full: 'Printing…' }));
    try { await printFullReceipt(SAMPLE_TICKET, fullReceiptPrinter); setTestStatus((status) => ({ ...status, full: 'Sent to printer' })); }
    catch (error) { setTestStatus((status) => ({ ...status, full: error.message })); }
  };

  return <form className="card settings-card" onSubmit={(event) => { event.preventDefault(); save(); }}>
    <div className="settings-card-head"><span>⎙</span><div><h2>Printer settings</h2><p>Choose which POS printer prints the small job ticket and which prints the full receipt. Uses QZ Tray, running on this computer.</p></div></div>
    {printerError && <div className="login-error">{printerError}</div>}
    <label>Small Ticket Printer<select value={smallTicketPrinter} onChange={(event) => setSmallTicketPrinter(event.target.value)} disabled={loadingPrinters}><option value="">{loadingPrinters ? 'Loading printers…' : 'Select printer'}</option>{printers.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
    <label>Full Receipt Printer<select value={fullReceiptPrinter} onChange={(event) => setFullReceiptPrinter(event.target.value)} disabled={loadingPrinters}><option value="">{loadingPrinters ? 'Loading printers…' : 'Select printer'}</option>{printers.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
    <button type="button" className="outline" onClick={loadPrinters} disabled={loadingPrinters}>{loadingPrinters ? 'Refreshing…' : '↻ Refresh printer list'}</button>
    <div className="settings-reset"><button type="button" className="outline" onClick={testSmall} disabled={!smallTicketPrinter}>Test Small Ticket Printer</button>{testStatus.small && <small>{testStatus.small}</small>}</div>
    <div className="settings-reset"><button type="button" className="outline" onClick={testFull} disabled={!fullReceiptPrinter}>Test Full Receipt Printer</button>{testStatus.full && <small>{testStatus.full}</small>}</div>
    {saveMessage && <div className="login-error" style={{ background: '#e6f8ef', color: '#168c5c', borderColor: '#bfe8d2' }}>{saveMessage}</div>}
    <button className="primary">Save</button>
  </form>;
}

export default function SettingsView({ user, updateProfile, changePassword, emailPasswordReset }) {
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const submitProfile = async (event) => {
    event.preventDefault(); setSavingProfile(true);
    await updateProfile(Object.fromEntries(new FormData(event.currentTarget)));
    setSavingProfile(false);
  };
  const submitPassword = async (event) => {
    event.preventDefault();
    const form = event.currentTarget; const data = Object.fromEntries(new FormData(form));
    if (data.newPassword !== data.confirmPassword) { setPasswordError('New passwords do not match'); return; }
    setPasswordError('');
    setSavingPassword(true);
    if (await changePassword(data)) form.reset();
    setSavingPassword(false);
  };
  const sendReset = async () => { setSendingReset(true); await emailPasswordReset(user.email); setSendingReset(false); };
  const isAdmin = user?.role === 'Admin';
  return <><PageHead eyebrow="ACCOUNT SETTINGS" title="Profile & security"><span className="head-count">Manage your personal staff account</span></PageHead><div className="settings-grid">{isAdmin && <form className="card settings-card" onSubmit={submitProfile}><div className="settings-card-head"><span>♙</span><div><h2>Profile information</h2><p>Update the name and email shown on your account.</p></div></div><label>Full name<input name="name" defaultValue={user?.name || ''} required/></label><label>Email address<input name="email" type="email" defaultValue={user?.email || ''} required/></label><label>Role<input value={user?.role || ''} disabled/></label><button className="primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save Profile'}</button></form>}<form className="card settings-card" onSubmit={submitPassword}><div className="settings-card-head"><span>⌾</span><div><h2>Password & security</h2><p>Use at least 10 characters for your new password.</p></div></div>{passwordError && <div className="login-error">{passwordError}</div>}<label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required/></label><label>New password<input name="newPassword" type="password" minLength="10" autoComplete="new-password" required/></label><label>Confirm new password<input name="confirmPassword" type="password" minLength="10" autoComplete="new-password" required/></label><button className="primary" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Change Password'}</button><div className="settings-reset"><p>Forgot your current password?</p><button type="button" className="outline" onClick={sendReset} disabled={sendingReset}>{sendingReset ? 'Sending…' : 'Email Me a Reset Link'}</button></div></form>{(isAdmin || user?.role === 'Front Desk') && <PrinterSettingsCard/>}</div></>;
}
