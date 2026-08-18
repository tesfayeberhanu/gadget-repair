import { createServer } from 'node:http';
import { getSession } from './auth.js';
import { advanceRepair, assignRepair, changePassword, confirmDelivery, createBanner, createBlogPost, createCustomer, createExpense, createInventoryItem, createRepair, createSocialLink, createStaff, createStaffProfile, deactivateStaff, deleteBanner, deleteBlogPost, deleteExpense, deleteInventoryItem, deleteSocialLink, deleteStaffProfile, getBannerImage, getPublicSiteContent, getStaffPhoto, getWorkspace, login, recordInvoicePayment, reorderBanner, reorderBlogPost, requestAppointment, requestPasswordReset, resetPassword, reviewAppointment, trackRepair, updateBanner, updateBlogPost, updateCustomer, updateExpense, updateInventoryItem, updateProfile, updateRepairProgress, updateSaleAccounting, updateSocialLink, updateStaff, updateStaffProfile } from './service.js';

const port = Number(process.env.PORT || process.env.BACKEND_PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const allowedOrigins = new Set([
  'http://localhost:3002',
  'https://ifixlab-staff.vercel.app',
  'https://ifixlab251.com',
  'https://www.ifixlab251.com',
  ...(process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
]);
const vercelPreviewPattern = /^https:\/\/gadget-repair-r16v-[a-z0-9-]+\.vercel\.app$/;

const corsHeaders = (request) => {
  const origin = request.headers.origin?.replace(/\/$/, '');
  return origin && (allowedOrigins.has(origin) || vercelPreviewPattern.test(origin))
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : { Vary: 'Origin' };
};

const send = (request, response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) });
  response.end(JSON.stringify(body));
};

const sendImage = (request, response, status, buffer, contentType) => {
  response.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=300', ...corsHeaders(request) });
  response.end(buffer);
};

const readJson = async (request) => {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 8_000_000) throw new Error('Request body is too large');
  }
  return raw ? JSON.parse(raw) : {};
};

const requestAdapter = (request) => ({ get: (name) => request.headers[name.toLowerCase()] });

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    if (!corsHeaders(request)['Access-Control-Allow-Origin']) return send(request, response, 403, { error: 'Origin not allowed' });
    response.writeHead(204, {
      ...corsHeaders(request),
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    return response.end();
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    if (request.method === 'GET' && url.pathname === '/api/health') return send(request, response, 200, { status: 'ok', service: 'ifixlab251-backend' });
    if (request.method === 'POST' && url.pathname === '/api/login') {
      const body = await readJson(request);
      return send(request, response, 200, await login(body.email, body.password));
    }
    if (request.method === 'POST' && url.pathname === '/api/password/forgot') return send(request, response, 200, await requestPasswordReset((await readJson(request)).email));
    if (request.method === 'POST' && url.pathname === '/api/password/reset') return send(request, response, 200, await resetPassword(await readJson(request)));
    if (request.method === 'GET' && url.pathname === '/api/public/track') return send(request, response, 200, await trackRepair(url.searchParams.get('ticket')));
    if (request.method === 'POST' && url.pathname === '/api/public/appointments') return send(request, response, 201, await requestAppointment(await readJson(request)));
    if (request.method === 'GET' && url.pathname === '/api/public/site-content') return send(request, response, 200, await getPublicSiteContent());
    const bannerImageMatch = request.method === 'GET' && url.pathname.match(/^\/api\/public\/banners\/([^/]+)\/image$/);
    if (bannerImageMatch) {
      try { const banner = await getBannerImage(bannerImageMatch[1]); return sendImage(request, response, 200, banner.imageData, banner.imageType); }
      catch { return send(request, response, 404, { error: 'Not found' }); }
    }
    const staffPhotoMatch = request.method === 'GET' && url.pathname.match(/^\/api\/public\/staff-profiles\/([^/]+)\/photo$/);
    if (staffPhotoMatch) {
      try { const photo = await getStaffPhoto(staffPhotoMatch[1]); return sendImage(request, response, 200, photo.imageData, photo.imageType); }
      catch { return send(request, response, 404, { error: 'Not found' }); }
    }
    if (request.method === 'PATCH' && url.pathname === '/api/appointments') {
      const session = getSession(requestAdapter(request));
      return send(request, response, 200, await reviewAppointment(session.role, session.sub, await readJson(request)));
    }
    if (request.method === 'GET' && url.pathname === '/api/workspace') {
      const session = getSession(requestAdapter(request));
      return send(request, response, 200, await getWorkspace(session.role, session.sub));
    }
    if (request.method === 'PATCH' && url.pathname === '/api/profile') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await updateProfile(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/profile/password') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await changePassword(session.role, session.sub, await readJson(request))); }
    if (request.method === 'GET' && url.pathname === '/api/repairs') { const session = getSession(requestAdapter(request)); return send(request, response, 200, { repairs: (await getWorkspace(session.role, session.sub)).repairs }); }
    if (request.method === 'POST' && url.pathname === '/api/repairs') { const session = getSession(requestAdapter(request)); return send(request, response, 201, await createRepair(session.role, session.sub, await readJson(request))); }
    if (request.method === 'POST' && url.pathname === '/api/customers') { const session = getSession(requestAdapter(request)); return send(request, response, 201, await createCustomer(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/customers') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await updateCustomer(session.role, session.sub, await readJson(request))); }
    if (request.method === 'POST' && url.pathname === '/api/sales/payments') { const session = getSession(requestAdapter(request)); return send(request, response, 201, await recordInvoicePayment(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/sales') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await updateSaleAccounting(session.role, session.sub, await readJson(request))); }
    if (request.method === 'POST' && url.pathname === '/api/inventory') { const session = getSession(requestAdapter(request)); return send(request, response, 201, await createInventoryItem(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/inventory') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await updateInventoryItem(session.role, session.sub, await readJson(request))); }
    if (request.method === 'DELETE' && url.pathname === '/api/inventory') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await deleteInventoryItem(session.role, session.sub, (await readJson(request)).id)); }
    if (request.method === 'POST' && url.pathname === '/api/expenses') { const session = getSession(requestAdapter(request)); return send(request, response, 201, await createExpense(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/expenses') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await updateExpense(session.role, session.sub, await readJson(request))); }
    if (request.method === 'DELETE' && url.pathname === '/api/expenses') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await deleteExpense(session.role, session.sub, (await readJson(request)).id)); }
    if (request.method === 'PATCH' && url.pathname === '/api/repairs/delivery') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await confirmDelivery(session.role, session.sub, await readJson(request))); }
    if (request.method === 'POST' && url.pathname === '/api/banners') { const session = getSession(requestAdapter(request)); return send(request, response, 201, await createBanner(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/banners/reorder') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await reorderBanner(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/banners') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await updateBanner(session.role, session.sub, await readJson(request))); }
    if (request.method === 'DELETE' && url.pathname === '/api/banners') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await deleteBanner(session.role, session.sub, (await readJson(request)).id)); }
    if (request.method === 'POST' && url.pathname === '/api/social-links') { const session = getSession(requestAdapter(request)); return send(request, response, 201, await createSocialLink(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/social-links') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await updateSocialLink(session.role, session.sub, await readJson(request))); }
    if (request.method === 'DELETE' && url.pathname === '/api/social-links') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await deleteSocialLink(session.role, session.sub, (await readJson(request)).id)); }
    if (request.method === 'POST' && url.pathname === '/api/staff-profiles') { const session = getSession(requestAdapter(request)); return send(request, response, 201, await createStaffProfile(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/staff-profiles') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await updateStaffProfile(session.role, session.sub, await readJson(request))); }
    if (request.method === 'DELETE' && url.pathname === '/api/staff-profiles') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await deleteStaffProfile(session.role, session.sub, (await readJson(request)).id)); }
    if (request.method === 'POST' && url.pathname === '/api/blog-posts') { const session = getSession(requestAdapter(request)); return send(request, response, 201, await createBlogPost(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/blog-posts/reorder') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await reorderBlogPost(session.role, session.sub, await readJson(request))); }
    if (request.method === 'PATCH' && url.pathname === '/api/blog-posts') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await updateBlogPost(session.role, session.sub, await readJson(request))); }
    if (request.method === 'DELETE' && url.pathname === '/api/blog-posts') { const session = getSession(requestAdapter(request)); return send(request, response, 200, await deleteBlogPost(session.role, session.sub, (await readJson(request)).id)); }
    if (request.method === 'POST' && url.pathname === '/api/users') {
      const session = getSession(requestAdapter(request));
      return send(request, response, 201, await createStaff(session.role, session.sub, await readJson(request)));
    }
    if (request.method === 'PATCH' && url.pathname === '/api/users') {
      const session = getSession(requestAdapter(request));
      return send(request, response, 200, await updateStaff(session.role, session.sub, await readJson(request)));
    }
    if (request.method === 'DELETE' && url.pathname === '/api/users') {
      const session = getSession(requestAdapter(request));
      return send(request, response, 200, await deactivateStaff(session.role, session.sub, (await readJson(request)).id));
    }
    if (request.method === 'PATCH' && url.pathname === '/api/repairs') {
      const body = await readJson(request);
      if (!body.id || !['advance', 'assign', 'take', 'progress'].includes(body.action)) return send(request, response, 400, { error: 'A supported action and ticket ID are required' });
      const session = getSession(requestAdapter(request));
      return send(request, response, 200, body.action === 'advance' ? await advanceRepair(session.role, session.sub, body.id) : body.action === 'assign' ? await assignRepair(session.role, session.sub, body) : await updateRepairProgress(session.role, session.sub, body));
    }
    return send(request, response, 404, { error: 'Route not found' });
  } catch (error) {
    const known = {
      UNAUTHORIZED: [401, 'Please sign in'], INVALID_CREDENTIALS: [401, 'Invalid email or password'], AUTH_NOT_CONFIGURED: [503, 'Authentication is not configured'], EMAIL_NOT_CONFIGURED: [503, 'Password reset email is not configured'], EMAIL_DELIVERY_FAILED: [502, 'The reset email could not be sent'], INVALID_PASSWORD_RESET: [400, 'Enter a password of at least 10 characters'], PASSWORD_RESET_MISMATCH: [400, 'The password confirmation does not match'], INVALID_RESET_TOKEN: [400, 'This reset link is invalid, expired, or already used'], INVALID_PROFILE: [400, 'Enter a name and valid email address'], PROFILE_EMAIL_EXISTS: [409, 'That email address is already in use'], INVALID_NEW_PASSWORD: [400, 'The new password must be at least 10 characters'], INVALID_CURRENT_PASSWORD: [401, 'The current password is incorrect'], FORBIDDEN: [403, 'You do not have permission for this action'],
      NOT_FOUND: [404, 'Record not found'], INVALID_STATUS: [400, 'Invalid ticket status transition'], INVALID_PROGRESS: [400, 'Choose a valid status that does not move the repair backward'], INVALID_ESTIMATE: [400, 'Enter a valid estimated maintenance charge'], INVALID_SERVICE_CHARGE: [400, 'Enter a valid maintenance charge'], INVALID_PART_PRICE: [400, 'Enter a valid selling price for every selected part'], FINAL_PRICE_REQUIRED: [409, 'Finalize the parts prices and maintenance charge before marking this repair ready'], INVALID_EXPENSE: [400, 'Enter an expense description, category, positive amount, and valid date'], INVALID_ASSIGNMENT: [400, 'Choose an active technician'], REPAIR_PART_REQUIRED: [400, 'Select at least one part before moving the repair to In Repair'], INVALID_PART_QUANTITY: [400, 'Enter a valid part quantity'], INSUFFICIENT_PART_STOCK: [409, 'The selected part does not have enough stock'], JOB_UNAVAILABLE: [409, 'This job is no longer available'], JOB_NOT_ASSIGNED: [403, 'The Front Desk must assign this job to you first'], INVALID_STAFF: [400, 'Name, valid email and a password of at least 10 characters are required'], INVALID_STAFF_UPDATE: [400, 'Enter a name, valid email, and an optional password of at least 10 characters'], INVALID_STAFF_COMPENSATION: [400, 'Salary, rent, commission, and allowance must be valid non-negative amounts'], INVALID_STAFF_ROLE: [400, 'Only Technician and Front Desk accounts can be created'], PROTECTED_ADMIN: [400, 'The Admin account cannot be changed or deactivated here'], INVALID_INVENTORY_ITEM: [400, 'Enter an item name, category, valid quantity, buying price, and selling price'], INVENTORY_SKU_EXISTS: [409, 'An inventory item with this SKU already exists'], INVENTORY_IN_USE: [409, 'This item is used by a repair and cannot be deleted'], INVALID_ETHIOPIAN_PHONE: [400, 'Use an Ethiopian mobile number in 09XXXXXXXX or +2519XXXXXXXX format'], INVALID_CUSTOMER: [400, 'Enter a customer name, valid Ethiopian phone number, and credit choice'], CUSTOMER_PHONE_EXISTS: [409, 'A customer with this phone number already exists'], INVALID_TRACKING: [400, 'Enter a ticket number'], TRACKING_NOT_FOUND: [404, 'No matching repair was found'], INVALID_APPOINTMENT: [400, 'Complete all appointment fields, use a valid Ethiopian phone number, and choose a future date'], INVALID_APPOINTMENT_ACTION: [400, 'Choose approve or reject'], APPOINTMENT_REVIEWED: [409, 'This appointment request has already been reviewed'], DELIVERY_AUTH_REQUIRED: [400, 'Enter your password to confirm delivery'], INVALID_DELIVERY_AUTH: [401, 'The password is incorrect'], NOT_READY_FOR_DELIVERY: [409, 'This repair is not ready for pickup'], ALREADY_DELIVERED: [409, 'This device has already been delivered'], INVOICE_NOT_FINALIZED: [409, 'The repair invoice has not been finalized'], PAYMENT_REQUIRED: [409, 'This regular customer must pay the remaining balance before delivery'], INVALID_PAYMENT: [400, 'Enter a valid payment amount, method, and request reference'], PAYMENT_EXCEEDS_BALANCE: [409, 'Payment cannot exceed the invoice balance'], PAYMENT_EXCEEDS_TOTAL: [409, 'Existing payments exceed the final invoice total'], IDEMPOTENCY_CONFLICT: [409, 'That payment request reference was already used for different details'], INVOICE_CLOSED: [409, 'This invoice is cancelled, refunded, or otherwise closed'], INVALID_SALE_ACTION: [400, 'Choose a supported invoice accounting action'], REFUND_REQUIRED: [409, 'Refund the collected payments before cancelling this invoice'], INVALID_IMAGE: [400, 'Upload a JPEG, PNG, WEBP, or GIF image under 4MB'], INVALID_SOCIAL_LINK: [400, 'Choose a platform and enter a valid link starting with http:// or https://'], INVALID_STAFF_PROFILE: [400, 'Enter a name and role for this team member'], INVALID_REORDER: [400, 'Choose a valid direction to reorder'], INVALID_BLOG_POST: [400, 'Enter a tag, title, summary, and body for this article'],
    };
    const [status, message] = known[error.message] || [500, process.env.NODE_ENV === 'production' ? 'Unexpected server error' : error.message];
    return send(request, response, status, { error: message });
  }
});

server.listen(port, host, () => console.log(`iFixLab251 backend listening on http://${host}:${port}`));
