-- Widens import-job source fingerprint for full UUID trace evidence.
-- The guarded runtime stock traceability fingerprint includes product, supplier warehouse,
-- dropship warehouse, quantity, and supplier SKU, which exceeds 128 characters.

ALTER TABLE "import_jobs"
  ALTER COLUMN "sourceFingerprint" TYPE varchar(256);
