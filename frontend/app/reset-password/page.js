'use client';

import { useEffect, useState } from 'react';

async function resetRequest(body) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const response = await fetch(`${apiBase}/api/password/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Password reset failed');
  return data;
}

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token') || ''); }, []);
  const submit = async (event) => {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    if (data.get('password') !== data.get('confirmPassword')) return setError('Passwords do not match');
    setBusy(true);
    try { await resetRequest({ token, password: data.get('password') }); setComplete(true); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };
  return <main className="login-screen"><form className="login-card card" onSubmit={submit}><img src="/ifixlab251-logo.png" alt="iFixLab251"/><div><p>ACCOUNT RECOVERY</p><h1>Create a new password</h1><span>The reset link can only be used once.</span></div>{error && <div className="login-error">{error}</div>}{complete ? <><div className="login-success">Your password has been reset.</div><a className="primary reset-login-link" href="/">Return to sign in</a></> : <><label>New password<input name="password" type="password" minLength="10" autoComplete="new-password" required/></label><label>Confirm password<input name="confirmPassword" type="password" minLength="10" autoComplete="new-password" required/></label><button className="primary" disabled={busy || !token}>{busy ? 'Resetting…' : 'Reset password'}</button>{!token && <div className="login-error">This reset link is missing its token.</div>}</>}</form></main>;
}
