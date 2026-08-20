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

const heroWavePaths = {
  blue: 'M0 26 C18 12,34 34,54 22 S92 8,112 24 S150 32,170 16 S190 10,200 20',
  green: 'M0 22 C20 32,38 8,58 18 S96 30,116 16 S154 6,174 20 S192 30,200 18',
  violet: 'M0 18 C16 30,36 10,56 20 S94 32,114 14 S152 8,172 22 S190 28,200 16',
  amber: 'M0 24 C20 10,40 30,60 20 S98 8,118 22 S156 32,176 14 S194 8,200 18',
};
export function StatHero({ tone = 'blue', icon, label, value, meta }) {
  return <article className={`stat-hero stat-hero-${tone}`}>
    <span className="stat-hero-icon">{icon}</span>
    <strong className="stat-hero-value">{value}</strong>
    <span className="stat-hero-label">{label}</span>
    {meta && <small className="stat-hero-meta">{meta}</small>}
    <svg className="stat-hero-wave" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true"><path d={heroWavePaths[tone] || heroWavePaths.blue}/></svg>
  </article>;
}

export function WeeklyRepairsChart({ repairs = [] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const startOfWeek = new Date();
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const counts = days.map((_, index) => {
    const dayStart = new Date(startOfWeek);
    dayStart.setDate(startOfWeek.getDate() + index);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);
    return repairs.filter((repair) => { const created = new Date(repair.createdAt); return created >= dayStart && created < dayEnd; }).length;
  });
  const max = Math.max(1, ...counts);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return <section className="card panel weekly-repairs"><div className="panel-title"><div><h2>Repairs this week</h2><p>{total} intake{total === 1 ? '' : 's'} · Monday – Sunday</p></div></div>
    <div className="weekly-bars">{days.map((day, index) => <div className="weekly-bar-col" key={day}><b>{counts[index]}</b><div className="weekly-bar-track"><div className="weekly-bar-fill" style={{ height: `${(counts[index] / max) * 100}%` }}/></div><span>{day}</span></div>)}</div>
  </section>;
}
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

export function RevenueCard({ dashboard = {} }) {
  const revenue = Number(dashboard.totalRevenue || 0);
  const expenses = Number(dashboard.totalExpenses || 0);
  const net = Number(dashboard.netRevenue ?? (revenue - expenses));
  const max = Math.max(revenue, expenses, Math.abs(net), 1);
  const bars = [
    { label: 'Revenue', value: revenue, color: 'var(--blue)' },
    { label: 'Expenses', value: expenses, color: 'var(--amber)' },
    { label: 'Net revenue', value: net, color: net >= 0 ? 'var(--green)' : '#e5534b' },
  ];
  return <section className="card panel revenue"><div className="panel-title"><div><h2>Revenue overview</h2><p>All-time totals recorded in the system</p></div></div><div className="revenue-bars">{bars.map((bar) => <div className="revenue-bar-col" key={bar.label}><b>{money(bar.value)}</b><div className="revenue-bar-track"><div className="revenue-bar-fill" style={{ height: `${Math.min(100, Math.abs(bar.value) / max * 100)}%`, background: bar.color }}/></div><span>{bar.label}</span></div>)}</div></section>;
}

export function StatusCard({ repairs }) {
  const groups = ['Received', 'Diagnosing', 'Repair Approved', 'In Repair'];
  const colors = ['#078fe5', '#1456a0', '#eea736', '#20b878'];
  const counts = groups.map((group) => repairs.filter((repair) => repair.status === group).length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  let offset = 0;
  const stops = counts.map((count, index) => {
    const start = offset;
    offset += total > 0 ? (count / total) * 100 : 0;
    return `${colors[index]} ${start}% ${offset}%`;
  });
  const donutStyle = { background: total > 0 ? `conic-gradient(${stops.join(',')})` : '#eef1f4' };
  return <section className="card panel"><div className="panel-title"><div><h2>Repair status</h2><p>Current workload breakdown</p></div></div><div className="donut-wrap"><div className="donut" style={donutStyle}><span><b>{total}</b>total</span></div><div className="legend">{groups.map((group, index) => <div key={group}><i className={`dot d${index}`}></i><span>{group}</span><strong>{counts[index]}</strong></div>)}</div></div></section>;
}

export function QueueCard({ repairs, role, title = 'Recent repairs', actionLabel, onView }) {
  return <section className="card table-card"><div className="panel-title"><div><h2>{title}</h2><p>{role === 'Technician' ? 'Repairs assigned to you' : actionLabel ? 'New repairs waiting for a technician' : 'Latest ticket activity across the shop'}</p></div><button className="link" onClick={onView}>View all repairs →</button></div><div className="table-scroll"><table><thead><tr><th>Ticket</th><th>Customer</th><th>Device</th><th>Status</th><th>Technician</th><th>{actionLabel ? 'Action' : 'Due'}</th></tr></thead><tbody>{repairs.length ? repairs.map((repair) => <tr key={repair.id}><td><strong>{repair.id}</strong></td><td><div className="customer"><span className="avatar small">{repair.avatar}</span><div><strong>{repair.customer}</strong><small>{repair.phone}</small></div></div></td><td><strong>{repair.device}</strong><small>{repair.issue}</small></td><td><Status value={repair.status}/></td><td>{repair.tech}</td><td>{actionLabel ? <button className="table-action" onClick={onView}>{actionLabel} →</button> : repair.due}</td></tr>) : <tr><td colSpan="6" className="empty">{actionLabel ? 'No repairs are waiting for assignment' : 'No matching repairs found'}</td></tr>}</tbody></table></div></section>;
}

export function SalesCard({ sales }) { const finalizedSales = sales.filter((sale) => sale.invoiceStatus === 'FINALIZED').slice(0, 5); return <section className="card panel"><div className="panel-title"><div><h2>Recent sales</h2><p>Latest finalized invoices</p></div></div><div className="mini-list">{finalizedSales.length ? finalizedSales.map((sale) => <div key={sale.id}><span className="sale-icon">▤</span><div><strong>{sale.customer}</strong><small>{sale.item} · {sale.status}</small></div><b>{money(sale.amount)}</b></div>) : <p className="empty">No finalized invoices yet.</p>}</div></section>; }

export function LowStockCard({ parts, onView }) { return <section className="card panel"><div className="panel-title"><div><h2>Low stock alerts</h2><p>Items that need your attention</p></div><button className="link" onClick={onView}>View inventory →</button></div><div className="mini-list">{parts.filter((part) => part.stock <= part.min).map((part) => <div key={part.sku}><span className="part-icon">□</span><div><strong>{part.name}</strong><small>{part.sku}</small></div><b className="stock-low">{part.stock} left</b></div>)}</div></section>; }
