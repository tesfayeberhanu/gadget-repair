CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE INDEX "Category_group_idx" ON "Category"("group");

INSERT INTO "Category" ("id", "name", "group", "updatedAt") VALUES
(gen_random_uuid(), 'Screen', 'SPARE_PART', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Battery', 'SPARE_PART', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Camera', 'SPARE_PART', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Part', 'SPARE_PART', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Other', 'SPARE_PART', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Accessory', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Cable', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Power Banks', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Wireless Chargers', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Car Chargers', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Phone Cases', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Screen Protectors', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Wireless Earbuds', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Wired Earphones', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Portable Speakers', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Headphones', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Adapters', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'OTG Adapter', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Tripods', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Laptop Stand', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'AirPods', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Neckband', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'C to C Chargers', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Micro Chargers', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Apple Chargers', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Wireless Speakers', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'SIM Opening Pin', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Lens Cover', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Armband Case', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Waterproof Pouch', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Cable Organizer', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Smartwatch', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Solar Power Bank', 'ACCESSORY', CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Cooling Pad', 'ACCESSORY', CURRENT_TIMESTAMP);

INSERT INTO "Category" ("id", "name", "group", "updatedAt")
SELECT gen_random_uuid(), existing."category", 'ACCESSORY', CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "category" FROM "Part" WHERE "category" IS NOT NULL) AS existing
WHERE NOT EXISTS (SELECT 1 FROM "Category" c WHERE c."name" = existing."category");
