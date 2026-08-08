import { createServer } from 'node:http';
import { getSession } from './auth.js';
import { advanceRepair, createRepair, createStaff, deactivateStaff, getWorkspace, login } from './service.js';

const port = Number(process.env.PORT || process.env.BACKEND_PORT || 4000);
const host = process.env.HOST || '0.0.0.0';
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3002')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

const corsHeaders = (request) => {
  const origin = request.headers.origin?.replace(/\/$/, '');
  return origin && allowedOrigins.includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : { Vary: 'Origin' };
};

const send = (request, response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request) });
  response.end(JSON.stringify(body));
};

const readJson = async (request) => {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('Request body is too large');
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
    const role = () => getSession(requestAdapter(request)).role;

    if (request.method === 'GET' && url.pathname === '/api/health') return send(request, response, 200, { status: 'ok', service: 'ifixlab251-backend' });
    if (request.method === 'POST' && url.pathname === '/api/login') {
      const body = await readJson(request);
      return send(request, response, 200, await login(body.email, body.password));
    }
    if (request.method === 'GET' && url.pathname === '/api/workspace') {
      const session = getSession(requestAdapter(request));
      return send(request, response, 200, { ...(await getWorkspace(session.role)), user: { name: session.name, role: session.role } });
    }
    if (request.method === 'GET' && url.pathname === '/api/repairs') return send(request, response, 200, { repairs: (await getWorkspace(role())).repairs });
    if (request.method === 'POST' && url.pathname === '/api/repairs') return send(request, response, 201, await createRepair(role(), await readJson(request)));
    if (request.method === 'POST' && url.pathname === '/api/users') {
      const session = getSession(requestAdapter(request));
      return send(request, response, 201, await createStaff(session.role, session.sub, await readJson(request)));
    }
    if (request.method === 'DELETE' && url.pathname === '/api/users') {
      const session = getSession(requestAdapter(request));
      return send(request, response, 200, await deactivateStaff(session.role, session.sub, (await readJson(request)).id));
    }
    if (request.method === 'PATCH' && url.pathname === '/api/repairs') {
      const body = await readJson(request);
      if (body.action !== 'advance' || !body.id) return send(request, response, 400, { error: 'A supported action and ticket ID are required' });
      return send(request, response, 200, await advanceRepair(role(), body.id));
    }
    return send(request, response, 404, { error: 'Route not found' });
  } catch (error) {
    const known = {
      UNAUTHORIZED: [401, 'Please sign in'], INVALID_CREDENTIALS: [401, 'Invalid email or password'], AUTH_NOT_CONFIGURED: [503, 'Authentication is not configured'], FORBIDDEN: [403, 'You do not have permission for this action'],
      NOT_FOUND: [404, 'Record not found'], INVALID_STATUS: [400, 'Invalid ticket status transition'], INVALID_STAFF: [400, 'Name, valid email and a password of at least 10 characters are required'], INVALID_STAFF_ROLE: [400, 'Only Technician and Front Desk accounts can be created'], PROTECTED_ADMIN: [400, 'The Admin account cannot be deactivated'],
    };
    const [status, message] = known[error.message] || [500, process.env.NODE_ENV === 'production' ? 'Unexpected server error' : error.message];
    return send(request, response, status, { error: message });
  }
});

server.listen(port, host, () => console.log(`iFixLab251 backend listening on http://${host}:${port}`));
