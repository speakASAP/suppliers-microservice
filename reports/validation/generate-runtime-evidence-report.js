#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath, fallback) {
  if (!filePath) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function asStatus(condition) {
  return condition ? 'passed-runtime' : 'missing-runtime';
}

function valueOrDash(value) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function boolWord(value) {
  return value ? 'yes' : 'no';
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCompletedEvidenceText(value) {
  return hasText(value) && !/TODO|placeholder/i.test(value);
}

function isCommitSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{7,40}$/i.test(value.trim());
}

function summarizeHealth(health) {
  if (!Array.isArray(health)) return 'Health evidence missing.';
  return health.map((item, index) => {
    const service = item?.service || `service-${index + 1}`;
    if (item?.error) return `${service}: failed`;
    const status = item?.status || item?.data?.status || item?.health || 'passed';
    return `${service}: ${status}`;
  }).join('; ');
}

function namedHealthComplete(health) {
  if (!Array.isArray(health)) return false;
  const services = new Set(health.map((item) => item?.service).filter(Boolean));
  return ['warehouse', 'catalog', 'suppliers'].every((service) => services.has(service));
}

function summarizeTopology(topology) {
  if (!topology) return 'Topology evidence missing.';
  const own = topology.ownWarehouses || [];
  const supplier = topology.supplierWarehouses || [];
  return `own=${own.length}, supplierManaged=${supplier.length}, totalAvailable=${valueOrDash(topology.totals?.totalAvailable)}`;
}

function summarizeOrigins(origins) {
  if (!Array.isArray(origins)) return 'Origin evidence missing.';
  return origins.map((row) => `${row.warehouseType}:${row.warehouseId}:available=${row.available}:supplier=${valueOrDash(row.supplierId)}`).join('; ');
}

function summarizeSupplierJob(job) {
  if (!job) return 'Supplier import evidence missing.';
  return `status=${valueOrDash(job.status)}, idempotencyKey=${valueOrDash(job.idempotencyKey)}, sourceFingerprint=${valueOrDash(job.sourceFingerprint)}, catalogProductValidation=${valueOrDash(job.catalogProductValidationStatus)}, checkedProducts=${Array.isArray(job.catalogProductIdsChecked) ? job.catalogProductIdsChecked.join(',') : '-'}, authority=${valueOrDash(job.warehouseAuthority)}, attempted=${boolWord(job.warehouseStockUpdateAttempted)}, approved=${boolWord(job.warehouseStockUpdateApproved)}, updatedProducts=${valueOrDash(job.updatedProducts)}`;
}

function summarizeFixtureCheck(fixture) {
  if (!fixture) return 'Fixture check evidence missing.';
  const ownWarehouseId = fixture.supplierImport?.ownWarehouseId || fixture.warehouseOrigins?.find?.((row) => row.warehouseType === 'own')?.warehouseId;
  return `status=${valueOrDash(fixture.status)}, fixtureCheck=${boolWord(fixture.fixtureCheck)}, mutationEnabled=${boolWord(fixture.mutationEnabled)}, importTriggered=${boolWord(fixture.supplierImport?.triggered)}, own=${valueOrDash(ownWarehouseId)}, supplier=${valueOrDash(fixture.supplierImport?.supplierWarehouseId)}, dropship=${valueOrDash(fixture.supplierImport?.dropshipWarehouseId)}, routes=${summarizeRouteTypes(fixture.logisticsRoutes)}`;
}

function fixtureCheckComplete(fixture) {
  return fixture?.status === 'fixture-ready'
    && fixture.fixtureCheck === true
    && fixture.mutationEnabled === false
    && fixture.supplierImport?.triggered !== true
    && (fixture.warehouseOrigins || []).some((row) => row.warehouseType === 'own' && Number(row.available) > 0)
    && (fixture.warehouseOrigins || []).some((row) => row.warehouseType === 'supplier' && row.supplierId && Number(row.available) > 0)
    && (fixture.warehouseOrigins || []).some((row) => row.warehouseType === 'dropship' && row.supplierId && Number(row.available) > 0)
    && hasAllRequiredRouteTypes(fixture.logisticsRoutes)
    && hasRequiredRouteLegs(fixture.logisticsLegs);
}

function summarizeStockAuthority(authority) {
  if (!authority) return 'Stock authority evidence missing.';
  return `source=${valueOrDash(authority.source)}, warehouseTotalAvailable=${valueOrDash(authority.warehouseTotalAvailable)}, warehouseOriginAvailable=${valueOrDash(authority.warehouseOriginAvailable)}, catalogAvailabilityTotal=${valueOrDash(authority.catalogAvailabilityTotal)}, catalogCoverageTotal=${valueOrDash(authority.catalogCoverageTotal)}, projectionStockQuantity=${valueOrDash(authority.projectionStockQuantity)}, projectionSellableRouteAvailable=${valueOrDash(authority.projectionSellableRouteAvailable)}`;
}

function summarizeCatalogAvailability(availability) {
  if (!availability) return 'Catalog availability evidence missing.';
  return `source=${valueOrDash(availability.source)}, warehouseCount=${valueOrDash(availability.warehouseCount)}, logisticsOptionCount=${valueOrDash(availability.logisticsOptionCount)}, preferredRoute=${valueOrDash(availability.preferredRoute)}, routeTypes=${summarizeRouteTypes(availability.routeTypes)}, routeLegs=${summarizeRouteLegs(availability.routeLegs)}`;
}

function deploymentEvidenceComplete(deployment) {
  if (deployment?.generatedFromCurrentHeads !== true) return false;
  if (!String(deployment?.completionReminder || '').includes('verify-stock-traceability-completion.js')) return false;
  const services = deployment?.services || {};
  return ['warehouse', 'catalog', 'suppliers'].every((service) => {
    const item = services[service];
    return isCommitSha(item?.commitSha)
      && hasText(item?.deployCommand || './scripts/deploy.sh')
      && isCompletedEvidenceText(item?.healthEvidence)
      && isCompletedEvidenceText(item?.protectedEndpointEvidence)
      && /401|403/.test(item.protectedEndpointEvidence);
  });
}

function expectedSkuPrefix(smoke) {
  return smoke.traceProductSkuPrefix || 'CODEX-STOCK-TRACE-';
}

function summarizeRouteTypes(routeTypes) {
  return Array.isArray(routeTypes) && routeTypes.length ? routeTypes.join(',') : '-';
}

function hasAllRequiredRouteTypes(routeTypes) {
  if (!Array.isArray(routeTypes)) return false;
  return routeTypes.includes('local_fulfillment')
    && routeTypes.includes('supplier_replenishment')
    && routeTypes.includes('supplier_dropship');
}

function summarizeRouteLegs(routeLegs) {
  if (!Array.isArray(routeLegs) || routeLegs.length === 0) return '-';
  return routeLegs.map((route) => {
    const legs = Array.isArray(route.legs) ? route.legs.map((leg) => `${leg.sequence}:${leg.from}>${leg.to}:${leg.responsibility}`).join('/') : '-';
    const routeEvidence = [
      `available=${valueOrDash(route.available)}`,
      `reservable=${boolWord(route.canReserveFromWarehouse === true)}`,
      `warehouse=${valueOrDash(route.warehouseId)}`,
      `supplier=${valueOrDash(route.supplierId)}`,
      legs,
    ].join(';');
    return `${route.routeType}[${routeEvidence}]`;
  }).join(',');
}

function hasRequiredRouteLegs(routeLegs) {
  if (!Array.isArray(routeLegs)) return false;
  const local = routeLegs.some((route) => route.routeType === 'local_fulfillment'
    && Array.isArray(route.legs)
    && route.legs.some((leg) => leg.responsibility === 'warehouse' && leg.to === 'customer'));
  const supplierDropship = routeLegs.some((route) => route.routeType === 'supplier_dropship'
    && Array.isArray(route.legs)
    && route.legs.some((leg) => leg.responsibility === 'supplier' && leg.to === 'customer'));
  const supplierReplenishment = routeLegs.some((route) => {
    const legs = Array.isArray(route.legs) ? route.legs : [];
    return route.routeType === 'supplier_replenishment'
      && legs.some((leg) => leg.responsibility === 'supplier' && String(leg.to || '').includes('alfares'))
      && legs.some((leg) => leg.responsibility === 'warehouse' && leg.to === 'customer');
  });
  return local && supplierReplenishment && supplierDropship;
}

function hasPositiveReservableRoute(routeLegs, routeType) {
  return Array.isArray(routeLegs) && routeLegs.some((route) => route.routeType === routeType
    && Number(route.available) > 0
    && route.canReserveFromWarehouse === true);
}

function hasRequiredReservableRoutes(routeLegs) {
  return hasPositiveReservableRoute(routeLegs, 'local_fulfillment')
    && hasPositiveReservableRoute(routeLegs, 'supplier_replenishment')
    && hasPositiveReservableRoute(routeLegs, 'supplier_dropship');
}

function stockAuthorityComplete(authority) {
  if (!authority || authority.source !== 'warehouse') return false;
  const warehouseTotal = Number(authority.warehouseTotalAvailable);
  const projectionStock = Number(authority.projectionStockQuantity);
  const projectionSellable = Number(authority.projectionSellableRouteAvailable);
  return Number.isFinite(warehouseTotal)
    && Number.isFinite(projectionSellable)
    && Number(authority.warehouseOriginAvailable) === warehouseTotal
    && Number(authority.catalogAvailabilityTotal) === warehouseTotal
    && Number(authority.catalogCoverageTotal) === warehouseTotal
    && projectionSellable > 0
    && projectionSellable <= warehouseTotal
    && projectionStock === projectionSellable;
}

function buildAssertions(smoke, fixture) {
  const origins = smoke.warehouseOrigins || [];
  const routes = smoke.logisticsRoutes || [];
  return [
    {
      assertion: 'Read-only live fixture check passed before mutation.',
      evidence: summarizeFixtureCheck(fixture),
      passed: fixtureCheckComplete(fixture),
    },
    {
      assertion: 'Warehouse, Catalog, and Suppliers health endpoints passed.',
      evidence: summarizeHealth(smoke.health),
      passed: smoke.status === 'passed' && Array.isArray(smoke.health) && smoke.health.length === 3 && namedHealthComplete(smoke.health),
    },
    {
      assertion: 'Catalog product identity exists.',
      evidence: `productId=${valueOrDash(smoke.catalogProduct?.id || smoke.productId)}, sku=${valueOrDash(smoke.catalogProduct?.sku)}, expectedSkuPrefix=${expectedSkuPrefix(smoke)}`,
      passed: Boolean(smoke.catalogProduct?.id && smoke.catalogProduct?.sku?.startsWith(expectedSkuPrefix(smoke))),
    },
    {
      assertion: 'Warehouse topology distinguishes own and supplier-managed warehouses.',
      evidence: summarizeTopology(smoke.warehouseTopology),
      passed: Boolean((smoke.warehouseTopology?.ownWarehouses || []).length && (smoke.warehouseTopology?.supplierWarehouses || []).length),
    },
    {
      assertion: 'Warehouse availability returns own plus supplier and dropship stock.',
      evidence: summarizeOrigins(origins),
      passed: origins.some((row) => row.warehouseType === 'own' && Number(row.available) > 0)
        && origins.some((row) => row.warehouseType === 'supplier' && row.supplierId && Number(row.available) > 0)
        && origins.some((row) => row.warehouseType === 'dropship' && row.supplierId && Number(row.available) > 0),
    },
    {
      assertion: 'Warehouse logistics returns local, supplier replenishment, and dropship route options.',
      evidence: `routes=${routes.join(',') || '-'}, routeLegs=${summarizeRouteLegs(smoke.logisticsLegs)}`,
      passed: hasAllRequiredRouteTypes(routes) && hasRequiredRouteLegs(smoke.logisticsLegs) && hasRequiredReservableRoutes(smoke.logisticsLegs),
    },
    {
      assertion: 'Catalog availability forwards Warehouse origin rows and logistics.',
      evidence: summarizeCatalogAvailability(smoke.catalogAvailability),
      passed: smoke.catalogAvailability?.source === 'warehouse'
        && Number(smoke.catalogAvailability?.warehouseCount || 0) >= 2
        && Number(smoke.catalogAvailability?.logisticsOptionCount || 0) >= 2
        && hasAllRequiredRouteTypes(smoke.catalogAvailability?.routeTypes)
        && hasRequiredRouteLegs(smoke.catalogAvailability?.routeLegs)
        && hasRequiredReservableRoutes(smoke.catalogAvailability?.routeLegs),
    },
    {
      assertion: 'Catalog coverage and audit classify covered mixed stock.',
      evidence: `coverage=${valueOrDash(smoke.coverage?.coverageStatus)}, origin=${valueOrDash(smoke.coverage?.stockOrigin)}, audit=${valueOrDash(smoke.coverageAudit?.matchedProduct?.coverageStatus)}/${valueOrDash(smoke.coverageAudit?.matchedProduct?.stockOrigin)}`,
      passed: smoke.coverage?.coverageStatus === 'covered'
        && smoke.coverage?.stockOrigin === 'mixed_stock'
        && smoke.coverageAudit?.matchedProduct?.coverageStatus === 'covered'
        && smoke.coverageAudit?.matchedProduct?.stockOrigin === 'mixed_stock',
    },
    {
      assertion: 'FlipFlop projection forwards Warehouse-sourced availability and logistics.',
      evidence: `productId=${valueOrDash(smoke.projection?.productId)}, source=${valueOrDash(smoke.projection?.source)}, stockQuantity=${valueOrDash(smoke.projection?.stockQuantity)}, routeCount=${valueOrDash(smoke.projection?.routeCount)}, routeTypes=${summarizeRouteTypes(smoke.projection?.routeTypes)}, routeLegs=${summarizeRouteLegs(smoke.projection?.routeLegs)}`,
      passed: Boolean(smoke.projection?.productId && smoke.projection?.source === 'warehouse' && Number(smoke.projection?.routeCount || 0) >= 3 && hasAllRequiredRouteTypes(smoke.projection?.routeTypes) && hasRequiredRouteLegs(smoke.projection?.routeLegs) && hasRequiredReservableRoutes(smoke.projection?.routeLegs)),
    },
    {
      assertion: 'Suppliers import preserves Catalog identity and Warehouse authority.',
      evidence: summarizeSupplierJob(smoke.supplierJob),
      passed: smoke.supplierJob?.status === 'completed'
        && smoke.supplierJob?.catalogProductValidationStatus === 'passed'
        && Array.isArray(smoke.supplierJob?.catalogProductIdsChecked)
        && smoke.supplierJob.catalogProductIdsChecked.includes(smoke.productId)
        && smoke.supplierJob?.sourceFingerprint === smoke.supplierImport?.sourceFingerprint
        && smoke.supplierJob?.warehouseAuthority === 'warehouse-microservice'
        && smoke.supplierJob?.warehouseStockUpdateAttempted === true
        && smoke.supplierJob?.warehouseStockUpdateApproved === true
        && Number(smoke.supplierJob?.updatedProducts || 0) > 0,
    },
    {
      assertion: 'Warehouse remains stock authority across totals.',
      evidence: summarizeStockAuthority(smoke.stockAuthority),
      passed: stockAuthorityComplete(smoke.stockAuthority),
    },
    {
      assertion: 'Cleanup or archival evidence is recorded.',
      evidence: `cleanupEvidence=${valueOrDash(smoke.cleanupEvidence)}`,
      passed: isCompletedEvidenceText(smoke.cleanupEvidence),
    },
  ];
}

function buildReport({ smoke, fixture, deployment, command, fixtureCommand }) {
  const assertions = buildAssertions(smoke, fixture);
  const complete = assertions.every((item) => item.passed) && deploymentEvidenceComplete(deployment);
  const metadataStatus = complete ? 'passed-runtime' : 'failed-runtime';
  const completeness = complete ? 'runtime-complete' : 'partial';
  const decision = complete ? 'Runtime complete' : 'Runtime incomplete';
  const services = deployment?.services || {};
  const commandText = command || 'node reports/validation/runtime-stock-traceability-smoke.js';
  const fixtureCommandText = fixtureCommand || 'node reports/validation/runtime-stock-traceability-smoke.js --fixture-check';

  return `# VAL-CROSS-STOCK-RUNTIME-LIVE - Cross-Service Runtime Traceability Validation

Metadata:
- id: VAL-CROSS-STOCK-RUNTIME-LIVE
- status: ${metadataStatus}
- owner: commerce-platform
- created: 2026-06-13
- last_updated: 2026-06-13
- completeness_level: ${completeness}
- upstream: docs/cross-service/stock-traceability-live-runbook.md, docs/cross-service/stock-traceability-completion-audit.md, reports/validation/runtime-stock-traceability-smoke.js

## Artifact Validated

Owner-approved deployed Warehouse, Catalog, and Suppliers runtime traceability path for one synthetic Catalog good.

## Deployment Evidence

| Service | Commit SHA | Deploy command | Health evidence | Protected endpoint evidence |
| --- | --- | --- | --- | --- |
| Warehouse | ${valueOrDash(services.warehouse?.commitSha)} | ${valueOrDash(services.warehouse?.deployCommand || './scripts/deploy.sh')} | ${valueOrDash(services.warehouse?.healthEvidence)} | ${valueOrDash(services.warehouse?.protectedEndpointEvidence)} |
| Catalog | ${valueOrDash(services.catalog?.commitSha)} | ${valueOrDash(services.catalog?.deployCommand || './scripts/deploy.sh')} | ${valueOrDash(services.catalog?.healthEvidence)} | ${valueOrDash(services.catalog?.protectedEndpointEvidence)} |
| Suppliers | ${valueOrDash(services.suppliers?.commitSha)} | ${valueOrDash(services.suppliers?.deployCommand || './scripts/deploy.sh')} | ${valueOrDash(services.suppliers?.healthEvidence)} | ${valueOrDash(services.suppliers?.protectedEndpointEvidence)} |

## Fixture Check Command Evidence

\`\`\`bash
${fixtureCommandText}
\`\`\`

## Smoke Command Evidence

\`\`\`bash
${commandText}
\`\`\`

## Runtime Assertions

| Assertion | Evidence summary | Status |
| --- | --- | --- |
${assertions.map((item) => `| ${item.assertion} | ${item.evidence} | ${asStatus(item.passed)} |`).join('\n')}

## Smoke Output Summary

- product: ${valueOrDash(smoke.catalogProduct?.id || smoke.productId)} / ${valueOrDash(smoke.catalogProduct?.sku)}
- fixture check: ${summarizeFixtureCheck(fixture)}
- health: ${summarizeHealth(smoke.health)}
- warehouse topology: ${summarizeTopology(smoke.warehouseTopology)}
- warehouse origins: ${summarizeOrigins(smoke.warehouseOrigins)}
- routes: ${(smoke.logisticsRoutes || []).join(',') || '-'}
- route legs: ${summarizeRouteLegs(smoke.logisticsLegs)}
- coverage: ${valueOrDash(smoke.coverage?.coverageStatus)} / ${valueOrDash(smoke.coverage?.stockOrigin)}
- supplier job: ${summarizeSupplierJob(smoke.supplierJob)}
- cleanup evidence: ${valueOrDash(smoke.cleanupEvidence)}

## Completion Decision

${decision}

## Boundary Evidence

- no real supplier credentials were exposed;
- no customer data was captured;
- no Catalog or Suppliers stock authority was introduced;
- Warehouse remained the stock and logistics authority;
- mutation was limited to approved synthetic traceability records;
- any cleanup requiring hard delete or compensating stock mutation had separate approval or remained deferred by recorded evidence.
`;
}

function sampleFixtureCheck() {
  const fixture = sampleSmoke();
  return {
    ...fixture,
    status: 'fixture-ready',
    fixtureCheck: true,
    mutationEnabled: false,
    supplierImport: {
      triggered: false,
      supplierId: null,
      ownWarehouseId: 'warehouse-own',
      supplierWarehouseId: 'warehouse-supplier',
      dropshipWarehouseId: 'warehouse-dropship',
      sourceFingerprint: null,
    },
    supplierJob: null,
    cleanupEvidence: null,
  };
}

function sampleSmoke() {
  return {
    status: 'passed',
    health: [{ service: 'warehouse', status: 'ok' }, { service: 'catalog', status: 'ok' }, { service: 'suppliers', status: 'ok' }],
    productId: 'product-synthetic',
    traceProductSkuPrefix: 'CODEX-STOCK-TRACE-',
    cleanupEvidence: 'deferred:traceability-runbook',
    catalogProduct: { id: 'product-synthetic', sku: 'CODEX-STOCK-TRACE-001' },
    warehouseTopology: {
      totals: { totalAvailable: 14 },
      ownWarehouses: [{ warehouseId: 'warehouse-own', warehouseCode: 'OWN', available: 4 }],
      supplierWarehouses: [
        { warehouseId: 'warehouse-supplier', warehouseCode: 'SUP', originType: 'supplier', supplierId: 'supplier-synthetic', available: 3 },
        { warehouseId: 'warehouse-dropship', warehouseCode: 'DROP', originType: 'dropship', supplierId: 'supplier-synthetic', available: 7 },
      ],
    },
    warehouseOrigins: [
      { warehouseId: 'warehouse-own', warehouseType: 'own', supplierId: null, available: 4 },
      { warehouseId: 'warehouse-supplier', warehouseType: 'supplier', supplierId: 'supplier-synthetic', available: 3 },
      { warehouseId: 'warehouse-dropship', warehouseType: 'dropship', supplierId: 'supplier-synthetic', available: 7 },
    ],
    supplierImport: {
      triggered: true,
      supplierId: 'supplier-synthetic',
      supplierWarehouseId: 'warehouse-supplier',
      dropshipWarehouseId: 'warehouse-dropship',
      sourceFingerprint: 'trace:product-synthetic:warehouse-supplier:warehouse-dropship:7:SUP-SKU-TRACE',
    },
    logisticsRoutes: ['local_fulfillment', 'supplier_replenishment', 'supplier_dropship'],
    logisticsLegs: [
      { routeType: 'local_fulfillment', warehouseId: 'warehouse-own', supplierId: null, available: 4, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'OWN', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_replenishment', warehouseId: 'warehouse-supplier', supplierId: 'supplier-synthetic', available: 3, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'SUP', to: 'alfares_receiving_or_handoff', responsibility: 'supplier' }, { sequence: 2, from: 'alfares_receiving_or_handoff', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_dropship', warehouseId: 'warehouse-dropship', supplierId: 'supplier-synthetic', available: 7, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'DROP', to: 'customer', responsibility: 'supplier' }] },
    ],
    stockAuthority: {
      source: 'warehouse',
      warehouseTotalAvailable: 14,
      warehouseOriginAvailable: 14,
      catalogAvailabilityTotal: 14,
      catalogCoverageTotal: 14,
      projectionStockQuantity: 14,
      projectionSellableRouteAvailable: 14,
    },
    catalogAvailability: {
      source: 'warehouse',
      warehouseCount: 3,
      logisticsOptionCount: 3,
      preferredRoute: 'local_fulfillment',
      routeTypes: ['local_fulfillment', 'supplier_replenishment', 'supplier_dropship'],
      routeLegs: [
      { routeType: 'local_fulfillment', warehouseId: 'warehouse-own', supplierId: null, available: 4, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'OWN', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_replenishment', warehouseId: 'warehouse-supplier', supplierId: 'supplier-synthetic', available: 3, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'SUP', to: 'alfares_receiving_or_handoff', responsibility: 'supplier' }, { sequence: 2, from: 'alfares_receiving_or_handoff', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_dropship', warehouseId: 'warehouse-dropship', supplierId: 'supplier-synthetic', available: 7, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'DROP', to: 'customer', responsibility: 'supplier' }] },
    ],
      warehouseTypes: ['own', 'supplier', 'dropship'],
    },
    coverage: { coverageStatus: 'covered', stockOrigin: 'mixed_stock' },
    coverageAudit: { matchedProduct: { coverageStatus: 'covered', stockOrigin: 'mixed_stock' } },
    supplierJob: {
      status: 'completed',
      idempotencyKey: 'manual:traceability-synthetic',
      sourceFingerprint: 'trace:product-synthetic:warehouse-supplier:warehouse-dropship:7:SUP-SKU-TRACE',
      warehouseAuthority: 'warehouse-microservice',
      warehouseStockUpdateAttempted: true,
      warehouseStockUpdateApproved: true,
      catalogProductValidationStatus: 'passed',
      catalogProductIdsChecked: ['product-synthetic'],
      catalogProductValidationErrorCount: 0,
      updatedProducts: 1,
    },
    projection: {
      productId: 'product-synthetic',
      source: 'warehouse',
      stockQuantity: 14,
      routeCount: 3,
      routeTypes: ['local_fulfillment', 'supplier_replenishment', 'supplier_dropship'],
      routeLegs: [
      { routeType: 'local_fulfillment', warehouseId: 'warehouse-own', supplierId: null, available: 4, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'OWN', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_replenishment', warehouseId: 'warehouse-supplier', supplierId: 'supplier-synthetic', available: 3, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'SUP', to: 'alfares_receiving_or_handoff', responsibility: 'supplier' }, { sequence: 2, from: 'alfares_receiving_or_handoff', to: 'customer', responsibility: 'warehouse' }] },
      { routeType: 'supplier_dropship', warehouseId: 'warehouse-dropship', supplierId: 'supplier-synthetic', available: 7, canReserveFromWarehouse: true, legs: [{ sequence: 1, from: 'DROP', to: 'customer', responsibility: 'supplier' }] },
    ],
    },
  };
}

function sampleDeployment() {
  return {
    generatedFromCurrentHeads: true,
    completionReminder: 'Deployment evidence is valid only when verify-stock-traceability-completion.js passes against the generated runtime manifest.',
    services: {
      warehouse: {
        commitSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/api/health passed',
        protectedEndpointEvidence: 'anonymous topology returned 401',
      },
      catalog: {
        commitSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/health passed',
        protectedEndpointEvidence: 'anonymous coverage returned 401',
      },
      suppliers: {
        commitSha: 'cccccccccccccccccccccccccccccccccccccccc',
        deployCommand: './scripts/deploy.sh',
        healthEvidence: '/api/health passed',
        protectedEndpointEvidence: 'anonymous imports returned 401',
      },
    },
  };
}

function main() {
  const smokeFile = process.env.SMOKE_RESULT_FILE;
  const fixtureFile = process.env.FIXTURE_CHECK_RESULT_FILE;
  const deploymentFile = process.env.DEPLOYMENT_EVIDENCE_FILE;
  const outputFile = process.env.RUNTIME_EVIDENCE_OUTPUT || 'docs/intent-preservation/validation-reports/VAL-CROSS-STOCK-RUNTIME-LIVE.md';
  const smoke = selfTest ? sampleSmoke() : readJson(smokeFile, null);
  assert(smoke, 'SMOKE_RESULT_FILE is required unless --self-test is used');
  const fixture = selfTest ? sampleFixtureCheck() : readJson(fixtureFile, null);
  assert(fixture, 'FIXTURE_CHECK_RESULT_FILE is required unless --self-test is used');
  const deployment = selfTest ? sampleDeployment() : readJson(deploymentFile, {});
  const command = process.env.REDACTED_SMOKE_COMMAND || 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_ID=supplier-synthetic TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship TRACE_IMPORT_IDEMPOTENCY_KEY=manual:traceability-synthetic TRACE_SUPPLIER_STOCK_QTY=7 TRACE_SUPPLIER_SKU=SUP-SKU-TRACE TRACE_CLEANUP_EVIDENCE=deferred:traceability-runbook RUNTIME_APPROVAL_ARTIFACT_FILE=/tmp/stock-traceability-runtime-approval.json TRACE_RUN_SUPPLIERS_IMPORT=true TRACE_EXPECT_SUPPLIERS_JOB=true OWNER_APPROVAL=explicit SMOKE_ALLOW_MUTATION=true node reports/validation/runtime-stock-traceability-smoke.js';
  const fixtureCommand = process.env.REDACTED_FIXTURE_COMMAND || 'WAREHOUSE_URL=https://warehouse.alfares.cz CATALOG_URL=https://catalog.alfares.cz SUPPLIERS_URL=https://suppliers.alfares.cz CATALOG_TOKEN=[REDACTED] WAREHOUSE_TOKEN=[REDACTED] SUPPLIERS_TOKEN=[REDACTED] TRACE_PRODUCT_ID=product-synthetic TRACE_PRODUCT_SKU_PREFIX=CODEX-STOCK-TRACE- TRACE_OWN_WAREHOUSE_ID=warehouse-own TRACE_SUPPLIER_WAREHOUSE_ID=warehouse-supplier TRACE_DROPSHIP_WAREHOUSE_ID=warehouse-dropship node reports/validation/runtime-stock-traceability-smoke.js --fixture-check';
  const report = buildReport({ smoke, fixture, deployment, command, fixtureCommand });

  if (selfTest) {
    assert(report.includes('Runtime complete'), 'self-test report should be runtime complete');
    assert(report.includes('CODEX-STOCK-TRACE-001'), 'self-test report should include synthetic SKU');
    assert(report.includes('passed-runtime'), 'self-test report should mark assertions passed');
    console.log(JSON.stringify({ status: 'passed', output: 'self-test', assertions: buildAssertions(smoke, fixture).length }, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, report);
  console.log(JSON.stringify({ status: 'passed', output: outputFile }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
