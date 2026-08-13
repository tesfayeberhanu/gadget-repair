'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppSidebar from './components/AppSidebar';
import Topbar from './components/Topbar';
import Overview from './components/Overview';
import IntakeModal from './components/IntakeModal';
import LoginScreen from './components/LoginScreen';
import SettingsView from './components/SettingsView';
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const availableRepairIds = useRef(null);

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
  const forgotPassword = async (email) => {
    setError('');
    try { return await apiRequest('/api/password/forgot', null, { method: 'POST', body: JSON.stringify({ email }) }); }
    catch (requestError) { setError(requestError.message); throw requestError; }
  };
  const emailPasswordReset = async (email) => {
    try { const result = await apiRequest('/api/password/forgot', null, { method: 'POST', body: JSON.stringify({ email }) }); notify(result.message, 5000); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const logout = () => { localStorage.removeItem('ifixlab_token'); setToken(null); setUser(null); setRole(null); setWorkspace(null); setActive('Overview'); setError(''); };

  const repairs = workspace?.repairs || [];
  const assignedNewRepairs = role === 'Technician' ? repairs.filter((repair) => repair.status === 'Received' && repair.isMine) : [];
  const filteredRepairs = useMemo(() => { const query = search.toLowerCase(); return repairs.filter((repair) => Object.values(repair).join(' ').toLowerCase().includes(query)); }, [repairs, search]);
  const openRepairSearch = (repair) => {
    if (repair) setSearch(repair.id);
    setActive('Repairs');
  };
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
  const saveRepairProgress = async (form) => {
    try { await apiRequest('/api/repairs', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); notify(form.action === 'take' ? 'Job assigned to you' : form.progress === 100 ? 'Repair is ready for pickup' : `Progress updated to ${form.progress}%`); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const assignRepair = async (form) => {
    try { await apiRequest('/api/repairs', token, { method: 'PATCH', body: JSON.stringify({ ...form, action: 'assign' }) }); await loadWorkspace(); notify('Repair assigned to technician'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };

  const createStaff = async (form) => {
    try { await apiRequest('/api/users', token, { method: 'POST', body: JSON.stringify(form) }); await loadWorkspace(); notify('Staff account created'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const updateStaff = async (form) => {
    try { await apiRequest('/api/users', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); notify('Staff account updated'); return true; }
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
  const updateProfile = async (form) => {
    try { await apiRequest('/api/profile', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); notify('Profile updated'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const changePassword = async (form) => {
    if (form.newPassword !== form.confirmPassword) { setError('New passwords do not match'); return false; }
    try { await apiRequest('/api/profile/password', token, { method: 'PATCH', body: JSON.stringify(form) }); notify('Password changed successfully'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
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

  useEffect(() => {
    if (!token || role !== 'Technician' || !workspace) { availableRepairIds.current = null; return undefined; }
    availableRepairIds.current = new Set(assignedNewRepairs.map((repair) => repair.id));
    const poll = window.setInterval(async () => {
      try {
        const next = await apiRequest('/api/workspace', token);
        const nextAvailable = next.repairs.filter((repair) => repair.status === 'Received' && repair.isMine);
        const arrivals = availableRepairIds.current ? nextAvailable.filter((repair) => !availableRepairIds.current.has(repair.id)) : [];
        if (arrivals.length) notify(`${arrivals.length} new repair${arrivals.length === 1 ? '' : 's'} arrived`, 5000);
        availableRepairIds.current = new Set(nextAvailable.map((repair) => repair.id));
        setWorkspace(next); setRole(next.role); setUser(next.user);
      } catch { /* Keep the current workspace; normal API actions surface errors. */ }
    }, 15000);
    return () => window.clearInterval(poll);
  }, [token, role]);

  if (token === undefined || (token && !workspace && !error)) return <div className="loading-screen"><span className="loader"></span><p>Loading iFixLab251 workspace…</p></div>;
  if (!token) return <LoginScreen login={login} forgotPassword={forgotPassword} error={error} />;

  const shared = { role, user, repairs, dashboard: workspace?.dashboard || {}, inventory: workspace?.inventory || [], sales: workspace?.sales || [], team: workspace?.team || [], technicians: workspace?.technicians || [], appointments: workspace?.appointments || [], setActive, openIntake };
  const views = { Overview: <Overview {...shared} />, Appointments: <AppointmentsView appointments={shared.appointments} reviewAppointment={reviewAppointment} />, Repairs: <RepairsView repairs={filteredRepairs} inventory={shared.inventory} technicians={shared.technicians} search={search} setSearch={setSearch} role={role} updateStatus={updateStatus} assignRepair={assignRepair} saveRepairProgress={saveRepairProgress} confirmDelivery={confirmDelivery} />, Inventory: <InventoryView role={role} parts={shared.inventory} dashboard={shared.dashboard} createInventoryItem={createInventoryItem} updateInventoryItem={updateInventoryItem} deleteInventoryItem={deleteInventoryItem} />, 'Point of Sale': <SalesView sales={shared.sales} />, Customers: <CustomersView repairs={repairs} />, Reports: <ReportsView dashboard={shared.dashboard} />, Team: <TeamView team={shared.team} createStaff={createStaff} updateStaff={updateStaff} deactivateStaff={deactivateStaff} />, Settings: <SettingsView user={user} updateProfile={updateProfile} changePassword={changePassword} emailPasswordReset={emailPasswordReset}/> };

  return <div className="app-shell">
    <AppSidebar role={role} user={user} active={active} navigation={workspace?.navigation || []} repairs={repairs} setActive={setActive} openIntake={openIntake} logout={logout} mobileOpen={mobileNavOpen} closeMobileNav={() => setMobileNavOpen(false)} />
    <main className="main-area"><Topbar role={role} user={user} search={search} setSearch={setSearch} repairs={repairs} openRepairSearch={openRepairSearch} openMobileNav={() => setMobileNavOpen(true)} notificationCount={assignedNewRepairs.length} openNotifications={() => setActive('Repairs')}/><div className="content">{error && <div className="api-error"><span>!</span>{error}<button onClick={() => loadWorkspace()}>Retry</button></div>}{views[active] || views.Overview}</div></main>
    {showIntake && <IntakeModal close={closeIntake} submit={createIntake}/>} {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}
