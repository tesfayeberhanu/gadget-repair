'use client';

import { useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
const statuses = ['Pending', 'In Progress', 'Waiting for Parts', 'Completed', 'Delivered'];
const posts = [
  { tag: 'BATTERY CARE', title: '5 habits that make your phone battery last longer', summary: 'Small charging changes can reduce heat and slow battery wear.', body: 'Avoid leaving your phone in direct heat, use a reliable charger, and try to keep daily charging between roughly 20% and 90%. If the phone swells, becomes unusually hot, or shuts down unexpectedly, stop charging it and arrange an inspection.' },
  { tag: 'SCREEN & WATER', title: 'What to do immediately after liquid damage', summary: 'Fast, calm action gives a technician the best chance to save the device.', body: 'Turn the device off, disconnect every cable, and do not test the charger. Avoid rice and hair dryers; both can make the damage worse. Bring the phone in as soon as possible and tell the technician what liquid was involved.' },
  { tag: 'BEFORE REPAIR', title: 'How to prepare your phone for a repair visit', summary: 'A quick backup and a few details make check-in much faster.', body: 'Back up important photos and contacts when the device still works. Bring the passcode only if testing requires it, note any recent drops or repairs, and bring relevant accessories when the fault involves charging or audio.' },
];

async function publicRequest(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function CustomerPage() {
  const [tracking, setTracking] = useState(null); const [trackError, setTrackError] = useState('');
  const [appointment, setAppointment] = useState(null); const [appointmentError, setAppointmentError] = useState('');
  const [openPost, setOpenPost] = useState(null);
  const track = async (event) => { event.preventDefault(); setTrackError(''); setTracking(null); const form = new FormData(event.currentTarget); try { setTracking(await publicRequest(`/api/public/track?ticket=${encodeURIComponent(form.get('ticket'))}&phone=${encodeURIComponent(form.get('phone'))}`)); } catch (error) { setTrackError(error.message); } };
  const book = async (event) => { event.preventDefault(); setAppointmentError(''); setAppointment(null); try { const result = await publicRequest('/api/public/appointments', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); setAppointment(result); event.currentTarget.reset(); } catch (error) { setAppointmentError(error.message); } };
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return <div className="customer-site">
    <header className="customer-nav"><a href="#home" className="customer-brand"><img src="/ifixlab251-logo.png" alt="iFixLab251"/><span>iFixLab<span>251</span></span></a><nav><a href="#track">Track repair</a><a href="#appointment">Appointment</a><a href="#tips">Repair tips</a></nav></header>
    <main>
      <section className="customer-hero" id="home"><div><p className="customer-kicker">ETHIOPIA&apos;S TRUSTED DEVICE CARE</p><h1>Your device.<br/><span>Back in good hands.</span></h1><p>Book a repair visit, follow your phone’s progress, and get practical care advice from iFixLab251.</p><div className="hero-actions"><a href="#appointment" className="customer-primary">Book an appointment</a><a href="#track" className="customer-secondary">Track my repair</a></div><div className="trust-row"><span>✓ Clear updates</span><span>✓ Skilled technicians</span><span>✓ Secure check-in</span></div></div><div className="hero-device"><div className="phone-shape"><span>251</span><b>Repair status</b><i>In progress</i></div><span className="orbit orbit-one">⚙</span><span className="orbit orbit-two">✓</span></div></section>

      <section className="customer-section track-section" id="track"><div className="section-copy"><p className="customer-kicker">LIVE REPAIR UPDATES</p><h2>Track your phone status</h2><p>Enter the ticket number from your receipt and the same phone number used at check-in.</p></div><div className="customer-panel"><form className="public-form inline-form" onSubmit={track}><label>Ticket number<input name="ticket" placeholder="REP-2026-0142" required /></label><label>Phone number<input name="phone" type="tel" placeholder="+251 9..." required /></label><button className="customer-primary">Check status</button></form>{trackError && <div className="public-error">{trackError}</div>}{tracking && <div className="tracking-result"><div><small>{tracking.ticketNumber}</small><h3>{tracking.device}</h3><p>Assigned: {tracking.technician}</p></div><div className="status-steps">{statuses.map((status, index) => { const current = statuses.indexOf(tracking.status); return <span className={index <= current ? 'done' : ''} key={status}><i>{index < current ? '✓' : index + 1}</i>{status}</span>; })}</div></div>}</div></section>

      <section className="customer-section appointment-section" id="appointment"><div className="appointment-copy"><p className="customer-kicker">PLAN YOUR VISIT</p><h2>Request an appointment</h2><p>Tell us what is happening and choose a convenient time. This sends a request; the appointment is only booked after the front desk approves it.</p><ul><li>Faster check-in</li><li>No account required</li><li>Approval required before visiting</li></ul></div><form className="customer-panel public-form appointment-form" onSubmit={book}><label>Your name<input name="customerName" autoComplete="name" required /></label><label>Phone number<input name="customerPhone" type="tel" autoComplete="tel" required /></label><label>Device<input name="device" placeholder="e.g. Samsung S24" required /></label><label>Preferred date & time<input name="preferredDate" type="datetime-local" min={today} required /></label><label className="wide">What needs attention?<textarea name="issue" placeholder="Briefly describe the problem" required /></label>{appointmentError && <div className="public-error wide">{appointmentError}</div>}{appointment && <div className="public-success wide">Request received and awaiting approval. Reference: <strong>{appointment.reference}</strong></div>}<button className="customer-primary wide">Send appointment request</button></form></section>

      <section className="customer-section blog-section" id="tips"><div className="blog-head"><div><p className="customer-kicker">FROM THE REPAIR BENCH</p><h2>Simple advice for healthier devices</h2></div><p>Useful guidance from the issues our technicians see every day.</p></div><div className="blog-grid">{posts.map((post, index) => <article className="blog-card" key={post.title}><div className={`blog-art art-${index + 1}`}><span>{index === 0 ? '⚡' : index === 1 ? '◌' : '✓'}</span></div><div><small>{post.tag}</small><h3>{post.title}</h3><p>{openPost === index ? post.body : post.summary}</p><button onClick={() => setOpenPost(openPost === index ? null : index)}>{openPost === index ? 'Show less' : 'Read article'} →</button></div></article>)}</div></section>
    </main>
    <footer className="customer-footer"><div className="customer-brand"><img src="/ifixlab251-logo.png" alt=""/><span>iFixLab<span>251</span></span></div><p>Device repair, clear communication, dependable care across Ethiopia.</p></footer>
  </div>;
}
