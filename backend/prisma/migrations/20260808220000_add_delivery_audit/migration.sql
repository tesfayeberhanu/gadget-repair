ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';

CREATE TABLE "DeliveryRecord" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "deliveredById" TEXT NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeliveryRecord_ticketId_key" ON "DeliveryRecord"("ticketId");
CREATE INDEX "DeliveryRecord_deliveredAt_idx" ON "DeliveryRecord"("deliveredAt");
CREATE INDEX "DeliveryRecord_deliveredById_idx" ON "DeliveryRecord"("deliveredById");

ALTER TABLE "DeliveryRecord" ADD CONSTRAINT "DeliveryRecord_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "RepairTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryRecord" ADD CONSTRAINT "DeliveryRecord_deliveredById_fkey" FOREIGN KEY ("deliveredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
