import { PrismaClient } from '@prisma/client';

const creditMigration = '20260813230000_add_credit_customers_and_invoice_payments';
const prisma = new PrismaClient();

console.log(`Checking recovery state for ${creditMigration}`);

const tableState = await prisma.$queryRawUnsafe(`
  SELECT
    to_regtype(format('%I.%I', current_schema(), 'PaymentStatus')) IS NOT NULL AS "hasPaymentStatus",
    to_regclass(format('%I.%I', current_schema(), '_prisma_migrations')) IS NOT NULL AS "hasMigrationTable"
`);

const [{ hasPaymentStatus, hasMigrationTable }] = tableState;

if (hasPaymentStatus) {
  const labels = await prisma.$queryRawUnsafe(`
    SELECT enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
    WHERE pg_type.typname = 'PaymentStatus'
      AND pg_namespace.nspname = current_schema()
  `);
  const existingLabels = new Set(labels.map(({ enumlabel }) => enumlabel));

  for (const label of ['UNPAID', 'PARTIALLY_PAID']) {
    if (!existingLabels.has(label)) {
      await prisma.$executeRawUnsafe(`ALTER TYPE "PaymentStatus" ADD VALUE '${label}'`);
    }
  }
}

let failedMigration = false;
if (hasMigrationTable) {
  const failed = await prisma.$queryRawUnsafe(`
    SELECT 1
    FROM "_prisma_migrations"
    WHERE migration_name = $1
      AND finished_at IS NULL
      AND rolled_back_at IS NULL
    LIMIT 1
  `, creditMigration);
  failedMigration = failed.length > 0;
}

if (failedMigration) {
  console.log(`Preparing a safe retry of failed migration ${creditMigration}`);
  await prisma.$executeRawUnsafe(`
    UPDATE "_prisma_migrations"
    SET rolled_back_at = CURRENT_TIMESTAMP
    WHERE migration_name = $1
      AND finished_at IS NULL
      AND rolled_back_at IS NULL
  `, creditMigration);
} else {
  console.log(`No unresolved ${creditMigration} migration was found`);
}

await prisma.$disconnect();
process.exit(0);
