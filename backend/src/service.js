import { prisma } from './prisma.js';
import { createSession, hashPassword, requireRole, ROLES, verifyPassword } from './auth.js';
import { createHash, randomBytes } from 'node:crypto';
import { accountingTotals, canCompleteWithBalance, creditCustomerValue, creditEligibleForDelivery, finalizeInvoiceSnapshot, invoiceFinancials } from './accounting.js';

const navigation = {
  Admin: ['Overview', 'Repairs', 'Inventory', 'Expense', 'Point of Sale', 'Customers', 'Reports', 'Team', 'Website', 'Settings'],
  Technician: ['Overview', 'Repairs', 'Settings'],
  'Front Desk': ['Overview', 'New Intake', 'Appointments', 'Repairs', 'Point of Sale', 'Customers', 'Settings'],
};
const dbRole = { Admin: 'ADMIN', Technician: 'TECHNICIAN', 'Front Desk': 'FRONT_DESK' };
const roleLabel = { ADMIN: 'Admin', TECHNICIAN: 'Technician', FRONT_DESK: 'Front Desk' };
const permissionNavigation = { VIEW_REPORTS: 'Reports', VIEW_CUSTOMERS: 'Customers', MANAGE_POS: 'Point of Sale', VIEW_INVENTORY: 'Inventory', MANAGE_WEBSITE: 'Website' };
const allowedPermissions = Object.keys(permissionNavigation);
const statusOrder = ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'DELIVERED'];
const statusLabel = { PENDING: 'Received', IN_PROGRESS: 'Diagnosing', WAITING_FOR_PARTS: 'Repair Approved', COMPLETED: 'In Repair', DELIVERED: 'Ready for Pickup', PICKED_UP: 'Delivered' };
const paymentLabel = { PAID: 'Paid', PENDING: 'Pending', UNPAID: 'Unpaid', PARTIALLY_PAID: 'Partially Paid', REFUNDED: 'Refunded' };
const methodLabel = { CASH: 'Cash', CARD: 'Card', DIGITAL_TRANSFER: 'Transfer' };
const paymentMethodValue = { CASH: 'CASH', Cash: 'CASH', CARD: 'CARD', Card: 'CARD', DIGITAL_TRANSFER: 'DIGITAL_TRANSFER', Transfer: 'DIGITAL_TRANSFER' };
const appointmentLabel = { REQUESTED: 'Requested', CONFIRMED: 'Approved', CANCELLED: 'Rejected' };
const accessoryCategories = new Set(['Accessory', 'Cable']);
const repairStatusForProgress = (progress) => progress >= 100 ? 'DELIVERED' : progress >= 75 ? 'COMPLETED' : progress >= 50 ? 'WAITING_FOR_PARTS' : 'IN_PROGRESS';
const repairInclude = { customer: true, assignedTech: { select: { name: true } }, usedParts: { include: { part: true } }, sales: { include: { payments: true }, orderBy: { createdAt: 'desc' } }, delivery: { include: { deliveredBy: { select: { name: true } } } } };
const invoiceForTicket = (ticket) => (ticket.sales || []).find((sale) => sale.finalizationKey === `repair:${ticket.id}`) || ticket.sales?.[0] || null;

function serializeRepair(ticket, role, actorId = null) {
  const name = ticket.customerName;
  const minimumProgress = { PENDING: 0, IN_PROGRESS: 25, WAITING_FOR_PARTS: 50, COMPLETED: 75, DELIVERED: 100, PICKED_UP: 100 };
  const usedParts = (ticket.usedParts || []).map((item) => ({ id: item.part.id, sku: item.part.sku, name: item.part.name, quantity: item.quantity, unitPrice: Number(item.unitPrice || item.part.retailPrice || 0) }));
  const partsTotal = usedParts.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const finalPrice = ticket.finalPrice == null ? null : Number(ticket.finalPrice);
  const canSeeBilling = role !== 'Technician';
  const sale = invoiceForTicket(ticket);
  const invoice = sale ? invoiceFinancials(sale) : null;
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
    usedParts,
    partsTotal,
    status: statusLabel[ticket.status],
    tech: ticket.assignedTech?.name || 'Unassigned',
    due: ticket.status === 'DELIVERED' ? 'Ready for pickup' : 'Not scheduled',
    total: role === 'Technician' ? null : finalPrice ?? Number(ticket.estimatedCost),
    estimatedCost: Number(ticket.estimatedCost),
    serviceCharge: Number(ticket.serviceCharge || 0),
    finalPrice,
    customerId: ticket.customerId,
    isCreditCustomer: Boolean(ticket.customer?.isCreditCustomer),
    saleId: canSeeBilling ? sale?.id || null : null,
    invoiceTotal: canSeeBilling ? invoice?.invoiceTotal ?? finalPrice : null,
    amountPaid: canSeeBilling ? invoice?.amountPaid ?? 0 : null,
    balanceDue: canSeeBilling ? invoice?.balanceDue ?? finalPrice ?? 0 : null,
    paymentStatus: canSeeBilling ? invoice ? paymentLabel[invoice.paymentStatus] : 'Not invoiced' : null,
    isCreditSale: canSeeBilling ? Boolean(sale?.isCreditSale) : null,
    creditEligibleForDelivery: creditEligibleForDelivery(ticket.status, ticket.customer?.isCreditCustomer, sale?.isCreditSale),
    createdAt: ticket.createdAt,
    isMine: Boolean(actorId && ticket.assignedTechId === actorId),
    delivery: ticket.delivery ? { deliveredBy: ticket.delivery.deliveredBy.name, deliveredAt: ticket.delivery.deliveredAt, paymentStatus: paymentLabel[ticket.delivery.paymentStatus] } : null,
    avatar: name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
  };
}

function serializePart(part, role) {
  const base = { id: part.id, sku: part.sku, name: part.name, category: part.category || 'Other', description: part.description || '', device: part.compatibleDevices || 'Universal', stock: part.stockQty, min: part.minimumStockQty, sellingPrice: Number(part.retailPrice), price: Number(part.retailPrice), createdAt: part.createdAt, updatedAt: part.updatedAt };
  return role === 'Admin' ? { ...base, buyingPrice: Number(part.costPrice), cost: Number(part.costPrice) } : base;
}

function serializeSale(sale) {
  const financials = invoiceFinancials(sale);
  const displayPaymentStatus = sale.paymentStatus === 'REFUNDED' ? 'REFUNDED' : financials.paymentStatus;
  const payments = (sale.payments || []).map((payment) => ({ id: payment.id, amount: Number(payment.amount), method: methodLabel[payment.method] || payment.method, createdAt: payment.createdAt, reversed: Boolean(payment.reversedAt), reversedAt: payment.reversedAt, reversalReason: payment.reversalReason }));
  return { id: `#SL-${sale.id.slice(0, 6).toUpperCase()}`, recordId: sale.id, customerId: sale.customerId, customer: sale.customer?.name || sale.ticket?.customerName || 'Retail customer', item: sale.ticket ? `${sale.ticket.deviceModel} repair` : 'Retail sale', method: sale.paymentMethod ? methodLabel[sale.paymentMethod] : 'No payment yet', amount: financials.invoiceTotal, invoiceTotal: financials.invoiceTotal, amountPaid: financials.amountPaid, balanceDue: financials.balanceDue, status: paymentLabel[displayPaymentStatus], invoiceStatus: sale.status, isCreditSale: Boolean(sale.isCreditSale), finalizedAt: sale.finalizedAt, createdAt: sale.createdAt, payments };
}

function serializeCustomer(customer) {
  const invoices = (customer.sales || []).map(serializeSale);
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    isCreditCustomer: customer.isCreditCustomer,
    repairCount: customer._count?.repairs ?? customer.repairs?.length ?? 0,
    accountsReceivable: invoices.filter((invoice) => invoice.invoiceStatus === 'FINALIZED').reduce((sum, invoice) => sum + invoice.balanceDue, 0),
    invoices,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    avatar: customer.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
  };
}

function serializeExpense(expense) {
  return { id: expense.id, description: expense.description, category: expense.category, amount: Number(expense.amount), expenseDate: expense.expenseDate, notes: expense.notes || '', recordedBy: expense.recordedBy?.name || 'Admin', createdAt: expense.createdAt, updatedAt: expense.updatedAt };
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const socialPlatforms = ['Facebook', 'Instagram', 'TikTok', 'Telegram', 'YouTube', 'X', 'LinkedIn', 'WhatsApp'];

function decodeImageDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('INVALID_IMAGE');
  const [, mimeType, base64] = match;
  if (!allowedImageTypes.has(mimeType)) throw new Error('INVALID_IMAGE');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) throw new Error('INVALID_IMAGE');
  return { buffer, mimeType };
}

function serializeBanner(banner) {
  return { id: banner.id, title: banner.title || '', subtitle: banner.subtitle || '', linkUrl: banner.linkUrl || '', active: banner.active, position: banner.position, imageUrl: `/api/public/banners/${banner.id}/image`, updatedAt: banner.updatedAt };
}

function serializeSocialLink(link) {
  return { id: link.id, platform: link.platform, url: link.url, position: link.position };
}

function serializeStaffProfile(profile) {
  return { id: profile.id, name: profile.name, role: profile.role, bio: profile.bio || '', active: profile.active, position: profile.position, photoUrl: profile.photoType ? `/api/public/staff-profiles/${profile.id}/photo` : null };
}

function serializeBlogPost(post) {
  return { id: post.id, tag: post.tag, title: post.title, summary: post.summary, body: post.body, active: post.active, position: post.position };
}

export async function listBlogPosts(role) {
  requireRole(role, ['Admin']);
  const posts = await prisma.blogPost.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  return posts.map(serializeBlogPost);
}

function blogPostInput(input) {
  const tag = String(input.tag || '').trim();
  const title = String(input.title || '').trim();
  const summary = String(input.summary || '').trim();
  const body = String(input.body || '').trim();
  if (!tag || !title || !summary || !body) throw new Error('INVALID_BLOG_POST');
  return { tag, title, summary, body };
}

export async function createBlogPost(role, actorId, input) {
  const data = blogPostInput(input);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const maxPosition = await tx.blogPost.aggregate({ _max: { position: true } });
    const post = await tx.blogPost.create({ data: { ...data, position: (maxPosition._max.position ?? -1) + 1 } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'blog_post.created', entity: 'BlogPost', entityId: post.id } });
    return serializeBlogPost(post);
  });
}

export async function updateBlogPost(role, actorId, input) {
  if (!input.id) throw new Error('NOT_FOUND');
  const data = blogPostInput(input);
  const active = input.active === undefined ? undefined : Boolean(input.active === true || input.active === 'true');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const existing = await tx.blogPost.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) throw new Error('NOT_FOUND');
    const post = await tx.blogPost.update({ where: { id: input.id }, data: { ...data, ...(active !== undefined ? { active } : {}) } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'blog_post.updated', entity: 'BlogPost', entityId: post.id } });
    return serializeBlogPost(post);
  });
}

export async function deleteBlogPost(role, actorId, id) {
  if (!id) throw new Error('NOT_FOUND');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const existing = await tx.blogPost.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new Error('NOT_FOUND');
    await tx.blogPost.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'blog_post.deleted', entity: 'BlogPost', entityId: id } });
    return { success: true };
  });
}

export async function reorderBlogPost(role, actorId, input) {
  if (!input.id || !['up', 'down'].includes(input.direction)) throw new Error('INVALID_REORDER');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const posts = await tx.blogPost.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
    const index = posts.findIndex((post) => post.id === input.id);
    if (index < 0) throw new Error('NOT_FOUND');
    const swapIndex = input.direction === 'up' ? index - 1 : index + 1;
    if (swapIndex >= 0 && swapIndex < posts.length) {
      const a = posts[index]; const b = posts[swapIndex];
      await tx.blogPost.update({ where: { id: a.id }, data: { position: b.position } });
      await tx.blogPost.update({ where: { id: b.id }, data: { position: a.position } });
      await tx.auditLog.create({ data: { userId: actor.id, action: 'blog_post.reordered', entity: 'BlogPost', entityId: a.id } });
    }
    const updated = await tx.blogPost.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
    return updated.map(serializeBlogPost);
  });
}

export async function listBanners(role) {
  requireRole(role, ['Admin', 'Front Desk']);
  const banners = await prisma.promoBanner.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], omit: { imageData: true } });
  return banners.map(serializeBanner);
}

export async function createBanner(role, actorId, input) {
  const { buffer, mimeType } = decodeImageDataUrl(input.image);
  const title = String(input.title || '').trim() || null;
  const subtitle = String(input.subtitle || '').trim() || null;
  const linkUrl = String(input.linkUrl || '').trim() || null;
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const maxPosition = await tx.promoBanner.aggregate({ _max: { position: true } });
    const banner = await tx.promoBanner.create({ data: { title, subtitle, linkUrl, imageData: buffer, imageType: mimeType, position: (maxPosition._max.position ?? -1) + 1 }, omit: { imageData: true } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'banner.created', entity: 'PromoBanner', entityId: banner.id } });
    return serializeBanner(banner);
  });
}

export async function updateBanner(role, actorId, input) {
  if (!input.id) throw new Error('NOT_FOUND');
  const title = String(input.title || '').trim() || null;
  const subtitle = String(input.subtitle || '').trim() || null;
  const linkUrl = String(input.linkUrl || '').trim() || null;
  const active = input.active === undefined ? undefined : Boolean(input.active === true || input.active === 'true');
  const image = input.image ? decodeImageDataUrl(input.image) : null;
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const existing = await tx.promoBanner.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) throw new Error('NOT_FOUND');
    const banner = await tx.promoBanner.update({ where: { id: input.id }, data: { title, subtitle, linkUrl, ...(active !== undefined ? { active } : {}), ...(image ? { imageData: image.buffer, imageType: image.mimeType } : {}) }, omit: { imageData: true } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'banner.updated', entity: 'PromoBanner', entityId: banner.id } });
    return serializeBanner(banner);
  });
}

export async function reorderBanner(role, actorId, input) {
  if (!input.id || !['up', 'down'].includes(input.direction)) throw new Error('INVALID_REORDER');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const banners = await tx.promoBanner.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], omit: { imageData: true } });
    const index = banners.findIndex((banner) => banner.id === input.id);
    if (index < 0) throw new Error('NOT_FOUND');
    const swapIndex = input.direction === 'up' ? index - 1 : index + 1;
    if (swapIndex >= 0 && swapIndex < banners.length) {
      const a = banners[index]; const b = banners[swapIndex];
      await tx.promoBanner.update({ where: { id: a.id }, data: { position: b.position } });
      await tx.promoBanner.update({ where: { id: b.id }, data: { position: a.position } });
      await tx.auditLog.create({ data: { userId: actor.id, action: 'banner.reordered', entity: 'PromoBanner', entityId: a.id } });
    }
    const updated = await tx.promoBanner.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], omit: { imageData: true } });
    return updated.map(serializeBanner);
  });
}

export async function deleteBanner(role, actorId, id) {
  if (!id) throw new Error('NOT_FOUND');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const existing = await tx.promoBanner.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new Error('NOT_FOUND');
    await tx.promoBanner.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'banner.deleted', entity: 'PromoBanner', entityId: id } });
    return { success: true };
  });
}

export async function getBannerImage(id) {
  const banner = await prisma.promoBanner.findUnique({ where: { id }, select: { imageData: true, imageType: true } });
  if (!banner) throw new Error('NOT_FOUND');
  return banner;
}

export async function listSocialLinks(role) {
  requireRole(role, ['Admin']);
  const links = await prisma.socialLink.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  return links.map(serializeSocialLink);
}

function socialLinkInput(input) {
  const platform = String(input.platform || '').trim();
  const url = String(input.url || '').trim();
  if (!socialPlatforms.includes(platform) || !/^https?:\/\//i.test(url)) throw new Error('INVALID_SOCIAL_LINK');
  return { platform, url };
}

export async function createSocialLink(role, actorId, input) {
  const data = socialLinkInput(input);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const maxPosition = await tx.socialLink.aggregate({ _max: { position: true } });
    const link = await tx.socialLink.create({ data: { ...data, position: (maxPosition._max.position ?? -1) + 1 } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'social_link.created', entity: 'SocialLink', entityId: link.id } });
    return serializeSocialLink(link);
  });
}

export async function updateSocialLink(role, actorId, input) {
  if (!input.id) throw new Error('NOT_FOUND');
  const data = socialLinkInput(input);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const existing = await tx.socialLink.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) throw new Error('NOT_FOUND');
    const link = await tx.socialLink.update({ where: { id: input.id }, data });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'social_link.updated', entity: 'SocialLink', entityId: link.id } });
    return serializeSocialLink(link);
  });
}

export async function deleteSocialLink(role, actorId, id) {
  if (!id) throw new Error('NOT_FOUND');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const existing = await tx.socialLink.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new Error('NOT_FOUND');
    await tx.socialLink.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'social_link.deleted', entity: 'SocialLink', entityId: id } });
    return { success: true };
  });
}

export async function listStaffProfiles(role) {
  requireRole(role, ['Admin']);
  const profiles = await prisma.staffProfile.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], omit: { photoData: true } });
  return profiles.map(serializeStaffProfile);
}

export async function createStaffProfile(role, actorId, input) {
  const name = String(input.name || '').trim();
  const staffRole = String(input.role || '').trim();
  const bio = String(input.bio || '').trim() || null;
  if (!name || !staffRole) throw new Error('INVALID_STAFF_PROFILE');
  const photo = input.photo ? decodeImageDataUrl(input.photo) : null;
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const maxPosition = await tx.staffProfile.aggregate({ _max: { position: true } });
    const profile = await tx.staffProfile.create({ data: { name, role: staffRole, bio, photoData: photo?.buffer, photoType: photo?.mimeType, position: (maxPosition._max.position ?? -1) + 1 }, omit: { photoData: true } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'staff_profile.created', entity: 'StaffProfile', entityId: profile.id } });
    return serializeStaffProfile(profile);
  });
}

export async function updateStaffProfile(role, actorId, input) {
  if (!input.id) throw new Error('NOT_FOUND');
  const name = String(input.name || '').trim();
  const staffRole = String(input.role || '').trim();
  const bio = String(input.bio || '').trim() || null;
  if (!name || !staffRole) throw new Error('INVALID_STAFF_PROFILE');
  const active = input.active === undefined ? undefined : Boolean(input.active === true || input.active === 'true');
  const photo = input.photo ? decodeImageDataUrl(input.photo) : null;
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const existing = await tx.staffProfile.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) throw new Error('NOT_FOUND');
    const profile = await tx.staffProfile.update({ where: { id: input.id }, data: { name, role: staffRole, bio, ...(active !== undefined ? { active } : {}), ...(photo ? { photoData: photo.buffer, photoType: photo.mimeType } : {}) }, omit: { photoData: true } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'staff_profile.updated', entity: 'StaffProfile', entityId: profile.id } });
    return serializeStaffProfile(profile);
  });
}

export async function deleteStaffProfile(role, actorId, id) {
  if (!id) throw new Error('NOT_FOUND');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (role !== 'Admin' && !actor.permissions.includes('MANAGE_WEBSITE')) throw new Error('FORBIDDEN');
    const existing = await tx.staffProfile.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new Error('NOT_FOUND');
    await tx.staffProfile.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'staff_profile.deleted', entity: 'StaffProfile', entityId: id } });
    return { success: true };
  });
}

export async function getStaffPhoto(id) {
  const profile = await prisma.staffProfile.findUnique({ where: { id }, select: { photoData: true, photoType: true } });
  if (!profile || !profile.photoData) throw new Error('NOT_FOUND');
  return { imageData: profile.photoData, imageType: profile.photoType };
}

export async function getPublicSiteContent() {
  const [banners, socialLinks, staffProfiles, blogPosts] = await Promise.all([
    prisma.promoBanner.findMany({ where: { active: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], omit: { imageData: true } }),
    prisma.socialLink.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    prisma.staffProfile.findMany({ where: { active: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], omit: { photoData: true } }),
    prisma.blogPost.findMany({ where: { active: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
  ]);
  return {
    banners: banners.map(serializeBanner),
    socialLinks: socialLinks.map(serializeSocialLink),
    staffProfiles: staffProfiles.map(serializeStaffProfile),
    blogPosts: blogPosts.map(serializeBlogPost),
  };
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
  const confirmPassword = String(input.confirmPassword || '');
  if (!token || password.length < 10) throw new Error('INVALID_PASSWORD_RESET');
  if (password !== confirmPassword) throw new Error('PASSWORD_RESET_MISMATCH');
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
  const [tickets, parts, sales, customers, team, appointments, technicians, inventoryMovements, expenses, banners, socialLinks, staffProfiles, blogPosts] = await Promise.all([
    prisma.repairTicket.findMany({ include: repairInclude, orderBy: { createdAt: 'desc' } }),
    prisma.part.findMany({ orderBy: { name: 'asc' } }),
    role === 'Technician' && !actor.permissions.includes('MANAGE_POS') && !actor.permissions.includes('VIEW_REPORTS') ? [] : prisma.sale.findMany({ include: { customer: true, ticket: { select: { customerName: true, deviceModel: true } }, payments: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }),
    role === 'Admin' || role === 'Front Desk' || actor.permissions.includes('VIEW_CUSTOMERS')
      ? prisma.customer.findMany({ include: { _count: { select: { repairs: true } }, sales: { include: { customer: true, ticket: { select: { customerName: true, deviceModel: true } }, payments: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } } }, orderBy: { name: 'asc' } })
      : [],
    role === 'Admin' ? prisma.user.findMany({ where: { active: true }, select: { id: true, email: true, name: true, role: true, permissions: true, salary: true, rent: true, commission: true, allowance: true }, orderBy: { createdAt: 'asc' } }) : [],
    role === 'Front Desk' ? prisma.appointment.findMany({ orderBy: { preferredDate: 'asc' }, take: 100 }) : [],
    role === 'Front Desk' ? prisma.user.findMany({ where: { role: 'TECHNICIAN', active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : [],
    role === 'Admin' || actor.permissions.includes('VIEW_REPORTS')
      ? prisma.inventoryMovement.findMany()
      : [],
    role === 'Admin' || actor.permissions.includes('VIEW_REPORTS')
      ? prisma.expense.findMany({ include: { recordedBy: { select: { name: true } } }, orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }] })
      : [],
    role === 'Admin' || actor.permissions.includes('MANAGE_WEBSITE') ? prisma.promoBanner.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], omit: { imageData: true } }) : [],
    role === 'Admin' || actor.permissions.includes('MANAGE_WEBSITE') ? prisma.socialLink.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }) : [],
    role === 'Admin' || actor.permissions.includes('MANAGE_WEBSITE') ? prisma.staffProfile.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], omit: { photoData: true } }) : [],
    role === 'Admin' || actor.permissions.includes('MANAGE_WEBSITE') ? prisma.blogPost.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }) : [],
  ]);

  const visibleTickets = role === 'Technician'
    ? tickets.filter((ticket) => ticket.assignedTechId === actor.id)
    : tickets;
  const repairs = visibleTickets.map((ticket) => serializeRepair(ticket, role, actor?.id));
  const inventory = parts.map((part) => serializePart(part, role));
  const active = visibleTickets.filter((ticket) => !['DELIVERED', 'PICKED_UP'].includes(ticket.status));
  const technicianTickets = role === 'Technician' ? tickets.filter((ticket) => ticket.assignedTechId === actor.id) : [];
  const { revenue: totalRevenue, cashCollected, accountsReceivable } = accountingTotals(sales);
  const revenueTickets = tickets.filter((ticket) => { const sale = invoiceForTicket(ticket); return sale?.status === 'FINALIZED' && sale.revenueRecognizedAt && !sale.revenueReversedAt; });
  const partRevenue = revenueTickets.reduce((totals, ticket) => {
    for (const item of ticket.usedParts) {
      const key = accessoryCategories.has(item.part.category) ? 'accessories' : 'spareParts';
      totals[key] += item.quantity * Number(item.unitPrice);
    }
    return totals;
  }, { spareParts: 0, accessories: 0 });
  const sparePartsRevenue = partRevenue.spareParts;
  const accessoriesRevenue = partRevenue.accessories;
  const completedTickets = revenueTickets;
  const maintenanceRevenue = completedTickets.reduce((sum, ticket) => sum + Number(ticket.serviceCharge || 0), 0);
  const retailRevenue = totalRevenue - sparePartsRevenue - accessoriesRevenue - maintenanceRevenue;
  const cashCollectedToday = sales.flatMap((sale) => sale.payments || []).filter((payment) => !payment.reversedAt && payment.createdAt.toDateString() === new Date().toDateString()).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const jubaDateParts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Africa/Juba', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const todayKey = `${jubaDateParts.year}-${jubaDateParts.month}-${jubaDateParts.day}`;
  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);
  const weekStartDate = new Date(todayDate);
  weekStartDate.setUTCDate(todayDate.getUTCDate() - ((todayDate.getUTCDay() + 6) % 7));
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);
  const weekStartKey = weekStartDate.toISOString().slice(0, 10);
  const weekEndKey = weekEndDate.toISOString().slice(0, 10);
  const periodExpenses = expenses.reduce((totals, expense) => {
    const expenseDateKey = expense.expenseDate.toISOString().slice(0, 10);
    const amount = Number(expense.amount);
    if (expenseDateKey === todayKey) totals.dailyExpenses += amount;
    if (expenseDateKey >= weekStartKey && expenseDateKey <= weekEndKey) totals.weeklyExpenses += amount;
    if (expenseDateKey.startsWith(`${jubaDateParts.year}-${jubaDateParts.month}`)) totals.monthlyExpenses += amount;
    if (expenseDateKey.startsWith(jubaDateParts.year)) totals.yearlyExpenses += amount;
    return totals;
  }, { dailyExpenses: 0, weeklyExpenses: 0, monthlyExpenses: 0, yearlyExpenses: 0 });
  const reportMetrics = { totalRevenue, cashCollected, accountsReceivable, totalExpenses, ...periodExpenses, netRevenue: totalRevenue - totalExpenses, sparePartsRevenue, accessoriesRevenue, maintenanceRevenue, retailRevenue, completedJobs: completedTickets.length, paidSalesRevenue: cashCollected };
  const hasReportsAccess = role === 'Admin' || actor.permissions.includes('VIEW_REPORTS');
  const dashboard = role === 'Technician'
    ? (hasReportsAccess ? { ...reportMetrics, assignedPending: technicianTickets.filter((ticket) => ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_PARTS'].includes(ticket.status)).length, inProgress: technicianTickets.filter((ticket) => ticket.status === 'COMPLETED').length, completedToday: technicianTickets.filter((ticket) => ticket.status === 'DELIVERED').length } : {})
    : role === 'Front Desk'
      ? (hasReportsAccess ? { ...reportMetrics, intakesToday: tickets.filter((ticket) => ticket.createdAt.toDateString() === new Date().toDateString()).length, awaitingAssignment: tickets.filter((ticket) => ticket.status === 'PENDING' && !ticket.assignedTechId).length, readyForPickup: tickets.filter((ticket) => ticket.status === 'DELIVERED').length, dailySales: cashCollectedToday } : {})
      : { ...reportMetrics, activeRepairs: active.length, completedThisMonth: tickets.filter((ticket) => ticket.status === 'DELIVERED').length, lowStock: parts.filter((part) => part.stockQty <= part.minimumStockQty).length };

  return {
    role,
    user: { name: actor.name, email: actor.email, role },
    navigation: userNavigation,
    permissions: actor.permissions,
    dashboard,
    repairs,
    inventory,
    expenses: role === 'Admin' ? expenses.map(serializeExpense) : [],
    sales: sales.map(serializeSale),
    customers: customers.map(serializeCustomer),
    appointments: appointments.map((item) => ({ id: item.id, reference: item.id.slice(0, 8).toUpperCase(), customer: item.customerName, phone: item.customerPhone, device: item.device, issue: item.issue, preferredDate: item.preferredDate, status: appointmentLabel[item.status] || item.status })),
    technicians,
    team: team.map((user) => ({ id: user.id, email: user.email, name: user.name, role: roleLabel[user.role] || user.role.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), permissions: user.permissions, salary: Number(user.salary || 0), rent: Number(user.rent || 0), commission: Number(user.commission || 0), allowance: Number(user.allowance || 0), description: user.role === 'ADMIN' ? 'Protected owner account' : user.role === 'TECHNICIAN' ? 'Repairs and parts' : 'Intake, POS and customers' })),
    banners: banners.map(serializeBanner),
    socialLinks: socialLinks.map(serializeSocialLink),
    staffProfiles: staffProfiles.map(serializeStaffProfile),
    blogPosts: blogPosts.map(serializeBlogPost),
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
  requireRole(role, ROLES);
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

function staffCompensationInput(input) {
  const compensation = Object.fromEntries(['salary', 'rent', 'commission', 'allowance'].map((field) => [field, Number(input[field] || 0)]));
  if (Object.values(compensation).some((amount) => !Number.isFinite(amount) || amount < 0 || amount > 99_999_999.99)) throw new Error('INVALID_STAFF_COMPENSATION');
  return compensation;
}

export async function createStaff(role, actorId, input) {
  requireRole(role, ['Admin']);
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const password = String(input.password || '');
  const staffRole = input.role;
  const permissions = Array.isArray(input.permissions) ? input.permissions.filter((permission) => allowedPermissions.includes(permission)) : [];
  const compensation = staffCompensationInput(input);
  if (!name || !email.includes('@') || password.length < 10) throw new Error('INVALID_STAFF');
  if (!['Technician', 'Front Desk'].includes(staffRole)) throw new Error('INVALID_STAFF_ROLE');
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({ where: { email }, update: { name, role: dbRole[staffRole], permissions, ...compensation, password: hashPassword(password), active: true }, create: { name, email, role: dbRole[staffRole], permissions, ...compensation, password: hashPassword(password), active: true } });
    await tx.auditLog.create({ data: { userId: actorId, action: 'staff.created_or_reactivated', entity: 'User', entityId: user.id } });
    return { id: user.id, email: user.email, name: user.name, role: staffRole, permissions, ...compensation, description: staffRole === 'Technician' ? 'Repairs and parts' : 'Intake, POS and customers' };
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
  const compensation = staffCompensationInput(input);
  if (!id || !name || !email.includes('@') || (password && password.length < 10)) throw new Error('INVALID_STAFF_UPDATE');
  if (!['Technician', 'Front Desk'].includes(staffRole)) throw new Error('INVALID_STAFF_ROLE');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const target = await tx.user.findUnique({ where: { id } });
    if (!target) throw new Error('NOT_FOUND');
    if (target.role === 'ADMIN') throw new Error('PROTECTED_ADMIN');
    const duplicate = await tx.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } });
    if (duplicate) throw new Error('PROFILE_EMAIL_EXISTS');
    const user = await tx.user.update({ where: { id }, data: { name, email, role: dbRole[staffRole], permissions, ...compensation, ...(password ? { password: hashPassword(password) } : {}) } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'staff.updated', entity: 'User', entityId: user.id } });
    return { id: user.id, email: user.email, name: user.name, role: staffRole, permissions, ...compensation, description: staffRole === 'Technician' ? 'Repairs and parts' : 'Intake, POS and customers' };
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
  const data = inventoryInput(input);

  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const sku = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const part = await tx.part.create({ data: { sku, ...data, minimumStockQty: 5 } });
    if (part.stockQty > 0) await tx.inventoryMovement.create({ data: { partId: part.id, category: part.category || 'Other', direction: 'IN', quantity: part.stockQty, unitPrice: part.costPrice } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'inventory.created', entity: 'Part', entityId: part.id } });
    return serializePart(part, role);
  });
}

function inventoryInput(input) {
  const name = String(input.name || '').trim();
  const category = String(input.category || '').trim();
  const description = String(input.description || '').trim() || null;
  const stockQty = Number(input.quantity);
  const costPrice = Number(input.buyingPrice ?? input.unitPrice);
  const retailPrice = Number(input.sellingPrice ?? input.unitPrice);
  const categories = ['Screen', 'Battery', 'Accessory', 'Cable', 'Camera', 'Part', 'Other'];
  if (!name || !categories.includes(category) || input.quantity === '' || input.buyingPrice === '' || input.sellingPrice === ''
    || !Number.isInteger(stockQty) || stockQty < 0 || !Number.isFinite(costPrice) || costPrice < 0 || !Number.isFinite(retailPrice) || retailPrice < 0) throw new Error('INVALID_INVENTORY_ITEM');
  return { name, category, description, stockQty, costPrice, retailPrice };
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
    const quantityChange = part.stockQty - existing.stockQty;
    if (quantityChange !== 0) await tx.inventoryMovement.create({ data: { partId: part.id, category: part.category || 'Other', direction: quantityChange > 0 ? 'IN' : 'OUT', quantity: Math.abs(quantityChange), unitPrice: quantityChange > 0 ? part.costPrice : part.retailPrice } });
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

const expenseCategories = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Supplies', 'Marketing', 'Taxes', 'Other'];

function expenseInput(input) {
  const description = String(input.description || '').trim();
  const category = String(input.category || '').trim();
  const amount = Number(input.amount);
  const expenseDateText = String(input.expenseDate || '');
  const notes = String(input.notes || '').trim() || null;
  const expenseDate = /^\d{4}-\d{2}-\d{2}$/.test(expenseDateText) ? new Date(`${expenseDateText}T00:00:00.000Z`) : null;
  if (!description || !expenseCategories.includes(category) || !Number.isFinite(amount) || amount <= 0 || amount > 99_999_999.99 || !expenseDate || Number.isNaN(expenseDate.getTime()) || expenseDate.toISOString().slice(0, 10) !== expenseDateText) throw new Error('INVALID_EXPENSE');
  return { description, category, amount, expenseDate, notes };
}

export async function createExpense(role, actorId, input) {
  requireRole(role, ['Admin']);
  const data = expenseInput(input);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const expense = await tx.expense.create({ data: { ...data, recordedById: actor.id }, include: { recordedBy: { select: { name: true } } } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'expense.created', entity: 'Expense', entityId: expense.id } });
    return serializeExpense(expense);
  });
}

export async function updateExpense(role, actorId, input) {
  requireRole(role, ['Admin']);
  if (!input.id) throw new Error('NOT_FOUND');
  const data = expenseInput(input);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const existing = await tx.expense.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!existing) throw new Error('NOT_FOUND');
    const expense = await tx.expense.update({ where: { id: input.id }, data, include: { recordedBy: { select: { name: true } } } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'expense.updated', entity: 'Expense', entityId: expense.id } });
    return serializeExpense(expense);
  });
}

export async function deleteExpense(role, actorId, id) {
  requireRole(role, ['Admin']);
  if (!id) throw new Error('NOT_FOUND');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const existing = await tx.expense.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new Error('NOT_FOUND');
    await tx.expense.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'expense.deleted', entity: 'Expense', entityId: id } });
    return { success: true };
  });
}

const normalizeEthiopianPhone = (value) => {
  const phone = String(value || '').replace(/[\s()-]/g, '');
  if (/^09\d{8}$/.test(phone)) return `+251${phone.slice(1)}`;
  if (/^\+2519\d{8}$/.test(phone)) return phone;
  return null;
};

function customerInput(input, requireCreditChoice = false) {
  const name = String(input.name ?? input.customer ?? '').trim();
  const phone = normalizeEthiopianPhone(input.phone);
  if (!name || !phone || (requireCreditChoice && input.isCreditCustomer === undefined)) throw new Error('INVALID_CUSTOMER');
  return { name, phone, isCreditCustomer: creditCustomerValue(input.isCreditCustomer) };
}

export async function createCustomer(role, actorId, input) {
  requireRole(role, ['Admin', 'Front Desk']);
  const data = customerInput(input);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const existing = await tx.customer.findUnique({ where: { phone: data.phone }, select: { id: true } });
    if (existing) throw new Error('CUSTOMER_PHONE_EXISTS');
    const customer = await tx.customer.create({ data });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'customer.created', entity: 'Customer', entityId: customer.id } });
    return serializeCustomer({ ...customer, sales: [], _count: { repairs: 0 } });
  });
}

export async function updateCustomer(role, actorId, input) {
  requireRole(role, ['Admin', 'Front Desk']);
  if (!input.id) throw new Error('NOT_FOUND');
  const data = customerInput(input, true);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const existing = await tx.customer.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error('NOT_FOUND');
    const duplicate = await tx.customer.findFirst({ where: { phone: data.phone, id: { not: existing.id } }, select: { id: true } });
    if (duplicate) throw new Error('CUSTOMER_PHONE_EXISTS');
    const customer = await tx.customer.update({ where: { id: existing.id }, data });
    await tx.repairTicket.updateMany({ where: { customerId: customer.id, status: { notIn: ['DELIVERED', 'PICKED_UP'] } }, data: { customerName: customer.name, customerPhone: customer.phone } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'customer.updated', entity: 'Customer', entityId: customer.id } });
    return serializeCustomer({ ...customer, sales: [], _count: { repairs: await tx.repairTicket.count({ where: { customerId: customer.id } }) } });
  });
}

export async function trackRepair(ticketNumber) {
  const ticket = String(ticketNumber || '').trim().toUpperCase();
  if (!ticket) throw new Error('INVALID_TRACKING');
  const repair = await prisma.repairTicket.findUnique({ where: { ticketNumber: ticket }, include: { assignedTech: { select: { name: true } } } });
  if (!repair) throw new Error('TRACKING_NOT_FOUND');
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
  const suppliedCustomerPhone = normalizeEthiopianPhone(input.phone);
  if (!suppliedCustomerPhone) throw new Error('INVALID_ETHIOPIAN_PHONE');
  const estimatedCost = Number(input.estimate);
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0) throw new Error('INVALID_ESTIMATE');

  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const selectedCustomerId = String(input.customerId || '').trim();
    const suppliedCustomerName = String(input.customer).trim();
    const customer = selectedCustomerId
      ? await tx.customer.findUnique({ where: { id: selectedCustomerId } })
      : await tx.customer.upsert({
        where: { phone: suppliedCustomerPhone },
        create: { name: suppliedCustomerName, phone: suppliedCustomerPhone, isCreditCustomer: creditCustomerValue(input.isCreditCustomer) },
        update: { name: suppliedCustomerName },
      });
    if (!customer) throw new Error('NOT_FOUND');
    const customerName = customer.name;
    const customerPhone = customer.phone;
    const latest = await tx.repairTicket.findFirst({ orderBy: { ticketNumber: 'desc' }, select: { ticketNumber: true } });
    const sequence = Math.max(0, Number(latest?.ticketNumber.split('-').pop()) || 0) + 1;
    const ticket = await tx.repairTicket.create({
      data: {
        ticketNumber: `REP-${new Date().getFullYear()}-${String(sequence).padStart(4, '0')}`,
        customerId: customer.id, customerName, customerPhone, deviceModel: String(input.device).trim(),
        serialOrImei: String(input.imei).trim(), physicalCondition: input.condition || null, reportedIssue: String(input.issue).trim(),
        estimatedCost, serviceCharge: estimatedCost, createdById: actor.id,
      },
      include: repairInclude,
    });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'repair.created', entity: 'RepairTicket', entityId: ticket.id } });
    return serializeRepair(ticket, role);
  }, { isolationLevel: 'Serializable' });
}

export async function advanceRepair(role, actorId, ticketNumber) {
  requireRole(role, ['Technician']);
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const ticket = await tx.repairTicket.findUnique({ where: { ticketNumber }, include: repairInclude });
    if (!ticket) throw new Error('NOT_FOUND');
    if (ticket.status === 'PENDING' && ticket.assignedTechId && ticket.assignedTechId !== actor.id) throw new Error('FORBIDDEN');
    if (ticket.status !== 'PENDING' && ticket.assignedTechId !== actor.id) throw new Error('FORBIDDEN');
    const index = statusOrder.indexOf(ticket.status);
    if (index < 0 || index === statusOrder.length - 1) throw new Error('INVALID_STATUS');
    if (statusOrder[index + 1] === 'DELIVERED') throw new Error('FINAL_PRICE_REQUIRED');
    const updated = await tx.repairTicket.update({
      where: { id: ticket.id },
      data: { status: statusOrder[index + 1], ...(ticket.status === 'PENDING' ? { assignedTechId: actor.id } : {}) },
      include: repairInclude,
    });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'repair.status_changed', entity: 'RepairTicket', entityId: ticket.id } });
    return serializeRepair(updated, role);
  });
}

export async function updateRepairProgress(role, actorId, input) {
  requireRole(role, ['Technician']);
  const action = input.action;
  const notes = String(input.notes || '').trim();
  const hasServiceCharge = input.serviceCharge !== undefined && input.serviceCharge !== '';
  const serviceCharge = Number(input.serviceCharge);
  if (hasServiceCharge && (!Number.isFinite(serviceCharge) || serviceCharge < 0)) throw new Error('INVALID_SERVICE_CHARGE');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const ticket = await tx.repairTicket.findUnique({ where: { ticketNumber: input.id }, include: repairInclude });
    if (!ticket) throw new Error('NOT_FOUND');

    if (action === 'take') {
      if (ticket.status !== 'PENDING' || ticket.assignedTechId !== actor.id) throw new Error('JOB_NOT_ASSIGNED');
      const updated = await tx.repairTicket.update({
        where: { id: ticket.id },
        data: { status: 'IN_PROGRESS', progress: 25, ...(notes ? { technicianNotes: notes } : {}), ...(hasServiceCharge ? { serviceCharge } : {}) },
        include: repairInclude,
      });
      await tx.auditLog.create({ data: { userId: actor.id, action: 'repair.taken', entity: 'RepairTicket', entityId: ticket.id } });
      return serializeRepair(updated, role, actor.id);
    }

    if (action !== 'progress' || ticket.assignedTechId !== actor.id || ['DELIVERED', 'PICKED_UP'].includes(ticket.status)) throw new Error('FORBIDDEN');
    const progress = Number(input.progress);
    if (![25, 50, 75, 100].includes(progress) || progress < ticket.progress) throw new Error('INVALID_PROGRESS');
    const requestedParts = Array.isArray(input.parts) ? input.parts : input.partId ? [{ id: input.partId, quantity: input.partQuantity }] : [];
    const partRequests = new Map();
    for (const item of requestedParts) {
      const partId = String(item.id || '');
      const quantity = Number(item.quantity);
      if (!partId || !Number.isInteger(quantity) || quantity < 1) throw new Error('INVALID_PART_QUANTITY');
      const unitPrice = item.unitPrice === undefined || item.unitPrice === '' ? null : Number(item.unitPrice);
      if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) throw new Error('INVALID_PART_PRICE');
      const current = partRequests.get(partId) || { quantity: 0, unitPrice };
      partRequests.set(partId, { quantity: current.quantity + quantity, unitPrice: unitPrice ?? current.unitPrice });
    }
    if (progress >= 75 && ticket.usedParts.length === 0 && partRequests.size === 0) throw new Error('REPAIR_PART_REQUIRED');
    for (const [partId, request] of partRequests) {
      const { quantity } = request;
      const deducted = await tx.part.updateMany({ where: { id: partId, stockQty: { gte: quantity } }, data: { stockQty: { decrement: quantity } } });
      if (deducted.count !== 1) throw new Error('INSUFFICIENT_PART_STOCK');
      const part = await tx.part.findUnique({ where: { id: partId }, select: { category: true, retailPrice: true } });
      const unitPrice = progress === 100 && request.unitPrice !== null ? request.unitPrice : Number(part.retailPrice);
      await tx.inventoryMovement.create({ data: { partId, ticketId: ticket.id, category: part.category || 'Other', direction: 'OUT', quantity, unitPrice } });
      await tx.ticketPart.upsert({ where: { ticketId_partId: { ticketId: ticket.id, partId } }, create: { ticketId: ticket.id, partId, quantity, unitPrice }, update: { quantity: { increment: quantity }, unitPrice } });
    }
    if (progress === 100) {
      const partPrices = Array.isArray(input.partPrices) ? input.partPrices : [];
      for (const item of partPrices) {
        const partId = String(item.id || '');
        const unitPrice = Number(item.unitPrice);
        if (!partId || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('INVALID_PART_PRICE');
        const updatedPart = await tx.ticketPart.updateMany({ where: { ticketId: ticket.id, partId }, data: { unitPrice } });
        if (updatedPart.count !== 1) throw new Error('INVALID_PART_PRICE');
      }
    }
    const finalParts = progress === 100 ? await tx.ticketPart.findMany({ where: { ticketId: ticket.id } }) : [];
    for (const item of finalParts) {
      await tx.inventoryMovement.updateMany({ where: { ticketId: ticket.id, partId: item.partId, direction: 'OUT' }, data: { unitPrice: item.unitPrice } });
    }
    const finalPrice = progress === 100
      ? finalParts.reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), hasServiceCharge ? serviceCharge : Number(ticket.serviceCharge))
      : null;
    if (progress === 100) {
      const now = new Date();
      const existingSale = invoiceForTicket(ticket);
      if (existingSale?.status === 'CANCELLED' || existingSale?.status === 'REFUNDED') throw new Error('INVOICE_CLOSED');
      if (!existingSale) {
        const finalized = finalizeInvoiceSnapshot({}, { totalAmount: finalPrice, isCreditCustomer: ticket.customer.isCreditCustomer, now });
        await tx.sale.create({ data: { ticketId: ticket.id, finalizationKey: `repair:${ticket.id}`, customerId: ticket.customerId, totalAmount: finalized.totalAmount, status: finalized.status, paymentStatus: finalized.totalAmount === 0 ? 'PAID' : 'UNPAID', isCreditSale: finalized.isCreditSale, recognizedRevenue: finalized.recognizedRevenue, finalizedAt: finalized.finalizedAt, revenueRecognizedAt: finalized.revenueRecognizedAt, processedBy: actor.id } });
      } else if (!existingSale.revenueRecognizedAt) {
        const financials = invoiceFinancials(existingSale);
        if (financials.amountPaid > finalPrice) throw new Error('PAYMENT_EXCEEDS_TOTAL');
        const balanceDue = Math.max(0, finalPrice - financials.amountPaid);
        const finalized = finalizeInvoiceSnapshot(existingSale, { totalAmount: finalPrice, isCreditCustomer: ticket.customer.isCreditCustomer, now });
        await tx.sale.update({ where: { id: existingSale.id }, data: { finalizationKey: `repair:${ticket.id}`, customerId: ticket.customerId, totalAmount: finalized.totalAmount, status: finalized.status, paymentStatus: balanceDue === 0 ? 'PAID' : financials.amountPaid <= 0 ? 'UNPAID' : 'PARTIALLY_PAID', isCreditSale: finalized.isCreditSale, recognizedRevenue: finalized.recognizedRevenue, finalizedAt: finalized.finalizedAt, revenueRecognizedAt: finalized.revenueRecognizedAt } });
      }
    }
    const updated = await tx.repairTicket.update({
      where: { id: ticket.id },
      data: { progress, status: repairStatusForProgress(progress), ...(notes ? { technicianNotes: notes } : {}), ...(hasServiceCharge ? { serviceCharge } : {}), ...(finalPrice !== null ? { finalPrice } : {}) },
      include: repairInclude,
    });
    await tx.auditLog.create({ data: { userId: actor.id, action: progress === 100 ? 'repair.ready_for_pickup' : 'repair.progress_updated', entity: 'RepairTicket', entityId: ticket.id } });
    return serializeRepair(updated, role, actor.id);
  }, { isolationLevel: 'Serializable' });
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
    const updated = await tx.repairTicket.update({ where: { id: ticket.id }, data: { assignedTechId: technician.id }, include: repairInclude });
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
      include: repairInclude,
    });
    if (!ticket) throw new Error('NOT_FOUND');
    const invoice = invoiceForTicket(ticket);
    if (ticket.status === 'PICKED_UP' && ticket.delivery) return { jobId: ticket.ticketNumber, status: 'Delivered', deliveredBy: ticket.delivery.deliveredBy.name, deliveredAt: ticket.delivery.deliveredAt, payment: invoice ? paymentLabel[invoiceFinancials(invoice).paymentStatus] : 'Unpaid', total: Number(ticket.finalPrice), device: ticket.deviceModel, customer: ticket.customerName, technician: ticket.assignedTech?.name || 'Unassigned' };
    if (ticket.status !== 'DELIVERED') throw new Error('NOT_READY_FOR_DELIVERY');
    if (ticket.finalPrice == null) throw new Error('FINAL_PRICE_REQUIRED');
    if (!invoice || invoice.status !== 'FINALIZED') throw new Error('INVOICE_NOT_FINALIZED');
    if (Number(input.paymentAmount || 0) > 0) await addPaymentInTransaction(tx, actor, invoice, input);
    const refreshedSale = await tx.sale.findUnique({ where: { id: invoice.id }, include: { payments: true } });
    const financials = invoiceFinancials(refreshedSale);
    const isCreditCustomer = Boolean(ticket.customer?.isCreditCustomer);
    if (!canCompleteWithBalance(isCreditCustomer, financials.balanceDue)) throw new Error('PAYMENT_REQUIRED');
    const paymentStatus = financials.paymentStatus;
    await tx.sale.update({ where: { id: refreshedSale.id }, data: { isCreditSale: isCreditCustomer } });
    const delivery = await tx.deliveryRecord.create({ data: { ticketId: ticket.id, deliveredById: actor.id, paymentStatus } });
    await tx.repairTicket.update({ where: { id: ticket.id }, data: { status: 'PICKED_UP' } });
    await tx.auditLog.create({ data: { userId: actor.id, action: 'repair.delivery_confirmed', entity: 'RepairTicket', entityId: ticket.id } });
    return { jobId: ticket.ticketNumber, status: 'Delivered', deliveredBy: actor.name, deliveredAt: delivery.deliveredAt, payment: paymentLabel[paymentStatus], total: Number(ticket.finalPrice), device: ticket.deviceModel, customer: ticket.customerName, technician: ticket.assignedTech?.name || 'Unassigned' };
  }, { isolationLevel: 'Serializable' });
}

async function addPaymentInTransaction(tx, actor, sale, input) {
  const amount = Number(input.amount ?? input.paymentAmount);
  const method = paymentMethodValue[input.method ?? input.paymentMethod];
  const idempotencyKey = String(input.idempotencyKey || '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || !method || idempotencyKey.length < 8 || idempotencyKey.length > 160) throw new Error('INVALID_PAYMENT');
  if (sale.status !== 'FINALIZED' || sale.revenueReversedAt) throw new Error('INVOICE_CLOSED');
  const existing = await tx.payment.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (existing.saleId !== sale.id || Number(existing.amount) !== amount || existing.method !== method) throw new Error('IDEMPOTENCY_CONFLICT');
    return existing;
  }
  const current = await tx.sale.findUnique({ where: { id: sale.id }, include: { payments: true } });
  const before = invoiceFinancials(current);
  if (amount > before.balanceDue + 0.001) throw new Error('PAYMENT_EXCEEDS_BALANCE');
  const payment = await tx.payment.create({ data: { saleId: sale.id, amount, method, idempotencyKey, processedBy: actor.id } });
  const amountPaid = before.amountPaid + amount;
  const paymentStatus = amountPaid >= before.invoiceTotal ? 'PAID' : 'PARTIALLY_PAID';
  await tx.sale.update({ where: { id: sale.id }, data: { paymentStatus, paymentMethod: method } });
  await tx.auditLog.create({ data: { userId: actor.id, action: 'invoice.payment_received', entity: 'Sale', entityId: sale.id } });
  return payment;
}

export async function recordInvoicePayment(role, actorId, input) {
  if (!input.saleId) throw new Error('INVALID_PAYMENT');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    if (!['Admin', 'Front Desk'].includes(role) && !actor.permissions.includes('MANAGE_POS')) throw new Error('FORBIDDEN');
    const sale = await tx.sale.findUnique({ where: { id: input.saleId }, include: { payments: true } });
    if (!sale) throw new Error('NOT_FOUND');
    await addPaymentInTransaction(tx, actor, sale, input);
    return serializeSale(await tx.sale.findUnique({ where: { id: sale.id }, include: { customer: true, ticket: { select: { customerName: true, deviceModel: true } }, payments: { orderBy: { createdAt: 'asc' } } } }));
  }, { isolationLevel: 'Serializable' });
}

export async function updateSaleAccounting(role, actorId, input) {
  requireRole(role, ['Admin']);
  if (!input.saleId || !['cancel', 'refund', 'reverse_payment'].includes(input.action)) throw new Error('INVALID_SALE_ACTION');
  return prisma.$transaction(async (tx) => {
    const actor = await actorFor(actorId, role, tx);
    const sale = await tx.sale.findUnique({ where: { id: input.saleId }, include: { payments: true } });
    if (!sale) throw new Error('NOT_FOUND');
    const now = new Date();
    if (input.action === 'cancel') {
      if (sale.status !== 'CANCELLED') {
        if (invoiceFinancials(sale).amountPaid > 0) throw new Error('REFUND_REQUIRED');
        await tx.sale.update({ where: { id: sale.id }, data: { status: 'CANCELLED', revenueReversedAt: sale.revenueRecognizedAt && !sale.revenueReversedAt ? now : sale.revenueReversedAt } });
        await tx.auditLog.create({ data: { userId: actor.id, action: 'invoice.cancelled', entity: 'Sale', entityId: sale.id } });
      }
    } else if (input.action === 'refund') {
      if (sale.status !== 'REFUNDED') {
        await tx.payment.updateMany({ where: { saleId: sale.id, reversedAt: null }, data: { reversedAt: now, reversalReason: String(input.reason || 'Invoice refunded').trim() } });
        await tx.sale.update({ where: { id: sale.id }, data: { status: 'REFUNDED', paymentStatus: 'REFUNDED', revenueReversedAt: sale.revenueRecognizedAt && !sale.revenueReversedAt ? now : sale.revenueReversedAt } });
        await tx.auditLog.create({ data: { userId: actor.id, action: 'invoice.refunded', entity: 'Sale', entityId: sale.id } });
      }
    } else {
      const payment = await tx.payment.findFirst({ where: { id: input.paymentId, saleId: sale.id } });
      if (!payment) throw new Error('NOT_FOUND');
      if (!payment.reversedAt) {
        await tx.payment.update({ where: { id: payment.id }, data: { reversedAt: now, reversalReason: String(input.reason || 'Payment reversed').trim() } });
        const refreshed = await tx.sale.findUnique({ where: { id: sale.id }, include: { payments: true } });
        await tx.sale.update({ where: { id: sale.id }, data: { paymentStatus: invoiceFinancials(refreshed).paymentStatus } });
        await tx.auditLog.create({ data: { userId: actor.id, action: 'invoice.payment_reversed', entity: 'Payment', entityId: payment.id } });
      }
    }
    return serializeSale(await tx.sale.findUnique({ where: { id: sale.id }, include: { customer: true, ticket: { select: { customerName: true, deviceModel: true } }, payments: { orderBy: { createdAt: 'asc' } } } }));
  }, { isolationLevel: 'Serializable' });
}
