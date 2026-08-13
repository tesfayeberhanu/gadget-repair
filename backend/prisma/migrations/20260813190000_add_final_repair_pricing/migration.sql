ALTER TABLE "TicketPart"
ADD COLUMN "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "TicketPart"
ADD CONSTRAINT "TicketPart_unitPrice_check" CHECK ("unitPrice" >= 0);

UPDATE "TicketPart" ticket_part
SET "unitPrice" = part."retailPrice"
FROM "Part" part
WHERE part."id" = ticket_part."partId";

ALTER TABLE "RepairTicket"
ADD COLUMN "finalPrice" DECIMAL(10,2);

ALTER TABLE "RepairTicket"
ADD CONSTRAINT "RepairTicket_finalPrice_check" CHECK ("finalPrice" IS NULL OR "finalPrice" >= 0);

UPDATE "RepairTicket" ticket
SET "finalPrice" = ticket."serviceCharge" + COALESCE(parts."total", 0)
FROM (
  SELECT "ticketId", SUM("quantity" * "unitPrice") AS "total"
  FROM "TicketPart"
  GROUP BY "ticketId"
) parts
WHERE parts."ticketId" = ticket."id"
  AND ticket."status" IN ('DELIVERED', 'PICKED_UP');

UPDATE "RepairTicket"
SET "finalPrice" = "serviceCharge"
WHERE "status" IN ('DELIVERED', 'PICKED_UP')
  AND "finalPrice" IS NULL;
