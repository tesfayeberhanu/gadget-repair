ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

DO $$
BEGIN
  CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "Customer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "is_credit_customer" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

WITH normalized_tickets AS (
  SELECT
    "id",
    "customerName",
    CASE
      WHEN regexp_replace("customerPhone", '[^0-9+]', '', 'g') ~ '^09[0-9]{8}$'
        THEN '+251' || substring(regexp_replace("customerPhone", '[^0-9+]', '', 'g') from 2)
      ELSE regexp_replace("customerPhone", '[^0-9+]', '', 'g')
    END AS normalized_phone,
    "createdAt",
    "updatedAt"
  FROM "RepairTicket"
), customer_source AS (
  SELECT DISTINCT ON (normalized_phone)
    normalized_phone,
    "customerName",
    "createdAt",
    "updatedAt"
  FROM normalized_tickets
  ORDER BY normalized_phone, "updatedAt" DESC
)
INSERT INTO "Customer" ("id", "name", "phone", "is_credit_customer", "createdAt", "updatedAt")
SELECT 'cus_' || md5(normalized_phone), "customerName", normalized_phone, false, "createdAt", "updatedAt"
FROM customer_source source
WHERE NOT EXISTS (
  SELECT 1 FROM "Customer" customer WHERE customer."phone" = source.normalized_phone
);

ALTER TABLE "RepairTicket" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

UPDATE "RepairTicket" ticket
SET "customerId" = customer."id",
    "customerPhone" = customer."phone"
FROM "Customer" customer
WHERE customer."phone" = CASE
  WHEN regexp_replace(ticket."customerPhone", '[^0-9+]', '', 'g') ~ '^09[0-9]{8}$'
    THEN '+251' || substring(regexp_replace(ticket."customerPhone", '[^0-9+]', '', 'g') from 2)
  ELSE regexp_replace(ticket."customerPhone", '[^0-9+]', '', 'g')
END;

ALTER TABLE "RepairTicket" ALTER COLUMN "customerId" SET NOT NULL;

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT,
  ADD COLUMN IF NOT EXISTS "finalizationKey" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "isCreditSale" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recognizedRevenue" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revenueRecognizedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revenueReversedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Sale" sale
SET "customerId" = ticket."customerId"
FROM "RepairTicket" ticket
WHERE ticket."id" = sale."ticketId";

UPDATE "Sale" sale
SET "status" = CASE WHEN sale."paymentStatus" = 'REFUNDED' THEN 'REFUNDED'::"SaleStatus" ELSE 'FINALIZED'::"SaleStatus" END,
    "recognizedRevenue" = sale."totalAmount",
    "finalizedAt" = sale."createdAt",
    "revenueRecognizedAt" = sale."createdAt",
    "revenueReversedAt" = CASE WHEN sale."paymentStatus" = 'REFUNDED' THEN sale."createdAt" ELSE NULL END
WHERE sale."paymentStatus" IN ('PAID', 'REFUNDED')
   OR EXISTS (
     SELECT 1 FROM "RepairTicket" ticket
     WHERE ticket."id" = sale."ticketId" AND ticket."status" IN ('DELIVERED', 'PICKED_UP')
   );

UPDATE "Sale" SET "paymentStatus" = 'UNPAID' WHERE "paymentStatus" = 'PENDING';
ALTER TABLE "Sale" ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID';
ALTER TABLE "Sale" ALTER COLUMN "paymentMethod" DROP NOT NULL;

WITH ranked_sales AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "ticketId"
    ORDER BY ("status" = 'FINALIZED') DESC, ("paymentStatus" = 'PAID') DESC, "createdAt" ASC
  ) AS rank
  FROM "Sale"
  WHERE "ticketId" IS NOT NULL
)
UPDATE "Sale" sale
SET "finalizationKey" = 'repair:' || sale."ticketId"
FROM ranked_sales ranked
WHERE ranked."id" = sale."id" AND ranked.rank = 1;

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "processedBy" TEXT NOT NULL,
  "reversedAt" TIMESTAMP(3),
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0)
);

INSERT INTO "Payment" ("id", "saleId", "amount", "method", "idempotencyKey", "processedBy", "createdAt")
SELECT 'pay_migrated_' || md5("id"), "id", "totalAmount", COALESCE("paymentMethod", 'CASH'::"PaymentMethod"), 'migration:' || "id", "processedBy", "createdAt"
FROM "Sale" sale
WHERE sale."paymentStatus" = 'PAID'
  AND sale."totalAmount" > 0
  AND NOT EXISTS (
    SELECT 1 FROM "Payment" payment WHERE payment."idempotencyKey" = 'migration:' || sale."id"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_phone_key" ON "Customer"("phone");
CREATE INDEX IF NOT EXISTS "Customer_name_idx" ON "Customer"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_finalizationKey_key" ON "Sale"("finalizationKey");
CREATE INDEX IF NOT EXISTS "Sale_ticketId_idx" ON "Sale"("ticketId");
CREATE INDEX IF NOT EXISTS "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX IF NOT EXISTS "Sale_status_revenueRecognizedAt_idx" ON "Sale"("status", "revenueRecognizedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "Payment_saleId_createdAt_idx" ON "Payment"("saleId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RepairTicket_customerId_fkey') THEN
    ALTER TABLE "RepairTicket" ADD CONSTRAINT "RepairTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_customerId_fkey') THEN
    ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_saleId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_processedBy_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
