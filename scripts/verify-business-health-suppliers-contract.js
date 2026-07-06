#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const handoffPath = path.join(root, "docs/orchestrator/2026-07-06-suppliers-business-health-handoff.md");
const text = fs.readFileSync(handoffPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredSnippets = [
  "## Intent Preservation Chain",
  "Vision:",
  "Goal Impact:",
  "System:",
  "Feature:",
  "Task:",
  "Execution Plan:",
  "Coding Prompt:",
  "Code:",
  "Validation:",
  "## Evidence Envelope",
  "## Existing Synthetic Runtime Proof",
  "## Missing Real Supplier Procurement Facts",
  "## Scheduled Monitor Consumption Rules",
  "## Parallel Execution Plan",
  "## Validation",
  "reports/validation/synthetic-stock-traceability-check.js",
  "reports/validation/runtime-stock-traceability-smoke.js",
  "reports/validation/verify-stock-traceability-completion.js",
  "/tmp/stock-traceability-runtime-20260624-003",
  "manual:traceability-20260624-003",
  "passed-synthetic-runtime",
  "blocked-real-supplier-facts",
  "blocked-approval",
];

for (const snippet of requiredSnippets) {
  assert(text.includes(snippet), `missing required snippet: ${snippet}`);
}

const missingMarkers = text.match(/\[MISSING: [^\]]+\]/g) || [];
assert(missingMarkers.length >= 10, "expected at least 10 explicit [MISSING: ...] markers");

const forbiddenPatterns = [
  /Authorization:\s*Bearer\s+(?!\[REDACTED\])/i,
  /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_./+=:-]{12,}/i,
  /password\s*[:=]\s*["']?[^"'\s]{8,}/i,
  /private[_-]?key/i,
  /BEGIN (RSA |OPENSSH |EC |)PRIVATE KEY/i,
  /SMOKE_ALLOW_MUTATION=true(?!`)/,
  /OWNER_APPROVAL=explicit(?!`)/,
];

for (const pattern of forbiddenPatterns) {
  assert(!pattern.test(text), `forbidden unsafe evidence pattern matched: ${pattern}`);
}

const requiredForbiddenActions = [
  "no runtime mutation",
  "live supplier imports",
  "Catalog writes",
  "Warehouse stock mutations",
  "Kubernetes changes",
  "deploys",
];

for (const marker of requiredForbiddenActions) {
  assert(text.toLowerCase().includes(marker.toLowerCase()), `missing forbidden-action boundary: ${marker}`);
}

console.log(JSON.stringify({
  status: "passed",
  file: "docs/orchestrator/2026-07-06-suppliers-business-health-handoff.md",
  missingMarkers: missingMarkers.length,
  checkedSnippets: requiredSnippets.length,
}, null, 2));
