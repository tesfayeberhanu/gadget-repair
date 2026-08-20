import { useEffect, useState } from 'react';
import { DateRangeFilter, Metric, money, PageHead, Pagination, ResultCount, RevenueCard, SearchBox, Status } from './SharedUI';

const PAGE_SIZE = 10;
import { compareText, matchesSearch, periodBounds, stableSort, withinPeriod } from '../utils/listTools.mjs';

const canUseCreditForDelivery = (repair) => Boolean(repair?.creditEligibleForDelivery ?? repair?.isCreditCustomer);

export function RepairsView({ repairs, totalRepairs = repairs.length, inventory = [], technicians = [], search, setSearch, role, updateStatus, assignRepair, saveRepairProgress, confirmDelivery }) {
  const [deliveryTicket, setDeliveryTicket] = useState(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [deliveryPaymentAmount, setDeliveryPaymentAmount] = useState(0);
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState('CASH');
  const [deliveryPaymentKey, setDeliveryPaymentKey] = useState('');
  const [detailTicket, setDetailTicket] = useState(null);
  const [progressValue, setProgressValue] = useState(10);
  const [savingProgress, setSavingProgress] = useState(false);
  const [assignmentTicket, setAssignmentTicket] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const [repairSort, setRepairSort] = useState('newest');
  const [repairStatusFilter, setRepairStatusFilter] = useState('All');
  const [repairPeriod, setRepairPeriod] = useState('today');
  const [repairFrom, setRepairFrom] = useState('');
  const [repairTo, setRepairTo] = useState('');
  const [partRows, setPartRows] = useState([{ id: '', quantity: 1, unitPrice: '' }]);
  const [serviceChargeValue, setServiceChargeValue] = useState(0);
  const [existingPartPrices, setExistingPartPrices] = useState({});
  const [repairPage, setRepairPage] = useState(1);
  const [minePage, setMinePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const progressStatus = (progress) => progress >= 100 ? 'Ready for Pickup' : progress >= 75 ? 'In Repair' : progress >= 50 ? 'Repair Approved' : progress > 0 ? 'Diagnosing' : 'Received';
  const repairPeriodBounds = periodBounds(repairPeriod, repairFrom, repairTo);
  const visibleRepairs = stableSort(
    repairs.filter((repair) => (repairStatusFilter === 'All' || repair.status === repairStatusFilter) && withinPeriod(repair.createdAt, repairPeriodBounds)),
    (a, b) => repairSort === 'customer' ? compareText(a.customer, b.customer) : repairSort === 'status' ? a.progress - b.progress : repairSort === 'ticket' ? compareText(a.id, b.id) : repairSort === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt),
    (repair) => repair.id,
  );
  useEffect(() => { setRepairPage(1); setMinePage(1); setHistoryPage(1); }, [search, repairStatusFilter, repairSort, repairPeriod, repairFrom, repairTo]);
  useEffect(() => { if (repairPeriod === 'today' && (search.trim() || repairSort !== 'newest')) setRepairPeriod('all'); }, [search, repairSort]);
  const pageRepairs = visibleRepairs.slice((repairPage - 1) * PAGE_SIZE, repairPage * PAGE_SIZE);
  const activeDeliveryTicket = deliveryTicket ? repairs.find((repair) => repair.id === deliveryTicket.id) || deliveryTicket : null;
  const deliveryCreditEligible = canUseCreditForDelivery(activeDeliveryTicket);
  const submitDelivery = async (event) => {
    event.preventDefault();
    if (confirmingDelivery) return;
    setConfirmingDelivery(true);
    const password = new FormData(event.currentTarget).get('password');
    if (await confirmDelivery({ id: activeDeliveryTicket.id, password, paymentAmount: Number(deliveryPaymentAmount || 0), paymentMethod: deliveryPaymentMethod, idempotencyKey: deliveryPaymentKey })) setDeliveryTicket(null);
    setConfirmingDelivery(false);
  };
  const openRepairDetail = (repair) => {
    setDetailTicket(repair);
    setProgressValue(Math.max(25, repair.progress || 0));
    setPartRows([{ id: '', quantity: 1, unitPrice: '' }]);
    setServiceChargeValue(Number(repair.serviceCharge || repair.estimatedCost || 0));
    setExistingPartPrices(Object.fromEntries((repair.usedParts || []).map((part) => [part.id, Number(part.unitPrice || 0)])));
  };
  const submitRepairProgress = async (event) => {
    event.preventDefault();
    if (savingProgress) return;
    setSavingProgress(true);
    const data = new FormData(event.currentTarget);
    const action = detailTicket.status === 'Received' ? 'take' : 'progress';
    const parts = partRows.filter((item) => item.id).map((item) => ({ id: item.id, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) }));
    const partPrices = (detailTicket.usedParts || []).map((part) => ({ id: part.id, unitPrice: Number(existingPartPrices[part.id]) }));
    const saved = await saveRepairProgress({ id: detailTicket.id, action, notes: data.get('notes'), serviceCharge: serviceChargeValue, ...(action === 'progress' ? { progress: Number(data.get('progress')), parts, ...(progressValue === 100 ? { partPrices } : {}) } : {}) });
    if (saved) setDetailTicket(null);
    setSavingProgress(false);
  };
  const submitAssignment = async (event) => {
    event.preventDefault(); if (assigning) return; setAssigning(true);
    const technicianId = new FormData(event.currentTarget).get('technicianId');
    if (await assignRepair({ id: assignmentTicket.id, technicianId })) setAssignmentTicket(null);
    setAssigning(false);
  };
  const existingPartsTotal = (detailTicket?.usedParts || []).reduce((sum, part) => sum + part.quantity * Number(existingPartPrices[part.id] || 0), 0);
  const addedPartsTotal = partRows.reduce((sum, part) => sum + (part.id ? Number(part.quantity || 0) * Number(part.unitPrice || 0) : 0), 0);
  const finalCustomerTotal = existingPartsTotal + addedPartsTotal + Number(serviceChargeValue || 0);
  if (role === 'Technician') {
    const mine = visibleRepairs.filter((repair) => repair.isMine && !['Ready for Pickup', 'Delivered'].includes(repair.status));
    const history = visibleRepairs.filter((repair) => repair.isMine && ['Ready for Pickup', 'Delivered'].includes(repair.status));
    const RepairRows = ({ items, action }) => items.length ? items.map((repair) => <tr key={repair.id}>
      <td><strong>{repair.id}</strong><small>{repair.customer} · {repair.phone}{repair.isCreditCustomer ? ' · Credit customer' : ''}</small></td>
      <td><strong>{repair.device}</strong><small>{repair.issue}</small></td>
      <td><Status value={repair.status}/></td><td><div className="progress-cell"><span className={`progress-track progress-${progressStatus(repair.progress || 0).toLowerCase().replaceAll(' ', '-')}`}><i style={{ width: `${repair.progress || 0}%` }}/></span><b>{repair.progress || 0}%</b></div></td><td>{repair.tech}</td>
      {action && <td><button className="table-action" onClick={() => openRepairDetail(repair)}>{repair.status === 'Received' ? 'Review & take' : 'View / update'} →</button></td>}
    </tr>) : <tr><td colSpan={action ? 6 : 5} className="empty">No repairs in this section.</td></tr>;
    const Queue = ({ title, items, action, page, setPage }) => { const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE); return <section className="card table-card technician-queue"><div className="panel-title"><div><h2>{title}</h2><p>{items.length} repair{items.length === 1 ? '' : 's'}</p></div></div><div className="table-scroll"><table><thead><tr><th>Ticket & customer</th><th>Device / issue</th><th>Status</th><th>Progress</th><th>Assigned to</th>{action && <th>Action</th>}</tr></thead><tbody><RepairRows items={pageItems} action={action}/></tbody></table></div><Pagination page={page} setPage={setPage} totalItems={items.length} pageSize={PAGE_SIZE}/></section>; };
    return <><PageHead eyebrow="TECHNICIAN WORKSPACE" title="Repair management"><span className="head-count">Received 0% → Diagnosing 25% → Repair Approved 50% → In Repair 75% → Ready for Pickup 100%</span></PageHead><div className="toolbar card list-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search ticket, customer, phone, IMEI or device" label="Search repairs"/><ResultCount shown={visibleRepairs.length} total={totalRepairs} noun="repair"/><select value={repairStatusFilter} onChange={(event) => setRepairStatusFilter(event.target.value)} aria-label="Filter repairs by status"><option>All</option>{['Received','Diagnosing','Repair Approved','In Repair','Ready for Pickup','Delivered'].map((status) => <option key={status}>{status}</option>)}</select><select value={repairSort} onChange={(event) => setRepairSort(event.target.value)} aria-label="Sort repairs"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="ticket">Ticket number</option><option value="customer">Customer A–Z</option><option value="status">Progress low–high</option></select></div><DateRangeFilter period={repairPeriod} setPeriod={setRepairPeriod} from={repairFrom} setFrom={setRepairFrom} to={repairTo} setTo={setRepairTo} label="Filter repairs by intake date"/><Queue title="My assigned repairs" items={mine} action page={minePage} setPage={setMinePage}/><Queue title="My repair history" items={history} page={historyPage} setPage={setHistoryPage}/>
      {detailTicket && <div className="modal-backdrop"><div className="modal card repair-detail-modal"><div className="modal-head"><div><p>REPAIR QUEUE › DETAIL</p><h2>Repair Detail</h2></div><button type="button" onClick={() => setDetailTicket(null)} disabled={savingProgress}>×</button></div><div className="repair-detail-grid"><section className="repair-detail-panel"><h3>⌕ &nbsp; Device Information</h3><dl className="repair-facts"><dt>Repair ID</dt><dd>{detailTicket.id}</dd><dt>Customer</dt><dd>{detailTicket.customer}</dd><dt>Phone</dt><dd>{detailTicket.phone}</dd><dt>Device</dt><dd>{detailTicket.device}</dd><dt>IMEI / Serial</dt><dd>{detailTicket.imei || 'Not recorded'}</dd><dt>Intake Date</dt><dd>{new Date(detailTicket.createdAt).toLocaleString()}</dd><dt>Assigned To</dt><dd>{detailTicket.tech}</dd><dt>Initial Maintenance Estimate</dt><dd>{money(detailTicket.estimatedCost)}</dd>{detailTicket.finalPrice != null && <><dt>Final Price</dt><dd>{money(detailTicket.finalPrice)}</dd></>}</dl><div className="repair-issue"><strong>ISSUE DESCRIPTION</strong><p>{detailTicket.issue}</p>{detailTicket.condition && <small>Condition: {detailTicket.condition}</small>}</div><div className="repair-used-parts"><strong>PARTS USED</strong>{detailTicket.usedParts?.length > 0 ? detailTicket.usedParts.map((part) => <span key={part.id}>{part.name} <b>× {part.quantity} · {money(part.unitPrice)}</b></span>) : <small>No parts added</small>}<div className="repair-cost-breakdown"><span>Parts cost <b>{money(existingPartsTotal + addedPartsTotal)}</b></span><span>Service charge <b>{money(serviceChargeValue)}</b></span><strong>Total <b>{money(detailTicket.finalPrice ?? finalCustomerTotal)}</b></strong></div></div></section><section className="repair-detail-panel update"><h3>✎ &nbsp; {progressValue === 100 ? 'Finalize Price & Ready for Pickup' : detailTicket.status === 'Received' ? 'Review and Take Job' : 'Update Repair Progress'}</h3><form className="repair-update-form" onSubmit={submitRepairProgress}><label>Technician Comments<textarea name="notes" defaultValue={detailTicket.notes} placeholder="Add diagnosis, work completed, or other repair notes…" /></label><label>Maintenance charge (ETB)<input name="serviceCharge" type="number" min="0" step="0.01" value={serviceChargeValue} onChange={(event) => setServiceChargeValue(event.target.value)} required /></label>{detailTicket.status !== 'Received' && <><label>Repair Status<select name="progress" value={progressValue} onChange={(event) => setProgressValue(Number(event.target.value))}>{[[0,'Received'],[25,'Diagnosing'],[50,'Repair Approved'],[75,'In Repair'],[100,'Ready for Pickup']].map(([value,label]) => <option value={value} key={value} disabled={value < detailTicket.progress}>{value}% — {label}</option>)}</select><span className="progress-status-preview">Status: <strong>{progressStatus(progressValue)}</strong></span></label>{progressValue === 100 && detailTicket.usedParts?.length > 0 && <div className="final-part-prices"><strong>Adjust parts already used</strong>{detailTicket.usedParts.map((part) => <label key={part.id}><span>{part.name} × {part.quantity}</span><input type="number" min="0" step="0.01" value={existingPartPrices[part.id] ?? 0} onChange={(event) => setExistingPartPrices((prices) => ({ ...prices, [part.id]: event.target.value }))} required /></label>)}</div>}<div className="multi-part-picker"><strong>{progressValue === 100 ? 'Add final parts' : 'Parts used this update'}</strong>{partRows.map((row, index) => <div className={`part-usage-fields ${progressValue === 100 ? 'with-price' : ''}`} key={index}><label>Inventory item<select value={row.id} required={index === 0 && progressValue >= 75 && !detailTicket.usedParts?.length} onChange={(event) => { const part = inventory.find((item) => item.id === event.target.value); setPartRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, id: event.target.value, unitPrice: part?.sellingPrice ?? '' } : item)); }}><option value="">{index === 0 && progressValue >= 75 && !detailTicket.usedParts?.length ? 'Select required part' : 'No item selected'}</option>{inventory.filter((part) => part.stock > 0 && !detailTicket.usedParts?.some((usedPart) => usedPart.id === part.id) && !partRows.some((selected, selectedIndex) => selectedIndex !== index && selected.id === part.id)).map((part) => <option value={part.id} key={part.id}>{part.name} · {part.stock} available</option>)}</select></label><label>Quantity<input type="number" min="1" step="1" value={row.quantity} onChange={(event) => setPartRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))}/></label>{progressValue === 100 && <label>Selling price<input type="number" min="0" step="0.01" value={row.unitPrice} onChange={(event) => setPartRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, unitPrice: event.target.value } : item))} required={Boolean(row.id)} /></label>}{partRows.length > 1 && <button type="button" className="remove-part" onClick={() => setPartRows((rows) => rows.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove part">×</button>}</div>)}<button type="button" className="outline add-part" onClick={() => setPartRows((rows) => [...rows, { id: '', quantity: 1, unitPrice: '' }])}>＋ Add another part</button></div>{progressValue === 100 && <div className="final-price-summary"><span>Existing parts <b>{money(existingPartsTotal)}</b></span><span>Added parts <b>{money(addedPartsTotal)}</b></span><span>Maintenance charge <b>{money(serviceChargeValue)}</b></span><strong>Final customer total <b>{money(finalCustomerTotal)}</b></strong></div>}</>}<button className="primary" disabled={savingProgress}>{savingProgress ? 'Saving…' : detailTicket.status === 'Received' ? 'Take The Job' : progressValue === 100 ? `Confirm ${money(finalCustomerTotal)} & Ready` : 'Save Update'}</button></form></section></div></div></div>}
    </>;
  }
  return <><PageHead eyebrow="OPERATIONS" title="Repairs queue"><span className="head-count">Received 0% → Diagnosing 25% → Repair Approved 50% → In Repair 75% → Ready for Pickup 100%</span></PageHead><div className="toolbar card list-toolbar"><SearchBox value={search} onChange={setSearch} placeholder="Search ticket, customer, phone, IMEI, device or status" label="Search repairs"/><ResultCount shown={visibleRepairs.length} total={totalRepairs} noun="repair"/><select value={repairStatusFilter} onChange={(event) => setRepairStatusFilter(event.target.value)} aria-label="Filter repairs by status"><option>All</option>{['Received','Diagnosing','Repair Approved','In Repair','Ready for Pickup','Delivered'].map((status) => <option key={status}>{status}</option>)}</select><select value={repairSort} onChange={(event) => setRepairSort(event.target.value)} aria-label="Sort repairs"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="ticket">Ticket number</option><option value="customer">Customer A–Z</option><option value="status">Progress low–high</option></select></div><DateRangeFilter period={repairPeriod} setPeriod={setRepairPeriod} from={repairFrom} setFrom={setRepairFrom} to={repairTo} setTo={setRepairTo} label="Filter repairs by intake date"/><section className="card table-card full-table"><div className="table-scroll"><table><thead><tr><th>Ticket & customer</th><th>Device / issue</th><th>Status</th><th>Assigned to</th><th>Invoice</th><th>Action</th></tr></thead><tbody>{pageRepairs.length ? pageRepairs.map((repair) => <tr key={repair.id}><td><div className="customer"><span className="avatar small">{repair.avatar}</span><div><strong>{repair.id}</strong><small>{repair.customer} · {repair.phone}{repair.isCreditCustomer ? ' · Credit' : ''}</small></div></div></td><td><strong>{repair.device}</strong><small>{repair.issue}</small></td><td><Status value={repair.status}/>{repair.delivery && <small>By {repair.delivery.deliveredBy} · {new Date(repair.delivery.deliveredAt).toLocaleString()}</small>}</td><td>{repair.tech}</td><td><strong>{money(repair.invoiceTotal ?? repair.total)}</strong>{repair.saleId ? <small>{repair.paymentStatus} · Due {money(repair.balanceDue)}</small> : <small>Estimate</small>}</td><td>{role === 'Front Desk' && repair.status === 'Received' ? <button className="primary delivery-button" onClick={() => setAssignmentTicket(repair)}>{repair.tech === 'Unassigned' ? 'Assign technician' : 'Reassign'}</button> : role === 'Front Desk' && repair.status === 'Ready for Pickup' ? <button className="primary delivery-button" onClick={() => { setDeliveryTicket(repair); setDeliveryPaymentAmount(canUseCreditForDelivery(repair) ? 0 : repair.balanceDue); setDeliveryPaymentMethod('CASH'); setDeliveryPaymentKey(crypto.randomUUID()); }}>Confirm delivery</button> : <span className="readonly">{repair.status === 'Delivered' ? 'Delivery recorded' : 'Read only'}</span>}</td></tr>) : <tr><td colSpan="6" className="empty">No repairs match the current search and filter.</td></tr>}</tbody></table></div><Pagination page={repairPage} setPage={setRepairPage} totalItems={visibleRepairs.length} pageSize={PAGE_SIZE}/></section>
    {activeDeliveryTicket && <div className="modal-backdrop"><form className="modal card delivery-modal" onSubmit={submitDelivery}><div className="modal-head"><div><p>SECURE HANDOVER</p><h2>Confirm delivery</h2><small>{deliveryCreditEligible ? 'Credit invoice: zero, partial, or full payment is allowed.' : 'Regular customer: the balance must be paid in full.'}</small></div><button type="button" onClick={() => setDeliveryTicket(null)} disabled={confirmingDelivery}>×</button></div><div className="delivery-summary"><strong>{activeDeliveryTicket.id} · {deliveryCreditEligible ? 'Credit customer' : 'Regular customer'}</strong><span>{activeDeliveryTicket.customer}</span><span>{activeDeliveryTicket.device}</span><span>Invoice: {money(activeDeliveryTicket.invoiceTotal)}</span><span>Paid: {money(activeDeliveryTicket.amountPaid)}</span><b>Balance due: {money(activeDeliveryTicket.balanceDue)} · {activeDeliveryTicket.paymentStatus}</b></div><div className="form-grid delivery-payment"><label>Payment now (ETB)<input type="number" min="0" max={activeDeliveryTicket.balanceDue} step="0.01" value={deliveryPaymentAmount} onChange={(event) => setDeliveryPaymentAmount(event.target.value)} required /></label><label>Payment method<select value={deliveryPaymentMethod} onChange={(event) => setDeliveryPaymentMethod(event.target.value)} disabled={Number(deliveryPaymentAmount || 0) === 0}><option value="CASH">Cash</option><option value="CARD">Card</option><option value="DIGITAL_TRANSFER">Transfer</option></select></label></div><label className="delivery-password">Your password<input name="password" type="password" autoComplete="current-password" required autoFocus placeholder="Re-enter your password"/></label><div className="modal-actions"><button type="button" className="outline" onClick={() => setDeliveryTicket(null)} disabled={confirmingDelivery}>Cancel</button><button className="primary" disabled={confirmingDelivery}>{confirmingDelivery ? 'Confirming…' : 'Confirm delivery'}</button></div></form></div>}
    {assignmentTicket && <div className="modal-backdrop"><form className="modal card assignment-modal" onSubmit={submitAssignment}><div className="modal-head"><div><p>FRONT DESK ASSIGNMENT</p><h2>Assign technician</h2><small>{assignmentTicket.id} · {assignmentTicket.device}</small></div><button type="button" onClick={() => setAssignmentTicket(null)} disabled={assigning}>×</button></div><label className="assignment-select">Technician<select name="technicianId" required defaultValue=""><option value="" disabled>Select an active technician</option>{technicians.map((technician) => <option value={technician.id} key={technician.id}>{technician.name}</option>)}</select></label>{technicians.length === 0 && <div className="login-error">No active technicians are available.</div>}<div className="modal-actions"><button type="button" className="outline" onClick={() => setAssignmentTicket(null)} disabled={assigning}>Cancel</button><button className="primary" disabled={assigning || technicians.length === 0}>{assigning ? 'Assigning…' : 'Assign Job'}</button></div></form></div>}
  </>;
}

export function InventoryView({ role, parts, dashboard = {}, createInventoryItem, updateInventoryItem, deleteInventoryItem }) {
  const admin = role === 'Admin';
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inventoryType, setInventoryType] = useState('Spare Parts');
  const [inventorySort, setInventorySort] = useState('name');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryPage, setInventoryPage] = useState(1);
  const closeForm = () => { if (!saving) { setAdding(false); setEditing(null); } };
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    setSaving(true);
    try {
      const form = Object.fromEntries(new FormData(formElement));
      const saved = editing ? await updateInventoryItem({ ...form, id: editing.id }) : await createInventoryItem(form);
      if (saved) { formElement.reset(); setAdding(false); setEditing(null); setInventoryType(['Accessory', 'Cable'].includes(form.category) ? 'Accessories' : 'Spare Parts'); }
    } finally { setSaving(false); }
  };
  const accessoryCategories = ['Accessory', 'Cable'];
  const typeParts = parts.filter((part) => inventoryType === 'Accessories' ? accessoryCategories.includes(part.category) : !accessoryCategories.includes(part.category));
  const visibleParts = stableSort(
    typeParts.filter((part) => matchesSearch([part.name, part.sku, part.category, part.device, part.description, part.stock, part.sellingPrice], inventorySearch)),
    (a, b) => inventorySort === 'stock-low' ? a.stock - b.stock : inventorySort === 'stock-high' ? b.stock - a.stock : inventorySort === 'value' ? (b.stock * b.sellingPrice) - (a.stock * a.sellingPrice) : inventorySort === 'updated' ? new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt) : inventorySort === 'name-desc' ? compareText(b.name, a.name) : compareText(a.name, b.name),
    (part) => part.sku || part.id,
  );
  useEffect(() => { setInventoryPage(1); }, [inventoryType, inventorySort, inventorySearch]);
  const pageParts = visibleParts.slice((inventoryPage - 1) * PAGE_SIZE, inventoryPage * PAGE_SIZE);
  const accessoryCount = parts.filter((part) => accessoryCategories.includes(part.category)).length;
  return <><PageHead eyebrow="STOCK CONTROL" title="Inventory & parts">{admin && <button className="primary" onClick={() => { setEditing(null); setAdding(true); }}>＋ Add item</button>}</PageHead>{admin && <><div className="metric-grid inventory-balance-grid"><Metric icon="□" tone="blue" label="Spare-parts revenue" value={money(dashboard.sparePartsRevenue)} meta="Finalized repair invoices"/><Metric icon="◇" tone="violet" label="Accessories revenue" value={money(dashboard.accessoriesRevenue)} meta="Finalized repair invoices"/><Metric icon="⌁" tone="amber" label="Maintenance revenue" value={money(dashboard.maintenanceRevenue)} meta={`${dashboard.completedJobs || 0} completed jobs`}/><Metric icon="Br" tone="green" label="Total revenue" value={money(dashboard.totalRevenue)} meta="Full finalized invoice value"/></div><section className="card inventory-formula"><strong>Revenue recognition</strong><span>Σ full totals of finalized invoices</span><small>Later customer payments increase cash collected without increasing revenue again.</small></section></>}<div className="inventory-controls"><div className="inventory-tabs card"><button className={inventoryType === 'Spare Parts' ? 'active' : ''} onClick={() => setInventoryType('Spare Parts')}>Spare Parts <b>{parts.length - accessoryCount}</b></button><button className={inventoryType === 'Accessories' ? 'active' : ''} onClick={() => setInventoryType('Accessories')}>Accessories <b>{accessoryCount}</b></button></div><div className="toolbar card list-toolbar inventory-list-toolbar"><SearchBox value={inventorySearch} onChange={setInventorySearch} placeholder="Search name, SKU, category or device" label="Search inventory"/><ResultCount shown={visibleParts.length} total={typeParts.length} noun="item"/><select value={inventorySort} onChange={(event) => setInventorySort(event.target.value)} aria-label="Sort inventory"><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="stock-low">Lowest stock</option><option value="stock-high">Highest stock</option><option value="value">Highest value</option><option value="updated">Recently updated</option></select></div></div><div className="notice"><span>!</span>{typeParts.filter((part) => part.stock <= part.min).length} {inventoryType.toLowerCase()} are below their minimum stock threshold.</div><section className="card table-card full-table inventory-table"><div className="panel-title"><div><h2>☷ &nbsp; {inventoryType}</h2><p>{visibleParts.length} matching item{visibleParts.length === 1 ? '' : 's'}</p></div></div><div className="table-scroll"><table><thead><tr><th>ID</th><th>Item Name</th><th>Category</th><th>Qty</th>{admin && <th>Buying Price</th>}<th>Selling Price</th><th>Sales Value</th><th>Description</th><th>Last Updated</th>{admin && <th>Actions</th>}</tr></thead><tbody>{pageParts.length ? pageParts.map((part, index) => <tr key={part.id}><td>{(inventoryPage - 1) * PAGE_SIZE + index + 1}</td><td><strong>{part.name}</strong></td><td><span className="category-badge">{part.category}</span></td><td><span className={part.stock <= part.min ? 'quantity-badge low' : 'quantity-badge'}>{part.stock}</span></td>{admin && <td>{money(part.buyingPrice)}</td>}<td>{money(part.sellingPrice)}</td><td><strong>{money(part.stock * part.sellingPrice)}</strong></td><td className="description-cell" title={part.description}>{part.description || '—'}</td><td>{new Date(part.updatedAt || part.createdAt).toLocaleDateString()}</td>{admin && <td><div className="inventory-actions"><button onClick={() => { setEditing(part); setAdding(true); }}>✎ Edit</button><button className="delete" onClick={() => deleteInventoryItem(part.id, part.name)}>♲ Delete</button></div></td>}</tr>) : <tr><td colSpan={admin ? 10 : 8} className="empty">No inventory items match the current search.</td></tr>}</tbody></table></div><Pagination page={inventoryPage} setPage={setInventoryPage} totalItems={visibleParts.length} pageSize={PAGE_SIZE}/></section>
    {adding && <div className="modal-backdrop"><form className="modal card inventory-modal" onSubmit={submit}><div className="modal-head"><div><p>STOCK CONTROL</p><h2>{editing ? '✎ Edit Inventory Item' : '＋ Add Inventory Item'}</h2></div><button type="button" onClick={closeForm} disabled={saving} aria-label="Close">×</button></div><div className="form-grid"><label>Item Name *<input name="name" required autoFocus placeholder="e.g., iPhone Screen" defaultValue={editing?.name || ''} /></label><label>Category *<select name="category" required defaultValue={editing?.category || ''}><option value="" disabled>Select category</option><option>Screen</option><option>Battery</option><option>Accessory</option><option>Cable</option><option>Camera</option><option>Part</option><option>Other</option></select></label><label>Quantity *<input name="quantity" type="number" min="0" step="1" defaultValue={editing?.stock ?? 0} required /></label><label>Buying Price (ETB) *<input name="buyingPrice" type="number" min="0" step="0.01" placeholder="0.00" defaultValue={editing?.buyingPrice ?? ''} required /></label><label>Selling Price (ETB) *<input name="sellingPrice" type="number" min="0" step="0.01" placeholder="0.00" defaultValue={editing?.sellingPrice ?? ''} required /></label><label className="wide">Description<textarea name="description" placeholder="Optional details" defaultValue={editing?.description || ''} /></label></div><div className="modal-actions"><button type="button" className="outline" onClick={closeForm} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : '＋ Add Item'}</button></div></form></div>}
  </>;
}

export function ExpensesView({ expenses = [], dashboard = {}, createExpense, updateExpense, deleteExpense }) {
  const categories = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Marketing', 'Taxes', 'Other'];
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expenseSort, setExpenseSort] = useState('newest');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expensePeriod, setExpensePeriod] = useState('today');
  const [expenseFrom, setExpenseFrom] = useState('');
  const [expenseTo, setExpenseTo] = useState('');
  const [expensePage, setExpensePage] = useState(1);
  const closeForm = () => { if (!saving) { setAdding(false); setEditing(null); } };
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const saved = editing ? await updateExpense({ ...form, id: editing.id }) : await createExpense(form);
    if (saved) { formElement.reset(); closeForm(); }
    setSaving(false);
  };
  const expensePeriodBounds = periodBounds(expensePeriod, expenseFrom, expenseTo);
  const visibleExpenses = stableSort(
    expenses.filter((expense) => (categoryFilter === 'All' || expense.category === categoryFilter) && withinPeriod(expense.expenseDate, expensePeriodBounds) && matchesSearch([expense.description, expense.category, expense.recordedBy, expense.notes, expense.amount, new Date(expense.expenseDate).toLocaleDateString()], expenseSearch)),
    (a, b) => expenseSort === 'oldest' ? new Date(a.expenseDate) - new Date(b.expenseDate) : expenseSort === 'amount-high' ? b.amount - a.amount : expenseSort === 'amount-low' ? a.amount - b.amount : expenseSort === 'description' ? compareText(a.description, b.description) : new Date(b.expenseDate) - new Date(a.expenseDate),
    (expense) => expense.id,
  );
  useEffect(() => { setExpensePage(1); }, [categoryFilter, expenseSort, expenseSearch, expensePeriod, expenseFrom, expenseTo]);
  useEffect(() => { if (expensePeriod === 'today' && (expenseSearch.trim() || expenseSort !== 'newest')) setExpensePeriod('all'); }, [expenseSearch, expenseSort]);
  const pageExpenses = visibleExpenses.slice((expensePage - 1) * PAGE_SIZE, expensePage * PAGE_SIZE);
  return <><PageHead eyebrow="FINANCIAL CONTROL" title="Expense tracking"><button className="primary" onClick={() => { setEditing(null); setAdding(true); }}>＋ Record expense</button></PageHead>
    <div className="metric-grid"><Metric icon="◷" tone="amber" label="Daily expenses" value={money(dashboard.dailyExpenses)} meta="Today"/><Metric icon="7" tone="blue" label="Weekly expenses" value={money(dashboard.weeklyExpenses)} meta="Monday – Sunday"/><Metric icon="M" tone="violet" label="Monthly expenses" value={money(dashboard.monthlyExpenses)} meta="Current month"/><Metric icon="Y" tone="green" label="Yearly expenses" value={money(dashboard.yearlyExpenses)} meta="Current year"/></div>
    <div className="metric-grid three"><Metric icon="−" tone="amber" label="All-time expenses" value={money(dashboard.totalExpenses)} meta={`${expenses.length} recorded expense${expenses.length === 1 ? '' : 's'}`}/><Metric icon="Br" tone="blue" label="Gross revenue" value={money(dashboard.totalRevenue)} meta="All revenue streams"/><Metric icon="Br" tone="green" label="Net revenue" value={money(dashboard.netRevenue)} meta="Revenue − expenses"/></div>
    <div className="expense-controls card list-toolbar"><SearchBox value={expenseSearch} onChange={setExpenseSearch} placeholder="Search description, notes, category or staff" label="Search expenses"/><ResultCount shown={visibleExpenses.length} total={expenses.length} noun="expense"/><label>Category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter expenses by category"><option>All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Sort<select value={expenseSort} onChange={(event) => setExpenseSort(event.target.value)} aria-label="Sort expenses"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="description">Description A–Z</option><option value="amount-high">Amount high–low</option><option value="amount-low">Amount low–high</option></select></label></div>
    <DateRangeFilter period={expensePeriod} setPeriod={setExpensePeriod} from={expenseFrom} setFrom={setExpenseFrom} to={expenseTo} setTo={setExpenseTo} label="Filter expenses by date"/>
    <section className="card table-card full-table expense-table"><div className="panel-title"><div><h2>Expense ledger</h2><p>{visibleExpenses.length} matching record{visibleExpenses.length === 1 ? '' : 's'}</p></div></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Recorded by</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{pageExpenses.length ? pageExpenses.map((expense) => <tr key={expense.id}><td>{new Date(expense.expenseDate).toLocaleDateString()}</td><td><strong>{expense.description}</strong>{expense.notes && <small>{expense.notes}</small>}</td><td><span className="category-badge">{expense.category}</span></td><td>{expense.recordedBy}</td><td><strong className="expense-amount">{money(expense.amount)}</strong></td><td><div className="expense-actions"><button onClick={() => { setEditing(expense); setAdding(true); }}>✎ Edit</button><button className="delete" onClick={() => deleteExpense(expense.id, expense.description)}>♲ Delete</button></div></td></tr>) : <tr><td colSpan="6" className="empty">No expenses match this filter.</td></tr>}</tbody></table></div><Pagination page={expensePage} setPage={setExpensePage} totalItems={visibleExpenses.length} pageSize={PAGE_SIZE}/></section>
    {adding && <div className="modal-backdrop"><form className="modal card expense-modal" onSubmit={submit}><div className="modal-head"><div><p>EXPENSE LEDGER</p><h2>{editing ? '✎ Edit expense' : '＋ Record expense'}</h2><small>Track operating costs separately from inventory purchases.</small></div><button type="button" onClick={closeForm} disabled={saving} aria-label="Close">×</button></div><div className="form-grid"><label>Description *<input name="description" autoFocus required placeholder="e.g., August shop rent" defaultValue={editing?.description || ''}/></label><label>Category *<select name="category" required defaultValue={editing?.category || ''}><option value="" disabled>Select category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Amount (ETB) *<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" defaultValue={editing?.amount ?? ''}/></label><label>Expense date *<input name="expenseDate" type="date" required defaultValue={editing?.expenseDate?.slice(0, 10) || today}/></label><label className="wide">Notes<textarea name="notes" placeholder="Receipt number, supplier, or optional details" defaultValue={editing?.notes || ''}/></label></div><div className="modal-actions"><button type="button" className="outline" onClick={closeForm} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Record expense'}</button></div></form></div>}
  </>;
}

export function SalesView({ sales, dashboard = {}, recordPayment }) {
  const [salesSort, setSalesSort] = useState('recent');
  const [salesSearch, setSalesSearch] = useState('');
  const [salesStatusFilter, setSalesStatusFilter] = useState('All');
  const [paymentSale, setPaymentSale] = useState(null);
  const [paymentKey, setPaymentKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [salesPeriod, setSalesPeriod] = useState('today');
  const [salesFrom, setSalesFrom] = useState('');
  const [salesTo, setSalesTo] = useState('');
  const [salesPage, setSalesPage] = useState(1);
  const salesPeriodBounds = periodBounds(salesPeriod, salesFrom, salesTo);
  const visibleSales = stableSort(
    sales.filter((sale) => (salesStatusFilter === 'All' || sale.status === salesStatusFilter) && withinPeriod(sale.createdAt, salesPeriodBounds) && matchesSearch([sale.id, sale.customer, sale.item, sale.method, sale.status, sale.invoiceStatus, sale.invoiceTotal, sale.amountPaid, sale.balanceDue], salesSearch)),
    (a, b) => salesSort === 'customer' ? compareText(a.customer, b.customer) : salesSort === 'amount-high' ? b.invoiceTotal - a.invoiceTotal : salesSort === 'amount-low' ? a.invoiceTotal - b.invoiceTotal : salesSort === 'balance-high' ? b.balanceDue - a.balanceDue : salesSort === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt),
    (sale) => sale.recordId || sale.id,
  );
  useEffect(() => { setSalesPage(1); }, [salesStatusFilter, salesSort, salesSearch, salesPeriod, salesFrom, salesTo]);
  useEffect(() => { if (salesPeriod === 'today' && (salesSearch.trim() || salesSort !== 'recent')) setSalesPeriod('all'); }, [salesSearch, salesSort]);
  const pageSales = visibleSales.slice((salesPage - 1) * PAGE_SIZE, salesPage * PAGE_SIZE);
  const submitPayment = async (event) => {
    event.preventDefault(); if (saving) return; setSaving(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    if (await recordPayment({ ...form, saleId: paymentSale.recordId, idempotencyKey: paymentKey })) setPaymentSale(null);
    setSaving(false);
  };
  return <><PageHead eyebrow="BILLING" title="Point of sale"><span className="head-count">Revenue, collections and customer balances</span></PageHead>
    <div className="metric-grid three"><Metric icon="Br" tone="green" label="Revenue" value={money(dashboard.totalRevenue)} meta="Finalized invoice value"/><Metric icon="◇" tone="blue" label="Cash collected" value={money(dashboard.cashCollected)} meta="Valid payments received"/><Metric icon="⌛" tone="amber" label="Accounts receivable" value={money(dashboard.accountsReceivable)} meta="Finalized unpaid balances"/></div>
    <div className="toolbar card list-toolbar"><SearchBox value={salesSearch} onChange={setSalesSearch} placeholder="Search invoice, customer, item or payment status" label="Search invoices"/><ResultCount shown={visibleSales.length} total={sales.length} noun="invoice"/><select value={salesStatusFilter} onChange={(event) => setSalesStatusFilter(event.target.value)} aria-label="Filter invoices by payment status"><option>All</option>{['Unpaid','Partially Paid','Paid','Refunded'].map((status) => <option key={status}>{status}</option>)}</select><select value={salesSort} onChange={(event) => setSalesSort(event.target.value)} aria-label="Sort sales"><option value="recent">Recent first</option><option value="oldest">Oldest first</option><option value="customer">Customer A–Z</option><option value="balance-high">Highest balance</option><option value="amount-high">Amount high–low</option><option value="amount-low">Amount low–high</option></select></div>
    <DateRangeFilter period={salesPeriod} setPeriod={setSalesPeriod} from={salesFrom} setFrom={setSalesFrom} to={salesTo} setTo={setSalesTo} label="Filter invoices by date"/>
    <section className="card table-card"><div className="panel-title"><div><h2>Invoices & collections</h2><p>Revenue is recognized at finalization; later payments only update collections.</p></div></div><div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Description</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>{pageSales.length ? pageSales.map((sale) => <tr key={sale.recordId}><td><strong>{sale.id}</strong><small>{sale.invoiceStatus}{sale.isCreditSale ? ' · Credit' : ''}</small></td><td>{sale.customer}</td><td>{sale.item}</td><td><strong>{money(sale.invoiceTotal)}</strong></td><td>{money(sale.amountPaid)}<small>{sale.method}</small></td><td><strong>{money(sale.balanceDue)}</strong></td><td><Status value={sale.status}/></td><td>{sale.invoiceStatus === 'FINALIZED' && sale.balanceDue > 0 ? <button className="table-action" onClick={() => { setPaymentSale(sale); setPaymentKey(crypto.randomUUID()); }}>Record payment</button> : <span className="readonly">{sale.balanceDue === 0 ? 'Settled' : 'Closed'}</span>}</td></tr>) : <tr><td colSpan="8" className="empty">No invoices match the current search and filter.</td></tr>}</tbody></table></div><Pagination page={salesPage} setPage={setSalesPage} totalItems={visibleSales.length} pageSize={PAGE_SIZE}/></section>
    {paymentSale && <div className="modal-backdrop"><form className="modal card payment-modal" onSubmit={submitPayment}><div className="modal-head"><div><p>PAYMENT COLLECTION</p><h2>Record invoice payment</h2><small>{paymentSale.id} · {paymentSale.customer}</small></div><button type="button" onClick={() => setPaymentSale(null)} disabled={saving}>×</button></div><div className="delivery-summary"><span>Invoice total: {money(paymentSale.invoiceTotal)}</span><span>Already paid: {money(paymentSale.amountPaid)}</span><b>Balance due: {money(paymentSale.balanceDue)}</b></div><div className="form-grid"><label>Amount (ETB)<input name="amount" type="number" min="0.01" max={paymentSale.balanceDue} step="0.01" defaultValue={paymentSale.balanceDue} required autoFocus /></label><label>Payment method<select name="method" defaultValue="CASH"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="DIGITAL_TRANSFER">Transfer</option></select></label></div><div className="modal-actions"><button type="button" className="outline" onClick={() => setPaymentSale(null)} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</button></div></form></div>}
  </>;
}

export function CustomersView({ role, canCreateIntake, customers, repairs = [], createCustomer, updateCustomer, startCustomerIntake, focusCustomer, clearFocusCustomer }) {
  const [customerSort, setCustomerSort] = useState('name');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('All');
  const [formCustomer, setFormCustomer] = useState(undefined);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState('all');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [customerPage, setCustomerPage] = useState(1);
  const canManage = ['Admin', 'Front Desk'].includes(role);
  useEffect(() => {
    if (!focusCustomer) return;
    const current = customers.find((customer) => customer.id === focusCustomer.id) || focusCustomer;
    setCustomerTypeFilter('All');
    setCustomerSearch('');
    setDetailCustomer(current);
    clearFocusCustomer?.();
  }, [focusCustomer]);
  useEffect(() => { setHistoryPeriod('all'); setHistoryFrom(''); setHistoryTo(''); }, [detailCustomer?.id]);
  const canStartIntake = Boolean(canCreateIntake) && typeof startCustomerIntake === 'function';
  const visibleCustomers = stableSort(
    customers.filter((customer) => {
      const matchesType = customerTypeFilter === 'All' || (customerTypeFilter === 'Credit' ? customer.isCreditCustomer : customerTypeFilter === 'Balance due' ? customer.accountsReceivable > 0 : !customer.isCreditCustomer);
      return matchesType && matchesSearch([customer.name, customer.phone, customer.isCreditCustomer ? 'credit customer' : 'regular customer', customer.accountsReceivable, customer.invoices], customerSearch);
    }),
    (a, b) => customerSort === 'balance' ? b.accountsReceivable - a.accountsReceivable : customerSort === 'recent' ? new Date(b.updatedAt) - new Date(a.updatedAt) : customerSort === 'repairs' ? b.repairCount - a.repairCount : customerSort === 'name-desc' ? compareText(b.name, a.name) : compareText(a.name, b.name),
    (customer) => customer.id,
  );
  useEffect(() => { setCustomerPage(1); }, [customerTypeFilter, customerSort, customerSearch]);
  const pageCustomers = visibleCustomers.slice((customerPage - 1) * PAGE_SIZE, customerPage * PAGE_SIZE);
  const submitCustomer = async (event) => {
    event.preventDefault(); if (saving) return; setSaving(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const saved = formCustomer ? await updateCustomer({ ...form, id: formCustomer.id }) : await createCustomer(form);
    if (saved) setFormCustomer(undefined);
    setSaving(false);
  };
  const openDetail = (customer) => setDetailCustomer(customer);
  const detailRepairs = detailCustomer ? stableSort(repairs.filter((repair) => repair.customerId === detailCustomer.id), (a, b) => new Date(b.createdAt) - new Date(a.createdAt), (repair) => repair.id) : [];
  const detailTransactions = detailCustomer ? stableSort(
    (detailCustomer.invoices || []).flatMap((invoice) => (invoice.payments || []).map((payment) => ({ ...payment, invoiceId: invoice.id, invoiceItem: invoice.item }))),
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    (payment) => payment.id,
  ) : [];
  const finalizedInvoices = detailCustomer ? (detailCustomer.invoices || []).filter((invoice) => invoice.invoiceStatus === 'FINALIZED' || invoice.invoiceStatus === 'REFUNDED') : [];
  const lifetimeSpend = finalizedInvoices.reduce((sum, invoice) => sum + invoice.invoiceTotal, 0);
  const lifetimeCollected = finalizedInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  const historyBounds = periodBounds(historyPeriod, historyFrom, historyTo);
  const periodRepairs = detailRepairs.filter((repair) => withinPeriod(repair.createdAt, historyBounds));
  const periodTransactions = detailTransactions.filter((payment) => withinPeriod(payment.createdAt, historyBounds));
  return <><PageHead eyebrow="CUSTOMER DIRECTORY" title="Customers"><div className="page-actions">{canManage && <button className="primary" onClick={() => setFormCustomer(null)}>＋ Add customer</button>}</div></PageHead>
    <div className="toolbar card list-toolbar"><SearchBox value={customerSearch} onChange={setCustomerSearch} placeholder="Search customer, phone or invoice" label="Search customers"/><ResultCount shown={visibleCustomers.length} total={customers.length} noun="customer"/><select value={customerTypeFilter} onChange={(event) => setCustomerTypeFilter(event.target.value)} aria-label="Filter customers by type"><option>All</option><option>Credit</option><option>Regular</option><option>Balance due</option></select><select value={customerSort} onChange={(event) => setCustomerSort(event.target.value)} aria-label="Sort customers"><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="recent">Most recent</option><option value="balance">Highest balance</option><option value="repairs">Most repairs</option></select></div>
    <div className="customer-grid">{pageCustomers.length ? pageCustomers.map((customer) => <article className="card customer-profile customer-credit-profile clickable" key={customer.id} role="button" tabIndex={0} onClick={() => openDetail(customer)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(customer); } }}><span className="avatar large">{customer.avatar}</span><div><h3>{customer.name}</h3><p>{customer.phone}</p><small>{customer.repairCount} repair{customer.repairCount === 1 ? '' : 's'} · Balance {money(customer.accountsReceivable)}</small></div><span className={`credit-badge ${customer.isCreditCustomer ? 'enabled' : ''}`}>{customer.isCreditCustomer ? 'Credit customer' : 'Regular'}</span><div className="customer-actions">{canStartIntake && <button className="customer-intake-action" onClick={(event) => { event.stopPropagation(); startCustomerIntake(customer); }}>＋ Intake</button>}{canManage && <button className="outline" onClick={(event) => { event.stopPropagation(); setFormCustomer(customer); }}>Edit</button>}</div></article>) : <p className="empty card list-empty">No customers match the current search and filter.</p>}</div>
    <div className="card"><Pagination page={customerPage} setPage={setCustomerPage} totalItems={visibleCustomers.length} pageSize={PAGE_SIZE}/></div>
    {formCustomer !== undefined && <div className="modal-backdrop"><form className="modal card customer-modal" onSubmit={submitCustomer}><div className="modal-head"><div><p>CUSTOMER ACCOUNT</p><h2>{formCustomer ? 'Edit customer' : 'Add customer'}</h2><small>The credit flag only permits an unpaid or partially paid delivery.</small></div><button type="button" onClick={() => setFormCustomer(undefined)} disabled={saving}>×</button></div><div className="form-grid"><label>Customer name<input name="name" defaultValue={formCustomer?.name || ''} required autoFocus /></label><label>Phone<input name="phone" type="tel" pattern="(?:09\d{8}|\+2519\d{8})" defaultValue={formCustomer?.phone || ''} required /></label><label>Credit Customer<select name="isCreditCustomer" defaultValue={String(formCustomer?.isCreditCustomer || false)}><option value="false">No</option><option value="true">Yes</option></select></label></div><div className="modal-actions"><button type="button" className="outline" onClick={() => setFormCustomer(undefined)} disabled={saving}>Cancel</button><button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Save customer'}</button></div></form></div>}
    {detailCustomer && <div className="modal-backdrop"><div className="modal card customer-detail-modal"><div className="modal-head"><div><p>CUSTOMER DETAILS · ALL-TIME RECORD</p><h2>{detailCustomer.name}</h2><small>{detailCustomer.phone} · Customer since {new Date(detailCustomer.createdAt).toLocaleDateString()}</small></div><button type="button" onClick={() => setDetailCustomer(null)}>×</button></div>
      <div className="customer-account-summary customer-stat-grid"><span className={`credit-badge ${detailCustomer.isCreditCustomer ? 'enabled' : ''}`}>{detailCustomer.isCreditCustomer ? 'Credit customer' : 'Regular customer'}</span><div><small>Total visits</small><strong>{detailRepairs.length}</strong></div><div><small>Lifetime spend</small><strong>{money(lifetimeSpend)}</strong></div><div><small>Lifetime collected</small><strong>{money(lifetimeCollected)}</strong></div><div><small>Outstanding balance</small><strong>{money(detailCustomer.accountsReceivable)}</strong></div></div>
      <DateRangeFilter period={historyPeriod} setPeriod={setHistoryPeriod} from={historyFrom} setFrom={setHistoryFrom} to={historyTo} setTo={setHistoryTo} label="Filter customer history by date"/>
      <section className="customer-detail-section"><h3>Repair history <span>{periodRepairs.length} of {detailRepairs.length} device{detailRepairs.length === 1 ? '' : 's'}</span></h3><div className="table-scroll"><table><thead><tr><th>Ticket</th><th>Device</th><th>Issue</th><th>Status</th><th>Technician</th><th>Date</th></tr></thead><tbody>{periodRepairs.length ? periodRepairs.map((repair) => <tr key={repair.id}><td><strong>{repair.id}</strong></td><td>{repair.device}</td><td className="description-cell" title={repair.issue}>{repair.issue}</td><td><Status value={repair.status}/></td><td>{repair.tech}</td><td>{new Date(repair.createdAt).toLocaleDateString()}</td></tr>) : <tr><td colSpan="6" className="empty">No repairs in this time range.</td></tr>}</tbody></table></div></section>
      <section className="customer-detail-section"><h3>Invoices <span>{(detailCustomer.invoices || []).length} invoice{(detailCustomer.invoices || []).length === 1 ? '' : 's'} · all time</span></h3><div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Total</th><th>Paid</th><th>Balance</th><th>Payment status</th></tr></thead><tbody>{detailCustomer.invoices.length ? detailCustomer.invoices.map((invoice) => <tr key={invoice.recordId}><td><strong>{invoice.id}</strong><small>{invoice.item}</small></td><td>{money(invoice.invoiceTotal)}</td><td>{money(invoice.amountPaid)}</td><td>{money(invoice.balanceDue)}</td><td><Status value={invoice.status}/></td></tr>) : <tr><td colSpan="5" className="empty">No invoices for this customer.</td></tr>}</tbody></table></div></section>
      <section className="customer-detail-section"><h3>Payment transactions <span>{periodTransactions.length} of {detailTransactions.length} payment{detailTransactions.length === 1 ? '' : 's'}</span></h3><div className="table-scroll"><table><thead><tr><th>Date</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead><tbody>{periodTransactions.length ? periodTransactions.map((payment) => <tr key={payment.id}><td>{new Date(payment.createdAt).toLocaleString()}</td><td><strong>{payment.invoiceId}</strong><small>{payment.invoiceItem}</small></td><td>{money(payment.amount)}</td><td>{payment.method}</td><td>{payment.reversed ? <Status value="Refunded"/> : <Status value="Paid"/>}</td></tr>) : <tr><td colSpan="5" className="empty">No payments in this time range.</td></tr>}</tbody></table></div></section>
      <div className="modal-actions"><button className="outline" onClick={() => setDetailCustomer(null)}>Close</button>{canManage && <button className="outline" onClick={() => { setFormCustomer(detailCustomer); setDetailCustomer(null); }}>Edit customer</button>}{canStartIntake && <button className="primary" onClick={() => { setDetailCustomer(null); startCustomerIntake(detailCustomer); }}>＋ New intake</button>}</div></div></div>}
  </>;
}

export function AppointmentsView({ appointments, reviewAppointment }) {
  const [appointmentSort, setAppointmentSort] = useState('soonest');
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('All');
  const [appointmentPeriod, setAppointmentPeriod] = useState('today');
  const [appointmentFrom, setAppointmentFrom] = useState('');
  const [appointmentTo, setAppointmentTo] = useState('');
  const [appointmentPage, setAppointmentPage] = useState(1);
  const appointmentPeriodBounds = periodBounds(appointmentPeriod, appointmentFrom, appointmentTo);
  const visibleAppointments = stableSort(
    appointments.filter((item) => (appointmentStatusFilter === 'All' || item.status === appointmentStatusFilter) && withinPeriod(item.preferredDate, appointmentPeriodBounds) && matchesSearch([item.reference, item.customer, item.phone, item.device, item.issue, item.status, new Date(item.preferredDate).toLocaleString()], appointmentSearch)),
    (a, b) => appointmentSort === 'customer' ? compareText(a.customer, b.customer) : appointmentSort === 'status' ? compareText(a.status, b.status) : appointmentSort === 'latest' ? new Date(b.preferredDate) - new Date(a.preferredDate) : new Date(a.preferredDate) - new Date(b.preferredDate),
    (item) => item.id,
  );
  useEffect(() => { setAppointmentPage(1); }, [appointmentStatusFilter, appointmentSort, appointmentSearch, appointmentPeriod, appointmentFrom, appointmentTo]);
  useEffect(() => { if (appointmentPeriod === 'today' && (appointmentSearch.trim() || appointmentSort !== 'soonest')) setAppointmentPeriod('all'); }, [appointmentSearch, appointmentSort]);
  const pageAppointments = visibleAppointments.slice((appointmentPage - 1) * PAGE_SIZE, appointmentPage * PAGE_SIZE);
  return <><PageHead eyebrow="FRONT DESK" title="Appointment requests"><span className="head-count">Review and organize public appointment requests</span></PageHead><div className="toolbar card list-toolbar"><SearchBox value={appointmentSearch} onChange={setAppointmentSearch} placeholder="Search reference, customer, phone, device or issue" label="Search appointments"/><ResultCount shown={visibleAppointments.length} total={appointments.length} noun="appointment"/><select value={appointmentStatusFilter} onChange={(event) => setAppointmentStatusFilter(event.target.value)} aria-label="Filter appointments by status"><option>All</option><option>Requested</option><option>Approved</option><option>Rejected</option></select><select value={appointmentSort} onChange={(event) => setAppointmentSort(event.target.value)} aria-label="Sort appointments"><option value="soonest">Soonest first</option><option value="latest">Latest first</option><option value="customer">Customer A–Z</option><option value="status">Status A–Z</option></select></div><DateRangeFilter period={appointmentPeriod} setPeriod={setAppointmentPeriod} from={appointmentFrom} setFrom={setAppointmentFrom} to={appointmentTo} setTo={setAppointmentTo} label="Filter appointments by preferred date"/><section className="card table-card full-table"><div className="table-scroll"><table><thead><tr><th>Reference</th><th>Customer</th><th>Device / issue</th><th>Preferred time</th><th>Status</th><th>Decision</th></tr></thead><tbody>{pageAppointments.length ? pageAppointments.map((item) => <tr key={item.id}><td><strong>#{item.reference}</strong></td><td><strong>{item.customer}</strong><small>{item.phone}</small></td><td><strong>{item.device}</strong><small>{item.issue}</small></td><td>{new Date(item.preferredDate).toLocaleString()}</td><td><Status value={item.status}/></td><td>{item.status === 'Requested' ? <div className="row-actions"><button className="table-action" onClick={() => reviewAppointment(item.id, 'approve')}>Approve</button><button className="outline" onClick={() => reviewAppointment(item.id, 'reject')}>Reject</button></div> : <span className="readonly">Reviewed</span>}</td></tr>) : <tr><td colSpan="6" className="empty">No appointments match the current search and filter.</td></tr>}</tbody></table></div><Pagination page={appointmentPage} setPage={setAppointmentPage} totalItems={visibleAppointments.length} pageSize={PAGE_SIZE}/></section></>;
}

export function ReportsView({ dashboard }) {
  const [reportSearch, setReportSearch] = useState('');
  const [reportGroupFilter, setReportGroupFilter] = useState('All');
  const [reportSort, setReportSort] = useState('group');
  const rows = [
    { label: 'Spare-parts revenue', value: dashboard.sparePartsRevenue, meta: 'Finalized repair invoices', group: 'Revenue' },
    { label: 'Accessories revenue', value: dashboard.accessoriesRevenue, meta: 'Finalized repair invoices', group: 'Revenue' },
    { label: 'Maintenance revenue', value: dashboard.maintenanceRevenue, meta: `${dashboard.completedJobs || 0} completed jobs`, group: 'Revenue' },
    { label: 'Cash collected', value: dashboard.cashCollected, meta: 'Valid payments received', group: 'Collections' },
    { label: 'Accounts receivable', value: dashboard.accountsReceivable, meta: 'Finalized unpaid balances', group: 'Collections' },
    { label: 'Daily expenses', value: dashboard.dailyExpenses, meta: 'Today', group: 'Expenses' },
    { label: 'Weekly expenses', value: dashboard.weeklyExpenses, meta: 'Monday – Sunday', group: 'Expenses' },
    { label: 'Monthly expenses', value: dashboard.monthlyExpenses, meta: 'Current month', group: 'Expenses' },
    { label: 'Yearly expenses', value: dashboard.yearlyExpenses, meta: 'Current year', group: 'Expenses' },
  ].filter((row) => row.value !== undefined);
  const groupOrder = { Revenue: 0, Collections: 1, Expenses: 2 };
  const visibleRows = stableSort(
    rows.filter((row) => (reportGroupFilter === 'All' || row.group === reportGroupFilter) && matchesSearch([row.label, row.group, row.meta, row.value], reportSearch)),
    (a, b) => reportSort === 'amount-high' ? b.value - a.value : reportSort === 'amount-low' ? a.value - b.value : reportSort === 'label' ? compareText(a.label, b.label) : groupOrder[a.group] - groupOrder[b.group],
    () => '',
  );
  return <><PageHead eyebrow="ADMIN ONLY" title="Reports & analytics"><span className="head-count">Current reporting period</span></PageHead>
    <div className="metric-grid three"><Metric icon="Br" tone="green" label="Revenue" value={money(dashboard.totalRevenue)} meta="Full finalized invoice value"/><Metric icon="−" tone="amber" label="Total expenses" value={money(dashboard.totalExpenses)} meta="Recorded operating costs"/><Metric icon="Br" tone="violet" label="Net revenue" value={money(dashboard.netRevenue)} meta="Revenue − expenses"/></div>
    <RevenueCard dashboard={dashboard}/>
    <div className="toolbar card list-toolbar"><SearchBox value={reportSearch} onChange={setReportSearch} placeholder="Search metric name" label="Search report metrics"/><ResultCount shown={visibleRows.length} total={rows.length} noun="metric"/><select value={reportGroupFilter} onChange={(event) => setReportGroupFilter(event.target.value)} aria-label="Filter metrics by group"><option>All</option><option>Revenue</option><option>Collections</option><option>Expenses</option></select><select value={reportSort} onChange={(event) => setReportSort(event.target.value)} aria-label="Sort metrics"><option value="group">Grouped</option><option value="label">Name A–Z</option><option value="amount-high">Amount high–low</option><option value="amount-low">Amount low–high</option></select></div>
    <section className="card table-card full-table"><div className="table-scroll"><table><thead><tr><th>Metric</th><th>Group</th><th>Value</th><th>Detail</th></tr></thead><tbody>{visibleRows.length ? visibleRows.map((row) => <tr key={row.label}><td><strong>{row.label}</strong></td><td><span className="category-badge">{row.group}</span></td><td><strong>{money(row.value)}</strong></td><td className="description-cell">{row.meta}</td></tr>) : <tr><td colSpan="4" className="empty">No metrics match the current search and filter.</td></tr>}</tbody></table></div></section>
  </>;
}

export function TeamView({ team, createStaff, updateStaff, deactivateStaff }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [teamSort, setTeamSort] = useState('name');
  const [teamSearch, setTeamSearch] = useState('');
  const [teamRoleFilter, setTeamRoleFilter] = useState('All');
  const [teamPage, setTeamPage] = useState(1);
  const closeForm = () => { setAdding(false); setEditing(null); };
  const submit = async (event) => { event.preventDefault(); const formElement = event.currentTarget; const data = new FormData(formElement); const form = Object.fromEntries(data); form.permissions = data.getAll('permissions'); const saved = editing ? await updateStaff({ ...form, id: editing.id }) : await createStaff(form); if (saved) { formElement.reset(); closeForm(); } };
  const visibleTeam = stableSort(
    team.filter((member) => (teamRoleFilter === 'All' || member.role === teamRoleFilter) && matchesSearch([member.name, member.email, member.role, member.description, member.permissions], teamSearch)),
    (a, b) => teamSort === 'role' ? compareText(a.role, b.role) || compareText(a.name, b.name) : teamSort === 'email' ? compareText(a.email, b.email) : teamSort === 'name-desc' ? compareText(b.name, a.name) : compareText(a.name, b.name),
    (member) => member.id,
  );
  useEffect(() => { setTeamPage(1); }, [teamRoleFilter, teamSort, teamSearch]);
  const pageTeam = visibleTeam.slice((teamPage - 1) * PAGE_SIZE, teamPage * PAGE_SIZE);
  return <><PageHead eyebrow="ACCESS CONTROL" title="Team & roles"><div className="page-actions"><button className="primary" onClick={() => { setEditing(null); setAdding(true); }}>＋ Add staff</button></div></PageHead>
    <div className="toolbar card list-toolbar"><SearchBox value={teamSearch} onChange={setTeamSearch} placeholder="Search name, email, role or permission" label="Search team"/><ResultCount shown={visibleTeam.length} total={team.length} noun="member"/><select value={teamRoleFilter} onChange={(event) => setTeamRoleFilter(event.target.value)} aria-label="Filter team by role"><option>All</option><option>Admin</option><option>Technician</option><option>Front Desk</option></select><select value={teamSort} onChange={(event) => setTeamSort(event.target.value)} aria-label="Sort team"><option value="name">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="role">Role A–Z</option><option value="email">Email A–Z</option></select></div>
    {adding && <form className="card staff-form" onSubmit={submit}><label>Full name<input name="name" defaultValue={editing?.name || ''} required /></label><label>Email<input name="email" type="email" defaultValue={editing?.email || ''} required /></label><label>Base role<select name="role" defaultValue={editing?.role || 'Technician'}><option>Technician</option><option>Front Desk</option></select></label><label>{editing ? 'New password (optional)' : 'Temporary password'}<input name="password" type="password" minLength="10" required={!editing} placeholder={editing ? 'Leave blank to keep current password' : ''}/></label><fieldset className="compensation-picker"><legend>Staff compensation (ETB)</legend>{[['salary','Salary'],['rent','Rent'],['commission','Commission'],['allowance','Allowance']].map(([name,label]) => <label key={name}>{label}<input name={name} type="number" min="0" step="0.01" defaultValue={editing?.[name] ?? 0} required /></label>)}<small>These are staff terms. Record actual payments in Expenses when paid.</small></fieldset><fieldset className="permission-picker"><legend>Permissions</legend><small>Nothing is granted by default — check every area this account needs.</small>{[['VIEW_REPAIRS','Repairs'],['MANAGE_INTAKE','New intake'],['MANAGE_APPOINTMENTS','Appointments'],['VIEW_REPORTS','Reports'],['VIEW_CUSTOMERS','Customer data'],['MANAGE_POS','Point of sale'],['VIEW_INVENTORY','Inventory'],['MANAGE_WEBSITE','Website']].map(([value,label]) => <label key={value}><input type="checkbox" name="permissions" value={value} defaultChecked={editing?.permissions?.includes(value) || false}/>{label}</label>)}</fieldset><fieldset className="permission-picker"><legend>Report line items</legend><small>Each also works standalone without the full Reports permission above.</small>{[['VIEW_DAILY_SALES','Daily sales'],['VIEW_SPAREPARTS_REVENUE','Spare-parts revenue'],['VIEW_ACCESSORIES_REVENUE','Accessories revenue'],['VIEW_MAINTENANCE_REVENUE','Maintenance revenue'],['VIEW_CASH_COLLECTED','Cash collected'],['VIEW_ACCOUNTS_RECEIVABLE','Accounts receivable'],['VIEW_DAILY_EXPENSES','Daily expenses'],['VIEW_WEEKLY_EXPENSES','Weekly expenses'],['VIEW_MONTHLY_EXPENSES','Monthly expenses'],['VIEW_YEARLY_EXPENSES','Yearly expenses']].map(([value,label]) => <label key={value}><input type="checkbox" name="permissions" value={value} defaultChecked={editing?.permissions?.includes(value) || false}/>{label}</label>)}</fieldset><div><button type="button" className="outline" onClick={closeForm}>Cancel</button><button className="primary">{editing ? 'Save changes' : 'Create account'}</button></div></form>}
    <div className="team-grid">{pageTeam.length ? pageTeam.map(({ id, email, name, role, permissions = [], salary = 0, rent = 0, commission = 0, allowance = 0, description }) => <article className="card team-member" key={id}><span className="avatar large">{name.split(' ').map((part) => part[0]).join('')}</span><div><h3>{name}</h3><p>{email}</p><small>{description}</small>{role !== 'Admin' && <div className="compensation-tags"><i>Salary {money(salary)}</i><i>Rent {money(rent)}</i><i>Commission {money(commission)}</i><i>Allowance {money(allowance)}</i></div>}{permissions.length > 0 && <div className="permission-tags">{permissions.map((permission) => <i key={permission}>{permission.replaceAll('_', ' ').toLowerCase()}</i>)}</div>}</div><span className="role-badge">{role}</span>{role !== 'Admin' && <div className="staff-actions"><button className="table-action" onClick={() => { setEditing({ id, email, name, role, permissions, salary, rent, commission, allowance }); setAdding(true); }}>Edit</button><button className="staff-remove" onClick={() => deactivateStaff(id, name)}>Deactivate</button></div>}</article>) : <p className="empty card list-empty">No team members match the current search and filter.</p>}</div>
    <div className="card"><Pagination page={teamPage} setPage={setTeamPage} totalItems={visibleTeam.length} pageSize={PAGE_SIZE}/></div></>;
}

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const socialPlatforms = ['Facebook', 'Instagram', 'TikTok', 'Telegram', 'YouTube', 'X', 'LinkedIn', 'WhatsApp'];
const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';

export function WebsiteView({ banners = [], socialLinks = [], staffProfiles = [], blogPosts = [], createBanner, updateBanner, deleteBanner, reorderBanner, createSocialLink, updateSocialLink, deleteSocialLink, createStaffProfile, updateStaffProfile, deleteStaffProfile, createBlogPost, updateBlogPost, deleteBlogPost, reorderBlogPost }) {
  const [addingBanner, setAddingBanner] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [savingBanner, setSavingBanner] = useState(false);
  const [addingSocial, setAddingSocial] = useState(false);
  const [editingSocial, setEditingSocial] = useState(null);
  const [savingSocial, setSavingSocial] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [savingStaff, setSavingStaff] = useState(false);
  const [addingPost, setAddingPost] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [savingPost, setSavingPost] = useState(false);

  const closeBannerForm = () => { if (!savingBanner) { setAddingBanner(false); setEditingBanner(null); } };
  const submitBanner = async (event) => {
    event.preventDefault();
    if (savingBanner) return;
    setSavingBanner(true);
    const formElement = event.currentTarget;
    try {
      const data = new FormData(formElement);
      const file = data.get('image');
      const form = { title: data.get('title'), subtitle: data.get('subtitle'), linkUrl: data.get('linkUrl'), active: data.get('active') === 'on' };
      if (file && file.size > 0) form.image = await fileToDataUrl(file);
      const saved = editingBanner ? await updateBanner({ ...form, id: editingBanner.id }) : await createBanner(form);
      if (saved) { formElement.reset(); setAddingBanner(false); setEditingBanner(null); }
    } finally { setSavingBanner(false); }
  };

  const closeSocialForm = () => { if (!savingSocial) { setAddingSocial(false); setEditingSocial(null); } };
  const submitSocial = async (event) => {
    event.preventDefault();
    if (savingSocial) return;
    setSavingSocial(true);
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const saved = editingSocial ? await updateSocialLink({ ...form, id: editingSocial.id }) : await createSocialLink(form);
    if (saved) { formElement.reset(); setAddingSocial(false); setEditingSocial(null); }
    setSavingSocial(false);
  };

  const closeStaffForm = () => { if (!savingStaff) { setAddingStaff(false); setEditingStaff(null); } };
  const submitStaff = async (event) => {
    event.preventDefault();
    if (savingStaff) return;
    setSavingStaff(true);
    const formElement = event.currentTarget;
    try {
      const data = new FormData(formElement);
      const file = data.get('photo');
      const form = { name: data.get('name'), role: data.get('role'), bio: data.get('bio'), active: data.get('active') === 'on' };
      if (file && file.size > 0) form.photo = await fileToDataUrl(file);
      const saved = editingStaff ? await updateStaffProfile({ ...form, id: editingStaff.id }) : await createStaffProfile(form);
      if (saved) { formElement.reset(); setAddingStaff(false); setEditingStaff(null); }
    } finally { setSavingStaff(false); }
  };

  const closePostForm = () => { if (!savingPost) { setAddingPost(false); setEditingPost(null); } };
  const submitPost = async (event) => {
    event.preventDefault();
    if (savingPost) return;
    setSavingPost(true);
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    form.active = new FormData(formElement).get('active') === 'on';
    const saved = editingPost ? await updateBlogPost({ ...form, id: editingPost.id }) : await createBlogPost(form);
    if (saved) { formElement.reset(); setAddingPost(false); setEditingPost(null); }
    setSavingPost(false);
  };

  return <>
    <PageHead eyebrow="PUBLIC SITE" title="Website content"><span className="head-count">Manage banners, social links, repair tips, and the team showcase</span></PageHead>

    <section className="card table-card full-table website-section">
      <div className="panel-title"><div><h2>Promotional banners</h2><p>{banners.length} banner{banners.length === 1 ? '' : 's'} shown as a carousel on the public site</p></div><button className="primary" onClick={() => { setEditingBanner(null); setAddingBanner(true); }}>＋ Add banner</button></div>
      <div className="banner-grid">{banners.length ? banners.map((banner, index) => <article className="card banner-card" key={banner.id}>
        <img src={`${apiBase}${banner.imageUrl}`} alt={banner.title || 'Promotional banner'}/>
        <div className="banner-card-body"><strong>{banner.title || 'Untitled banner'}</strong>{banner.subtitle && <p>{banner.subtitle}</p>}{banner.linkUrl && <small>{banner.linkUrl}</small>}<span className={`credit-badge ${banner.active ? 'enabled' : ''}`}>{banner.active ? 'Active' : 'Hidden'}</span></div>
        <div className="banner-card-actions"><button type="button" disabled={index === 0} onClick={() => reorderBanner({ id: banner.id, direction: 'up' })} aria-label="Move up">↑</button><button type="button" disabled={index === banners.length - 1} onClick={() => reorderBanner({ id: banner.id, direction: 'down' })} aria-label="Move down">↓</button><button type="button" onClick={() => { setEditingBanner(banner); setAddingBanner(true); }}>✎ Edit</button><button type="button" className="delete" onClick={() => deleteBanner(banner.id, banner.title || 'this banner')}>♲ Delete</button></div>
      </article>) : <p className="empty card list-empty">No banners yet — add one to show a promotion on the public site.</p>}</div>
    </section>

    <section className="card table-card full-table website-section">
      <div className="panel-title"><div><h2>Social media icons</h2><p>{socialLinks.length} link{socialLinks.length === 1 ? '' : 's'} shown in the public site footer</p></div><button className="primary" onClick={() => { setEditingSocial(null); setAddingSocial(true); }}>＋ Add link</button></div>
      <div className="table-scroll"><table><thead><tr><th>Platform</th><th>URL</th><th>Actions</th></tr></thead><tbody>{socialLinks.length ? socialLinks.map((link) => <tr key={link.id}><td><strong>{link.platform}</strong></td><td className="description-cell" title={link.url}>{link.url}</td><td><div className="expense-actions"><button onClick={() => { setEditingSocial(link); setAddingSocial(true); }}>✎ Edit</button><button className="delete" onClick={() => deleteSocialLink(link.id, link.platform)}>♲ Delete</button></div></td></tr>) : <tr><td colSpan="3" className="empty">No social links yet.</td></tr>}</tbody></table></div>
    </section>

    <section className="card table-card full-table website-section">
      <div className="panel-title"><div><h2>Team showcase</h2><p>{staffProfiles.length} profile{staffProfiles.length === 1 ? '' : 's'} shown in "Meet the team" on the public site</p></div><button className="primary" onClick={() => { setEditingStaff(null); setAddingStaff(true); }}>＋ Add team member</button></div>
      <div className="team-grid">{staffProfiles.length ? staffProfiles.map((profile) => <article className="card team-member" key={profile.id}>{profile.photoUrl ? <img className="staff-avatar-photo" src={`${apiBase}${profile.photoUrl}`} alt={profile.name}/> : <span className="avatar large">{profile.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>}<div><h3>{profile.name}</h3><p>{profile.role}</p>{profile.bio && <small>{profile.bio}</small>}</div><span className={`credit-badge ${profile.active ? 'enabled' : ''}`}>{profile.active ? 'Visible' : 'Hidden'}</span><div className="staff-actions"><button className="table-action" onClick={() => { setEditingStaff(profile); setAddingStaff(true); }}>Edit</button><button className="staff-remove" onClick={() => deleteStaffProfile(profile.id, profile.name)}>Delete</button></div></article>) : <p className="empty card list-empty">No team members added yet.</p>}</div>
    </section>

    <section className="card table-card full-table website-section">
      <div className="panel-title"><div><h2>Repair tips ("From the repair bench")</h2><p>{blogPosts.length} article{blogPosts.length === 1 ? '' : 's'} shown on the public site</p></div><button className="primary" onClick={() => { setEditingPost(null); setAddingPost(true); }}>＋ Add article</button></div>
      <div className="table-scroll"><table><thead><tr><th>Tag</th><th>Title</th><th>Summary</th><th>Status</th><th>Actions</th></tr></thead><tbody>{blogPosts.length ? blogPosts.map((post, index) => <tr key={post.id}><td><span className="category-badge">{post.tag}</span></td><td><strong>{post.title}</strong></td><td className="description-cell" title={post.summary}>{post.summary}</td><td><span className={`credit-badge ${post.active ? 'enabled' : ''}`}>{post.active ? 'Live' : 'Hidden'}</span></td><td><div className="expense-actions"><button disabled={index === 0} onClick={() => reorderBlogPost({ id: post.id, direction: 'up' })} aria-label="Move up">↑</button><button disabled={index === blogPosts.length - 1} onClick={() => reorderBlogPost({ id: post.id, direction: 'down' })} aria-label="Move down">↓</button><button onClick={() => { setEditingPost(post); setAddingPost(true); }}>✎ Edit</button><button className="delete" onClick={() => deleteBlogPost(post.id, post.title)}>♲ Delete</button></div></td></tr>) : <tr><td colSpan="5" className="empty">No repair tip articles yet.</td></tr>}</tbody></table></div>
    </section>

    {addingBanner && <div className="modal-backdrop"><form className="modal card banner-modal" onSubmit={submitBanner}>
      <div className="modal-head"><div><p>PUBLIC SITE</p><h2>{editingBanner ? '✎ Edit banner' : '＋ Add banner'}</h2><small>Shown as a rotating carousel on the customer website.</small></div><button type="button" onClick={closeBannerForm} disabled={savingBanner}>×</button></div>
      <div className="form-grid">
        <label>Title<input name="title" defaultValue={editingBanner?.title || ''} placeholder="e.g. 20% off screen repairs"/></label>
        <label>Subtitle<input name="subtitle" defaultValue={editingBanner?.subtitle || ''} placeholder="Optional supporting text"/></label>
        <label className="wide">Link URL<input name="linkUrl" type="url" defaultValue={editingBanner?.linkUrl || ''} placeholder="https://... (optional)"/></label>
        <label className="wide">{editingBanner ? 'Replace image (optional)' : 'Banner image *'}<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required={!editingBanner}/></label>
        {editingBanner && <div className="wide banner-current-image"><img src={`${apiBase}${editingBanner.imageUrl}`} alt=""/><small>Current image — choose a new file above to replace it.</small></div>}
        <label className="checkbox-field wide"><input type="checkbox" name="active" defaultChecked={editingBanner?.active ?? true}/> Show on public site</label>
      </div>
      <div className="modal-actions"><button type="button" className="outline" onClick={closeBannerForm} disabled={savingBanner}>Cancel</button><button className="primary" disabled={savingBanner}>{savingBanner ? 'Saving…' : editingBanner ? 'Save changes' : 'Add banner'}</button></div>
    </form></div>}

    {addingSocial && <div className="modal-backdrop"><form className="modal card" onSubmit={submitSocial}>
      <div className="modal-head"><div><p>PUBLIC SITE</p><h2>{editingSocial ? '✎ Edit social link' : '＋ Add social link'}</h2></div><button type="button" onClick={closeSocialForm} disabled={savingSocial}>×</button></div>
      <div className="form-grid">
        <label>Platform<select name="platform" required defaultValue={editingSocial?.platform || ''}><option value="" disabled>Select platform</option>{socialPlatforms.map((platform) => <option key={platform}>{platform}</option>)}</select></label>
        <label>URL<input name="url" type="url" required defaultValue={editingSocial?.url || ''} placeholder="https://..."/></label>
      </div>
      <div className="modal-actions"><button type="button" className="outline" onClick={closeSocialForm} disabled={savingSocial}>Cancel</button><button className="primary" disabled={savingSocial}>{savingSocial ? 'Saving…' : editingSocial ? 'Save changes' : 'Add link'}</button></div>
    </form></div>}

    {addingPost && <div className="modal-backdrop"><form className="modal card" onSubmit={submitPost}>
      <div className="modal-head"><div><p>PUBLIC SITE</p><h2>{editingPost ? '✎ Edit repair tip' : '＋ Add repair tip'}</h2><small>Shown in "From the repair bench" on the customer website.</small></div><button type="button" onClick={closePostForm} disabled={savingPost}>×</button></div>
      <div className="form-grid">
        <label>Tag<input name="tag" required defaultValue={editingPost?.tag || ''} placeholder="e.g. BATTERY CARE"/></label>
        <label>Title<input name="title" required defaultValue={editingPost?.title || ''} placeholder="e.g. 5 habits that make your battery last longer"/></label>
        <label className="wide">Summary<input name="summary" required defaultValue={editingPost?.summary || ''} placeholder="Short teaser shown on the card"/></label>
        <label className="wide">Full article<textarea name="body" required defaultValue={editingPost?.body || ''} placeholder="Shown when a visitor clicks 'Read article'"/></label>
        <label className="checkbox-field wide"><input type="checkbox" name="active" defaultChecked={editingPost?.active ?? true}/> Show on public site</label>
      </div>
      <div className="modal-actions"><button type="button" className="outline" onClick={closePostForm} disabled={savingPost}>Cancel</button><button className="primary" disabled={savingPost}>{savingPost ? 'Saving…' : editingPost ? 'Save changes' : 'Add article'}</button></div>
    </form></div>}

    {addingStaff && <div className="modal-backdrop"><form className="modal card" onSubmit={submitStaff}>
      <div className="modal-head"><div><p>PUBLIC SITE</p><h2>{editingStaff ? '✎ Edit team member' : '＋ Add team member'}</h2><small>Shown in "Meet the team" on the customer website.</small></div><button type="button" onClick={closeStaffForm} disabled={savingStaff}>×</button></div>
      <div className="form-grid">
        <label>Name<input name="name" required defaultValue={editingStaff?.name || ''}/></label>
        <label>Role<input name="role" required defaultValue={editingStaff?.role || ''} placeholder="e.g. Lead Technician"/></label>
        <label className="wide">Bio<textarea name="bio" defaultValue={editingStaff?.bio || ''} placeholder="Optional short bio"/></label>
        <label className="wide">{editingStaff ? 'Replace photo (optional)' : 'Photo (optional)'}<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif"/></label>
        {editingStaff?.photoUrl && <div className="wide banner-current-image"><img src={`${apiBase}${editingStaff.photoUrl}`} alt=""/><small>Current photo — choose a new file above to replace it.</small></div>}
        <label className="checkbox-field wide"><input type="checkbox" name="active" defaultChecked={editingStaff?.active ?? true}/> Show on public site</label>
      </div>
      <div className="modal-actions"><button type="button" className="outline" onClick={closeStaffForm} disabled={savingStaff}>Cancel</button><button className="primary" disabled={savingStaff}>{savingStaff ? 'Saving…' : editingStaff ? 'Save changes' : 'Add team member'}</button></div>
    </form></div>}
  </>;
}
