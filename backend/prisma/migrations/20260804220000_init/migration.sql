CREATE TYPE "Role" AS ENUM ('ADMIN', 'TECHNICIAN', 'FRONT_DESK');
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'WAITING_FOR_PARTS', 'COMPLETED', 'DELIVERED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'DIGITAL_TRANSFER');
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING', 'REFUNDED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'FRONT_DESK',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RepairTicket" (
  "id" TEXT NOT NULL,
  "ticketNumber" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "deviceModel" TEXT NOT NULL,
  "serialOrImei" TEXT,
  "physicalCondition" TEXT,
  "reportedIssue" TEXT NOT NULL,
  "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
  "estimatedCost" DECIMAL(10,2) NOT NULL,
  "createdById" TEXT NOT NULL,
  "assignedTechId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RepairTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Part" (
  "id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "compatibleDevices" TEXT,
  "stockQty" INTEGER NOT NULL,
  "minimumStockQty" INTEGER NOT NULL DEFAULT 5,
  "costPrice" DECIMAL(10,2) NOT NULL,
  "retailPrice" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketPart" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "partId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "TicketPart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sale" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT,
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "processedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "RepairTicket_ticketNumber_key" ON "RepairTicket"("ticketNumber");
CREATE INDEX "RepairTicket_status_idx" ON "RepairTicket"("status");
CREATE INDEX "RepairTicket_customerPhone_idx" ON "RepairTicket"("customerPhone");
CREATE INDEX "RepairTicket_serialOrImei_idx" ON "RepairTicket"("serialOrImei");
CREATE UNIQUE INDEX "Part_sku_key" ON "Part"("sku");
CREATE UNIQUE INDEX "TicketPart_ticketId_partId_key" ON "TicketPart"("ticketId", "partId");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

ALTER TABLE "RepairTicket" ADD CONSTRAINT "RepairTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepairTicket" ADD CONSTRAINT "RepairTicket_assignedTechId_fkey" FOREIGN KEY ("assignedTechId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketPart" ADD CONSTRAINT "TicketPart_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "RepairTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketPart" ADD CONSTRAINT "TicketPart_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "RepairTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
