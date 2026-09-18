ALTER TABLE "InventoryMovement" ADD COLUMN "saleId" TEXT;

CREATE TABLE "SaleItem" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "partId" TEXT,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "unitCost" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaleItem_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "SaleItem_unitPrice_check" CHECK ("unitPrice" > 0),
  CONSTRAINT "SaleItem_unitCost_check" CHECK ("unitCost" >= 0)
);

CREATE UNIQUE INDEX "SaleItem_saleId_sku_key" ON "SaleItem"("saleId", "sku");
CREATE INDEX "SaleItem_partId_idx" ON "SaleItem"("partId");
CREATE INDEX "InventoryMovement_saleId_idx" ON "InventoryMovement"("saleId");

ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
