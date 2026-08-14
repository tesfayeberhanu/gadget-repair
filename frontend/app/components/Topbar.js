import { matchesSearch, normalizeSearch, stableSort } from '../utils/listTools.mjs';

export default function Topbar({ role, user, search, setSearch, repairs = [], customers = [], inventory = [], appointments = [], openRepairSearch, openCustomerSearch, openAppointmentSearch, openMobileNav, notificationCount = 0, openNotifications }) {
  const query = normalizeSearch(search);
  
  const repairResults = query ? stableSort(
    repairs.filter((repair) => matchesSearch([repair.id, repair.customer, repair.phone, repair.imei, repair.device, repair.issue, repair.status, repair.tech], query)),
    (left, right) => {
      const leftId = normalizeSearch(left.id);
      const rightId = normalizeSearch(right.id);
      const leftRank = leftId === query ? 0 : leftId.startsWith(query) ? 1 : normalizeSearch(left.customer).startsWith(query) ? 2 : 3;
      const rightRank = rightId === query ? 0 : rightId.startsWith(query) ? 1 : normalizeSearch(right.customer).startsWith(query) ? 2 : 3;
      return leftRank - rightRank || new Date(right.createdAt) - new Date(left.createdAt);
    },
    (repair) => repair.id,
  ).slice(0, 3) : [];

  const customerResults = query ? customers.filter((customer) => matchesSearch([customer.name, customer.phone], query)).slice(0, 3) : [];
  const appointmentResults = query ? appointments.filter((apt) => matchesSearch([apt.reference, apt.customer, apt.phone, apt.device], query)).slice(0, 3) : [];
  const inventoryResults = query ? inventory.filter((item) => matchesSearch([item.name, item.partNumber], query)).slice(0, 2) : [];

  const results = [...repairResults, ...customerResults, ...appointmentResults, ...inventoryResults];
  
  const submitSearch = (event) => {
    event.preventDefault();
    if (!query) return;
    if (repairResults[0]) openRepairSearch(repairResults[0]);
    else if (customerResults[0]) openCustomerSearch(customerResults[0]);
    else if (appointmentResults[0]) openAppointmentSearch(appointmentResults[0]);
  };

  return <header className="topbar">
    <button className="mobile-menu-button" onClick={openMobileNav} aria-label="Open navigation" aria-expanded="false">☰</button>
    <div className="mobile-logo"><img src="/ifixlab251-logo.png" alt=""/>iFixLab<span>251</span></div>
    <form className="global-search" onSubmit={submitSearch} role="search">
      <span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets, customers, phone, IMEI, parts..." aria-label="Global search" autoComplete="off" />
      {query && <div className="global-search-results">
        {results.length ? <>
          {repairResults.length > 0 && <div className="search-category"><p className="category-label">Repairs</p>{repairResults.map((repair) => <button type="button" key={`repair-${repair.id}`} onClick={() => openRepairSearch(repair)}>
            <strong>{repair.id}</strong><span>{repair.customer} · {repair.phone}</span><small>{repair.device}</small>
          </button>)}</div>}
          {customerResults.length > 0 && <div className="search-category"><p className="category-label">Customers</p>{customerResults.map((customer) => <button type="button" key={`customer-${customer.id}`} onClick={() => openCustomerSearch(customer)}>
            <strong>{customer.name}</strong><span>{customer.phone}</span><small>{customer.repairCount} repairs</small>
          </button>)}</div>}
          {appointmentResults.length > 0 && <div className="search-category"><p className="category-label">Appointments</p>{appointmentResults.map((apt) => <button type="button" key={`apt-${apt.id}`} onClick={() => openAppointmentSearch(apt)}>
            <strong>{apt.reference}</strong><span>{apt.customer} · {apt.phone}</span><small>{apt.device}</small>
          </button>)}</div>}
          {inventoryResults.length > 0 && <div className="search-category"><p className="category-label">Parts</p>{inventoryResults.map((item) => <button type="button" key={`inv-${item.id}`} onClick={() => setSearch('')}>
            <strong>{item.name}</strong><span>{item.partNumber}</span><small>Stock: {item.stock}</small>
          </button>)}</div>}
        </> : <p>No results found for "{search.trim()}"</p>}
      </div>}
      </div>}
    </form>
    <div className="top-actions">
      <span className="role-badge">{user?.name || role} · {role}</span>
      <button className="icon-button notification-bell" aria-label={`${notificationCount} newly assigned repair notifications`} title="Assigned repairs" onClick={openNotifications}><span aria-hidden="true">🔔</span>{notificationCount > 0 && <i>{notificationCount > 99 ? '99+' : notificationCount}</i>}</button>
    </div>
  </header>;
}
