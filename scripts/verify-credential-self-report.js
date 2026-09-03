#!/usr/bin/env node
/**
 * Verifies the credential self-reporter wiring for this repo.
 *
 * Two things are checked, and the second is the one that matters:
 *
 *   1. The classification rule behaves per the contract. The shared module has
 *      its own tests; this re-asserts the three-way rule at the point of use,
 *      because collapsing `indeterminate` into `rejected` is the single failure
 *      that would make Phase 2 fire an alert for a receiver outage.
 *
 *   2. The vendored module is present in `dist/`. The nest-cli asset entry is
 *      easy to omit and nothing catches it: a source-resolving test suite passes
 *      either way, and the failure appears only as MODULE_NOT_FOUND in a running
 *      pod. So this requires the BUILT file, not the source one.
 *
 * Contract: monitoring-microservice/docs/CREDENTIAL_SELF_REPORT_CONTRACT.md
 * Plan:     auth-microservice/docs/SERVICE_CREDENTIAL_PROBER_PLAN.md (Task A)
 *
 * Usage: node scripts/verify-credential-self-report.js
 *        (run after `npm run build` for the dist check to be meaningful)
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const failures = [];

function check(name, fn) {
  try {
    fn();
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`  FAIL  ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- 1. the vendored source exists and is CommonJS -------------------------

const vendorSource = path.join(root, 'src/health/vendor/credential-reporter.js');

check('vendored module present in src', () => {
  assert(fs.existsSync(vendorSource), `missing ${vendorSource}`);
});

check('vendored module is CommonJS, not ESM', () => {
  const text = fs.readFileSync(vendorSource, 'utf8');
  // `export` at the top level throws `Unexpected token 'export'` under
  // require() in NestJS's CJS build. shared/packages/consent is ESM; this
  // package deliberately is not.
  assert(!/^\s*export\s/m.test(text), 'contains a top-level `export` statement');
  assert(/module\.exports/.test(text), 'no module.exports found');
});

// --- 2. the classification rule ---------------------------------------------

const reporter = require(vendorSource);

check('2xx classifies accepted', () => {
  assert(reporter.classifyStatus(200) === 'accepted', '200 was not accepted');
  assert(reporter.classifyStatus(204) === 'accepted', '204 was not accepted');
});

check('401 and 403 classify rejected', () => {
  assert(reporter.classifyStatus(401) === 'rejected', '401 was not rejected');
  assert(reporter.classifyStatus(403) === 'rejected', '403 was not rejected');
});

check('everything else classifies indeterminate', () => {
  // A receiver being down is a health problem HealthWatcher already owns.
  // Reporting it as `rejected` would double-report one incident.
  for (const status of [404, 500, 502, 503, null, undefined]) {
    assert(
      reporter.classifyStatus(status) === 'indeterminate',
      `${status} was not indeterminate`,
    );
  }
});

check('expiry decodes without verifying, and refuses garbage', () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const token = `x.${payload}.y`;
  assert(
    reporter.readTokenExpiry(token) === new Date(exp * 1000).toISOString(),
    'did not decode a well-formed exp',
  );
  // Never send a guess: an absent expiry reconciles as "not reported", but a
  // fabricated one is worse than nothing because Phase 2 may alert on it.
  assert(reporter.readTokenExpiry('not-a-jwt') === undefined, 'guessed at a malformed token');
  assert(reporter.readTokenExpiry('') === undefined, 'guessed at an empty token');
});

// --- 3. this repo's wiring ---------------------------------------------------

check('reporter probes warehouse, not catalog or /health', () => {
  const text = fs.readFileSync(path.join(root, 'src/health/credential-self-reporter.ts'), 'utf8');
  assert(text.includes('/api/stock/'), 'does not probe the stock read route');
  // /health answers 200 with no credential at all, so a probe against it can
  // never fail — it would report `accepted` for an empty token.
  assert(!/url:.*\/api\/health/.test(text), 'probes /api/health, which cannot fail');
  // catalog's guard grants read from the SERVICE_NAME header rather than the
  // JWT role, so a catalog GET returns 200 for a revoked credential.
  assert(!text.includes('CATALOG_SERVICE_TOKEN'), 'probes the unprobeable catalog lane');
});

check('principal string matches auth exactly', () => {
  const text = fs.readFileSync(path.join(root, 'src/health/credential-self-reporter.ts'), 'utf8');
  // Off-convention domain: @alfares.cz, NOT @internal.alfares.cz. A mismatch
  // here reconciles the report against nothing and the principal stays silent.
  assert(
    text.includes("'suppliers-warehouse-service@alfares.cz'"),
    'principal does not match the address auth lists',
  );
});

check('nest-cli registers the vendor asset', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'nest-cli.json'), 'utf8'));
  const assets = (cfg.compilerOptions && cfg.compilerOptions.assets) || [];
  assert(
    assets.some((a) => (typeof a === 'string' ? a : a.include || '').includes('health/vendor')),
    'nest-cli.json does not register health/vendor/*.js — dist/ will lack the module',
  );
});

// --- 4. the built artifact ---------------------------------------------------

check('vendored module reached dist/ (run after build)', () => {
  // Resolve the vendored file the way Node will at runtime: relative to the
  // COMPILED reporter, wherever that landed.
  //
  // Hardcoding a dist path is what let this check pass while the pod
  // crashlooped on MODULE_NOT_FOUND (2026-09-03). This repo has no `rootDir`,
  // so tsc infers it from the widest include and emits to dist/src/..., while
  // nest-cli's asset copier resolves `include` against sourceRoot and dropped
  // the file at dist/common/vendor — a sibling of where the code looks. Both
  // paths existed; only one was the one that mattered.
  const candidates = fs
    .readdirSync(path.join(root, 'dist'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(root, 'dist', e.name, 'health/credential-self-reporter.js'))
    .concat([path.join(root, 'dist/health/credential-self-reporter.js')]);

  const compiled = candidates.find((p) => fs.existsSync(p));
  assert(compiled, `no compiled credential-self-reporter.js found under dist/`);

  const built = path.join(path.dirname(compiled), 'vendor/credential-reporter.js');
  assert(
    fs.existsSync(built),
    `missing ${built} — the compiled reporter at ${compiled} requires ./vendor/credential-reporter.js ` +
      `and it is not there, so the pod throws MODULE_NOT_FOUND at boot`,
  );
  // Require the built file specifically. Requiring the source proves nothing
  // about what ships.
  const builtModule = require(built);
  assert(
    typeof builtModule.reportCredential === 'function',
    'built module does not export reportCredential',
  );
});

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall credential self-report checks passed');
