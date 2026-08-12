export default function Topbar({ role, user, search, setSearch, repairs = [], openRepairSearch, notificationCount = 0, openNotifications }) {
  const query = search.trim().toLowerCase();
  const results = query ? repairs.filter((repair) => [repair.id, repair.customer, repair.phone, repair.imei, repair.device]
    .some((value) => String(value || '').toLowerCase().includes(query))).slice(0, 6) : [];
  const submitSearch = (event) => {
    event.preventDefault();
    if (!query) return;
    openRepairSearch(results[0] || null);
  };

  return <header className="topbar">
    <div className="mobile-logo"><img src="/ifixlab251-logo.png" alt=""/>iFixLab<span>251</span></div>
    <form className="global-search" onSubmit={submitSearch} role="search">
      <span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets, customers, phone, IMEI..." aria-label="Search repairs" autoComplete="off" />
      {query && <div className="global-search-results">
        {results.length ? results.map((repair) => <button type="button" key={repair.id} onClick={() => openRepairSearch(repair)}>
          <strong>{repair.id}</strong><span>{repair.customer} · {repair.phone}</span><small>{repair.device}</small>
        </button>) : <p>No repair found for “{search.trim()}”</p>}
      </div>}
    </form>
    <div className="top-actions">
      <span className="role-badge">{user?.name || role} · {role}</span>
      <button className="icon-button notification-bell" aria-label={`${notificationCount} newly assigned repair notifications`} title="Assigned repairs" onClick={openNotifications}><span aria-hidden="true">🔔</span>{notificationCount > 0 && <i>{notificationCount > 99 ? '99+' : notificationCount}</i>}</button>
    </div>
  </header>;
}
