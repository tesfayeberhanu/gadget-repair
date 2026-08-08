import { useState } from 'react';

export default function LoginScreen({ login, error }) {
  const [busy, setBusy] = useState(false);
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { await login(Object.fromEntries(new FormData(event.currentTarget))); } finally { setBusy(false); } };
  return <main className="login-screen"><form className="login-card card" onSubmit={submit}>
    <img src="/ifixlab251-logo.png" alt="iFixLab251" />
    <div><p>STAFF ACCESS</p><h1>Sign in to iFixLab251</h1><span>Use the account assigned to your role.</span></div>
    {error && <div className="login-error">{error}</div>}
    <label>Email<input name="email" type="email" autoComplete="username" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
    <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <a className="customer-portal-link" href="/customer">Customer website: track a repair or book a visit →</a>
  </form></main>;
}
