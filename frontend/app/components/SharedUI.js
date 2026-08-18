import { periodOptions } from '../utils/listTools.mjs';

export const money = (value) => `ETB ${Number(value || 0).toLocaleString('en-ET')}`;
export function DateRangeFilter({ period, setPeriod, from, setFrom, to, setTo, label = 'Filter by date' }) {
  return <div className="date-range-filter" role="group" aria-label={label}>
    <div className="period-pills">{periodOptions.map(([value, optionLabel]) => <button type="button" key={value} className={period === value ? 'active' : ''} onClick={() => { setPeriod(value); setFrom(''); setTo(''); }}>{optionLabel}</button>)}</div>
    <div className="period-range"><label>From<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPeriod('custom'); }} /></label><label>To<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPeriod('custom'); }} /></label></div>
  </div>;
}
export function PageHead({ eyebrow, title, children }) { return <div className="page-head"><div><p>{eyebrow}</p><h1>{title}</h1></div>{children}</div>; }
export function Metric({ icon, tone, label, value, meta }) { return <article className="metric card"><div className={`metric-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div></article>; }
export function Status({ value }) { return <span className={`status ${value.toLowerCase().replaceAll(' ', '-')}`}><i></i>{value}</span>; }
export function SearchBox({ value, onChange, placeholder, label = 'Search' }) {
  return <div className="search-inner list-search"><span aria-hidden="true">⌕</span><input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} autoComplete="off"/>{value && <button type="button" className="search-clear" onClick={() => onChange('')} aria-label={`Clear ${label.toLowerCase()}`}>×</button>}</div>;
}
export function ResultCount({ shown, total, noun = 'result' }) {
  const label = total === shown ? `${shown} ${noun}${shown === 1 ? '' : 's'}` : `${shown} of ${total} ${noun}${total === 1 ? '' : 's'}`;
  return <span className="result-count" aria-live="polite">{label}</span>;
}

export function Pagination({ page, setPage, totalItems, pageSize = 10 }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);
  return <div className="pagination" aria-label="Pagination">
    <span className="pagination-range">{start}–{end} of {totalItems}</span>
    <div className="pagination-controls">
      <button type="button" onClick={() => setPage(1)} disabled={page <= 1} aria-label="First page">«</button>
      <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} aria-label="Previous page">‹ Prev</button>
      <span className="pagination-page">Page {page} of {totalPages}</span>
      <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages} aria-label="Next page">Next ›</button>
      <button type="button" onClick={() => setPage(totalPages)} disabled={page >= totalPages} aria-label="Last page">»</button>
    </div>
  </div>;
}

export function RevenueCard() {
  return <section className="card panel revenue"><div className="panel-title"><div><h2>Revenue overview</h2><p>Revenue performance over the last 6 months</p></div></div><div className="chart"><div className="y-axis"><span>ETB 12k</span><span>ETB 8k</span><span>ETB 4k</span><span>ETB 0</span></div><svg viewBox="0 0 600 190" preserveAspectRatio="none" aria-label="Revenue trend"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4f46e5" stopOpacity=".28"/><stop offset="1" stopColor="#4f46e5" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 150 C70 135,90 155,140 117 S230 130,280 90 S365 105,420 58 S515 76,600 28 L600 190 L0 190Z"/><path className="line" d="M0 150 C70 135,90 155,140 117 S230 130,280 90 S365 105,420 58 S515 76,600 28"/></svg><div className="months"><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span></div></div></section>;
}

export function StatusCard({ repairs }) {
  const groups = ['Received', 'Diagnosing', 'Repair Approved', 'In Repair'];
  return <section className="card panel"><div className="panel-title"><div><h2>Repair status</h2><p>Current workload breakdown</p></div></div><div className="donut-wrap"><div className="donut"><span><b>{repairs.length + 20}</b>total</span></div><div className="legend">{groups.map((group, index) => <div key={group}><i className={`dot d${index}`}></i><span>{group}</span><strong>{[8, 6, 4, 6][index]}</strong></div>)}</div></div></section>;
}

export function QueueCard({ repairs, role, title = 'Recent repairs', actionLabel, onView }) {
  return <section className="card table-card"><div className="panel-title"><div><h2>{title}</h2><p>{role === 'Technician' ? 'Repairs assigned to you' : actionLabel ? 'New repairs waiting for a technician' : 'Latest ticket activity across the shop'}</p></div><button className="link" onClick={onView}>View all repairs →</button></div><div className="table-scroll"><table><thead><tr><th>Ticket</th><th>Customer</th><th>Device</th><th>Status</th><th>Technician</th><th>{actionLabel ? 'Action' : 'Due'}</th></tr></thead><tbody>{repairs.length ? repairs.map((repair) => <tr key={repair.id}><td><strong>{repair.id}</strong></td><td><div className="customer"><span className="avatar small">{repair.avatar}</span><div><strong>{repair.customer}</strong><small>{repair.phone}</small></div></div></td><td><strong>{repair.device}</strong><small>{repair.issue}</small></td><td><Status value={repair.status}/></td><td>{repair.tech}</td><td>{actionLabel ? <button className="table-action" onClick={onView}>{actionLabel} →</button> : repair.due}</td></tr>) : <tr><td colSpan="6" className="empty">{actionLabel ? 'No repairs are waiting for assignment' : 'No matching repairs found'}</td></tr>}</tbody></table></div></section>;
}

export function SalesCard({ sales }) { const finalizedSales = sales.filter((sale) => sale.invoiceStatus === 'FINALIZED').slice(0, 5); return <section className="card panel"><div className="panel-title"><div><h2>Recent sales</h2><p>Latest finalized invoices</p></div></div><div className="mini-list">{finalizedSales.length ? finalizedSales.map((sale) => <div key={sale.id}><span className="sale-icon">▤</span><div><strong>{sale.customer}</strong><small>{sale.item} · {sale.status}</small></div><b>{money(sale.amount)}</b></div>) : <p className="empty">No finalized invoices yet.</p>}</div></section>; }

export function LowStockCard({ parts, onView }) { return <section className="card panel"><div className="panel-title"><div><h2>Low stock alerts</h2><p>Items that need your attention</p></div><button className="link" onClick={onView}>View inventory →</button></div><div className="mini-list">{parts.filter((part) => part.stock <= part.min).map((part) => <div key={part.sku}><span className="part-icon">□</span><div><strong>{part.name}</strong><small>{part.sku}</small></div><b className="stock-low">{part.stock} left</b></div>)}</div></section>; }
