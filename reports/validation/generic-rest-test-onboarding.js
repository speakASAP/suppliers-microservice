#!/usr/bin/env node
const assert = require('assert');

const baseUrl = (process.env.SUPPLIERS_URL || 'https://suppliers.alfares.cz').replace(/\/$/, '');
const token = process.env.SUPPLIERS_TOKEN || process.env.JWT_TOKEN;

if (!token) {
  console.error(JSON.stringify({ status: 'failed', error: 'SUPPLIERS_TOKEN or JWT_TOKEN is required' }, null, 2));
  process.exit(2);
}

const testSuppliers = [
  {
    name: 'Codex Generic REST Test Supplier A',
    code: 'codex-rest-test-a',
    apiType: 'rest',
    apiUrl: `${baseUrl}/supplier-fixtures/generic-rest-test-a.json`,
    isActive: true,
  },
  {
    name: 'Codex Generic REST Test Supplier B',
    code: 'codex-rest-test-b',
    apiType: 'rest',
    apiUrl: `${baseUrl}/supplier-fixtures/generic-rest-test-b.json`,
    isActive: true,
  },
];

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function upsertSupplier(spec) {
  const current = await request('/api/suppliers');
  const existing = (current.data || []).find((supplier) => supplier.code === spec.code);
  const response = existing
    ? await request(`/api/suppliers/${existing.id}`, { method: 'PUT', body: JSON.stringify(spec) })
    : await request('/api/suppliers', { method: 'POST', body: JSON.stringify(spec) });

  const supplier = response.data;
  assert.strictEqual(supplier.code, spec.code);
  assert.strictEqual(supplier.apiType, 'rest');
  assert.strictEqual(supplier.apiUrl, spec.apiUrl);
  assert.strictEqual(supplier.isActive, true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(supplier, 'apiCredentials'), false, 'apiCredentials must be redacted');
  assert.strictEqual(supplier.hasCredentials, false);
  return { supplier, operation: existing ? 'updated' : 'created' };
}

async function runImport(supplier) {
  const idempotencyKey = `manual:generic-rest-test-${supplier.code}-20260621`;
  const sourceFingerprint = `generic-rest-test:${supplier.code}:20260621`;
  const start = await request(`/api/imports/run/${supplier.id}`, {
    method: 'POST',
    body: JSON.stringify({
      triggerType: 'manual',
      idempotencyKey,
      sourceFingerprint,
      warehouseStockUpdateMode: 'validate_only',
    }),
  });

  const created = start.meta?.created === true || start.meta?.idempotentReplay === false;
  let job = start.data;
  for (let i = 0; i < 20; i += 1) {
    const jobs = await request(`/api/imports?supplierId=${encodeURIComponent(supplier.id)}`);
    const candidate = (jobs.data || []).find((item) => item.id === job.id || item.idempotencyKey === idempotencyKey);
    if (candidate) job = candidate;
    if (job.status === 'completed' || job.status === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  assert.strictEqual(job.status, 'completed', `import for ${supplier.code} must complete`);
  assert.strictEqual(job.payloadValidationStatus, 'passed', `payload validation for ${supplier.code} must pass`);
  assert.strictEqual(job.warehouseStockValidationStatus, 'passed', `warehouse boundary validation for ${supplier.code} must pass`);
  assert.strictEqual(job.warehouseStockUpdateAttempted, false, `validate-only import for ${supplier.code} must not attempt Warehouse mutation`);
  assert.strictEqual(job.warehouseStockUpdateApproved, false, `validate-only import for ${supplier.code} must not record mutation approval`);
  assert.strictEqual(Number(job.updatedProducts || 0), 0, `validate-only import for ${supplier.code} must not apply Warehouse updates`);

  return {
    id: job.id,
    status: job.status,
    idempotencyKey: job.idempotencyKey,
    sourceFingerprint: job.sourceFingerprint,
    totalProducts: job.totalProducts,
    updatedProducts: job.updatedProducts,
    payloadValidationStatus: job.payloadValidationStatus,
    catalogProductValidationStatus: job.catalogProductValidationStatus,
    warehouseStockValidationStatus: job.warehouseStockValidationStatus,
    warehouseStockUpdateAttempted: job.warehouseStockUpdateAttempted,
    warehouseStockUpdateApproved: job.warehouseStockUpdateApproved,
    created,
  };
}

(async () => {
  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
  assert.strictEqual(health.status, 'healthy');

  const results = [];
  for (const spec of testSuppliers) {
    const { supplier, operation } = await upsertSupplier(spec);
    const job = await runImport(supplier);
    results.push({
      supplier: {
        id: supplier.id,
        name: supplier.name,
        code: supplier.code,
        apiType: supplier.apiType,
        apiUrl: supplier.apiUrl,
        hasCredentials: supplier.hasCredentials,
        operation,
      },
      importJob: job,
    });
  }

  console.log(JSON.stringify({
    status: 'passed',
    baseUrl,
    mode: 'generic-rest-test-onboarding',
    supplierCount: results.length,
    mutationMode: 'validate_only',
    warehouseMutationAttempted: false,
    results,
  }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
});

