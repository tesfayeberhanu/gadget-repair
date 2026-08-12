'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import './print-ticket.css';

export default function PrintTicketPage() {
  const [ticket, setTicket] = useState(undefined);

  useEffect(() => {
    const stored = sessionStorage.getItem('ifixlab_print_ticket');
    try { setTicket(stored ? JSON.parse(stored) : null); } catch { setTicket(null); }
  }, []);

  if (ticket === undefined) return <main className="receipt-loading">Preparing receipt…</main>;
  if (!ticket) return <main className="receipt-missing"><h1>No ticket ready to print</h1><p>Create a new intake from the Front Desk workspace first.</p><Link href="/">Back to Front Desk</Link></main>;

  return <main className="receipt-page">
    <div className="receipt-toolbar"><Link href="/">← Back to Front Desk</Link><button onClick={() => window.print()}>Print ticket</button></div>
    <article className="repair-receipt">
      <header><img src="/ifixlab251-logo.png" alt="iFixLab251"/><div><h1>iFixLab251</h1><p>REPAIR INTAKE / የጥገና መቀበያ</p></div></header>
      <section className="receipt-ticket-head"><div><small>JOB NUMBER / የስራ ቁጥር</small><strong>{ticket.id}</strong></div><div><small>DATE / ቀን</small><strong>{new Date(ticket.createdAt).toLocaleString()}</strong></div></section>
      <div className="receipt-barcode" aria-label={`Barcode for ${ticket.id}`}></div><b className="barcode-label" style={{ marginBottom: 24 }}>{ticket.id}</b>
      <section className="receipt-grid">
        <div><small>CUSTOMER / ደንበኛ</small><strong>{ticket.customer}</strong><p>{ticket.phone}</p></div>
        <div><small>DEVICE / መሣሪያ</small><strong>{ticket.device}</strong><p>IMEI/SN: {ticket.imei}</p></div>
        <div className="wide"><small>REPORTED ISSUE / የተገለጸው ችግር</small><p>{ticket.issue}</p></div>
        <div className="wide"><small>PHYSICAL CONDITION / አካላዊ ሁኔታ</small><p>{ticket.condition || 'Not recorded'}</p></div>
      </section>
      <footer><p>Keep this receipt and use ticket <strong>{ticket.id}</strong> with your phone number to track the repair.</p><div><span>Customer signature / የደንበኛ ፊርማ</span><span>Front Desk</span></div></footer>
    </article>
  </main>;
}
