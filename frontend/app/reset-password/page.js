'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function ResetPasswordForm() {
  const token = useSearchParams().get('token') || '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = Object.fromEntries(new FormData(event.currentTarget));
    if (form.password !== form.confirmPassword) return setError('The password confirmation does not match.');
    setBusy(true); setError('');
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
      const response = await fetch(`${apiBase}/api/password/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...form }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Password reset failed');
      setComplete(true);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  if (!token) return <main className="login-screen"><section className="login-card card"><img src="/ifixlab251-logo.png" alt="iFixLab251"/><div><p>INVALID LINK</p><h1>Reset link missing</h1><span>Request a new password reset link from the sign-in page.</span></div><a className="primary reset-login-link" href="/">Return to sign in</a></section></main>;
  if (complete) return <main className="login-screen"><section className="login-card card"><img src="/ifixlab251-logo.png" alt="iFixLab251"/><div><p>PASSWORD UPDATED</p><h1>Your password is ready</h1><span>The reset link has been used and cannot be opened again.</span></div><div className="login-success">Your new password was saved successfully.</div><a className="primary reset-login-link" href="/">Sign in with new password</a></section></main>;

  return <main className="login-screen"><form className="login-card card" onSubmit={submit}><img src="/ifixlab251-logo.png" alt="iFixLab251"/><div><p>SECURE PASSWORD RESET</p><h1>Create a new password</h1><span>Enter and confirm your new password. Use at least 10 characters.</span></div>{error && <div className="login-error">{error}</div>}<label>New password<input name="password" type="password" minLength="10" autoComplete="new-password" required autoFocus/></label><label>Confirm new password<input name="confirmPassword" type="password" minLength="10" autoComplete="new-password" required/></label><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Confirm new password'}</button><a className="auth-link reset-login-link" href="/">Back to sign in</a></form></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="login-screen">Loading secure reset…</main>}><ResetPasswordForm/></Suspense>;
}
