CREATE TABLE "PromoBanner" (
  "id" TEXT NOT NULL,
  "title" TEXT,
  "subtitle" TEXT,
  "linkUrl" TEXT,
  "imageData" BYTEA NOT NULL,
  "imageType" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromoBanner_active_position_idx" ON "PromoBanner"("active", "position");

CREATE TABLE "SocialLink" (
  "id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SocialLink_position_idx" ON "SocialLink"("position");

CREATE TABLE "StaffProfile" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "bio" TEXT,
  "photoData" BYTEA,
  "photoType" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffProfile_active_position_idx" ON "StaffProfile"("active", "position");
