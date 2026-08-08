import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth.js';

const prisma = new PrismaClient();
const credentials = [
  ['ADMIN_INITIAL_PASSWORD', 'admin@ifixlab251.local', 'Alex Kim', 'ADMIN'],
  ['TECHNICIAN_INITIAL_PASSWORD', 'technician@ifixlab251.local', 'Daniel Kimani', 'TECHNICIAN'],
  ['FRONT_DESK_INITIAL_PASSWORD', 'frontdesk@ifixlab251.local', 'Nora Patel', 'FRONT_DESK'],
];

async function main() {
  for (const [key, email, name, role] of credentials) {
    const password = process.env[key];
    if (!password || password.length < 10) throw new Error(`${key} must be set and contain at least 10 characters`);
    await prisma.user.upsert({
      where: { email },
      update: { name, role, active: true, password: hashPassword(password) },
      create: { email, name, role, active: true, password: hashPassword(password) },
    });
  }
  console.log('Protected staff credentials synchronized');
}

main().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error.message); await prisma.$disconnect(); process.exit(1); });
