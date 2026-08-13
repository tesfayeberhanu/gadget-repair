ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'FINALIZED', 'CANCELLED', 'REFUNDED');

CREATE TABLE "Customer" (
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
FROM customer_source;

ALTER TABLE "RepairTicket" ADD COLUMN "customerId" TEXT;

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
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "finalizationKey" TEXT,
  ADD COLUMN "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "isCreditSale" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recognizedRevenue" DECIMAL(10,2),
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "revenueRecognizedAt" TIMESTAMP(3),
  ADD COLUMN "revenueReversedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

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

CREATE TABLE "Payment" (
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
FROM "Sale"
WHERE "paymentStatus" = 'PAID' AND "totalAmount" > 0;

CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");
CREATE UNIQUE INDEX "Sale_finalizationKey_key" ON "Sale"("finalizationKey");
CREATE INDEX "Sale_ticketId_idx" ON "Sale"("ticketId");
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX "Sale_status_revenueRecognizedAt_idx" ON "Sale"("status", "revenueRecognizedAt");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_saleId_createdAt_idx" ON "Payment"("saleId", "createdAt");

ALTER TABLE "RepairTicket" ADD CONSTRAINT "RepairTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
