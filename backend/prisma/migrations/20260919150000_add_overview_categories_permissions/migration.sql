-- Overview and Categories become explicit, admin-grantable permissions
-- (VIEW_OVERVIEW, VIEW_CATEGORIES) instead of being automatic for
-- Technician accounts / bundled into VIEW_INVENTORY only.
--
-- Backfill VIEW_OVERVIEW onto every existing Technician account so their
-- current landing page (their assigned repair queue) keeps working; it
-- remains admin-configurable per account going forward. Front Desk never
-- had Overview automatically, so no backfill is needed there.
UPDATE "User"
SET "permissions" = array_append("permissions", 'VIEW_OVERVIEW')
WHERE "role" = 'TECHNICIAN' AND NOT ('VIEW_OVERVIEW' = ANY("permissions"));
