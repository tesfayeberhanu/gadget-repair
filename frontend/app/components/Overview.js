import { LowStockCard, Metric, PageHead, QueueCard, RevenueCard, SalesCard, StatusCard } from './SharedUI';

export default function Overview({ role, repairs, inventory, sales, dashboard, openIntake, setActive }) {
  const activeRepairs = repairs.filter((repair) => repair.status !== 'Ready for Pickup');

  if (role === 'Technician') return <>
    <PageHead eyebrow="TUESDAY, AUGUST 4" title="Good morning, Alex"><button className="outline" onClick={() => setActive('Repairs')}>Open my queue →</button></PageHead>
    <div className="metric-grid three"><Metric icon="⌛" tone="amber" label="Assigned queue" value={dashboard.assignedPending} meta="Server-calculated"/><Metric icon="↻" tone="blue" label="In repair" value={dashboard.inProgress} meta="Live repair queue"/><Metric icon="✓" tone="green" label="Ready for pickup" value={dashboard.completedToday} meta="Server-calculated"/></div>
    <QueueCard repairs={activeRepairs} role={role} onView={() => setActive('Repairs')} />
  </>;

  if (role === 'Front Desk') return <>
    <PageHead eyebrow="TUESDAY, AUGUST 4" title="Front desk overview"><button className="primary" onClick={openIntake}>＋ New repair intake</button></PageHead>
    <div className="metric-grid three"><Metric icon="＋" tone="blue" label="Intakes today" value={dashboard.intakesToday} meta="Server-calculated"/><Metric icon="✓" tone="green" label="Ready for pickup" value={dashboard.readyForPickup} meta="Live repair queue"/><Metric icon="Br" tone="violet" label="Daily sales" value={`ETB ${Number(dashboard.dailySales || 0).toLocaleString('en-ET')}`} meta="Paid transactions"/></div>
    <QueueCard repairs={repairs.filter((repair) => repair.status === 'Ready for Pickup')} role={role} title="Ready for pickup" onView={() => setActive('Repairs')} />
  </>;

  return <>
    <PageHead eyebrow="TUESDAY, AUGUST 4" title="Good morning, Alex"><span className="head-count">Current overview</span></PageHead>
    <div className="metric-grid"><Metric icon="Br" tone="green" label="Total revenue" value={`ETB ${Number(dashboard.totalRevenue || 0).toLocaleString('en-ET')}`} meta="Server-calculated"/><Metric icon="▥" tone="blue" label="Active repairs" value={dashboard.activeRepairs} meta="Live repair queue"/><Metric icon="✓" tone="violet" label="Ready this month" value={dashboard.completedThisMonth} meta="Server-calculated"/><Metric icon="!" tone="amber" label="Low stock items" value={dashboard.lowStock} meta="At or below threshold"/></div>
    <div className="dashboard-grid"><RevenueCard/><StatusCard repairs={repairs}/></div>
    <QueueCard repairs={repairs.slice(0, 4)} role={role} onView={() => setActive('Repairs')} />
    <div className="bottom-grid"><SalesCard sales={sales}/><LowStockCard parts={inventory} onView={() => setActive('Inventory')}/></div>
  </>;
}
