export const ROLES = ['Admin', 'Technician', 'Front Desk'];

export function getRole(request) {
  const role = request.get ? request.get('x-user-role') || 'Admin' : request.headers.get('x-user-role') || 'Admin';
  if (!ROLES.includes(role)) throw new Error('INVALID_ROLE');
  return role;
}

export function requireRole(role, allowed) {
  if (!allowed.includes(role)) throw new Error('FORBIDDEN');
}
