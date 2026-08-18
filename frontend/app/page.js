'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppSidebar from './components/AppSidebar';
import Topbar from './components/Topbar';
import Overview from './components/Overview';
import IntakeModal from './components/IntakeModal';
import LoginScreen from './components/LoginScreen';
import SettingsView from './components/SettingsView';
import { AppointmentsView, RepairsView, InventoryView, ExpensesView, SalesView, CustomersView, ReportsView, TeamView, WebsiteView } from './components/ModuleViews';
import { matchesSearch } from './utils/listTools.mjs';

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
  const [intakeCustomer, setIntakeCustomer] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [focusCustomer, setFocusCustomer] = useState(null);
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
  const filteredRepairs = useMemo(() => repairs.filter((repair) => matchesSearch([
    repair.id, repair.customer, repair.phone, repair.imei, repair.device, repair.issue, repair.status, repair.tech,
    repair.paymentStatus, repair.invoiceTotal, repair.balanceDue,
  ], search)), [repairs, search]);
  const openRepairSearch = (repair) => {
    if (repair) setSearch(repair.id);
    setActive('Repairs');
  };
  const openCustomerSearch = (customer) => {
    setSearch('');
    setFocusCustomer(customer || null);
    setActive('Customers');
  };
  const openAppointmentSearch = (appointment) => {
    setSearch('');
    setActive('Appointments');
  };
  const openIntake = (customer = null) => {
    if (role !== 'Front Desk') return notify('Device intake is available to Front Desk only');
    setIntakeCustomer(customer);
    setShowIntake(true);
    setActive('New Intake');
  };
  const closeIntake = () => { setShowIntake(false); setIntakeCustomer(null); setActive('Overview'); };

  const createIntake = async (event, deviceCount = 1) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const shared = { customer: data.get('customer'), phone: data.get('phone'), customerId: data.get('customerId'), isCreditCustomer: data.get('isCreditCustomer') };
    const tickets = [];
    try {
      for (let index = 0; index < deviceCount; index++) {
        const prefix = `dev${index}_`;
        const checks = data.getAll(`${prefix}checks`); const physical = data.getAll(`${prefix}physical`); const accessories = data.getAll(`${prefix}accessories`); const notes = String(data.get(`${prefix}issueNotes`) || '').trim();
        const form = { ...shared, ...(tickets[0] ? { customerId: tickets[0].customerId } : {}) };
        form.device = [data.get(`${prefix}deviceType`), data.get(`${prefix}brand`), data.get(`${prefix}device`), data.get(`${prefix}color`) && `(${data.get(`${prefix}color`)})`].filter(Boolean).join(' ');
        form.condition = physical.length ? physical.map((item) => item.replace('Physical: ', '')).join(', ') : 'Not recorded';
        form.issue = [...checks, accessories.length ? `Accessories: ${accessories.join(', ')}` : '', notes].filter(Boolean).join(' · ') || 'General inspection requested';
        form.imei = data.get(`${prefix}imei`);
        form.estimate = data.get(`${prefix}estimate`);
        const ticket = await apiRequest('/api/repairs', token, { method: 'POST', body: JSON.stringify(form) });
        tickets.push(ticket);
      }
      sessionStorage.setItem('ifixlab_print_ticket', JSON.stringify({ tickets: tickets.map((ticket) => ({ ...ticket, createdAt: new Date().toISOString() })) }));
      window.location.assign('/print-ticket');
      return true;
    }
    catch (requestError) {
      setError(tickets.length ? `Device ${tickets.length + 1}: ${requestError.message}. ${tickets.length} ticket${tickets.length === 1 ? '' : 's'} already created for this customer — check the Repairs queue.` : requestError.message);
      return false;
    }
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
  const createExpense = async (form) => {
    try { await apiRequest('/api/expenses', token, { method: 'POST', body: JSON.stringify(form) }); await loadWorkspace(); notify('Expense recorded'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const updateExpense = async (form) => {
    try { await apiRequest('/api/expenses', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); notify('Expense updated'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const deleteExpense = async (id, description) => {
    if (!window.confirm(`Delete expense "${description}"? This cannot be undone.`)) return;
    try { await apiRequest('/api/expenses', token, { method: 'DELETE', body: JSON.stringify({ id }) }); await loadWorkspace(); notify('Expense deleted'); }
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

  const createBanner = async (form) => {
    try { await apiRequest('/api/banners', token, { method: 'POST', body: JSON.stringify(form) }); await loadWorkspace(); notify('Banner added'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const updateBanner = async (form) => {
    try { await apiRequest('/api/banners', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); notify('Banner updated'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const deleteBanner = async (id, title) => {
    if (!window.confirm(`Delete banner "${title}"? This cannot be undone.`)) return;
    try { await apiRequest('/api/banners', token, { method: 'DELETE', body: JSON.stringify({ id }) }); await loadWorkspace(); notify('Banner deleted'); }
    catch (requestError) { setError(requestError.message); }
  };
  const reorderBanner = async (form) => {
    try { await apiRequest('/api/banners/reorder', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); }
    catch (requestError) { setError(requestError.message); }
  };
  const createSocialLink = async (form) => {
    try { await apiRequest('/api/social-links', token, { method: 'POST', body: JSON.stringify(form) }); await loadWorkspace(); notify('Social link added'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const updateSocialLink = async (form) => {
    try { await apiRequest('/api/social-links', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); notify('Social link updated'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const deleteSocialLink = async (id, platform) => {
    if (!window.confirm(`Delete the ${platform} link?`)) return;
    try { await apiRequest('/api/social-links', token, { method: 'DELETE', body: JSON.stringify({ id }) }); await loadWorkspace(); notify('Social link deleted'); }
    catch (requestError) { setError(requestError.message); }
  };
  const createStaffProfile = async (form) => {
    try { await apiRequest('/api/staff-profiles', token, { method: 'POST', body: JSON.stringify(form) }); await loadWorkspace(); notify('Team member added'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const updateStaffProfile = async (form) => {
    try { await apiRequest('/api/staff-profiles', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); notify('Team member updated'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const deleteStaffProfile = async (id, name) => {
    if (!window.confirm(`Remove ${name} from the team showcase?`)) return;
    try { await apiRequest('/api/staff-profiles', token, { method: 'DELETE', body: JSON.stringify({ id }) }); await loadWorkspace(); notify('Team member removed'); }
    catch (requestError) { setError(requestError.message); }
  };
  const createBlogPost = async (form) => {
    try { await apiRequest('/api/blog-posts', token, { method: 'POST', body: JSON.stringify(form) }); await loadWorkspace(); notify('Article added'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const updateBlogPost = async (form) => {
    try { await apiRequest('/api/blog-posts', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); notify('Article updated'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const deleteBlogPost = async (id, title) => {
    if (!window.confirm(`Delete article "${title}"? This cannot be undone.`)) return;
    try { await apiRequest('/api/blog-posts', token, { method: 'DELETE', body: JSON.stringify({ id }) }); await loadWorkspace(); notify('Article deleted'); }
    catch (requestError) { setError(requestError.message); }
  };
  const reorderBlogPost = async (form) => {
    try { await apiRequest('/api/blog-posts/reorder', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); }
    catch (requestError) { setError(requestError.message); }
  };

  const createCustomer = async (form) => {
    try { await apiRequest('/api/customers', token, { method: 'POST', body: JSON.stringify(form) }); await loadWorkspace(); notify('Customer created'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const updateCustomer = async (form) => {
    try { await apiRequest('/api/customers', token, { method: 'PATCH', body: JSON.stringify(form) }); await loadWorkspace(); notify('Customer updated'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const recordPayment = async (form) => {
    try { await apiRequest('/api/sales/payments', token, { method: 'POST', body: JSON.stringify(form) }); await loadWorkspace(); notify('Payment recorded'); return true; }
    catch (requestError) { setError(requestError.message); return false; }
  };
  const confirmDelivery = async (form) => {
    try {
      const delivery = await apiRequest('/api/repairs/delivery', token, { method: 'PATCH', body: JSON.stringify(form) });
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

  useEffect(() => {
    if (!token || role === 'Technician') return undefined;
    let active = true;
    let refreshInFlight = false;

    const refreshWorkspace = async () => {
      if (!active || refreshInFlight || document.visibilityState !== 'visible') return;
      refreshInFlight = true;
      try {
        const next = await apiRequest('/api/workspace', token);
        if (!active) return;
        setWorkspace(next); setRole(next.role); setUser(next.user); setError('');
      } catch (requestError) {
        if (!active) return;
        if (requestError.message === 'Please sign in') { localStorage.removeItem('ifixlab_token'); setToken(null); setWorkspace(null); }
        setError(requestError.message);
      } finally {
        refreshInFlight = false;
      }
    };
    const refreshWhenFocused = () => { void refreshWorkspace(); };
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void refreshWorkspace(); };
    const refreshInterval = window.setInterval(() => { void refreshWorkspace(); }, 15000);

    window.addEventListener('focus', refreshWhenFocused);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshWhenFocused);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [token, role]);

  if (token === undefined || (token && !workspace && !error)) return <div className="loading-screen"><span className="loader"></span><p>Loading iFixLab251 workspace…</p></div>;
  if (!token) return <LoginScreen login={login} forgotPassword={forgotPassword} error={error} />;

  const shared = { role, user, repairs, dashboard: workspace?.dashboard || {}, inventory: workspace?.inventory || [], expenses: workspace?.expenses || [], sales: workspace?.sales || [], customers: workspace?.customers || [], team: workspace?.team || [], technicians: workspace?.technicians || [], appointments: workspace?.appointments || [], banners: workspace?.banners || [], socialLinks: workspace?.socialLinks || [], staffProfiles: workspace?.staffProfiles || [], blogPosts: workspace?.blogPosts || [], setActive, openIntake };
  const views = { Overview: <Overview {...shared} />, Appointments: <AppointmentsView appointments={shared.appointments} reviewAppointment={reviewAppointment} />, Repairs: <RepairsView repairs={filteredRepairs} totalRepairs={repairs.length} inventory={shared.inventory} technicians={shared.technicians} search={search} setSearch={setSearch} role={role} updateStatus={updateStatus} assignRepair={assignRepair} saveRepairProgress={saveRepairProgress} confirmDelivery={confirmDelivery} />, Inventory: <InventoryView role={role} parts={shared.inventory} dashboard={shared.dashboard} createInventoryItem={createInventoryItem} updateInventoryItem={updateInventoryItem} deleteInventoryItem={deleteInventoryItem} />, Expense: <ExpensesView expenses={shared.expenses} dashboard={shared.dashboard} createExpense={createExpense} updateExpense={updateExpense} deleteExpense={deleteExpense} />, 'Point of Sale': <SalesView sales={shared.sales} dashboard={shared.dashboard} recordPayment={recordPayment} />, Customers: <CustomersView role={role} customers={shared.customers} repairs={repairs} createCustomer={createCustomer} updateCustomer={updateCustomer} startCustomerIntake={openIntake} focusCustomer={focusCustomer} clearFocusCustomer={() => setFocusCustomer(null)} />, Reports: <ReportsView dashboard={shared.dashboard} />, Team: <TeamView team={shared.team} createStaff={createStaff} updateStaff={updateStaff} deactivateStaff={deactivateStaff} />, Website: <WebsiteView role={role} banners={shared.banners} socialLinks={shared.socialLinks} staffProfiles={shared.staffProfiles} blogPosts={shared.blogPosts} createBanner={createBanner} updateBanner={updateBanner} deleteBanner={deleteBanner} reorderBanner={reorderBanner} createSocialLink={createSocialLink} updateSocialLink={updateSocialLink} deleteSocialLink={deleteSocialLink} createStaffProfile={createStaffProfile} updateStaffProfile={updateStaffProfile} deleteStaffProfile={deleteStaffProfile} createBlogPost={createBlogPost} updateBlogPost={updateBlogPost} deleteBlogPost={deleteBlogPost} reorderBlogPost={reorderBlogPost} />, Settings: <SettingsView user={user} updateProfile={updateProfile} changePassword={changePassword} emailPasswordReset={emailPasswordReset}/> };

  return <div className="app-shell">
    <AppSidebar role={role} user={user} active={active} navigation={workspace?.navigation || []} repairs={repairs} setActive={setActive} openIntake={openIntake} logout={logout} mobileOpen={mobileNavOpen} closeMobileNav={() => setMobileNavOpen(false)} />
    <main className="main-area"><Topbar role={role} user={user} search={search} setSearch={setSearch} repairs={repairs} customers={workspace?.customers || []} inventory={workspace?.inventory || []} appointments={workspace?.appointments || []} openRepairSearch={openRepairSearch} openCustomerSearch={openCustomerSearch} openAppointmentSearch={openAppointmentSearch} openMobileNav={() => setMobileNavOpen(true)} notificationCount={assignedNewRepairs.length} openNotifications={() => setActive('Repairs')}/><div className="content">{error && <div className="api-error"><span>!</span>{error}<button onClick={() => loadWorkspace()}>Retry</button></div>}{views[active] || views.Overview}</div></main>
    {showIntake && <IntakeModal customer={intakeCustomer} close={closeIntake} submit={createIntake}/>} {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}
