'use client';

import { useEffect, useMemo, useState } from 'react';
import AppSidebar from './components/AppSidebar';
import Topbar from './components/Topbar';
import Overview from './components/Overview';
import IntakeModal from './components/IntakeModal';
import { RepairsView, InventoryView, SalesView, CustomersView, ReportsView, TeamView } from './components/ModuleViews';

async function apiRequest(path, role, options = {}) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-user-role': role, ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function HomePage() {
  const [role, setRole] = useState('Admin');
  const [active, setActive] = useState('Overview');
  const [workspace, setWorkspace] = useState(null);
  const [search, setSearch] = useState('');
  const [showIntake, setShowIntake] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const notify = (message, duration = 2200) => {
    setToast(message);
    window.setTimeout(() => setToast(''), duration);
  };

  const loadWorkspace = async (selectedRole = role) => {
    setError('');
    try { setWorkspace(await apiRequest('/api/workspace', selectedRole)); }
    catch (requestError) { setError(requestError.message); }
  };

  useEffect(() => { loadWorkspace(role); }, [role]);

  const repairs = workspace?.repairs || [];
  const filteredRepairs = useMemo(() => {
    const query = search.toLowerCase();
    return repairs.filter((repair) => Object.values(repair).join(' ').toLowerCase().includes(query));
  }, [repairs, search]);

  const switchRole = (nextRole) => {
    setRole(nextRole);
    setActive('Overview');
    notify(`Loading ${nextRole} access`);
  };

  const openIntake = () => {
    if (role !== 'Front Desk') return notify('Device intake is available to Front Desk only');
    setShowIntake(true); setActive('New Intake');
  };
  const closeIntake = () => { setShowIntake(false); setActive('Overview'); };

  const createIntake = async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const checks = data.getAll('checks');
    const physical = data.getAll('physical');
    const accessories = data.getAll('accessories');
    const notes = String(data.get('issueNotes') || '').trim();
    const form = Object.fromEntries(data);
    form.device = [data.get('deviceType'), data.get('device'), data.get('color') && `(${data.get('color')})`].filter(Boolean).join(' ');
    form.condition = physical.length ? physical.map((item) => item.replace('Physical: ', '')).join(', ') : 'Not recorded';
    form.issue = [...checks, accessories.length ? `Accessories: ${accessories.join(', ')}` : '', notes].filter(Boolean).join(' · ') || 'General inspection requested';
    try {
      await apiRequest('/api/repairs', role, { method: 'POST', body: JSON.stringify(form) });
      await loadWorkspace();
      setShowIntake(false);
      setActive('Repairs');
      notify('Ticket created by server · barcode receipt ready', 2600);
    } catch (requestError) { setError(requestError.message); }
  };

  const updateStatus = async (id) => {
    try {
      await apiRequest('/api/repairs', role, { method: 'PATCH', body: JSON.stringify({ action: 'advance', id }) });
      await loadWorkspace();
      notify('Ticket status updated and audit logged by server');
    } catch (requestError) { setError(requestError.message); }
  };

  if (!workspace && !error) return <div className="loading-screen"><span className="loader"></span><p>Loading iFixLab251 workspace…</p></div>;

  const shared = { role, repairs, dashboard: workspace?.dashboard || {}, inventory: workspace?.inventory || [], sales: workspace?.sales || [], team: workspace?.team || [], setActive, openIntake };
  const views = {
    Overview: <Overview {...shared} />,
    Repairs: <RepairsView repairs={filteredRepairs} search={search} setSearch={setSearch} role={role} updateStatus={updateStatus} />,
    Inventory: <InventoryView role={role} parts={shared.inventory} />,
    'Point of Sale': <SalesView sales={shared.sales} notify={notify} />,
    Customers: <CustomersView repairs={repairs} />,
    Reports: <ReportsView dashboard={shared.dashboard} />,
    Team: <TeamView team={shared.team} />,
  };

  return <div className="app-shell">
    <AppSidebar role={role} active={active} navigation={workspace?.navigation || []} repairs={repairs} setActive={setActive} openIntake={openIntake} />
    <main className="main-area"><Topbar role={role} search={search} setSearch={setSearch} switchRole={switchRole} openIntake={openIntake}/><div className="content">{error && <div className="api-error"><span>!</span>{error}<button onClick={() => loadWorkspace()}>Retry</button></div>}{views[active] || views.Overview}</div></main>
    {showIntake && <IntakeModal close={closeIntake} submit={createIntake}/>} {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}
