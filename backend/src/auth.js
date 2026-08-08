import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

export const ROLES = ['Admin', 'Technician', 'Front Desk'];
const dbRole = { ADMIN: 'Admin', TECHNICIAN: 'Technician', FRONT_DESK: 'Front Desk' };
const authSecret = () => process.env.AUTH_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'local-development-secret');
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const sign = (value) => createHmac('sha256', authSecret()).update(value).digest('base64url');

export function verifyPassword(password, stored) {
  const [scheme, salt, expectedHex] = String(stored || '').split(':');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSession(user) {
  if (!authSecret()) throw new Error('AUTH_NOT_CONFIGURED');
  const payload = encode({ sub: user.id, name: user.name, role: dbRole[user.role], exp: Date.now() + 8 * 60 * 60 * 1000 });
  return `${payload}.${sign(payload)}`;
}

export function getSession(request) {
  if (!authSecret()) throw new Error('AUTH_NOT_CONFIGURED');
  const header = request.get ? request.get('authorization') : request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw new Error('UNAUTHORIZED');
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('UNAUTHORIZED');
  const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (!ROLES.includes(session.role) || session.exp < Date.now()) throw new Error('UNAUTHORIZED');
  return session;
}

export function requireRole(role, allowed) {
  if (!allowed.includes(role)) throw new Error('FORBIDDEN');
}
