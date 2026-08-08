const icons = { Overview: '⌂', Repairs: '⌁', Inventory: '□', 'Point of Sale': '◇', Customers: '♙', Reports: '↗', Team: '♧', 'New Intake': '＋', Appointments: '◷' };

export default function AppSidebar({ role, user, active, navigation, repairs, setActive, openIntake, logout }) {
  return <aside className="sidebar">
    <div className="logo"><img src="/ifixlab251-logo.png" alt="iFixLab251"/><span>iFixLab<span className="brand-number">251</span></span></div>
    <nav className="side-nav"><p>WORKSPACE</p>{navigation.map((item) => <button key={item} className={active === item ? 'active' : ''} onClick={() => item === 'New Intake' ? openIntake() : setActive(item)}><span className="nav-icon">{icons[item]}</span>{item}{item === 'Repairs' && <b>{repairs.filter((repair) => !['Ready for Pickup', 'Delivered'].includes(repair.status)).length}</b>}</button>)}</nav>
    <div className="sidebar-foot"><button>⚙ <span>Settings</span></button><button onClick={logout}>⇥ <span>Sign out</span></button><div className="user-card"><span className="avatar">{(user?.name || role).split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><strong>{user?.name || role}</strong><small>{role}</small></div><span>•••</span></div></div>
  </aside>;
}
