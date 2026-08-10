import { useState } from 'react';

export default function LoginScreen({ login, forgotPassword, error }) {
  const [busy, setBusy] = useState(false);
  const [forgotten, setForgotten] = useState(false);
  const [message, setMessage] = useState(null);
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { await login(Object.fromEntries(new FormData(event.currentTarget))); } finally { setBusy(false); } };
  const requestReset = async (event) => { event.preventDefault(); setBusy(true); setMessage(null); try { setMessage(await forgotPassword(new FormData(event.currentTarget).get('email'))); } catch { /* Parent displays the API error. */ } finally { setBusy(false); } };
  if (forgotten) return <main className="login-screen"><form className="login-card card" onSubmit={requestReset}><img src="/ifixlab251-logo.png" alt="iFixLab251"/><div><p>ACCOUNT RECOVERY</p><h1>Reset your password</h1><span>We’ll email a secure reset link to your staff account.</span></div>{error && <div className="login-error">{error}</div>}{message && <div className="login-success">{message.message}{message.resetUrl && <a href={message.resetUrl}>Open development reset link →</a>}</div>}<label>Email<input name="email" type="email" autoComplete="email" required autoFocus/></label><button className="primary" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button><button type="button" className="auth-link" onClick={() => { setForgotten(false); setMessage(null); }}>← Back to sign in</button></form></main>;
  return <main className="login-screen"><form className="login-card card" onSubmit={submit}>
    <img src="/ifixlab251-logo.png" alt="iFixLab251" />
    <div><p>STAFF ACCESS</p><h1>Sign in to iFixLab251</h1><span>Use the account assigned to your role.</span></div>
    {error && <div className="login-error">{error}</div>}
    <label>Email<input name="email" type="email" autoComplete="username" required /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
    <button type="button" className="auth-link" onClick={() => setForgotten(true)}>Forgot password?</button>
    <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    <a className="customer-portal-link" href="/customer">Customer website: track a repair or book a visit →</a>
  </form></main>;
}
