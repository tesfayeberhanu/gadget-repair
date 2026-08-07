import store from './store';
import { requireRole } from './auth';

const navigation = {
  Admin: ['Overview', 'Repairs', 'Inventory', 'Point of Sale', 'Customers', 'Reports', 'Team'],
  Technician: ['Overview', 'Repairs', 'Inventory', 'Customers'],
  'Front Desk': ['Overview', 'New Intake', 'Repairs', 'Point of Sale', 'Customers'],
};
const statusOrder = ['Pending', 'In Progress', 'Waiting for Parts', 'Completed', 'Delivered'];

const audit = (action, role, entity, id) => store.audit.unshift({ action, role, entity, id, timestamp: new Date().toISOString() });

function inventoryFor(role) {
  return store.parts.map((part) => role === 'Admin' ? part : ({ sku: part.sku, name: part.name, device: part.device, stock: part.stock, min: part.min }));
}

function repairsFor(role) {
  return store.repairs.map((repair) => role === 'Technician' ? { ...repair, total: null } : repair);
}

function dashboardFor(role) {
  const active = store.repairs.filter((repair) => ['Pending', 'In Progress', 'Waiting for Parts'].includes(repair.status));
  if (role === 'Technician') return { assignedPending: active.filter((repair) => repair.tech !== 'Unassigned').length, inProgress: store.repairs.filter((repair) => repair.status === 'In Progress').length, completedToday: 5 };
  if (role === 'Front Desk') return { intakesToday: 8, readyForPickup: store.repairs.filter((repair) => repair.status === 'Completed').length, dailySales: store.sales.filter((sale) => sale.status === 'Paid').reduce((sum, sale) => sum + sale.amount, 0) };
  return { totalRevenue: 48290, activeRepairs: active.length, completedThisMonth: 128, lowStock: store.parts.filter((part) => part.stock <= part.min).length, grossMargin: 54.2, technicianYield: 6.4 };
}

export function getWorkspace(role) {
  return {
    role,
    navigation: navigation[role],
    dashboard: dashboardFor(role),
    repairs: repairsFor(role),
    inventory: inventoryFor(role),
    sales: role === 'Technician' ? [] : store.sales,
    team: role === 'Admin' ? store.team : [],
  };
}

export function createRepair(role, input) {
  requireRole(role, ['Admin', 'Front Desk']);
  const required = ['customer', 'phone', 'device', 'imei', 'issue'];
  if (required.some((field) => !String(input[field] || '').trim())) throw new Error('Missing required intake information');
  const highest = store.repairs.reduce((max, repair) => Math.max(max, Number(repair.id.split('-').pop())), 0);
  const customer = String(input.customer).trim();
  const repair = {
    id: `RPR-2026-${String(highest + 1).padStart(4, '0')}`,
    customer, phone: String(input.phone).trim(), imei: String(input.imei).trim(), device: String(input.device).trim(),
    issue: String(input.issue).trim(), condition: input.condition || 'Good — normal wear', status: 'Pending', tech: 'Unassigned',
    due: 'Not scheduled', total: Math.max(0, Number(input.estimate) || 0),
    avatar: customer.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
  };
  store.repairs.unshift(repair);
  audit('repair.created', role, 'repair', repair.id);
  return repair;
}

export function advanceRepair(role, id) {
  requireRole(role, ['Admin', 'Technician']);
  const repair = store.repairs.find((item) => item.id === id);
  if (!repair) throw new Error('NOT_FOUND');
  const index = statusOrder.indexOf(repair.status);
  if (index < 0 || index === statusOrder.length - 1) throw new Error('INVALID_STATUS');
  if (repair.status === 'Pending' && role === 'Technician') repair.tech = 'Alex Kim';
  repair.status = statusOrder[index + 1];
  if (repair.status === 'Completed') repair.due = 'Ready for pickup';
  audit('repair.status_changed', role, 'repair', id);
  return role === 'Technician' ? { ...repair, total: null } : repair;
}
