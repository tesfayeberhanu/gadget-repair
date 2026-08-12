import { prisma } from './prisma.js';
import { createSession, hashPassword, requireRole, verifyPassword } from './auth.js';
import { createHash, randomBytes } from 'node:crypto';

const navigation = {
  Admin: ['Overview', 'Repairs', 'Inventory', 'Point of Sale', 'Customers', 'Reports', 'Team', 'Settings'],
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
const repairStatusForProgress = (progress) => progress >= 100 ? 'DELIVERED' : progress >= 75 ? 'COMPLETED' : progress >= 50 ? 'WAITING_FOR_PARTS' : 'IN_PROGRESS';

function serializeRepair(ticket, role, actorId = null) {
  const name = ticket.customerName;
  const minimumProgress = { PENDING: 0, IN_PROGRESS: 25, WAITING_FOR_PARTS: 50, COMPLETED: 75, DELIVERED: 100, PICKED_UP: 100 };
  return {
    id: ticket.ticketNumber,
    recordId: ticket.id,
    customer: name,
    phone: ticket.customerPhone,
    imei: ticket.serialOrImei,
    device: ticket.deviceModel,
    issue: ticket.reportedIssue,
    condition: ticket.physicalCondition,
    notes: ticket.technicianNotes || '',
    progress: Math.max(ticket.progress || 0, minimumProgress[ticket.status] || 0),
    usedParts: (ticket.usedParts || []).map((item) => ({ id: item.part.id, sku: item.part.sku, name: item.part.name, quantity: item.quantity })),
    status: statusLabel[ticket.status],
    tech: ticket.assignedTech?.name || 'Unassigned',
    due: ticket.status === 'DELIVERED' ? 'Ready for pickup' : 'Not scheduled',
    total: role === 'Technician' ? null : Number(ticket.estimatedCost),
    estimatedCost: Number(ticket.estimatedCost),
    createdAt: ticket.createdAt,
    isMine: Boolean(actorId && ticket.assignedTechId === actorId),
    delivery: ticket.delivery ? { deliveredBy: ticket.delivery.deliveredBy.name, deliveredAt: ticket.delivery.deliveredAt, paymentStatus: paymentLabel[ticket.delivery.paymentStatus] } : null,
    avatar: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
  };
}

function serializePart(part, role) {
  const base = { id: part.id, sku: part.sku, name: part.name, category: part.category || 'Other', description: part.description || '', device: part.compatibleDevices || 'Universal', stock: part.stockQty, min: part.minimumStockQty, createdAt: part.createdAt, updatedAt: part.updatedAt };
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

const resetTokenHash = (token) => createHash('sha256').update(token).digest('hex');
const escapeHtml = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

async function sendPasswordResetEmail(user, resetUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') throw new Error('EMAIL_NOT_CONFIGURED');
    return false;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESET_EMAIL_FROM || 'iFixLab251 <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Reset your iFixLab251 password',
      html: `<p>Hello ${escapeHtml(user.name)},</p><p>Use the secure link below to reset your password. It expires in 30 minutes and can only be used once.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) throw new Error('EMAIL_DELIVERY_FAILED');
  return true;
}

export async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.active) return { message: 'If that account exists, a reset link has been sent.' };
  const token = randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({ data: { tokenHash: resetTokenHash(token), userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
  const appUrl = (process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || 'http://localhost:3002').split(',')[0].replace(/\/$/, '');
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetEmail(user, resetUrl);
  return { message: 'If that account exists, a reset link has been sent.', ...(process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY ? { resetUrl } : {}) };
}

export async function resetPassword(input) {
  const token = String(input.token || '');
  const password = String(input.password || '');
  if (!token || password.length < 10) throw new Error('INVALID_PASSWORD_RESET');
  await prisma.$transaction(async (tx) => {
    const record = await tx.passwordResetToken.findUnique({ where: { tokenHash: resetTokenHash(token) } });
    if (!record) throw new Error('INVALID_RESET_TOKEN');
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new Error('INVALID_RESET_TOKEN');
    await tx.user.update({ where: { id: record.userId }, data: { password: hashPassword(password) } });
    await tx.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: record.userId, action: 'auth.password_reset', entity: 'User', entityId: record.userId } });
  });
  return { success: true };
}

export async function getWorkspace(role, actorId) {
  const actor = await actorFor(actorId, role);
  const userNavigation = [...navigation[role]];
  for (const permission of actor.permissions) {
    const item = permissionNavigation[permission];
    if (item && !userNavigation.includes(item)) userNavigation.push(item);
  }
  const [tickets, parts, sales, team, appointments, technicians] = await Promise.all([
    prisma.repairTicket.findMany({ include: { assignedTech: { select: { name: true } }, usedParts: { include: { part: true } }, delivery: { include: { deliveredBy: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } }),
    prisma.part.findMany({ orderBy: { name: 'asc' } }),
    role === 'Technician' && !actor.permissions.includes('MANAGE_POS') ? [] : prisma.sale.findMany({ include: { ticket: { select: { customerName: true, deviceModel: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    role === 'Admin' ? prisma.user.findMany({ where: { active: true }, select: { id: true, email: true, name: true, role: true, permissions: true }, orderBy: { createdAt: 'asc' } }) : [],
    role === 'Front Desk' ? prisma.appointment.findMany({ orderBy: { preferredDate: 'asc' }, take: 100 }) : [],
    role === 'Front Desk' ? prisma.user.findMany({ where: { role: 'TECHNICIAN', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : [],
  ]);

  const visibleTickets = role === 'Technician'
    ? tickets.filter((ticket) => ticket.assignedTechId === actor.id)
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
      ? { ...reportMetrics, intakesToday: tickets.filter((ticket) => ticket.createdAt.toDateString() === new Date().toDateString()).length, awaitingAssignment: tickets.filter((ticket) => ticket.status === 'PENDING' && !ticket.assignedTechId).length, readyForPickup: tickets.filter((ticket) => ticket.status === 'DELIVERED').length, dailySales: paidRevenue }
      : { ...reportMetrics, activeRepairs: active.length, completedThisMonth: tickets.filter((ticket) => ticket.status === 'DELIVERED').length, lowStock: parts.filter((part) => part.stockQty <= part.minimumStockQty).length };

  return {
    role,
    user: { name: actor.name, email: actor.email, role },
    navigation: userNavigation,
    permissions: actor.permissions,
    dashboard,
    repairs,
    inventory,
    sales: sales.map(serializeSale),
    appointments: appointments.map((item) => ({ id: item.id, reference: item.id.slice(0, 8).toUpperCase(), customer: item.customerName, phone: item.customerPhone, device: item.device, issue: item.issue, preferredDate: item.preferredDate, status: appointmentLabel[item.status] || item.status })),
    technicians,
    team: team.map((user) => ({ id: user.id, email: user.email, name: user.name, role: roleLabel[user.role] || user.role.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), permissions: user.permissions, description: user.role === 'ADMIN' ? 'Protected owner account' : user.role === 'TECHNICIAN' ? 'Repairs and parts' : 'Intake, POS and customers' })),
  };
}

export async function updateProfile(role, actorId, input) {
  requireRole(role, ['Admin']);
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  if (!name || !email.includes('@')) throw new Error('INVALID_PROFILE');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const duplicate = await tx.user.findFirst({ where: { email, id: { not: actor.id } }, select: { id: true } });
    if (duplicate) throw new Error('PROFILE_EMAIL_EXISTS');
    const user = await tx.user.update({ where: { id: actor.id }, data: { name, email } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'profile.updated', entity: 'User', entityId: actor.id } });
    return { name: user.name, email: user.email, role };
  });
}

export async function changePassword(role, actorId, input) {
  requireRole(role, ['Admin']);
  const currentPassword = String(input.currentPassword || '');
  const newPassword = String(input.newPassword || '');
  if (newPassword.length < 10) throw new Error('INVALID_NEW_PASSWORD');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (!verifyPassword(currentPassword, actor.password)) throw new Error('INVALID_CURRENT_PASSWORD');
    await tx.user.update({ where: { id: actor.id }, data: { password: hashPassword(newPassword) } });
    await tx.passwordResetToken.updateMany({ where: { userId: actor.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'profile.password_changed', entity: 'User', entityId: actor.id } });
    return { success: true };
  });
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

export async function updateStaff(role, actorId, input) {
  requireRole(role, ['Admin']);
  const id = String(input.id || '');
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const staffRole = input.role;
  const permissions = Array.isArray(input.permissions) ? input.permissions.filter((permission) => allowedPermissions.includes(permission)) : [];
  if (!id || !name || !email.includes('@') || (password && password.length < 10)) throw new Error('INVALID_STAFF_UPDATE');
  if (!['Technician', 'Front Desk'].includes(staffRole)) throw new Error('INVALID_STAFF_ROLE');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const target = await tx.user.findUnique({ where: { id } });
    if (!target) throw new Error('NOT_FOUND');
    if (target.role === 'ADMIN') throw new Error('PROTECTED_ADMIN');
    const duplicate = await tx.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } });
    if (duplicate) throw new Error('PROFILE_EMAIL_EXISTS');
    const user = await tx.user.update({ where: { id }, data: { name, email, role: dbRole[staffRole], permissions, ...(password ? { password: hashPassword(password) } : {}) } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'staff.updated', entity: 'User', entityId: user.id } });
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

export async function createInventoryItem(role, actorId, input) {
  requireRole(role, ['Admin']);
  const name = String(input.name || '').trim();
  const category = String(input.category || '').trim();
  const description = String(input.description || '').trim() || null;
  const stockQty = Number(input.quantity);
  const unitPrice = Number(input.unitPrice);
  const categories = ['Screen', 'Battery', 'Accessory', 'Cable', 'Camera', 'Part', 'Other'];
  if (!name || !categories.includes(category) || input.quantity === '' || input.unitPrice === ''
    || !Number.isInteger(stockQty) || stockQty < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error('INVALID_INVENTORY_ITEM');
  }

  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const sku = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const part = await tx.part.create({ data: { sku, name, category, description, stockQty, minimumStockQty: 5, costPrice: unitPrice, retailPrice: unitPrice } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'inventory.created', entity: 'Part', entityId: part.id } });
    return serializePart(part, role);
  });
}

function inventoryInput(input) {
  const name = String(input.name || '').trim();
  const category = String(input.category || '').trim();
  const description = String(input.description || '').trim() || null;
  const stockQty = Number(input.quantity);
  const unitPrice = Number(input.unitPrice);
  const categories = ['Screen', 'Battery', 'Accessory', 'Cable', 'Camera', 'Part', 'Other'];
  if (!name || !categories.includes(category) || input.quantity === '' || input.unitPrice === ''
    || !Number.isInteger(stockQty) || stockQty < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('INVALID_INVENTORY_ITEM');
  return { name, category, description, stockQty, costPrice: unitPrice, retailPrice: unitPrice };
}

export async function updateInventoryItem(role, actorId, input) {
  requireRole(role, ['Admin']);
  if (!input.id) throw new Error('NOT_FOUND');
  const data = inventoryInput(input);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const existing = await tx.part.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error('NOT_FOUND');
    const part = await tx.part.update({ where: { id: input.id }, data });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'inventory.updated', entity: 'Part', entityId: part.id } });
    return serializePart(part, role);
  });
}

export async function deleteInventoryItem(role, actorId, id) {
  requireRole(role, ['Admin']);
  if (!id) throw new Error('NOT_FOUND');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const existing = await tx.part.findUnique({ where: { id }, include: { _count: { select: { ticketParts: true } } } });
    if (!existing) throw new Error('NOT_FOUND');
    if (existing._count.ticketParts > 0) throw new Error('INVENTORY_IN_USE');
    await tx.part.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'inventory.deleted', entity: 'Part', entityId: id } });
    return { success: true };
  });
}

const normalizeEthiopianPhone = (value) => {
  const phone = String(value || '').replace(/[\s()-]/g, '');
  if (/^09\d{8}$/.test(phone)) return `+251${phone.slice(1)}`;
  if (/^\+2519\d{8}$/.test(phone)) return phone;
  return null;
};

export async function trackRepair(ticketNumber, phone) {
  const ticket = String(ticketNumber || '').trim().toUpperCase();
  const normalizedPhone = normalizeEthiopianPhone(phone);
  if (!ticket || !normalizedPhone) throw new Error('INVALID_TRACKING');
  const repair = await prisma.repairTicket.findUnique({ where: { ticketNumber: ticket }, include: { assignedTech: { select: { name: true } } } });
  if (!repair || normalizeEthiopianPhone(repair.customerPhone) !== normalizedPhone) throw new Error('TRACKING_NOT_FOUND');
  return { ticketNumber: repair.ticketNumber, device: repair.deviceModel, status: statusLabel[repair.status], technician: repair.assignedTech?.name || 'Awaiting assignment', receivedAt: repair.createdAt, updatedAt: repair.updatedAt };
}

export async function requestAppointment(input) {
  const customerName = String(input.customerName || '').trim();
  const customerPhone = normalizeEthiopianPhone(input.customerPhone);
  const device = String(input.device || '').trim();
  const issue = String(input.issue || '').trim();
  const preferredDate = new Date(input.preferredDate);
  if (!customerName || !customerPhone || !device || !issue || Number.isNaN(preferredDate.getTime()) || preferredDate <= new Date()) throw new Error('INVALID_APPOINTMENT');
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
  const customerPhone = normalizeEthiopianPhone(input.phone);
  if (!customerPhone) throw new Error('INVALID_ETHIOPIAN_PHONE');

  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const latest = await tx.repairTicket.findFirst({ orderBy: { ticketNumber: 'desc' }, select: { ticketNumber: true } });
    const sequence = Math.max(0, Number(latest?.ticketNumber.split('-').pop()) || 0) + 1;
    const ticket = await tx.repairTicket.create({
      data: {
        ticketNumber: `REP-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`,
        customerName: String(input.customer).trim(), customerPhone, deviceModel: String(input.device).trim(),
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

export async function updateRepairProgress(role, actorId, input) {
  requireRole(role, ['Technician']);
  const action = input.action;
  const notes = String(input.notes || '').trim();
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const ticket = await tx.repairTicket.findUnique({ where: { ticketNumber: input.id }, include: { assignedTech: { select: { name: true } }, usedParts: { include: { part: true } } } });
    if (!ticket) throw new Error('NOT_FOUND');

    if (action === 'take') {
      if (ticket.status !== 'PENDING' || ticket.assignedTechId !== actor.id) throw new Error('JOB_NOT_ASSIGNED');
      const updated = await tx.repairTicket.update({
        where: { id: ticket.id },
        data: { status: 'IN_PROGRESS', progress: 25, ...(notes ? { technicianNotes: notes } : {}) },
        include: { assignedTech: { select: { name: true } }, usedParts: { include: { part: true } } },
      });
      await tx.auditLog.create({ data: { userId: actor.id, action: 'repair.taken', entity: 'RepairTicket', entityId: ticket.id } });
      return serializeRepair(updated, role, actor.id);
    }

    if (action !== 'progress' || ticket.assignedTechId !== actor.id || ['DELIVERED', 'PICKED_UP'].includes(ticket.status)) throw new Error('FORBIDDEN');
    const progress = Number(input.progress);
    if (![25, 50, 75, 100].includes(progress) || progress < ticket.progress) throw new Error('INVALID_PROGRESS');
    const requestedParts = Array.isArray(input.parts) ? input.parts : input.partId ? [{ id: input.partId, quantity: input.partQuantity }] : [];
    const partQuantities = new Map();
    for (const item of requestedParts) {
      const partId = String(item.id || '');
      const quantity = Number(item.quantity);
      if (!partId || !Number.isInteger(quantity) || quantity < 1) throw new Error('INVALID_PART_QUANTITY');
      partQuantities.set(partId, (partQuantities.get(partId) || 0) + quantity);
    }
    if (progress >= 75 && ticket.usedParts.length === 0 && partQuantities.size === 0) throw new Error('REPAIR_PART_REQUIRED');
    for (const [partId, quantity] of partQuantities) {
      const deducted = await tx.part.updateMany({ where: { id: partId, stockQty: { gte: quantity } }, data: { stockQty: { decrement: quantity } } });
      if (deducted.count !== 1) throw new Error('INSUFFICIENT_PART_STOCK');
      await tx.ticketPart.upsert({ where: { ticketId_partId: { ticketId: ticket.id, partId } }, create: { ticketId: ticket.id, partId, quantity }, update: { quantity: { increment: quantity } } });
    }
    const updated = await tx.repairTicket.update({
      where: { id: ticket.id },
      data: { progress, status: repairStatusForProgress(progress), ...(notes ? { technicianNotes: notes } : {}) },
      include: { assignedTech: { select: { name: true } }, usedParts: { include: { part: true } } },
    });
    await tx.auditLog.create({ data: { userId: actor.id, action: progress === 100 ? 'repair.ready_for_pickup' : 'repair.progress_updated', entity: 'RepairTicket', entityId: ticket.id } });
    return serializeRepair(updated, role, actor.id);
  });
}

export async function assignRepair(role, actorId, input) {
  requireRole(role, ['Front Desk']);
  if (!input.id || !input.technicianId) throw new Error('INVALID_ASSIGNMENT');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const technician = await tx.user.findFirst({ where: { id: input.technicianId, role: 'TECHNICIAN', active: true } });
    if (!technician) throw new Error('INVALID_ASSIGNMENT');
    const ticket = await tx.repairTicket.findUnique({ where: { ticketNumber: input.id } });
    if (!ticket) throw new Error('NOT_FOUND');
    if (ticket.status !== 'PENDING') throw new Error('JOB_UNAVAILABLE');
    const updated = await tx.repairTicket.update({ where: { id: ticket.id }, data: { assignedTechId: technician.id }, include: { assignedTech: { select: { name: true } }, usedParts: { include: { part: true } } } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'repair.assigned', entity: 'RepairTicket', entityId: ticket.id } });
    return serializeRepair(updated, role, actor.id);
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
