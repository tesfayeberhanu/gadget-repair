import { useState } from 'react';
import { Metric, money, PageHead, RevenueCard, Status } from './SharedUI';

export function RepairsView({ repairs, search, setSearch, role, updateStatus }) {
  if (role === 'Technician') {
    const mine = repairs.filter((repair) => repair.isMine && !['Completed', 'Delivered'].includes(repair.status));
    const available = repairs.filter((repair) => !repair.isMine && repair.status === 'Pending');
    const history = repairs.filter((repair) => repair.isMine && ['Completed', 'Delivered'].includes(repair.status));
    const RepairRows = ({ items, action }) => items.length ? items.map((repair) => <tr key={repair.id}>
      <td><strong>{repair.id}</strong><small>{repair.customer} · {repair.phone}</small></td>
      <td><strong>{repair.device}</strong><small>{repair.issue}</small></td>
      <td><Status value={repair.status}/></td><td>{repair.tech}</td>
      {action && <td><button className="table-action" onClick={() => updateStatus(repair.id)}>{repair.status === 'Pending' ? 'Take job' : 'Update'} →</button></td>}
    </tr>) : <tr><td colSpan="5" className="empty">No repairs in this section.</td></tr>;
    const Queue = ({ title, items, action }) => <section className="card table-card technician-queue"><div className="panel-title"><div><h2>{title}</h2><p>{items.length} repair{items.length === 1 ? '' : 's'}</p></div></div><div className="table-scroll"><table><thead><tr><th>Ticket & customer</th><th>Device / issue</th><th>Status</th><th>Assigned to</th>{action && <th>Action</th>}</tr></thead><tbody><RepairRows items={items} action={action}/></tbody></table></div></section>;
    return <><PageHead eyebrow="TECHNICIAN WORKSPACE" title="Repair management"><span className="head-count">Assigned work and available jobs</span></PageHead><div className="toolbar card"><div className="search-inner">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search my repairs"/></div></div><Queue title="My in-progress repairs" items={mine} action/><Queue title="Available repairs" items={available} action/><Queue title="My repair history" items={history}/></>;
  }
  const canUpdate = false;
  return <><PageHead eyebrow="OPERATIONS" title="Repairs queue"><span className="head-count">{repairs.length} tickets</span></PageHead><div className="toolbar card"><div className="search-inner">⌕<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by customer, IMEI or ticket ID"/></div><select><option>All statuses</option><option>Pending</option><option>In Progress</option><option>Waiting for Parts</option><option>Completed</option></select></div><section className="card table-card full-table"><div className="table-scroll"><table><thead><tr><th>Ticket & customer</th><th>Device / issue</th><th>Status</th><th>Assigned to</th><th>Estimate</th><th>{canUpdate ? 'Action' : 'Access'}</th></tr></thead><tbody>{repairs.map((repair) => <tr key={repair.id}><td><div className="customer"><span className="avatar small">{repair.avatar}</span><div><strong>{repair.id}</strong><small>{repair.customer} · {repair.phone}</small></div></div></td><td><strong>{repair.device}</strong><small>{repair.issue}</small></td><td><Status value={repair.status}/></td><td>{repair.tech}</td><td>{role === 'Technician' ? 'Restricted' : money(repair.total)}</td><td>{canUpdate ? <button className="table-action" onClick={() => updateStatus(repair.id)} disabled={repair.status === 'Delivered'}>{repair.status === 'Pending' ? 'Claim' : repair.status === 'Delivered' ? 'Closed' : 'Advance'} →</button> : <span className="readonly">Read only</span>}</td></tr>)}</tbody></table></div></section></>;
}

export function InventoryView({ role, parts }) {
  const admin = role === 'Admin';
  return <><PageHead eyebrow="STOCK CONTROL" title="Inventory & parts"><button className="primary">＋ Add item</button></PageHead><div className="notice"><span>!</span>{parts.filter((part) => part.stock <= part.min).length} items are below their minimum stock threshold.</div><section className="card table-card full-table"><div className="table-scroll"><table><thead><tr><th>Part</th><th>Compatible devices</th><th>Available</th>{admin && <><th>Cost</th><th>Selling price</th><th>Margin</th></>}<th>Stock health</th></tr></thead><tbody>{parts.map((part) => <tr key={part.sku}><td><strong>{part.name}</strong><small>{part.sku}</small></td><td>{part.device}</td><td><strong>{part.stock}</strong> units</td>{admin && <><td>{money(part.cost)}</td><td>{money(part.price)}</td><td>{Math.round((part.price - part.cost) / part.price * 100)}%</td></>}<td><span className={part.stock <= part.min ? 'stock-low' : 'stock-ok'}>{part.stock <= part.min ? 'Low stock' : 'Healthy'}</span></td></tr>)}</tbody></table></div>{!admin && <div className="restricted-note">Cost prices and profit margins are hidden for your role.</div>}</section></>;
}

export function SalesView({ sales, notify }) {
  return <><PageHead eyebrow="BILLING" title="Point of sale"><button className="primary" onClick={() => notify('New sale opened')}>＋ New sale</button></PageHead><div className="metric-grid three"><Metric icon="$" tone="green" label="Sales today" value="$1,482" meta="14 transactions"/><Metric icon="◇" tone="blue" label="Card & transfer" value="$986" meta="66.5% of sales"/><Metric icon="⌛" tone="amber" label="Pending payment" value="$340" meta="3 invoices"/></div><section className="card table-card"><div className="panel-title"><div><h2>Recent sales</h2><p>Repair and retail transactions</p></div></div><div className="table-scroll"><table><thead><tr><th>Sale</th><th>Customer</th><th>Description</th><th>Payment</th><th>Status</th><th>Amount</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><strong>{sale.id}</strong></td><td>{sale.customer}</td><td>{sale.item}</td><td>{sale.method}</td><td><Status value={sale.status}/></td><td><strong>{money(sale.amount)}</strong></td></tr>)}</tbody></table></div></section></>;
}

export function CustomersView({ repairs }) {
  return <><PageHead eyebrow="CUSTOMER DIRECTORY" title="Customers"><span className="head-count">{repairs.length} profiles</span></PageHead><div className="customer-grid">{repairs.map((repair) => <article className="card customer-profile" key={repair.id}><span className="avatar large">{repair.avatar}</span><div><h3>{repair.customer}</h3><p>{repair.phone}</p><small>Latest: {repair.device}</small></div><Status value={repair.status}/></article>)}</div></>;
}

export function ReportsView({ dashboard }) {
  return <><PageHead eyebrow="ADMIN ONLY" title="Reports & analytics"><select className="period"><option>This month</option><option>This year</option></select></PageHead><div className="metric-grid three"><Metric icon="$" tone="green" label="Gross revenue" value={money(dashboard.totalRevenue)} meta="Server-calculated"/><Metric icon="↗" tone="blue" label="Gross margin" value={`${dashboard.grossMargin}%`} meta="Server-calculated"/><Metric icon="✓" tone="violet" label="Technician yield" value={`${dashboard.technicianYield}/day`} meta="Per technician"/></div><RevenueCard/></>;
}

export function TeamView({ team, createStaff, deactivateStaff }) {
  const [adding, setAdding] = useState(false);
  const submit = async (event) => { event.preventDefault(); if (await createStaff(Object.fromEntries(new FormData(event.currentTarget)))) { event.currentTarget.reset(); setAdding(false); } };
  return <><PageHead eyebrow="ACCESS CONTROL" title="Team & roles"><button className="primary" onClick={() => setAdding((value) => !value)}>＋ Add staff</button></PageHead>
    {adding && <form className="card staff-form" onSubmit={submit}><label>Full name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Role<select name="role"><option>Technician</option><option>Front Desk</option></select></label><label>Temporary password<input name="password" type="password" minLength="10" required /></label><div><button type="button" className="outline" onClick={() => setAdding(false)}>Cancel</button><button className="primary">Create account</button></div></form>}
    <div className="team-grid">{team.map(({ id, email, name, role, description }) => <article className="card team-member" key={id}><span className="avatar large">{name.split(' ').map((part) => part[0]).join('')}</span><div><h3>{name}</h3><p>{email}</p><small>{description}</small></div><span className="role-badge">{role}</span>{role !== 'Admin' && <button className="staff-remove" onClick={() => deactivateStaff(id, name)}>Deactivate</button>}</article>)}</div></>;
}
