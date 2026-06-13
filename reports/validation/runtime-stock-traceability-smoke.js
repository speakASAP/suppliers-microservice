#!/usr/bin/env node
const DEFAULT_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 8000);
const DEFAULT_IMPORT_POLL_MS = Number(process.env.TRACE_IMPORT_POLL_MS || 15000);
const args = new Set(process.argv.slice(2));
const planOnly = args.has('--plan-only') || process.env.SMOKE_PLAN_ONLY === 'true';
const configOnly = args.has('--config-only') || process.env.SMOKE_CONFIG_ONLY === 'true';
const fixtureCheck = args.has('--fixture-check') || process.env.SMOKE_FIXTURE_CHECK === 'true';
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

function isCompletedEvidenceText(value) {
  return typeof value === 'string' && value.trim().length > 0 && !/TODO|placeholder/i.test(value);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertHealth(health) {
  const failed = health.find((item) => item && item.error);
  assert(!failed, `health check failed: ${failed?.error}`);
}

async function readHealth(service, url) {
  try {
    const data = await requestJson(`${service} health`, url);
    return { service, endpoint: url, status: data?.status || data?.health || 'passed' };
  } catch (error) {
    return { service, endpoint: url, error: error.message };
  }
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
    sourceFingerprint: job.sourceFingerprint,
    status: job.status,
    warehouseStockValidationStatus: job.warehouseStockValidationStatus,
    warehouseStockUpdateAttempted: job.warehouseStockUpdateAttempted,
    warehouseStockUpdateApproved: job.warehouseStockUpdateApproved,
    warehouseAuthority: job.warehouseStockUpdatePolicy?.warehouseAuthority,
    catalogProductValidationStatus: job.catalogProductValidationStatus,
    catalogProductIdsChecked: Array.isArray(job.catalogProductIdsChecked) ? job.catalogProductIdsChecked : [],
    catalogProductValidationErrorCount: Array.isArray(job.catalogProductValidationErrors) ? job.catalogProductValidationErrors.length : 0,
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

function summarizeLogisticsLegs(options) {
  if (!Array.isArray(options)) return [];
  return options.map((option) => ({
    routeType: option.routeType,
    warehouseId: option.warehouseId,
    supplierId: option.supplierId || null,
    available: option.available,
    canReserveFromWarehouse: option.canReserveFromWarehouse === true,
    legs: Array.isArray(option.legs) ? option.legs.map((leg) => ({
      sequence: leg.sequence,
      from: leg.from,
      to: leg.to,
      responsibility: leg.responsibility,
    })) : [],
  }));
}

function hasLocalCustomerLeg(options) {
  return Array.isArray(options) && options.some((option) => option.routeType === 'local_fulfillment'
    && Array.isArray(option.legs)
    && option.legs.some((leg) => leg.responsibility === 'warehouse' && leg.to === 'customer'));
}

function hasSupplierDropshipCustomerPath(options) {
  return Array.isArray(options) && options.some((option) => option.routeType === 'supplier_dropship'
    && Array.isArray(option.legs)
    && option.legs.some((leg) => leg.responsibility === 'supplier' && leg.to === 'customer'));
}

function hasSupplierReplenishmentPath(options) {
  return Array.isArray(options) && options.some((option) => {
    const legs = Array.isArray(option.legs) ? option.legs : [];
    return option.routeType === 'supplier_replenishment'
      && legs.some((leg) => leg.responsibility === 'supplier' && String(leg.to || '').includes('alfares'))
      && legs.some((leg) => leg.responsibility === 'warehouse' && leg.to === 'customer');
  });
}

function hasRequiredLogisticsLegs(options) {
  return hasLocalCustomerLeg(options) && hasSupplierReplenishmentPath(options) && hasSupplierDropshipCustomerPath(options);
}

function hasPositiveReservableRoute(options, routeType) {
  return Array.isArray(options) && options.some((option) => option.routeType === routeType
    && Number(option.available) > 0
    && option.canReserveFromWarehouse === true);
}

function hasRequiredReservableRoutes(options) {
  return hasPositiveReservableRoute(options, 'local_fulfillment')
    && hasPositiveReservableRoute(options, 'supplier_replenishment')
    && hasPositiveReservableRoute(options, 'supplier_dropship');
}

function hasRequiredSupplierOwnership(option) {
  if (!['supplier_replenishment', 'supplier_dropship'].includes(option.routeType)) return true;
  return typeof option.supplierId === 'string' && option.supplierId.trim().length > 0;
}

function sumTraceableReservableAvailability(options) {
  if (!Array.isArray(options)) return 0;
  return options.reduce((total, option) => {
    if (Number(option.available ?? 0) <= 0
      || option.canReserveFromWarehouse !== true
      || !hasRequiredSupplierOwnership(option)
      || !Array.isArray(option.legs)
      || option.legs.length === 0) {
      return total;
    }
    return total + Number(option.available ?? 0);
  }, 0);
}

function assertConfiguredWarehouseId(label, configuredId, rows, matcher) {
  if (!configuredId) return;
  assert(rows.some((row) => row.warehouseId === configuredId && matcher(row)), `expected ${label} fixture warehouse ${configuredId} in runtime evidence`);
}

function assertConfiguredSupplierOwnership(label, expectedSupplierId, configuredId, rows) {
  if (!expectedSupplierId || !configuredId) return;
  const row = rows.find((item) => item.warehouseId === configuredId);
  assert(row, `expected ${label} warehouse ${configuredId} in runtime evidence`);
  assert(row.supplierId === expectedSupplierId, `expected ${label} warehouse ${configuredId} to belong to supplier ${expectedSupplierId}`);
}

function assertConfiguredRouteSupplierOwnership(label, expectedSupplierId, configuredId, routeType, options) {
  if (!expectedSupplierId || !configuredId) return;
  const route = options.find((item) => item.warehouseId === configuredId && item.routeType === routeType);
  assert(route, `expected ${label} route ${routeType} for warehouse ${configuredId}`);
  assert(route.supplierId === expectedSupplierId, `expected ${label} route ${routeType} for warehouse ${configuredId} to belong to supplier ${expectedSupplierId}`);
}

function assertConfiguredRoute(label, configuredId, routeType, options) {
  if (!configuredId) return;
  const route = options.find((item) => item.warehouseId === configuredId && item.routeType === routeType);
  assert(route, `expected ${label} route ${routeType} for warehouse ${configuredId}`);
  assert(Array.isArray(route.legs) && route.legs.length > 0, `expected ${label} route ${routeType} for warehouse ${configuredId} to include legs`);
}

async function readSupplierJob({ suppliersUrl, suppliersToken, supplierId, importIdempotencyKey }) {
  const supplierJobs = await requestJson('Suppliers import jobs', `${suppliersUrl}/api/imports?supplierId=${encodeURIComponent(supplierId)}`, {
    method: 'GET',
    headers: authHeaders(suppliersToken),
  });
  return (supplierJobs.data || []).find((job) => job.idempotencyKey === importIdempotencyKey) || null;
}

async function pollSupplierJob(options) {
  const startedAt = Date.now();
  let lastJob = null;

  while (Date.now() - startedAt <= DEFAULT_IMPORT_POLL_MS) {
    lastJob = await readSupplierJob(options);
    if (lastJob && !['pending', 'running'].includes(lastJob.status)) return lastJob;
    await sleep(750);
  }

  return lastJob;
}

async function runApprovedSyntheticSupplierImport({ suppliersUrl, suppliersToken, supplierId, importIdempotencyKey, sourceFingerprint }) {
  return requestJson('Suppliers approved synthetic import', `${suppliersUrl}/api/imports/run/${encodeURIComponent(supplierId)}`, {
    method: 'POST',
    headers: authHeaders(suppliersToken),
    body: JSON.stringify({
      triggerType: 'manual',
      idempotencyKey: importIdempotencyKey,
      sourceFingerprint,
      warehouseStockUpdateMode: 'apply_with_owner_approval',
      ownerApproval: 'explicit',
    }),
  });
}

const stages = [
  'Verify service health endpoints for Warehouse, Catalog, and Suppliers.',
  'Verify protected endpoint auth rejection without tokens where safe.',
  'Read or create approved synthetic Catalog product.',
  'Read or create approved own, supplier replenishment, and dropship Warehouse locations.',
  'Apply approved supplier replenishment and dropship stock reconciliation only when OWNER_APPROVAL=explicit and SMOKE_ALLOW_MUTATION=true.',
  'Read Warehouse topology, availability, and logistics for the product.',
  'Read Catalog availability, coverage, coverage audit, and FlipFlop projection.',
  'Assert local plus supplier replenishment and dropship origins, Warehouse-owned logistics routes and route legs, covered mixed_stock classification, and Warehouse stock authority.',
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
      'TRACE_RUN_SUPPLIERS_IMPORT=true',
      'TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE-',
      'TRACE_SUPPLIER_WAREHOUSE_ID=<supplier-replenishment-warehouse-id>',
      'TRACE_DROPSHIP_WAREHOUSE_ID=<supplier-dropship-warehouse-id>',
      'TRACE_SUPPLIER_STOCK_QTY=7',
      'TRACE_SUPPLIER_SKU=SUP-SKU-TRACE',
      'TRACE_CLEANUP_EVIDENCE=deferred:<ticket-or-runbook>',
      'TRACE_AUDIT_PAGE=1',
      'TRACE_AUDIT_LIMIT=100',
      'TRACE_SUPPLIER_ID',
      'TRACE_IMPORT_IDEMPOTENCY_KEY',
      'TRACE_EXPECT_SUPPLIERS_JOB=true',
      'TRACE_OWN_WAREHOUSE_ID',
      'SMOKE_FIXTURE_CHECK=true',
      'OWNER_APPROVAL=explicit',
      'SMOKE_ALLOW_MUTATION=true',
      'TRACE_IMPORT_POLL_MS=15000',
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
  const traceProductSkuPrefix = optionalEnv('TRACE_PRODUCT_SKU_PREFIX', 'CODEX-STOCK-TRACE-');
  const runSuppliersImport = optionalBoolean('TRACE_RUN_SUPPLIERS_IMPORT', approvedMutation);
  const expectSuppliersJob = optionalBoolean('TRACE_EXPECT_SUPPLIERS_JOB', approvedMutation);
  const supplierId = optionalEnv('TRACE_SUPPLIER_ID', '');
  const ownWarehouseId = optionalEnv('TRACE_OWN_WAREHOUSE_ID', '');
  const supplierWarehouseId = optionalEnv('TRACE_SUPPLIER_WAREHOUSE_ID', '');
  const dropshipWarehouseId = optionalEnv('TRACE_DROPSHIP_WAREHOUSE_ID', '');
  const supplierStockQty = optionalEnv('TRACE_SUPPLIER_STOCK_QTY', '7');
  const supplierSku = optionalEnv('TRACE_SUPPLIER_SKU', 'SUP-SKU-TRACE');
  const cleanupEvidence = optionalEnv('TRACE_CLEANUP_EVIDENCE', '');
  const importIdempotencyKey = optionalEnv('TRACE_IMPORT_IDEMPOTENCY_KEY', `manual:trace:${productId}`);
  const sourceFingerprint = `trace:${productId}:${supplierWarehouseId}:${dropshipWarehouseId}:${supplierStockQty}:${supplierSku}`;

  if (approvedMutation) {
    assert(isCompletedEvidenceText(cleanupEvidence), 'TRACE_CLEANUP_EVIDENCE must be completed and must not contain TODO or placeholder when approved mutation is enabled');
  }
  if (fixtureCheck) {
    assert(!approvedMutation, '--fixture-check must be read-only; unset OWNER_APPROVAL or SMOKE_ALLOW_MUTATION');
    assert(!runSuppliersImport, '--fixture-check must not run Suppliers import; unset TRACE_RUN_SUPPLIERS_IMPORT');
  }
  if (runSuppliersImport) {
    assert(approvedMutation, 'TRACE_RUN_SUPPLIERS_IMPORT requires OWNER_APPROVAL=explicit and SMOKE_ALLOW_MUTATION=true');
    assert(supplierId, 'TRACE_SUPPLIER_ID is required when TRACE_RUN_SUPPLIERS_IMPORT=true');
    assert(supplierWarehouseId, 'TRACE_SUPPLIER_WAREHOUSE_ID is required when TRACE_RUN_SUPPLIERS_IMPORT=true');
    assert(dropshipWarehouseId, 'TRACE_DROPSHIP_WAREHOUSE_ID is required when TRACE_RUN_SUPPLIERS_IMPORT=true');
    assert(Number.isInteger(Number(supplierStockQty)) && Number(supplierStockQty) > 0, 'TRACE_SUPPLIER_STOCK_QTY must be a positive integer');
  }
  if (expectSuppliersJob) {
    assert(supplierId, 'TRACE_SUPPLIER_ID is required when TRACE_EXPECT_SUPPLIERS_JOB=true');
    assert(importIdempotencyKey, 'TRACE_IMPORT_IDEMPOTENCY_KEY is required when TRACE_EXPECT_SUPPLIERS_JOB=true');
  }

  if (configOnly) {
    console.log(JSON.stringify({
      status: 'config-only',
      mutationEnabled: approvedMutation,
      supplierImport: {
        enabled: runSuppliersImport,
        supplierId,
        supplierWarehouseId,
        dropshipWarehouseId,
        sourceFingerprint,
      },
      suppliersJobExpected: expectSuppliersJob,
      cleanupEvidencePresent: Boolean(cleanupEvidence),
      traceProductSkuPrefix,
      urls: {
        warehouse: warehouseUrl,
        catalog: catalogUrl,
        suppliers: suppliersUrl,
      },
      tokens: {
        catalog: redact(catalogToken),
        warehouse: redact(warehouseToken),
        suppliers: redact(suppliersToken),
      },
    }, null, 2));
    return;
  }

  const health = await Promise.all([
    readHealth('warehouse', `${warehouseUrl}/api/health`),
    readHealth('catalog', `${catalogUrl}/health`),
    readHealth('suppliers', `${suppliersUrl}/api/health`),
  ]);
  assertHealth(health);

  if (runSuppliersImport) {
    await runApprovedSyntheticSupplierImport({ suppliersUrl, suppliersToken, supplierId, importIdempotencyKey, sourceFingerprint });
  }

  const auditQuery = new URLSearchParams({ page: auditPage, limit: auditLimit, isActive: 'true' });
  let supplierJob = null;

  if (expectSuppliersJob) {
    supplierJob = await pollSupplierJob({ suppliersUrl, suppliersToken, supplierId, importIdempotencyKey });
    assert(supplierJob, 'expected Suppliers import job evidence for TRACE_IMPORT_IDEMPOTENCY_KEY');
    assert(supplierJob.status === 'completed', 'expected Suppliers import job to complete before traceability assertions');
    assert(supplierJob.sourceFingerprint === sourceFingerprint, 'expected Suppliers job source fingerprint to match the approved trace import request');
    assert(supplierJob.warehouseStockUpdateAttempted === true, 'expected Suppliers job to record Warehouse stock update attempted');
    assert(supplierJob.warehouseStockUpdateApproved === true, 'expected Suppliers job to record approved Warehouse stock update');
    assert(supplierJob.catalogProductValidationStatus === 'passed', 'expected Suppliers job to record passed Catalog product validation');
    assert(Array.isArray(supplierJob.catalogProductIdsChecked) && supplierJob.catalogProductIdsChecked.includes(productId), 'expected Suppliers job to record checked Catalog product ID before Warehouse mutation');
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
  const catalogLogisticsOptions = catalogItem?.logistics?.options || [];
  const projectionLogisticsOptions = projectionItem?.availability?.logistics?.options || [];
  const catalogRouteTypes = catalogLogisticsOptions.map((option) => option.routeType);
  const projectionRouteTypes = projectionLogisticsOptions.map((option) => option.routeType);
  const warehouseTotalAvailable = Number(warehouseAvailability.data?.[0]?.totalAvailable ?? 0);
  const warehouseOriginAvailable = warehouseRows.reduce((sum, row) => sum + Number(row.available ?? 0), 0);
  const catalogAvailabilityTotal = Number(catalogItem?.totalAvailable ?? 0);
  const catalogCoverageTotal = Number(coverageItem?.totalAvailable ?? 0);
  const projectionStockQuantity = Number(projectionItem?.stockQuantity ?? 0);
  const projectionSellableRouteAvailable = sumTraceableReservableAvailability(projectionLogisticsOptions);

  assert(catalogProductData?.id === productId, 'expected Catalog product identity to match TRACE_PRODUCT_ID');
  assert(catalogProductData?.sku, 'expected Catalog product identity to include SKU');
  assert(catalogProductData.sku.startsWith(traceProductSkuPrefix), `expected Catalog product SKU to start with ${traceProductSkuPrefix}`);
  assert((topologyData?.groups?.own || []).length > 0, 'expected Warehouse topology to include own warehouses');
  assert((topologyData?.groups?.supplier || []).length > 0, 'expected Warehouse topology to include supplier replenishment warehouses');
  assert((topologyData?.groups?.dropship || []).length > 0, 'expected Warehouse topology to include supplier dropship warehouses');
  assert(warehouseRows.some((row) => row.warehouseType === 'own' && Number(row.available) > 0), 'expected own Warehouse stock row');
  assert(warehouseRows.some((row) => row.warehouseType === 'supplier' && row.supplierId && Number(row.available) > 0), 'expected supplier replenishment Warehouse stock row');
  assert(warehouseRows.some((row) => row.warehouseType === 'dropship' && row.supplierId && Number(row.available) > 0), 'expected supplier dropship Warehouse stock row');
  assertConfiguredWarehouseId('own', ownWarehouseId, warehouseRows, (row) => row.warehouseType === 'own' && Number(row.available) > 0);
  assertConfiguredWarehouseId('supplier replenishment', supplierWarehouseId, warehouseRows, (row) => row.warehouseType === 'supplier' && row.supplierId && Number(row.available) > 0);
  assertConfiguredWarehouseId('supplier dropship', dropshipWarehouseId, warehouseRows, (row) => row.warehouseType === 'dropship' && row.supplierId && Number(row.available) > 0);
  assertConfiguredSupplierOwnership("supplier replenishment", supplierId, supplierWarehouseId, warehouseRows);
  assertConfiguredSupplierOwnership("supplier dropship", supplierId, dropshipWarehouseId, warehouseRows);
  assert(logisticsOptions.some((option) => option.routeType === 'local_fulfillment'), 'expected local fulfillment route');
  assert(logisticsOptions.some((option) => option.routeType === 'supplier_replenishment'), 'expected supplier replenishment route');
  assert(logisticsOptions.some((option) => option.routeType === 'supplier_dropship'), 'expected supplier dropship route');
  assert(hasRequiredLogisticsLegs(logisticsOptions), 'expected Warehouse logistics legs to prove local fulfillment, supplier replenishment, and supplier dropship paths');
  assert(hasRequiredReservableRoutes(logisticsOptions), 'expected Warehouse logistics routes to be reservable with positive availability');
  assertConfiguredRoute("own", ownWarehouseId, "local_fulfillment", logisticsOptions);
  assertConfiguredRouteSupplierOwnership("supplier replenishment", supplierId, supplierWarehouseId, "supplier_replenishment", logisticsOptions);
  assertConfiguredRouteSupplierOwnership("supplier dropship", supplierId, dropshipWarehouseId, "supplier_dropship", logisticsOptions);
  assert(catalogItem?.source === 'warehouse', 'expected Catalog availability source warehouse');
  assert(catalogItem?.warehouses?.length >= 2, 'expected Catalog to forward origin rows');
  assert(catalogItem?.logistics?.options?.length >= 2, 'expected Catalog to forward logistics options');
  assert(catalogRouteTypes.includes('local_fulfillment'), 'expected Catalog availability to forward local fulfillment route');
  assert(catalogRouteTypes.includes('supplier_replenishment'), 'expected Catalog availability to forward supplier replenishment route');
  assert(catalogRouteTypes.includes('supplier_dropship'), 'expected Catalog availability to forward supplier dropship route');
  assert(hasRequiredLogisticsLegs(catalogLogisticsOptions), 'expected Catalog availability to forward local, supplier replenishment, and dropship logistics legs');
  assert(hasRequiredReservableRoutes(catalogLogisticsOptions), 'expected Catalog availability to forward reservable routes with positive availability');
  assertConfiguredRoute("Catalog forwarded own", ownWarehouseId, "local_fulfillment", catalogLogisticsOptions);
  assertConfiguredRouteSupplierOwnership("Catalog forwarded supplier replenishment", supplierId, supplierWarehouseId, "supplier_replenishment", catalogLogisticsOptions);
  assertConfiguredRouteSupplierOwnership("Catalog forwarded supplier dropship", supplierId, dropshipWarehouseId, "supplier_dropship", catalogLogisticsOptions);
  assert(coverageItem?.coverageStatus === 'covered', 'expected Catalog coverage status covered');
  assert(coverageItem?.stockOrigin === 'mixed_stock', 'expected Catalog coverage stockOrigin mixed_stock');
  assert(coverageAuditItem?.coverageStatus === 'covered', 'expected Catalog coverage audit to include covered product');
  assert(coverageAuditItem?.stockOrigin === 'mixed_stock', 'expected Catalog coverage audit stockOrigin mixed_stock');
  assert(projectionItem?.availability?.source === 'warehouse', 'expected FlipFlop projection availability source warehouse');
  assert(projectionItem?.availability?.logistics?.options?.length >= 2, 'expected FlipFlop projection logistics options');
  assert(projectionRouteTypes.includes('local_fulfillment'), 'expected FlipFlop projection to forward local fulfillment route');
  assert(projectionRouteTypes.includes('supplier_replenishment'), 'expected FlipFlop projection to forward supplier replenishment route');
  assert(projectionRouteTypes.includes('supplier_dropship'), 'expected FlipFlop projection to forward supplier dropship route');
  assert(hasRequiredLogisticsLegs(projectionLogisticsOptions), 'expected FlipFlop projection to forward local, supplier replenishment, and dropship logistics legs');
  assert(hasRequiredReservableRoutes(projectionLogisticsOptions), 'expected FlipFlop projection to forward reservable routes with positive availability');
  assertConfiguredRoute("FlipFlop forwarded own", ownWarehouseId, "local_fulfillment", projectionLogisticsOptions);
  assertConfiguredRouteSupplierOwnership("FlipFlop forwarded supplier replenishment", supplierId, supplierWarehouseId, "supplier_replenishment", projectionLogisticsOptions);
  assertConfiguredRouteSupplierOwnership("FlipFlop forwarded supplier dropship", supplierId, dropshipWarehouseId, "supplier_dropship", projectionLogisticsOptions);
  assert(warehouseTotalAvailable === warehouseOriginAvailable, 'expected Warehouse totalAvailable to equal summed Warehouse origin availability');
  assert(catalogAvailabilityTotal === warehouseTotalAvailable, 'expected Catalog availability totalAvailable to match Warehouse totalAvailable');
  assert(catalogCoverageTotal === warehouseTotalAvailable, 'expected Catalog coverage totalAvailable to match Warehouse totalAvailable');
  assert(projectionSellableRouteAvailable > 0, 'expected FlipFlop projection to expose positive sellable route availability');
  assert(projectionStockQuantity === projectionSellableRouteAvailable, 'expected FlipFlop stockQuantity to match traceable reservable route availability');

  console.log(JSON.stringify({
    status: fixtureCheck ? 'fixture-ready' : 'passed',
    fixtureCheck,
    mutationEnabled: approvedMutation,
    tokens: {
      catalog: redact(catalogToken),
      warehouse: redact(warehouseToken),
      suppliers: redact(suppliersToken),
    },
    health,
    productId,
    traceProductSkuPrefix,
    supplierImport: {
      triggered: runSuppliersImport,
      supplierId: supplierId || null,
      supplierWarehouseId: supplierWarehouseId || null,
      dropshipWarehouseId: dropshipWarehouseId || null,
      sourceFingerprint: runSuppliersImport ? sourceFingerprint : null,
    },
    cleanupEvidence: cleanupEvidence || null,
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
    logisticsLegs: summarizeLogisticsLegs(logisticsOptions),
    stockAuthority: {
      source: 'warehouse',
      warehouseTotalAvailable,
      warehouseOriginAvailable,
      catalogAvailabilityTotal,
      catalogCoverageTotal,
      projectionStockQuantity,
      projectionSellableRouteAvailable,
    },
    catalogAvailability: {
      source: catalogItem.source,
      warehouseCount: catalogItem.warehouses?.length || 0,
      logisticsOptionCount: catalogItem.logistics?.options?.length || 0,
      preferredRoute: catalogItem.logistics?.preferredRoute || null,
      routeTypes: catalogRouteTypes,
      routeLegs: summarizeLogisticsLegs(catalogLogisticsOptions),
      warehouseTypes: (catalogItem.warehouses || []).map((row) => row.warehouseType),
    },
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
      source: projectionItem.availability?.source,
      stockQuantity: projectionItem.stockQuantity,
      routeCount: projectionItem.availability?.logistics?.options?.length || 0,
      routeTypes: projectionRouteTypes,
      routeLegs: summarizeLogisticsLegs(projectionLogisticsOptions),
    },
  }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
});
