#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const args = new Set(process.argv.slice(2));
const selfTest = args.has('--self-test');
const root = process.env.CROSS_SERVICE_ROOT || '/home/ssf/Documents/Github';
const outputFile = process.env.RUNTIME_HANDOFF_OUTPUT || '/tmp/stock-traceability-runtime-handoff.md';
const services = {
  warehouse: 'warehouse-microservice',
  catalog: 'catalog-microservice',
  suppliers: 'suppliers-microservice',
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function git(repo, gitArgs) {
  if (selfTest && gitArgs[0] === 'rev-parse' && gitArgs[1] === 'HEAD') return `${repo.slice(0, 3)}`.padEnd(40, '0');
  if (selfTest && gitArgs[0] === 'rev-parse' && gitArgs[1] === '--abbrev-ref') return 'self-test-branch';
  if (selfTest && gitArgs[0] === 'status') return '';
  return execFileSync('git', gitArgs, { cwd: path.join(root, repo), encoding: 'utf8' }).trim();
}

function runJson(commandArgs) {
  if (selfTest) {
    return {
      status: 'passed',
      liveRuntimeReport: { status: 'not-passed-runtime' },
      completionGate: { status: 'incomplete', result: { reason: 'self-test incomplete' } },
    };
  }
  const result = spawnSync(process.execPath, commandArgs, { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${commandArgs.join(' ')} failed: ${result.stdout}${result.stderr}`.trim());
  return JSON.parse(result.stdout);
}

function formatCompletionReason(reason) {
  if (!reason) return "-";
  const oneLine = String(reason).replace(/\s+/g, " ").trim();
  return oneLine.length > 500 ? `${oneLine.slice(0, 497)}...` : oneLine;
}

function serviceRows() {
  return Object.entries(services).map(([name, repo]) => {
    const status = git(repo, ['status', '--short']);
    return {
      name,
      repo,
      branch: git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']),
      head: git(repo, ['rev-parse', 'HEAD']),
      dirtyLines: status ? status.split('\n').length : 0,
    };
  });
}

function assertCleanRows(rows) {
  const dirty = rows.filter((row) => row.dirtyLines !== 0);
  assert(dirty.length === 0, `runtime handoff requires clean Warehouse, Catalog, and Suppliers worktrees; dirty services: ${dirty.map((row) => row.repo).join(', ')}`);
}

function render(rows, preflight) {
  const table = rows.map((row) => `| ${row.name} | ${row.repo} | ${row.branch} | ${row.head} | ${row.dirtyLines} |`).join('\n');
  return `# Stock Traceability Runtime Handoff

Metadata:
- id: STOCK-TRACEABILITY-RUNTIME-HANDOFF
- status: ready-for-owner-approval
- generatedAt: ${new Date().toISOString()}
- preflightStatus: ${preflight.status || 'unknown'}
- liveRuntimeReport: ${preflight.liveRuntimeReport?.status || 'unknown'}
- completionGate: ${preflight.completionGate?.status || 'unknown'}
- completionReason: ${formatCompletionReason(preflight.completionGate?.result?.reason)}

## Source Snapshot

| Service | Repository | Branch | HEAD | Dirty lines |
| --- | --- | --- | --- | --- |
${table}

## Approval Boundary

Do not deploy, create runtime records, or run the approved supplier import unless the owner explicitly approves deployment, synthetic traceability records, and one Warehouse-mutating Suppliers synthetic import in the active session.

Runtime handoff requires clean Warehouse, Catalog, and Suppliers worktrees. If any source snapshot has dirty lines, commit or remove that source state and regenerate this handoff before approval.

## Required Operator Inputs

- TRACE_PRODUCT_ID with CODEX-STOCK-TRACE- SKU prefix
- TRACE_SUPPLIER_ID using supplier code synthetic-trace
- TRACE_OWN_WAREHOUSE_ID
- TRACE_SUPPLIER_WAREHOUSE_ID linked to TRACE_SUPPLIER_ID
- TRACE_DROPSHIP_WAREHOUSE_ID linked to TRACE_SUPPLIER_ID
- TRACE_IMPORT_IDEMPOTENCY_KEY
- TRACE_CLEANUP_EVIDENCE
- DEPLOYMENT_EVIDENCE_FILE pointing to completed deployment evidence JSON
- CATALOG_TOKEN, WAREHOUSE_TOKEN, SUPPLIERS_TOKEN kept only in shell environment

## Command Order

1. Run \`node reports/validation/cross-service-preflight-check.js\` and confirm source checks pass and completionGate is incomplete before deployment.
2. Generate deployment evidence skeleton with \`DEPLOYMENT_EVIDENCE_TEMPLATE_OUTPUT=/tmp/stock-traceability-deployment-evidence.template.json node reports/validation/create-deployment-evidence-template.js\`.
3. Deploy Warehouse first: \`ssh alfares 'cd /home/ssf/Documents/Github/warehouse-microservice && ./scripts/deploy.sh'\`.
4. Deploy Catalog second: \`ssh alfares 'cd /home/ssf/Documents/Github/catalog-microservice && ./scripts/deploy.sh'\`.
5. Deploy Suppliers third: \`ssh alfares 'cd /home/ssf/Documents/Github/suppliers-microservice && ./scripts/deploy.sh'\`.
6. Replace deployment evidence TODO fields with completed health and anonymous protected-endpoint 401/403 evidence for Warehouse, Catalog, and Suppliers.
7. Run \`node reports/validation/run-runtime-evidence-flow.js --config-only\` with RUN_APPROVED_RUNTIME_SMOKE=true, OWNER_APPROVAL=explicit, SMOKE_ALLOW_MUTATION=true, cleanup evidence, and the completed deployment evidence file.
8. Run the guarded evidence flow without --config-only to capture fixture JSON, approved smoke JSON, final report, manifest, and verified bundle.
9. Confirm the bundle verifier proves the same TRACE_SUPPLIER_ID owns the supplier replenishment and dropship warehouse origins and route options in fixture and smoke evidence.
10. Run the final verification commands below and require status complete before claiming the goal is done.

## Final Verification Commands

- \`node reports/validation/verify-runtime-evidence-report.js\`
- \`node reports/validation/verify-runtime-evidence-manifest.js <manifest-file>\`
- \`node reports/validation/verify-runtime-evidence-bundle.js <manifest-file> <report-file>\`
- \`node reports/validation/verify-stock-traceability-completion.js <report-file> <manifest-file>\`

## Non-Completion Reminder

A deployment alone is not completion. A source-only synthetic check is not completion. The goal is complete only after the final report, manifest, and bundle verifier prove Warehouse-owned local, supplier replenishment, dropship stock, supplier identity ownership, and logistics route legs through Catalog and Suppliers.
`;
}

function assertSelfTestContent(markdown) {
  const required = [
    'STOCK-TRACEABILITY-RUNTIME-HANDOFF',
    'completionGate',
    'runtime handoff requires clean Warehouse, Catalog, and Suppliers worktrees',
    'TRACE_SUPPLIER_WAREHOUSE_ID linked to TRACE_SUPPLIER_ID',
    'DEPLOYMENT_EVIDENCE_FILE',
    'Deploy Warehouse first',
    'RUN_APPROVED_RUNTIME_SMOKE=true',
    'verify-runtime-evidence-report.js',
    'verify-runtime-evidence-manifest.js <manifest-file>',
    'verify-runtime-evidence-bundle.js <manifest-file> <report-file>',
    'same TRACE_SUPPLIER_ID owns the supplier replenishment and dropship warehouse origins and route options',
    'verify-stock-traceability-completion.js <report-file> <manifest-file>',
  ];
  const missing = required.filter((pattern) => !markdown.includes(pattern));
  assert(missing.length === 0, `handoff missing required content: ${missing.join(', ')}`);
  assert(!/catalog-token-synthetic|warehouse-token-synthetic|suppliers-token-synthetic|Bearer\s+/i.test(markdown), 'handoff must not render token values');
}

try {
  const rows = serviceRows();
  const preflight = runJson(['reports/validation/cross-service-preflight-check.js']);
  assertCleanRows(rows);
  const markdown = render(rows, preflight);
  assertSelfTestContent(markdown);
  if (selfTest) {
    console.log(JSON.stringify({ status: 'passed', services: rows.length, completionGate: preflight.completionGate?.status }, null, 2));
  } else {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, markdown);
    console.log(JSON.stringify({ status: 'written', outputFile, services: rows.length, completionGate: preflight.completionGate?.status }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'failed', error: error.message }, null, 2));
  process.exit(1);
}
