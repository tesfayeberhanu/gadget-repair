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
    where: { email }, update: { name, role, active: true, password: hashPassword(password) }, create: { email, name, role, active: true, password: hashPassword(password) },
  })));
  const [admin, technician, frontDesk] = users;

  const parts = await Promise.all([
    ['SCR-IP14P-OLED', 'iPhone 14 Pro OLED', 'Screen', 'Apple iPhone 14 Pro', 3, 5, 118, 189],
    ['BAT-S23-5000', 'Galaxy S23 Battery', 'Battery', 'Samsung Galaxy S23', 12, 5, 28, 59],
    ['CAM-PX8-REAR', 'Pixel 8 Rear Camera', 'Camera', 'Google Pixel 8', 2, 3, 62, 99],
    ['USB-C-UNIV-02', 'USB-C Charging Port', 'Part', 'Universal / Android', 24, 8, 9, 25],
  ].map(([sku, name, category, compatibleDevices, stockQty, minimumStockQty, costPrice, retailPrice]) => prisma.part.upsert({
    where: { sku }, update: { name, category, compatibleDevices, stockQty, minimumStockQty, costPrice, retailPrice }, create: { sku, name, category, compatibleDevices, stockQty, minimumStockQty, costPrice, retailPrice },
  })));
  for (const part of parts) {
    if (part.stockQty > 0 && await prisma.inventoryMovement.count({ where: { partId: part.id } }) === 0) {
      await prisma.inventoryMovement.create({ data: { partId: part.id, category: part.category || 'Other', direction: 'IN', quantity: part.stockQty, unitPrice: part.costPrice } });
    }
  }

  const ticketFixtures = [
    ['REP-2026-0142', 'Maya Chen', '+251 911 456 801', 'iPhone 14 Pro', '351234567890142', 'Damaged', 'Screen replacement', 'IN_PROGRESS', 285, 45, technician.id],
    ['REP-2026-0141', 'Samuel Okoro', '+251 916 048 241', 'Samsung S23', '351234567890141', 'Good — normal wear', 'Battery draining', 'WAITING_FOR_PARTS', 120, 35, null],
    ['REP-2026-0140', 'Lina Haddad', '+251 927 540 112', 'MacBook Air M2', 'C02M200140', 'Severely damaged', 'Liquid damage', 'PENDING', 340, 80, null],
    ['REP-2026-0139', 'Noah Williams', '+251 929 612 087', 'Google Pixel 8', '351234567890139', 'Good — normal wear', 'Camera not focusing', 'COMPLETED', 195, 40, technician.id],
  ];
  const customerByPhone = new Map();
  for (const [, customerName, rawPhone] of ticketFixtures) {
    const phone = rawPhone.replace(/\s/g, '');
    const customer = await prisma.customer.upsert({ where: { phone }, update: { name: customerName }, create: { name: customerName, phone } });
    customerByPhone.set(phone, customer);
  }
  const tickets = await Promise.all(ticketFixtures.map(([ticketNumber, customerName, rawPhone, deviceModel, serialOrImei, physicalCondition, reportedIssue, status, estimatedCost, serviceCharge, assignedTechId]) => {
    const customerPhone = rawPhone.replace(/\s/g, '');
    return prisma.repairTicket.upsert({
      where: { ticketNumber }, update: {}, create: { ticketNumber, customerId: customerByPhone.get(customerPhone).id, customerName, customerPhone, deviceModel, serialOrImei, physicalCondition, reportedIssue, status, estimatedCost, serviceCharge, assignedTechId, createdById: frontDesk.id },
    });
  }));

  if (await prisma.sale.count() === 0) {
    const now = new Date();
    const seededSales = await Promise.all([
      prisma.sale.create({ data: { ticketId: tickets[3].id, finalizationKey: `repair:${tickets[3].id}`, customerId: tickets[3].customerId, totalAmount: 195, paymentMethod: 'CARD', paymentStatus: 'PAID', status: 'FINALIZED', recognizedRevenue: 195, finalizedAt: now, revenueRecognizedAt: now, processedBy: admin.id } }),
      prisma.sale.create({ data: { totalAmount: 64, paymentMethod: 'CASH', paymentStatus: 'PAID', status: 'FINALIZED', recognizedRevenue: 64, finalizedAt: now, revenueRecognizedAt: now, processedBy: frontDesk.id } }),
      prisma.sale.create({ data: { ticketId: tickets[0].id, finalizationKey: `repair:${tickets[0].id}`, customerId: tickets[0].customerId, totalAmount: 100, paymentStatus: 'UNPAID', status: 'DRAFT', processedBy: frontDesk.id } }),
    ]);
    await prisma.payment.createMany({ data: [
      { saleId: seededSales[0].id, amount: 195, method: 'CARD', idempotencyKey: `seed:${seededSales[0].id}`, processedBy: admin.id },
      { saleId: seededSales[1].id, amount: 64, method: 'CASH', idempotencyKey: `seed:${seededSales[1].id}`, processedBy: frontDesk.id },
    ] });
  }
}

main().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
