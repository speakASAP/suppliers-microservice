-- Goal 5 source migration artifact.
-- Adds import-job evidence fields for Warehouse stock-boundary validation.
-- Do not apply to production until the owner approves a migration/deployment chunk.

ALTER TABLE "import_jobs"
  ADD COLUMN IF NOT EXISTS "warehouseStockValidationStatus" varchar(50) NOT NULL DEFAULT $$pending$$,
  ADD COLUMN IF NOT EXISTS "warehouseStockValidationErrors" jsonb,
  ADD COLUMN IF NOT EXISTS "warehouseStockUpdatePolicy" jsonb,
  ADD COLUMN IF NOT EXISTS "warehouseStockUpdateAttempted" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "warehouseStockUpdateApproved" boolean NOT NULL DEFAULT false;
