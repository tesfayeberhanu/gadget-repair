import { useState } from 'react';
import { PageHead } from './SharedUI';

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
  return <><PageHead eyebrow="ACCOUNT SETTINGS" title="Profile & security"><span className="head-count">Manage your personal staff account</span></PageHead><div className="settings-grid">{isAdmin && <form className="card settings-card" onSubmit={submitProfile}><div className="settings-card-head"><span>♙</span><div><h2>Profile information</h2><p>Update the name and email shown on your account.</p></div></div><label>Full name<input name="name" defaultValue={user?.name || ''} required/></label><label>Email address<input name="email" type="email" defaultValue={user?.email || ''} required/></label><label>Role<input value={user?.role || ''} disabled/></label><button className="primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save Profile'}</button></form>}<form className="card settings-card" onSubmit={submitPassword}><div className="settings-card-head"><span>⌾</span><div><h2>Password & security</h2><p>Use at least 10 characters for your new password.</p></div></div>{passwordError && <div className="login-error">{passwordError}</div>}<label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required/></label><label>New password<input name="newPassword" type="password" minLength="10" autoComplete="new-password" required/></label><label>Confirm new password<input name="confirmPassword" type="password" minLength="10" autoComplete="new-password" required/></label><button className="primary" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Change Password'}</button><div className="settings-reset"><p>Forgot your current password?</p><button type="button" className="outline" onClick={sendReset} disabled={sendingReset}>{sendingReset ? 'Sending…' : 'Email Me a Reset Link'}</button></div></form></div></>;
}
