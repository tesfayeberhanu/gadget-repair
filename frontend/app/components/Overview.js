import { LowStockCard, Metric, PageHead, QueueCard, RevenueCard, SalesCard, StatusCard } from './SharedUI';

export default function Overview({ role, user, repairs, inventory, sales, dashboard, openIntake, setActive }) {
  const activeRepairs = repairs.filter((repair) => repair.status !== 'Ready for Pickup');
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase();
  const firstName = user?.name?.trim().split(/\s+/)[0] || role;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (role === 'Technician') return <>
    <PageHead eyebrow={today} title={`${greeting}, ${firstName}`}><button className="outline" onClick={() => setActive('Repairs')}>Open my queue →</button></PageHead>
    <div className="metric-grid three"><Metric icon="⌛" tone="amber" label="Assigned queue" value={dashboard.assignedPending} meta="Server-calculated"/><Metric icon="↻" tone="blue" label="In repair" value={dashboard.inProgress} meta="Live repair queue"/><Metric icon="✓" tone="green" label="Ready for pickup" value={dashboard.completedToday} meta="Server-calculated"/></div>
    <QueueCard repairs={activeRepairs} role={role} onView={() => setActive('Repairs')} />
  </>;

  if (role === 'Front Desk') return <>
    <PageHead eyebrow={today} title={`${firstName}'s front desk overview`}><button className="primary" onClick={openIntake}>＋ New repair intake</button></PageHead>
    <div className="metric-grid three"><Metric icon="＋" tone="blue" label="Intakes today" value={dashboard.intakesToday} meta="Server-calculated"/><Metric icon="♧" tone="amber" label="Awaiting assignment" value={dashboard.awaitingAssignment || 0} meta="Assign to a technician"/><Metric icon="Br" tone="violet" label="Daily sales" value={`ETB ${Number(dashboard.dailySales || 0).toLocaleString('en-ET')}`} meta="Paid transactions"/></div>
    <div className="metric-grid three"><Metric icon="Br" tone="green" label="Revenue" value={`ETB ${Number(dashboard.totalRevenue || 0).toLocaleString('en-ET')}`} meta="Finalized invoices"/><Metric icon="◇" tone="blue" label="Cash collected" value={`ETB ${Number(dashboard.cashCollected || 0).toLocaleString('en-ET')}`} meta="Payments received"/><Metric icon="⌛" tone="amber" label="Accounts receivable" value={`ETB ${Number(dashboard.accountsReceivable || 0).toLocaleString('en-ET')}`} meta="Customer balances"/></div>
    <QueueCard repairs={repairs.filter((repair) => repair.status === 'Received' && repair.tech === 'Unassigned')} role={role} title="Assign to Technician" actionLabel="Assign technician" onView={() => setActive('Repairs')} />
  </>;

  return <>
    <PageHead eyebrow={today} title={`${greeting}, ${firstName}`}><span className="head-count">Current overview</span></PageHead>
    <div className="metric-grid"><Metric icon="Br" tone="green" label="Revenue" value={`ETB ${Number(dashboard.totalRevenue || 0).toLocaleString('en-ET')}`} meta="Finalized invoices"/><Metric icon="◇" tone="blue" label="Cash collected" value={`ETB ${Number(dashboard.cashCollected || 0).toLocaleString('en-ET')}`} meta="Payments received"/><Metric icon="⌛" tone="amber" label="Accounts receivable" value={`ETB ${Number(dashboard.accountsReceivable || 0).toLocaleString('en-ET')}`} meta="Customer balances"/><Metric icon="Br" tone="violet" label="Net revenue" value={`ETB ${Number(dashboard.netRevenue || 0).toLocaleString('en-ET')}`} meta="Revenue − expenses"/></div>
    <div className="metric-grid three"><Metric icon="−" tone="amber" label="Expenses this month" value={`ETB ${Number(dashboard.monthlyExpenses || 0).toLocaleString('en-ET')}`} meta="Operating expenses"/><Metric icon="▥" tone="blue" label="Active repairs" value={dashboard.activeRepairs} meta="Live repair queue"/><Metric icon="!" tone="violet" label="Low stock items" value={dashboard.lowStock} meta="At or below threshold"/></div>
    <div className="dashboard-grid"><RevenueCard dashboard={dashboard}/><StatusCard repairs={repairs}/></div>
    <QueueCard repairs={repairs.slice(0, 4)} role={role} onView={() => setActive('Repairs')} />
    <div className="bottom-grid"><SalesCard sales={sales}/><LowStockCard parts={inventory} onView={() => setActive('Inventory')}/></div>
  </>;
}
