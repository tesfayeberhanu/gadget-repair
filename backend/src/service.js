import { prisma } from './prisma.js';
import { createSession, hashPassword, requireRole, verifyPassword } from './auth.js';

const navigation = {
  Admin: ['Overview', 'Repairs', 'Inventory', 'Point of Sale', 'Customers', 'Reports', 'Team'],
  Technician: ['Overview', 'Repairs', 'Inventory'],
  'Front Desk': ['Overview', 'New Intake', 'Appointments', 'Repairs', 'Point of Sale', 'Customers'],
};
const dbRole = { Admin: 'ADMIN', Technician: 'TECHNICIAN', 'Front Desk': 'FRONT_DESK' };
const roleLabel = { ADMIN: 'Admin', TECHNICIAN: 'Technician', FRONT_DESK: 'Front Desk' };
const permissionNavigation = { VIEW_REPORTS: 'Reports', VIEW_CUSTOMERS: 'Customers', MANAGE_POS: 'Point of Sale', VIEW_INVENTORY: 'Inventory' };
const allowedPermissions = Object.keys(permissionNavigation);
const statusOrder = ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'DELIVERED'];
const statusLabel = { PENDING: 'Received', IN_PROGRESS: 'Diagnosing', WAITING_FOR_PARTS: 'Repair Approved', COMPLETED: 'In Repair', DELIVERED: 'Ready for Pickup', PICKED_UP: 'Delivered' };
const paymentLabel = { PAID: 'Paid', PENDING: 'Pending', REFUNDED: 'Refunded' };
const methodLabel = { CASH: 'Cash', CARD: 'Card', DIGITAL_TRANSFER: 'Transfer' };
const appointmentLabel = { REQUESTED: 'Requested', CONFIRMED: 'Approved', CANCELLED: 'Rejected' };

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
    due: ticket.status === 'DELIVERED' ? 'Ready for pickup' : 'Not scheduled',
    total: role === 'Technician' ? null : Number(ticket.estimatedCost),
    isMine: Boolean(actorId && ticket.assignedTechId === actorId),
    delivery: ticket.delivery ? { deliveredBy: ticket.delivery.deliveredBy.name, deliveredAt: ticket.delivery.deliveredAt, paymentStatus: paymentLabel[ticket.delivery.paymentStatus] } : null,
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

async function actorFor(actorId, role, client = prisma) {
  const actor = await client.user.findFirst({ where: { id: actorId, role: dbRole[role], active: true } });
  if (!actor) throw new Error('UNAUTHORIZED');
  return actor;
}

export async function login(email, password) {
  const user = await prisma.user.findUnique({ where: { email: String(email || '').trim().toLowerCase() } });
  if (!user || !user.active || !verifyPassword(String(password || ''), user.password)) throw new Error('INVALID_CREDENTIALS');
  return { token: createSession(user), user: { name: user.name, role: roleLabel[user.role] || user.role } };
}

export async function getWorkspace(role, actorId) {
  const actor = await actorFor(actorId, role);
  const userNavigation = [...navigation[role]];
  for (const permission of actor.permissions) {
    const item = permissionNavigation[permission];
    if (item && !userNavigation.includes(item)) userNavigation.push(item);
  }
  const [tickets, parts, sales, team, appointments] = await Promise.all([
    prisma.repairTicket.findMany({ include: { assignedTech: { select: { name: true } }, delivery: { include: { deliveredBy: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } }),
    prisma.part.findMany({ orderBy: { name: 'asc' } }),
    role === 'Technician' && !actor.permissions.includes('MANAGE_POS') ? [] : prisma.sale.findMany({ include: { ticket: { select: { customerName: true, deviceModel: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    role === 'Admin' ? prisma.user.findMany({ where: { active: true }, select: { id: true, email: true, name: true, role: true, permissions: true }, orderBy: { createdAt: 'asc' } }) : [],
    role === 'Front Desk' ? prisma.appointment.findMany({ orderBy: { preferredDate: 'asc' }, take: 100 }) : [],
  ]);

  const visibleTickets = role === 'Technician' && !actor.permissions.includes('VIEW_CUSTOMERS')
    ? tickets.filter((ticket) => ticket.assignedTechId === actor.id || (ticket.status === 'PENDING' && !ticket.assignedTechId))
    : tickets;
  const repairs = visibleTickets.map((ticket) => serializeRepair(ticket, role, actor?.id));
  const inventory = parts.map((part) => serializePart(part, role));
  const active = visibleTickets.filter((ticket) => !['DELIVERED', 'PICKED_UP'].includes(ticket.status));
  const technicianTickets = role === 'Technician' ? tickets.filter((ticket) => ticket.assignedTechId === actor.id) : [];
  const paidRevenue = sales.filter((sale) => sale.paymentStatus === 'PAID').reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
  const reportMetrics = { totalRevenue: paidRevenue, grossMargin: 54.2, technicianYield: 6.4 };
  const dashboard = role === 'Technician'
    ? { ...reportMetrics, assignedPending: technicianTickets.filter((ticket) => ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_PARTS'].includes(ticket.status)).length, inProgress: technicianTickets.filter((ticket) => ticket.status === 'COMPLETED').length, completedToday: technicianTickets.filter((ticket) => ticket.status === 'DELIVERED').length }
    : role === 'Front Desk'
      ? { ...reportMetrics, intakesToday: tickets.filter((ticket) => ticket.createdAt.toDateString() === new Date().toDateString()).length, readyForPickup: tickets.filter((ticket) => ticket.status === 'DELIVERED').length, dailySales: paidRevenue }
      : { ...reportMetrics, activeRepairs: active.length, completedThisMonth: tickets.filter((ticket) => ticket.status === 'DELIVERED').length, lowStock: parts.filter((part) => part.stockQty <= part.minimumStockQty).length };

  return {
    role,
    navigation: userNavigation,
    permissions: actor.permissions,
    dashboard,
    repairs,
    inventory,
    sales: sales.map(serializeSale),
    appointments: appointments.map((item) => ({ id: item.id, reference: item.id.slice(0, 8).toUpperCase(), customer: item.customerName, phone: item.customerPhone, device: item.device, issue: item.issue, preferredDate: item.preferredDate, status: appointmentLabel[item.status] || item.status })),
    team: team.map((user) => ({ id: user.id, email: user.email, name: user.name, role: statusLabel[user.role] || user.role.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), permissions: user.permissions, description: user.role === 'ADMIN' ? 'Protected owner account' : user.role === 'TECHNICIAN' ? 'Repairs and parts' : 'Intake, POS and customers' })),
  };
}

export async function createStaff(role, actorId, input) {
  requireRole(role, ['Admin']);
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const staffRole = input.role;
  const permissions = Array.isArray(input.permissions) ? input.permissions.filter((permission) => allowedPermissions.includes(permission)) : [];
  if (!name || !email.includes('@') || password.length < 10) throw new Error('INVALID_STAFF');
  if (!['Technician', 'Front Desk'].includes(staffRole)) throw new Error('INVALID_STAFF_ROLE');
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({ where: { email }, update: { name, role: dbRole[staffRole], permissions, password: hashPassword(password), active: true }, create: { name, email, role: dbRole[staffRole], permissions, password: hashPassword(password), active: true } });
    await tx.auditLog.create({ data: { userId: actorId, action: 'staff.created_or_reactivated', entity: 'User', entityId: user.id } });
    return { id: user.id, email: user.email, name: user.name, role: staffRole, permissions, description: staffRole === 'Technician' ? 'Repairs and parts' : 'Intake, POS and customers' };
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

const normalizePhone = (value) => String(value || '').replace(/[^0-9+]/g, '');

export async function trackRepair(ticketNumber, phone) {
  const ticket = String(ticketNumber || '').trim().toUpperCase();
  const normalizedPhone = normalizePhone(phone);
  if (!ticket || normalizedPhone.length < 7) throw new Error('INVALID_TRACKING');
  const repair = await prisma.repairTicket.findUnique({ where: { ticketNumber: ticket }, include: { assignedTech: { select: { name: true } } } });
  if (!repair || normalizePhone(repair.customerPhone) !== normalizedPhone) throw new Error('TRACKING_NOT_FOUND');
  return { ticketNumber: repair.ticketNumber, device: repair.deviceModel, status: statusLabel[repair.status], technician: repair.assignedTech?.name || 'Awaiting assignment', receivedAt: repair.createdAt, updatedAt: repair.updatedAt };
}

export async function requestAppointment(input) {
  const customerName = String(input.customerName || '').trim();
  const customerPhone = normalizePhone(input.customerPhone);
  const device = String(input.device || '').trim();
  const issue = String(input.issue || '').trim();
  const preferredDate = new Date(input.preferredDate);
  if (!customerName || customerPhone.length < 7 || !device || !issue || Number.isNaN(preferredDate.getTime()) || preferredDate <= new Date()) throw new Error('INVALID_APPOINTMENT');
  const appointment = await prisma.appointment.create({ data: { customerName, customerPhone, device, issue, preferredDate } });
  return { reference: appointment.id.slice(0, 8).toUpperCase(), status: 'Requested', preferredDate: appointment.preferredDate };
}

export async function reviewAppointment(role, actorId, input) {
  requireRole(role, ['Front Desk']);
  const status = input.action === 'approve' ? 'CONFIRMED' : input.action === 'reject' ? 'CANCELLED' : null;
  if (!input.id || !status) throw new Error('INVALID_APPOINTMENT_ACTION');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const appointment = await tx.appointment.findUnique({ where: { id: input.id } });
    if (!appointment) throw new Error('NOT_FOUND');
    if (appointment.status !== 'REQUESTED') throw new Error('APPOINTMENT_REVIEWED');
    const updated = await tx.appointment.update({ where: { id: appointment.id }, data: { status } });
    await tx.auditLog.create({ data: { userId: actor.id, action: input.action === 'approve' ? 'appointment.approved' : 'appointment.rejected', entity: 'Appointment', entityId: appointment.id } });
    return { id: updated.id, status: appointmentLabel[updated.status] };
  });
}

export async function createRepair(role, actorId, input) {
  requireRole(role, ['Front Desk']);
  const required = ['customer', 'phone', 'device', 'imei', 'issue'];
  if (required.some((field) => !String(input[field] || '').trim())) throw new Error('Missing required intake information');

  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
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

export async function advanceRepair(role, actorId, ticketNumber) {
  requireRole(role, ['Technician']);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
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

export async function confirmDelivery(role, actorId, input) {
  requireRole(role, ['Front Desk']);
  const password = String(input.password || '');
  if (!input.id || !password) throw new Error('DELIVERY_AUTH_REQUIRED');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (!verifyPassword(password, actor.password)) throw new Error('INVALID_DELIVERY_AUTH');
    const ticket = await tx.repairTicket.findUnique({
      where: { ticketNumber: input.id },
      include: { assignedTech: { select: { name: true } }, sales: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!ticket) throw new Error('NOT_FOUND');
    if (ticket.status === 'PICKED_UP') throw new Error('ALREADY_DELIVERED');
    if (ticket.status !== 'DELIVERED') throw new Error('NOT_READY_FOR_DELIVERY');
    const paymentStatus = ticket.sales[0]?.paymentStatus || 'PENDING';
    const delivery = await tx.deliveryRecord.create({ data: { ticketId: ticket.id, deliveredById: actor.id, paymentStatus } });
    await tx.repairTicket.update({ where: { id: ticket.id }, data: { status: 'PICKED_UP' } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'repair.delivery_confirmed', entity: 'RepairTicket', entityId: ticket.id } });
    return { jobId: ticket.ticketNumber, status: 'Delivered', deliveredBy: actor.name, deliveredAt: delivery.deliveredAt, payment: paymentLabel[paymentStatus], device: ticket.deviceModel, customer: ticket.customerName, technician: ticket.assignedTech?.name || 'Unassigned' };
  });
}
