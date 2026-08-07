export default function Topbar({ role, search, setSearch, switchRole, openIntake }) {
  return <header className="topbar">
    <div className="mobile-logo"><img src="/ifixlab251-logo.png" alt=""/>iFixLab<span>251</span></div>
    <div className="global-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets, customers, IMEI..." /></div>
    <div className="top-actions">
      <label className="role-picker">Viewing as <select value={role} onChange={(event) => switchRole(event.target.value)}><option>Admin</option><option>Technician</option><option>Front Desk</option></select></label>
      <button className="icon-button" aria-label="Notifications">♢<i>3</i></button>
      {(role === 'Admin' || role === 'Front Desk') && <button className="primary" onClick={openIntake}>＋ New Intake</button>}
    </div>
  </header>;
}
