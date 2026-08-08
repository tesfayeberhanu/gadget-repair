import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';

const prisma = new PrismaClient();
const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

async function main() {
  const credential = (key) => {
    const value = process.env[key];
    if (value) return value;
    if (process.env.NODE_ENV === 'production') throw new Error(`${key} must be set before seeding production users`);
    return 'ChangeMe-251!';
  };
  const users = await Promise.all([
    ['admin@ifixlab251.local', 'Alex Kim', 'ADMIN', credential('ADMIN_INITIAL_PASSWORD')],
    ['technician@ifixlab251.local', 'Daniel Kimani', 'TECHNICIAN', credential('TECHNICIAN_INITIAL_PASSWORD')],
    ['frontdesk@ifixlab251.local', 'Nora Patel', 'FRONT_DESK', credential('FRONT_DESK_INITIAL_PASSWORD')],
  ].map(([email, name, role, password]) => prisma.user.upsert({
    where: { email }, update: { name, role, password: hashPassword(password) }, create: { email, name, role, password: hashPassword(password) },
  })));
  const [admin, technician, frontDesk] = users;

  await Promise.all([
    ['SCR-IP14P-OLED', 'iPhone 14 Pro OLED', 'Apple iPhone 14 Pro', 3, 5, 118, 189],
    ['BAT-S23-5000', 'Galaxy S23 Battery', 'Samsung Galaxy S23', 12, 5, 28, 59],
    ['CAM-PX8-REAR', 'Pixel 8 Rear Camera', 'Google Pixel 8', 2, 3, 62, 99],
    ['USB-C-UNIV-02', 'USB-C Charging Port', 'Universal / Android', 24, 8, 9, 25],
  ].map(([sku, name, compatibleDevices, stockQty, minimumStockQty, costPrice, retailPrice]) => prisma.part.upsert({
    where: { sku }, update: { name, compatibleDevices, stockQty, minimumStockQty, costPrice, retailPrice }, create: { sku, name, compatibleDevices, stockQty, minimumStockQty, costPrice, retailPrice },
  })));

  const tickets = await Promise.all([
    ['REP-2026-0142', 'Maya Chen', '+211 922 456 801', 'iPhone 14 Pro', '351234567890142', 'Damaged', 'Screen replacement', 'IN_PROGRESS', 285, technician.id],
    ['REP-2026-0141', 'Samuel Okoro', '+211 916 048 241', 'Samsung S23', '351234567890141', 'Good — normal wear', 'Battery draining', 'WAITING_FOR_PARTS', 120, null],
    ['REP-2026-0140', 'Lina Haddad', '+211 927 540 112', 'MacBook Air M2', 'C02M200140', 'Severely damaged', 'Liquid damage', 'PENDING', 340, null],
    ['REP-2026-0139', 'Noah Williams', '+211 929 612 087', 'Google Pixel 8', '351234567890139', 'Good — normal wear', 'Camera not focusing', 'COMPLETED', 195, technician.id],
  ].map(([ticketNumber, customerName, customerPhone, deviceModel, serialOrImei, physicalCondition, reportedIssue, status, estimatedCost, assignedTechId]) => prisma.repairTicket.upsert({
    where: { ticketNumber }, update: {}, create: { ticketNumber, customerName, customerPhone, deviceModel, serialOrImei, physicalCondition, reportedIssue, status, estimatedCost, assignedTechId, createdById: frontDesk.id },
  })));

  if (await prisma.sale.count() === 0) {
    await prisma.sale.createMany({ data: [
      { ticketId: tickets[3].id, totalAmount: 195, paymentMethod: 'CARD', paymentStatus: 'PAID', processedBy: admin.id },
      { totalAmount: 64, paymentMethod: 'CASH', paymentStatus: 'PAID', processedBy: frontDesk.id },
      { ticketId: tickets[0].id, totalAmount: 100, paymentMethod: 'DIGITAL_TRANSFER', paymentStatus: 'PENDING', processedBy: frontDesk.id },
    ] });
  }
}

main().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
