export default function Topbar({ role, user, search, setSearch, openIntake, notificationCount = 0, openNotifications }) {
  return <header className="topbar">
    <div className="mobile-logo"><img src="/ifixlab251-logo.png" alt=""/>iFixLab<span>251</span></div>
    <div className="global-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets, customers, IMEI..." /></div>
    <div className="top-actions">
      <span className="role-badge">{user?.name || role} · {role}</span>
      <button className="icon-button notification-bell" aria-label={`${notificationCount} newly assigned repair notifications`} title="Assigned repairs" onClick={openNotifications}><span aria-hidden="true">🔔</span>{notificationCount > 0 && <i>{notificationCount > 99 ? '99+' : notificationCount}</i>}</button>
      {role === 'Front Desk' && <button className="primary" onClick={openIntake}>＋ New Intake</button>}
    </div>
  </header>;
}
