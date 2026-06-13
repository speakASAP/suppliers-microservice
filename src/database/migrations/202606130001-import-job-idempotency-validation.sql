-- Goal 3/4 production schema migration.
-- Creates missing Suppliers-owned tables for production instances without TypeORM sync,
-- then applies the Goal 3 import-job idempotency and validation columns.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(200) NOT NULL,
  "code" varchar(100) NOT NULL,
  "apiType" varchar(50) NOT NULL,
  "apiUrl" varchar(500),
  "apiCredentials" jsonb,
  "syncSchedule" varchar(100),
  "isActive" boolean NOT NULL DEFAULT true,
  "lastSyncAt" timestamp,
  "lastSyncStatus" varchar(50),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "suppliers"
  ADD COLUMN IF NOT EXISTS "name" varchar(200),
  ADD COLUMN IF NOT EXISTS "code" varchar(100),
  ADD COLUMN IF NOT EXISTS "apiType" varchar(50),
  ADD COLUMN IF NOT EXISTS "apiUrl" varchar(500),
  ADD COLUMN IF NOT EXISTS "apiCredentials" jsonb,
  ADD COLUMN IF NOT EXISTS "syncSchedule" varchar(100),
  ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "lastSyncAt" timestamp,
  ADD COLUMN IF NOT EXISTS "lastSyncStatus" varchar(50),
  ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_suppliers_code"
  ON "suppliers" ("code");

CREATE TABLE IF NOT EXISTS "category_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplierId" uuid NOT NULL,
  "supplierCategoryId" varchar(200) NOT NULL,
  "supplierCategoryName" varchar(500),
  "catalogCategoryId" uuid,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "category_mappings"
  ADD COLUMN IF NOT EXISTS "supplierId" uuid,
  ADD COLUMN IF NOT EXISTS "supplierCategoryId" varchar(200),
  ADD COLUMN IF NOT EXISTS "supplierCategoryName" varchar(500),
  ADD COLUMN IF NOT EXISTS "catalogCategoryId" uuid,
  ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_category_mappings_supplier_category"
  ON "category_mappings" ("supplierId", "supplierCategoryId");

CREATE TABLE IF NOT EXISTS "import_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplierId" uuid NOT NULL,
  "idempotencyKey" varchar(128),
  "triggerType" varchar(50) NOT NULL DEFAULT 'manual',
  "sourceFingerprint" varchar(256),
  "status" varchar(50) NOT NULL DEFAULT 'pending',
  "payloadValidationStatus" varchar(50) NOT NULL DEFAULT 'pending',
  "payloadValidationErrors" jsonb,
  "totalProducts" integer NOT NULL DEFAULT 0,
  "importedProducts" integer NOT NULL DEFAULT 0,
  "updatedProducts" integer NOT NULL DEFAULT 0,
  "failedProducts" integer NOT NULL DEFAULT 0,
  "errors" jsonb,
  "startedAt" timestamp,
  "completedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "import_jobs"
  ADD COLUMN IF NOT EXISTS "supplierId" uuid,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" varchar(128),
  ADD COLUMN IF NOT EXISTS "triggerType" varchar(50) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "sourceFingerprint" varchar(256),
  ADD COLUMN IF NOT EXISTS "status" varchar(50) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "payloadValidationStatus" varchar(50) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "payloadValidationErrors" jsonb,
  ADD COLUMN IF NOT EXISTS "totalProducts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "importedProducts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "updatedProducts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "failedProducts" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "errors" jsonb,
  ADD COLUMN IF NOT EXISTS "startedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "completedAt" timestamp,
  ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT now();

UPDATE "import_jobs"
SET "idempotencyKey" = 'manual:' || md5("id"::text)
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "import_jobs"
  ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_import_jobs_supplier_idempotency"
  ON "import_jobs" ("supplierId", "idempotencyKey");
