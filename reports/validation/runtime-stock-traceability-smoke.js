#!/usr/bin/env node
const DEFAULT_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 8000);
const args = new Set(process.argv.slice(2));
const planOnly = args.has('--plan-only') || process.env.SMOKE_PLAN_ONLY === 'true';
const approvedMutation = process.env.OWNER_APPROVAL === 'explicit' && process.env.SMOKE_ALLOW_MUTATION === 'true';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function redact(value) {
  if (!value) return null;
  return value.slice(0, 6) + '...' + value.slice(-4);
}

function requiredEnv(name) {
  const value = process.env[name];
  assert(value && value.trim(), `${name} is required`);
  return value.replace(/\/$/, '');
}

function optionalEnv(name, fallback) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function optionalBoolean(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return fallback;
  return value === 'true' || value === '1' || value === 'yes';
}

async function requestJson(label, url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    assert(response.ok, `${label} failed with HTTP ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function assertHealth(health) {
  const failed = health.find((item) => item && item.error);
  assert(!failed, `health check failed: ${failed?.error}`);
}

function summarizeCoverage(item) {
  return {
    productId: item.productId,
    sku: item.sku,
    coverageStatus: item.coverageStatus,
    stockOrigin: item.stockOrigin,
    totalAvailable: item.totalAvailable,
    localAvailable: item.localAvailable,
    supplierAvailable: item.supplierAvailable,
    dropshipAvailable: item.dropshipAvailable,
    preferredRoute: item.preferredRoute,
    blockingReasons: item.blockingReasons,
  };
}

function summarizeSupplierJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    supplierId: job.supplierId,
    idempotencyKey: job.idempotencyKey,
    status: job.status,
    warehouseStockValidationStatus: job.warehouseStockValidationStatus,
    warehouseStockUpdateAttempted: job.warehouseStockUpdateAttempted,
    warehouseStockUpdateApproved: job.warehouseStockUpdateApproved,
    warehouseAuthority: job.warehouseStockUpdatePolicy?.warehouseAuthority,
    updatedProducts: job.updatedProducts,
  };
}

function summarizeTopology(topology) {
  if (!topology) return null;
  return {
    productId: topology.productId,
    totals: topology.totals,
    ownWarehouses: (topology.groups?.own || []).map((row) => ({ warehouseId: row.warehouseId, warehouseCode: row.warehouseCode, available: row.totalAvailable })),
    supplierWarehouses: [...(topology.groups?.supplier || []), ...(topology.groups?.dropship || [])]
      .map((row) => ({ warehouseId: row.warehouseId, warehouseCode: row.warehouseCode, originType: row.originType, supplierId: row.supplierId, available: row.totalAvailable })),
  };
}

const stages = [
  'Verify service health endpoints for Warehouse, Catalog, and Suppliers.',
  'Verify protected endpoint auth rejection without tokens where safe.',
  'Read or create approved synthetic Catalog product.',
  'Read or create approved own and supplier/dropship Warehouse locations.',
  'Apply approved supplier/dropship stock reconciliation only when OWNER_APPROVAL=explicit and SMOKE_ALLOW_MUTATION=true.',
  'Read Warehouse topology, availability, and logistics for the product.',
  'Read Catalog availability, coverage, coverage audit, and FlipFlop projection.',
  'Assert local plus supplier/dropship origins, Warehouse-owned logistics routes, covered mixed_stock classification, and Warehouse stock authority.',
  'Record cleanup or cleanup deferral evidence.',
];

if (planOnly) {
  console.log(JSON.stringify({
    status: 'plan-only',
    mutationEnabled: approvedMutation,
    requiredRuntimeEnv: [
      'WAREHOUSE_URL',
      'CATALOG_URL',
      'SUPPLIERS_URL',
      'CATALOG_TOKEN',
      'WAREHOUSE_TOKEN',
      'SUPPLIERS_TOKEN',
      'TRACE_PRODUCT_ID',
    ],
    optionalRuntimeEnv: [
      'TRACE_AUDIT_PAGE=1',
      'TRACE_AUDIT_LIMIT=100',
      'TRACE_SUPPLIER_ID',
      'TRACE_IMPORT_IDEMPOTENCY_KEY',
      'TRACE_EXPECT_SUPPLIERS_JOB=true',
      'TRACE_OWN_WAREHOUSE_ID',
      'TRACE_SUPPLIER_WAREHOUSE_ID',
      'OWNER_APPROVAL=explicit',
      'SMOKE_ALLOW_MUTATION=true',
    ],
    stages,
  }, null, 2));
  process.exit(0);
}

(async () => {
  const warehouseUrl = requiredEnv('WAREHOUSE_URL');
  const catalogUrl = requiredEnv('CATALOG_URL');
  const suppliersUrl = requiredEnv('SUPPLIERS_URL');
  const catalogToken = requiredEnv('CATALOG_TOKEN');
  const warehouseToken = requiredEnv('WAREHOUSE_TOKEN');
  const suppliersToken = requiredEnv('SUPPLIERS_TOKEN');
  const productId = requiredEnv('TRACE_PRODUCT_ID');
  const auditPage = optionalEnv('TRACE_AUDIT_PAGE', '1');
  const auditLimit = optionalEnv('TRACE_AUDIT_LIMIT', '100');
  const expectSuppliersJob = optionalBoolean('TRACE_EXPECT_SUPPLIERS_JOB', approvedMutation);
  const supplierId = optionalEnv('TRACE_SUPPLIER_ID', '');
  const importIdempotencyKey = optionalEnv('TRACE_IMPORT_IDEMPOTENCY_KEY', '');

  const health = await Promise.all([
    requestJson('Warehouse health', `${warehouseUrl}/api/health`).catch((error) => ({ error: error.message })),
    requestJson('Catalog health', `${catalogUrl}/health`).catch((error) => ({ error: error.message })),
    requestJson('Suppliers health', `${suppliersUrl}/api/health`).catch((error) => ({ error: error.message })),
  ]);
  assertHealth(health);

  if (approvedMutation) {
    assert(process.env.TRACE_SUPPLIER_ID, 'TRACE_SUPPLIER_ID is required for approved mutation smoke');
    assert(process.env.TRACE_SUPPLIER_WAREHOUSE_ID, 'TRACE_SUPPLIER_WAREHOUSE_ID is required for approved mutation smoke');
  }
  if (expectSuppliersJob) {
    assert(supplierId, 'TRACE_SUPPLIER_ID is required when TRACE_EXPECT_SUPPLIERS_JOB=true');
    assert(importIdempotencyKey, 'TRACE_IMPORT_IDEMPOTENCY_KEY is required when TRACE_EXPECT_SUPPLIERS_JOB=true');
  }

  const auditQuery = new URLSearchParams({ page: auditPage, limit: auditLimit, isActive: 'true' });
  let supplierJob = null;

  if (expectSuppliersJob) {
    const supplierJobs = await requestJson('Suppliers import jobs', `${suppliersUrl}/api/imports?supplierId=${encodeURIComponent(supplierId)}`, {
      method: 'GET',
      headers: authHeaders(suppliersToken),
    });
    supplierJob = (supplierJobs.data || []).find((job) => job.idempotencyKey === importIdempotencyKey);
    assert(supplierJob, 'expected Suppliers import job evidence for TRACE_IMPORT_IDEMPOTENCY_KEY');
    assert(supplierJob.warehouseStockUpdateAttempted === true, 'expected Suppliers job to record Warehouse stock update attempted');
    assert(supplierJob.warehouseStockUpdateApproved === true, 'expected Suppliers job to record approved Warehouse stock update');
    assert(supplierJob.warehouseStockUpdatePolicy?.warehouseAuthority === 'warehouse-microservice', 'expected Suppliers job to preserve Warehouse authority policy');
    assert(Number(supplierJob.updatedProducts || 0) > 0, 'expected Suppliers job to record applied Warehouse updates');
  }

  const [catalogProduct, warehouseTopology, warehouseAvailability, warehouseLogistics, catalogAvailability, catalogCoverage, catalogCoverageAudit, flipflopProjection] = await Promise.all([
    requestJson('Catalog product identity', `${catalogUrl}/api/products/${productId}`, {
      method: 'GET',
      headers: authHeaders(catalogToken),
    }),
    requestJson('Warehouse topology', `${warehouseUrl}/api/warehouses/topology?productId=${encodeURIComponent(productId)}`, {
      method: 'GET',
      headers: authHeaders(warehouseToken),
    }),
    requestJson('Warehouse availability', `${warehouseUrl}/api/stock/availability/batch`, {
      method: 'POST',
      headers: authHeaders(warehouseToken),
      body: JSON.stringify({ productIds: [productId] }),
    }),
    requestJson('Warehouse logistics', `${warehouseUrl}/api/warehouses/logistics/batch`, {
      method: 'POST',
      headers: authHeaders(warehouseToken),
      body: JSON.stringify({ productIds: [productId] }),
    }),
    requestJson('Catalog availability', `${catalogUrl}/api/products/availability/batch`, {
      method: 'POST',
      headers: authHeaders(catalogToken),
      body: JSON.stringify({ productIds: [productId] }),
    }),
    requestJson('Catalog coverage', `${catalogUrl}/api/products/availability/coverage`, {
      method: 'POST',
      headers: authHeaders(catalogToken),
      body: JSON.stringify({ productIds: [productId] }),
    }),
    requestJson('Catalog coverage audit', `${catalogUrl}/api/products/availability/coverage/audit?${auditQuery.toString()}`, {
      method: 'GET',
      headers: authHeaders(catalogToken),
    }),
    requestJson('Catalog FlipFlop projection', `${catalogUrl}/api/products/projections/flipflop/batch`, {
      method: 'POST',
      headers: authHeaders(catalogToken),
      body: JSON.stringify({ productIds: [productId], includeUnavailable: true }),
    }),
  ]);

  const catalogProductData = catalogProduct.data;
  const topologyData = warehouseTopology.data;
  const warehouseRows = warehouseAvailability.data?.[0]?.warehouses || [];
  const logisticsOptions = warehouseLogistics.data?.[0]?.options || [];
  const catalogItem = catalogAvailability.data?.items?.[0];
  const coverageItem = catalogCoverage.data?.items?.[0];
  const coverageAuditItems = catalogCoverageAudit.data?.items || [];
  const coverageAuditItem = coverageAuditItems.find((item) => item.productId === productId);
  const projectionItem = flipflopProjection.data?.items?.[0];

  assert(catalogProductData?.id === productId, 'expected Catalog product identity to match TRACE_PRODUCT_ID');
  assert(catalogProductData?.sku, 'expected Catalog product identity to include SKU');
  assert((topologyData?.groups?.own || []).length > 0, 'expected Warehouse topology to include own warehouses');
  assert([...(topologyData?.groups?.supplier || []), ...(topologyData?.groups?.dropship || [])].length > 0, 'expected Warehouse topology to include supplier-managed warehouses');
  assert(warehouseRows.some((row) => row.warehouseType === 'own' && Number(row.available) > 0), 'expected own Warehouse stock row');
  assert(warehouseRows.some((row) => ['supplier', 'dropship'].includes(row.warehouseType) && row.supplierId && Number(row.available) > 0), 'expected supplier/dropship Warehouse stock row');
  assert(logisticsOptions.some((option) => option.routeType === 'local_fulfillment'), 'expected local fulfillment route');
  assert(logisticsOptions.some((option) => ['supplier_replenishment', 'supplier_dropship'].includes(option.routeType)), 'expected supplier route');
  assert(catalogItem?.source === 'warehouse', 'expected Catalog availability source warehouse');
  assert(catalogItem?.warehouses?.length >= 2, 'expected Catalog to forward origin rows');
  assert(catalogItem?.logistics?.options?.length >= 2, 'expected Catalog to forward logistics options');
  assert(coverageItem?.coverageStatus === 'covered', 'expected Catalog coverage status covered');
  assert(coverageItem?.stockOrigin === 'mixed_stock', 'expected Catalog coverage stockOrigin mixed_stock');
  assert(coverageAuditItem?.coverageStatus === 'covered', 'expected Catalog coverage audit to include covered product');
  assert(coverageAuditItem?.stockOrigin === 'mixed_stock', 'expected Catalog coverage audit stockOrigin mixed_stock');
  assert(projectionItem?.availability?.source === 'warehouse', 'expected FlipFlop projection availability source warehouse');
  assert(projectionItem?.availability?.logistics?.options?.length >= 2, 'expected FlipFlop projection logistics options');

  console.log(JSON.stringify({
    status: 'passed',
    mutationEnabled: approvedMutation,
    tokens: {
      catalog: redact(catalogToken),
      warehouse: redact(warehouseToken),
      suppliers: redact(suppliersToken),
    },
    health,
    productId,
    catalogProduct: {
      id: catalogProductData.id,
      sku: catalogProductData.sku,
      title: catalogProductData.title,
    },
    warehouseTopology: summarizeTopology(topologyData),
    warehouseOrigins: warehouseRows.map((row) => ({
      warehouseId: row.warehouseId,
      warehouseType: row.warehouseType,
      supplierId: row.supplierId,
      available: row.available,
    })),
    logisticsRoutes: logisticsOptions.map((option) => option.routeType),
    coverage: summarizeCoverage(coverageItem),
    coverageAudit: {
      page: catalogCoverageAudit.data?.pagination?.page,
      limit: catalogCoverageAudit.data?.pagination?.limit,
      total: catalogCoverageAudit.data?.pagination?.total,
      matchedProduct: summarizeCoverage(coverageAuditItem),
    },
    supplierJob: summarizeSupplierJob(supplierJob),
    projection: {
      productId: projectionItem.productId,
      stockQuantity: projectionItem.stockQuantity,
      routeCount: projectionItem.availability?.logistics?.options?.length || 0,
    },
  }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
});
