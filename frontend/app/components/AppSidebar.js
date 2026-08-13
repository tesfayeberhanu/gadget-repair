const icons = { Overview: '⌂', Repairs: '⌁', Inventory: '□', Expenses: '−', 'Point of Sale': '◇', Customers: '♙', Reports: '↗', Team: '♧', Settings: '⚙', 'New Intake': '＋', Appointments: '◷' };

export default function AppSidebar({ role, user, active, navigation, repairs, setActive, openIntake, logout, mobileOpen, closeMobileNav }) {
  const navigate = (item) => { item === 'New Intake' ? openIntake() : setActive(item); closeMobileNav(); };
  return <><button className={`sidebar-backdrop ${mobileOpen ? 'open' : ''}`} onClick={closeMobileNav} aria-label="Close navigation" tabIndex={mobileOpen ? 0 : -1}/><aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
    <button className="mobile-nav-close" onClick={closeMobileNav} aria-label="Close navigation">×</button>
    <div className="logo"><img src="/ifixlab251-logo.png" alt="iFixLab251"/><span>iFixLab<span className="brand-number">251</span></span></div>
    <nav className="side-nav"><p>WORKSPACE</p>{navigation.map((item) => <button key={item} className={active === item ? 'active' : ''} aria-label={item} title={item} onClick={() => navigate(item)}><span className="nav-icon">{icons[item]}</span><span className="nav-label">{item}</span>{item === 'Repairs' && <b>{repairs.filter((repair) => !['Ready for Pickup', 'Delivered'].includes(repair.status)).length}</b>}</button>)}</nav>
    <div className="sidebar-foot"><button onClick={logout}>⇥ <span>Sign out</span></button><div className="user-card"><span className="avatar">{(user?.name || role).split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{user?.name || role}</strong><small>{role}</small></div></div></div>
  </aside></>;
}
