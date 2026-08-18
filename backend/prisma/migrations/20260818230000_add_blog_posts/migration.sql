CREATE TABLE "BlogPost" (
  "id" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BlogPost_active_position_idx" ON "BlogPost"("active", "position");

INSERT INTO "BlogPost" ("id", "tag", "title", "summary", "body", "position", "updatedAt") VALUES
(gen_random_uuid(), 'BATTERY CARE', '5 habits that make your phone battery last longer', 'Small charging changes can reduce heat and slow battery wear.', 'Avoid leaving your phone in direct heat, use a reliable charger, and try to keep daily charging between roughly 20% and 90%. If the phone swells, becomes unusually hot, or shuts down unexpectedly, stop charging it and arrange an inspection.', 0, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'SCREEN & WATER', 'What to do immediately after liquid damage', 'Fast, calm action gives a technician the best chance to save the device.', 'Turn the device off, disconnect every cable, and do not test the charger. Avoid rice and hair dryers; both can make the damage worse. Bring the phone in as soon as possible and tell the technician what liquid was involved.', 1, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'BEFORE REPAIR', 'How to prepare your phone for a repair visit', 'A quick backup and a few details make check-in much faster.', 'Back up important photos and contacts when the device still works. Bring the passcode only if testing requires it, note any recent drops or repairs, and bring relevant accessories when the fault involves charging or audio.', 2, CURRENT_TIMESTAMP);
