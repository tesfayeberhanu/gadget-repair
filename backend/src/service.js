import { prisma } from './prisma.js';
import { createSession, hashPassword, requireRole, verifyPassword } from './auth.js';

const navigation = {
  Admin: ['Overview', 'Repairs', 'Inventory', 'Point of Sale', 'Customers', 'Reports', 'Team'],
  Technician: ['Overview', 'Repairs', 'Inventory'],
  'Front Desk': ['Overview', 'New Intake', 'Repairs', 'Point of Sale', 'Customers'],
};
const dbRole = { Admin: 'ADMIN', Technician: 'TECHNICIAN', 'Front Desk': 'FRONT_DESK' };
const roleLabel = { ADMIN: 'Admin', TECHNICIAN: 'Technician', FRONT_DESK: 'Front Desk' };
const statusOrder = ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'DELIVERED'];
const statusLabel = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', WAITING_FOR_PARTS: 'Waiting for Parts', COMPLETED: 'Completed', DELIVERED: 'Delivered' };
const paymentLabel = { PAID: 'Paid', PENDING: 'Pending', REFUNDED: 'Refunded' };
const methodLabel = { CASH: 'Cash', CARD: 'Card', DIGITAL_TRANSFER: 'Transfer' };

function serializeRepair(ticket, role, actorId = null) {
  const name = ticket.customerName;
  return {
    id: ticket.ticketNumber,
    recordId: ticket.id,
    customer: name,
    phone: ticket.customerPhone,
    imei: ticket.serialOrImei,
    device: ticket.deviceModel,
    issue: ticket.reportedIssue,
    condition: ticket.physicalCondition,
    status: statusLabel[ticket.status],
    tech: ticket.assignedTech?.name || 'Unassigned',
    due: ticket.status === 'COMPLETED' ? 'Ready for pickup' : 'Not scheduled',
    total: role === 'Technician' ? null : Number(ticket.estimatedCost),
    isMine: Boolean(actorId && ticket.assignedTechId === actorId),
    avatar: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
  };
}

function serializePart(part, role) {
  const base = { id: part.id, sku: part.sku, name: part.name, device: part.compatibleDevices || 'Universal', stock: part.stockQty, min: part.minimumStockQty };
  return role === 'Admin' ? { ...base, cost: Number(part.costPrice), price: Number(part.retailPrice) } : base;
}

function serializeSale(sale) {
  return { id: `#SL-${sale.id.slice(0, 6).toUpperCase()}`, customer: sale.ticket?.customerName || 'Retail customer', item: sale.ticket ? `${sale.ticket.deviceModel} repair` : 'Retail sale', method: methodLabel[sale.paymentMethod], amount: Number(sale.totalAmount), status: paymentLabel[sale.paymentStatus] };
}

async function actorFor(role, client = prisma) {
  const actor = await client.user.findFirst({ where: { role: dbRole[role], active: true }, orderBy: { createdAt: 'asc' } });
  if (!actor) throw new Error(`No seeded ${role} user exists`);
  return actor;
}

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email: String(email || '').trim().toLowerCase() } });
  if (!user || !user.active || !verifyPassword(String(password || ''), user.password)) throw new Error('INVALID_CREDENTIALS');
  return { token: createSession(user), user: { name: user.name, role: roleLabel[user.role] || user.role } };
}

export async function getWorkspace(role) {
  const actor = role === 'Technician' ? await actorFor(role) : null;
  const [tickets, parts, sales, team] = await Promise.all([
    prisma.repairTicket.findMany({ include: { assignedTech: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.part.findMany({ orderBy: { name: 'asc' } }),
    role === 'Technician' ? [] : prisma.sale.findMany({ include: { ticket: { select: { customerName: true, deviceModel: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    role === 'Admin' ? prisma.user.findMany({ where: { active: true }, select: { id: true, email: true, name: true, role: true }, orderBy: { createdAt: 'asc' } }) : [],
  ]);

  const visibleTickets = role === 'Technician'
    ? tickets.filter((ticket) => ticket.assignedTechId === actor.id || (ticket.status === 'PENDING' && !ticket.assignedTechId))
    : tickets;
  const repairs = visibleTickets.map((ticket) => serializeRepair(ticket, role, actor?.id));
  const inventory = parts.map((part) => serializePart(part, role));
  const active = visibleTickets.filter((ticket) => ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_PARTS'].includes(ticket.status));
  const paidRevenue = sales.filter((sale) => sale.paymentStatus === 'PAID').reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
  const dashboard = role === 'Technician'
    ? { assignedPending: active.filter((ticket) => ticket.assignedTechId === actor.id).length, inProgress: visibleTickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length, completedToday: visibleTickets.filter((ticket) => ticket.status === 'COMPLETED').length }
    : role === 'Front Desk'
      ? { intakesToday: tickets.filter((ticket) => ticket.createdAt.toDateString() === new Date().toDateString()).length, readyForPickup: tickets.filter((ticket) => ticket.status === 'COMPLETED').length, dailySales: paidRevenue }
      : { totalRevenue: paidRevenue, activeRepairs: active.length, completedThisMonth: tickets.filter((ticket) => ticket.status === 'COMPLETED').length, lowStock: parts.filter((part) => part.stockQty <= part.minimumStockQty).length, grossMargin: 54.2, technicianYield: 6.4 };

  return {
    role,
    navigation: navigation[role],
    dashboard,
    repairs,
    inventory,
    sales: sales.map(serializeSale),
    team: team.map((user) => ({ id: user.id, email: user.email, name: user.name, role: statusLabel[user.role] || user.role.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), description: user.role === 'ADMIN' ? 'Protected owner account' : user.role === 'TECHNICIAN' ? 'Repairs and parts' : 'Intake, POS and customers' })),
  };
}

export async function createStaff(role, actorId, input) {
  requireRole(role, ['Admin']);
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const staffRole = input.role;
  if (!name || !email.includes('@') || password.length < 10) throw new Error('INVALID_STAFF');
  if (!['Technician', 'Front Desk'].includes(staffRole)) throw new Error('INVALID_STAFF_ROLE');
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({ where: { email }, update: { name, role: dbRole[staffRole], password: hashPassword(password), active: true }, create: { name, email, role: dbRole[staffRole], password: hashPassword(password), active: true } });
    await tx.auditLog.create({ data: { userId: actorId, action: 'staff.created_or_reactivated', entity: 'User', entityId: user.id } });
    return { id: user.id, email: user.email, name: user.name, role: staffRole, description: staffRole === 'Technician' ? 'Repairs and parts' : 'Intake, POS and customers' };
  });
}

export async function deactivateStaff(role, actorId, id) {
  requireRole(role, ['Admin']);
  if (!id || id === actorId) throw new Error('PROTECTED_ADMIN');
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new Error('NOT_FOUND');
  if (user.role === 'ADMIN') throw new Error('PROTECTED_ADMIN');
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { active: false } }),
    prisma.auditLog.create({ data: { userId: actorId, action: 'staff.deactivated', entity: 'User', entityId: id } }),
  ]);
  return { success: true };
}

export async function createRepair(role, input) {
  requireRole(role, ['Front Desk']);
  const required = ['customer', 'phone', 'device', 'imei', 'issue'];
  if (required.some((field) => !String(input[field] || '').trim())) throw new Error('Missing required intake information');

  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(role, tx);
    const latest = await tx.repairTicket.findFirst({ orderBy: { ticketNumber: 'desc' }, select: { ticketNumber: true } });
    const sequence = Math.max(0, Number(latest?.ticketNumber.split('-').pop()) || 0) + 1;
    const ticket = await tx.repairTicket.create({
      data: {
        ticketNumber: `REP-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`,
        customerName: String(input.customer).trim(), customerPhone: String(input.phone).trim(), deviceModel: String(input.device).trim(),
        serialOrImei: String(input.imei).trim(), physicalCondition: input.condition || null, reportedIssue: String(input.issue).trim(),
        estimatedCost: Math.max(0, Number(input.estimate) || 0), createdById: actor.id,
      },
      include: { assignedTech: { select: { name: true } } },
    });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'repair.created', entity: 'RepairTicket', entityId: ticket.id } });
    return serializeRepair(ticket, role);
  }, { isolationLevel: 'Serializable' });
}

export async function advanceRepair(role, ticketNumber) {
  requireRole(role, ['Technician']);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(role, tx);
    const ticket = await tx.repairTicket.findUnique({ where: { ticketNumber }, include: { assignedTech: { select: { name: true } } } });
    if (!ticket) throw new Error('NOT_FOUND');
    if (ticket.status === 'PENDING' && ticket.assignedTechId && ticket.assignedTechId !== actor.id) throw new Error('FORBIDDEN');
    if (ticket.status !== 'PENDING' && ticket.assignedTechId !== actor.id) throw new Error('FORBIDDEN');
    const index = statusOrder.indexOf(ticket.status);
    if (index < 0 || index === statusOrder.length - 1) throw new Error('INVALID_STATUS');
    const updated = await tx.repairTicket.update({
      where: { id: ticket.id },
      data: { status: statusOrder[index + 1], ...(ticket.status === 'PENDING' ? { assignedTechId: actor.id } : {}) },
      include: { assignedTech: { select: { name: true } } },
    });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'repair.status_changed', entity: 'RepairTicket', entityId: ticket.id } });
    return serializeRepair(updated, role);
  });
}
