'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import './print-ticket.css';
import './barcode.css';
import './thermal-80mm.css';

const code39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
};

function TicketBarcode({ value }) {
  const encoded = `*${String(value).toUpperCase()}*`;
  const narrow = 2; const wide = 5; const gap = 2; const height = 62;
  let x = 20; const bars = [];
  for (const character of encoded) {
    const pattern = code39[character];
    if (!pattern) continue;
    pattern.split('').forEach((width, index) => {
      const size = width === 'w' ? wide : narrow;
      if (index % 2 === 0) bars.push(<rect key={`${x}-${index}`} x={x} y="0" width={size} height={height}/>);
      x += size;
    });
    x += gap;
  }
  return <svg className="receipt-barcode real-barcode" viewBox={`0 0 ${x + 20} ${height}`} role="img" aria-label={`Scannable Code 39 barcode for ${value}`} preserveAspectRatio="none">{bars}</svg>;
}

export default function PrintTicketPage() {
  const [tickets, setTickets] = useState(undefined);

  useEffect(() => {
    const stored = sessionStorage.getItem('ifixlab_print_ticket');
    try {
      const parsed = stored ? JSON.parse(stored) : null;
      setTickets(Array.isArray(parsed?.tickets) ? parsed.tickets : parsed ? [parsed] : null);
    } catch { setTickets(null); }
  }, []);

  if (tickets === undefined) return <main className="receipt-loading">Preparing receipt…</main>;
  if (!tickets || !tickets.length) return <main className="receipt-missing"><h1>No ticket ready to print</h1><p>Create a new intake from the Front Desk workspace first.</p><Link href="/">Back to Front Desk</Link></main>;

  const first = tickets[0];
  const jobNumbers = tickets.map((ticket) => ticket.id).join(', ');

  return <main className="receipt-page">
    <div className="receipt-toolbar"><Link href="/">← Back to Front Desk</Link><button onClick={() => window.print()}>Print ticket</button></div>
    <article className="repair-receipt">
      <header><img src="/ifixlab251-logo.png" alt="iFixLab251"/><div><h1>iFixLab251</h1><p>REPAIR INTAKE / የጥገና መቀበያ</p></div></header>
      <section className="receipt-ticket-head"><div><small>{tickets.length > 1 ? 'JOB NUMBERS / የስራ ቁጥሮች' : 'JOB NUMBER / የስራ ቁጥር'}</small><strong>{jobNumbers}</strong></div><div><small>DATE / ቀን</small><strong>{new Date(first.createdAt).toLocaleString()}</strong></div></section>
      <section className="receipt-grid"><div className="wide"><small>CUSTOMER / ደንበኛ</small><strong>{first.customer}</strong><p>{first.phone}</p></div></section>
      {tickets.map((ticket, index) => <section className="receipt-device-entry" key={ticket.id}>
        {tickets.length > 1 && <><h2 className="receipt-device-title">Device {index + 1} of {tickets.length} / መሣሪያ {index + 1}</h2>
        <section className="receipt-ticket-head"><div><small>JOB NUMBER / የስራ ቁጥር</small><strong>{ticket.id}</strong></div></section></>}
        <TicketBarcode value={ticket.id}/><b className="barcode-label">{ticket.id}</b>
        <section className="receipt-grid">
          <div><small>DEVICE / መሣሪያ</small><strong>{ticket.device}</strong><p>IMEI/SN: {ticket.imei}</p></div>
          <div><small>ESTIMATED MAINTENANCE CHARGE / የጥገና ግምት</small><strong>ETB {Number(ticket.estimatedCost || 0).toLocaleString('en-ET')}</strong></div>
          <div className="wide"><small>REPORTED ISSUE / የተገለጸው ችግር</small><p>{ticket.issue}</p></div>
          <div className="wide"><small>PHYSICAL CONDITION / አካላዊ ሁኔታ</small><p>{ticket.condition || 'Not recorded'}</p></div>
        </section>
      </section>)}
      <footer><p>Keep this receipt and use {tickets.length > 1 ? 'the job numbers above' : <>ticket <strong>{first.id}</strong></>} with your phone number to track the repair.</p><div><span>Customer signature / የደንበኛ ፊርማ</span><span>Front Desk</span></div></footer>
    </article>
  </main>;
}
