import { TicketBarcode } from '../../print-ticket/page';
import './small-ticket.css';

const formatTicketDate = (value) => {
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${day}/${month}/${date.getFullYear()}  ${time}`;
};

export function SmallTicketDocument({ ticket }) {
  return <article className="small-ticket">
    <h1>iFixLab251</h1>
    <section><small>DATE</small><strong>{formatTicketDate(ticket.createdAt)}</strong></section>
    <section><small>CUSTOMER</small><strong>{ticket.customer}</strong></section>
    <section><small>PHONE</small><strong>{ticket.phone}</strong></section>
    <TicketBarcode value={ticket.id}/>
    <section><small>JOB NUMBER</small><strong>{ticket.id}</strong></section>
  </article>;
}
