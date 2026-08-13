ALTER TABLE "RepairTicket"
ADD COLUMN "serviceCharge" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "partId" TEXT,
  "ticketId" TEXT,
  "category" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryMovement_direction_check" CHECK ("direction" IN ('IN', 'OUT')),
  CONSTRAINT "InventoryMovement_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "InventoryMovement_unitPrice_check" CHECK ("unitPrice" >= 0)
);

CREATE INDEX "InventoryMovement_partId_direction_idx" ON "InventoryMovement"("partId", "direction");
CREATE INDEX "InventoryMovement_ticketId_idx" ON "InventoryMovement"("ticketId");
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "RepairTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "InventoryMovement" ("id", "partId", "category", "direction", "quantity", "unitPrice", "createdAt")
SELECT 'opening-' || p."id", p."id", COALESCE(p."category", 'Other'), 'IN', p."stockQty" + COALESCE(used."quantity", 0), p."costPrice", COALESCE(p."createdAt", CURRENT_TIMESTAMP)
FROM "Part" p
LEFT JOIN (
  SELECT "partId", SUM("quantity")::INTEGER AS "quantity"
  FROM "TicketPart"
  GROUP BY "partId"
) used ON used."partId" = p."id"
WHERE p."stockQty" + COALESCE(used."quantity", 0) > 0;

INSERT INTO "InventoryMovement" ("id", "partId", "ticketId", "category", "direction", "quantity", "unitPrice", "createdAt")
SELECT 'used-' || tp."id", p."id", tp."ticketId", COALESCE(p."category", 'Other'), 'OUT', tp."quantity", p."retailPrice", COALESCE(ticket."updatedAt", CURRENT_TIMESTAMP)
FROM "TicketPart" tp
JOIN "Part" p ON p."id" = tp."partId"
JOIN "RepairTicket" ticket ON ticket."id" = tp."ticketId";
