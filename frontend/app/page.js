'use client';

import { useEffect, useMemo, useState } from 'react';
import AppSidebar from './components/AppSidebar';
import Topbar from './components/Topbar';
import Overview from './components/Overview';
import IntakeModal from './components/IntakeModal';
import LoginScreen from './components/LoginScreen';
import { AppointmentsView, RepairsView, InventoryView, SalesView, CustomersView, ReportsView, TeamView } from './components/ModuleViews';

async function apiRequest(path, token, options = {}) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const response = await fetch(`${apiBase}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function HomePage() {
  const [token, setToken] = useState(undefined);
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const [active, setActive] = useState('Overview');
  const [workspace, setWorkspace] = useState(null);
  const [search, setSearch] = useState('');
  const [showIntake, setShowIntake] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const notify = (message, duration = 2200) => { setToast(message); window.setTimeout(() => setToast(''), duration); };
  const loadWorkspace = async (sessionToken = token) => {
    setError('');
    try { const next = await apiRequest('/api/workspace', sessionToken); setWorkspace(next); setRole(next.role); setUser(next.user); }
    catch (requestError) {
      if (requestError.message === 'Please sign in') { localStorage.removeItem('ifixlab_token'); setToken(null); setWorkspace(null); }
      setError(requestError.message);
    }
  };

  useEffect(() => { const stored = localStorage.getItem('ifixlab_token'); setToken(stored); if (stored) loadWorkspace(stored); }, []);

  const login = async (credentials) => {
    setError('');
    try {
      const session = await apiRequest('/api/login', null, { method: 'POST', body: JSON.stringify(credentials) });
      localStorage.setItem('ifixlab_token', session.token); setToken(session.token); setUser(session.user); setRole(session.user.role); await loadWorkspace(session.token);
    } catch (requestError) { setError(requestError.message); }
  };
  const logout = () => { localStorage.removeItem('ifixlab_token'); setToken(null); setUser(null); setRole(null); setWorkspace(null); setActive('Overview'); setError(''); };

  const repairs = workspace?.repairs || [];
  const filteredRepairs = useMemo(() => { const query = search.toLowerCase(); return repairs.filter((repair) => Object.values(repair).join(' ').toLowerCase().includes(query)); }, [repairs, search]);
  const openIntake = () => { if (role !== 'Front Desk') return notify('Device intake is available to Front Desk only'); setShowIntake(true); setActive('New Intake'); };
  const closeIntake = () => { setShowIntake(false); setActive('Overview'); };

  const createIntake = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget); const checks = data.getAll('checks'); const physical = data.getAll('physical'); const accessories = data.getAll('accessories'); const notes = String(data.get('issueNotes') || '').trim(); const form = Object.fromEntries(data);
    form.device = [data.get('deviceType'), data.get('brand'), data.get('device'), data.get('color') && `(${data.get('color')})`].filter(Boolean).join(' ');
    form.condition = physical.length ? physical.map((item) => item.replace('Physical: ', '')).join(', ') : 'Not recorded';
    form.issue = [...checks, accessories.length ? `Accessories: ${accessories.join(', ')}` : '', notes].filter(Boolean).join(' · ') || 'General inspection requested';
    try {
      const ticket = await apiRequest('/api/repairs', token, { method: 'POST', body: JSON.stringify(form) });
      sessionStorage.setItem('ifixlab_print_ticket', JSON.stringify({ ...ticket, createdAt: new Date().toISOString() }));
      window.location.assign('/print-ticket');
      return true;
    }
    catch (requestError) { setError(requestError.message); return false; }
  };

  const updateStatus = async (id) => {
    try { await apiRequest('/api/repairs', token, { method: 'PATCH', body: JSON.stringify({ action: 'advance', id }) }); await loadWorkspace(); notify('Ticket status updated and audit logged by server'); }
    catch (requestError) { setError(requestError.message); }
  };

  const createStaff = async (form) => {
    try { await apiRequest('/api/users', token, { method: 'POST', body: JSON.stringify(form) }); await loadWorkspace(); notify('Staff account created'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const createInventoryItem = async (form) => {
    try { await apiRequest('/api/inventory', token, { method: 'POST', body: JSON.stringify(form) }); await loadWorkspace(); notify('Inventory item added'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const updateInventoryItem = async (form) => {
    try { await apiRequest('/api/inventory', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); notify('Inventory item updated'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const deleteInventoryItem = async (id, name) => {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    try { await apiRequest('/api/inventory', token, { method: 'DELETE', body: JSON.stringify({ id }) }); await loadWorkspace(); notify('Inventory item deleted'); }
    catch (requestError) { setError(requestError.message); }
  };
  const deactivateStaff = async (id, name) => {
    if (!window.confirm(`Deactivate ${name}? They will no longer be able to sign in.`)) return;
    try { await apiRequest('/api/users', token, { method: 'DELETE', body: JSON.stringify({ id }) }); await loadWorkspace(); notify('Staff account deactivated'); }
    catch (requestError) { setError(requestError.message); }
  };

  const reviewAppointment = async (id, action) => {
    try {
      await apiRequest('/api/appointments', token, { method: 'PATCH', body: JSON.stringify({ id, action }) });
      await loadWorkspace();
      notify(action === 'approve' ? 'Appointment request approved' : 'Appointment request rejected');
    } catch (requestError) { setError(requestError.message); }
  };

  const confirmDelivery = async (id, password) => {
    try {
      const delivery = await apiRequest('/api/repairs/delivery', token, { method: 'PATCH', body: JSON.stringify({ id, password }) });
      await loadWorkspace();
      notify(`Delivery confirmed by ${delivery.deliveredBy}`, 3000);
      return true;
    } catch (requestError) { setError(requestError.message); return false; }
  };

  if (token === undefined || (token && !workspace && !error)) return <div className="loading-screen"><span className="loader"></span><p>Loading iFixLab251 workspace…</p></div>;
  if (!token) return <LoginScreen login={login} error={error} />;

  const shared = { role, repairs, dashboard: workspace?.dashboard || {}, inventory: workspace?.inventory || [], sales: workspace?.sales || [], team: workspace?.team || [], appointments: workspace?.appointments || [], setActive, openIntake };
  const views = { Overview: <Overview {...shared} />, Appointments: <AppointmentsView appointments={shared.appointments} reviewAppointment={reviewAppointment} />, Repairs: <RepairsView repairs={filteredRepairs} search={search} setSearch={setSearch} role={role} updateStatus={updateStatus} confirmDelivery={confirmDelivery} />, Inventory: <InventoryView role={role} parts={shared.inventory} createInventoryItem={createInventoryItem} updateInventoryItem={updateInventoryItem} deleteInventoryItem={deleteInventoryItem} />, 'Point of Sale': <SalesView sales={shared.sales} notify={notify} />, Customers: <CustomersView repairs={repairs} />, Reports: <ReportsView dashboard={shared.dashboard} />, Team: <TeamView team={shared.team} createStaff={createStaff} deactivateStaff={deactivateStaff} /> };

  return <div className="app-shell">
    <AppSidebar role={role} user={user} active={active} navigation={workspace?.navigation || []} repairs={repairs} setActive={setActive} openIntake={openIntake} logout={logout} />
    <main className="main-area"><Topbar role={role} user={user} search={search} setSearch={setSearch} openIntake={openIntake}/><div className="content">{error && <div className="api-error"><span>!</span>{error}<button onClick={() => loadWorkspace()}>Retry</button></div>}{views[active] || views.Overview}</div></main>
    {showIntake && <IntakeModal close={closeIntake} submit={createIntake}/>} {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}
