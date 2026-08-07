import { createServer } from 'node:http';
import { getRole } from './auth.js';
import { advanceRepair, createRepair, getWorkspace } from './service.js';

const port = Number(process.env.BACKEND_PORT || 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3002';

const send = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': frontendOrigin, Vary: 'Origin' });
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
    response.writeHead(204, {
      'Access-Control-Allow-Origin': frontendOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-user-role',
      'Access-Control-Max-Age': '86400',
    });
    return response.end();
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    const role = () => getRole(requestAdapter(request));

    if (request.method === 'GET' && url.pathname === '/api/health') return send(response, 200, { status: 'ok', service: 'ifixlab251-backend' });
    if (request.method === 'GET' && url.pathname === '/api/workspace') return send(response, 200, await getWorkspace(role()));
    if (request.method === 'GET' && url.pathname === '/api/repairs') return send(response, 200, { repairs: (await getWorkspace(role())).repairs });
    if (request.method === 'POST' && url.pathname === '/api/repairs') return send(response, 201, await createRepair(role(), await readJson(request)));
    if (request.method === 'PATCH' && url.pathname === '/api/repairs') {
      const body = await readJson(request);
      if (body.action !== 'advance' || !body.id) return send(response, 400, { error: 'A supported action and ticket ID are required' });
      return send(response, 200, await advanceRepair(role(), body.id));
    }
    return send(response, 404, { error: 'Route not found' });
  } catch (error) {
    const known = {
      INVALID_ROLE: [401, 'Invalid role'], FORBIDDEN: [403, 'You do not have permission for this action'],
      NOT_FOUND: [404, 'Record not found'], INVALID_STATUS: [400, 'Invalid ticket status transition'],
    };
    const [status, message] = known[error.message] || [500, process.env.NODE_ENV === 'production' ? 'Unexpected server error' : error.message];
    return send(response, status, { error: message });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`iFixLab251 backend listening on http://127.0.0.1:${port}`));
