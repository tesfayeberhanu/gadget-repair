import { matchesSearch, normalizeSearch, stableSort } from '../utils/listTools.mjs';

export default function Topbar({ role, user, search, setSearch, repairs = [], openRepairSearch, openMobileNav, notificationCount = 0, openNotifications }) {
  const query = normalizeSearch(search);
  const results = query ? stableSort(
    repairs.filter((repair) => matchesSearch([repair.id, repair.customer, repair.phone, repair.imei, repair.device, repair.issue, repair.status, repair.tech], query)),
    (left, right) => {
      const leftId = normalizeSearch(left.id);
      const rightId = normalizeSearch(right.id);
      const leftRank = leftId === query ? 0 : leftId.startsWith(query) ? 1 : normalizeSearch(left.customer).startsWith(query) ? 2 : 3;
      const rightRank = rightId === query ? 0 : rightId.startsWith(query) ? 1 : normalizeSearch(right.customer).startsWith(query) ? 2 : 3;
      return leftRank - rightRank || new Date(right.createdAt) - new Date(left.createdAt);
    },
    (repair) => repair.id,
  ).slice(0, 6) : [];
  const submitSearch = (event) => {
    event.preventDefault();
    if (!query) return;
    openRepairSearch(results[0] || null);
  };

  return <header className="topbar">
    <button className="mobile-menu-button" onClick={openMobileNav} aria-label="Open navigation" aria-expanded="false">☰</button>
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
