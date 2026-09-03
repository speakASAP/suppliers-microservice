/**
 * Alfares credential self-reporter — framework-agnostic, zero dependencies.
 *
 * Each service probes its OWN service credential against the receiver it
 * actually calls, then posts the verdict to monitoring-microservice. No secret
 * ever leaves its owner: the token is used, never transmitted.
 *
 * Why this is a shared module rather than fourteen hand-written copies: the
 * accepted/rejected/indeterminate rule is the whole design, and fourteen
 * independent implementations will not classify identically. A reporter that
 * calls a timeout `rejected` produces exactly the false alert Phase 2 must
 * never fire. The rule is written once, here, and tested once.
 *
 * Contract: monitoring-microservice/docs/CREDENTIAL_SELF_REPORT_CONTRACT.md
 * Plan:     auth-microservice/docs/SERVICE_CREDENTIAL_PROBER_PLAN.md
 *
 * @typedef {'accepted'|'rejected'|'indeterminate'} ProbeVerdict
 *
 * @typedef {Object} ProbeResult
 * @property {ProbeVerdict} verdict
 * @property {number} [status]   HTTP status the receiver returned, when there was one.
 * @property {string} [detail]   Short human-readable reason, max 500 chars.
 */

/** Max length monitoring accepts for `detail`. */
const DETAIL_MAX = 500;

/**
 * Classifies a receiver's answer about a credential.
 *
 * The three-way split is the point. Collapsing "indeterminate" into "rejected"
 * is what makes a prober noisy enough to be muted: an unreachable receiver is a
 * HEALTH problem that HealthWatcher already owns, and reporting it as a
 * credential rejection double-reports one incident and trains the channel to
 * ignore both.
 *
 * @param {number|null|undefined} status HTTP status, or null/undefined if the request never completed.
 * @returns {ProbeVerdict}
 */
function classifyStatus(status) {
  if (typeof status !== 'number' || !Number.isFinite(status)) return 'indeterminate';
  if (status >= 200 && status < 300) return 'accepted';
  // 401/403 only. A 400 is a malformed probe request, not a refused credential,
  // and a 404 means the endpoint moved -- neither says the credential is bad.
  if (status === 401 || status === 403) return 'rejected';
  return 'indeterminate';
}

/**
 * Reads `exp` out of a JWT without verifying it.
 *
 * Deliberately no signature check. The receiver's verdict is what establishes
 * validity; a reporter that verified its own token would be grading its own
 * homework, and it would need the public key to do it.
 *
 * Returns undefined for anything malformed rather than throwing: a reporter
 * must never fail to report because it could not parse its own expiry. An
 * absent expiry reconciles as "not reported", which is honest. A guessed one
 * would be worse than nothing, because Phase 2 is allowed to alert on it.
 *
 * @param {string} token
 * @returns {string|undefined} ISO-8601 expiry, or undefined.
 */
function readTokenExpiry(token) {
  if (typeof token !== 'string') return undefined;

  const parts = token.split('.');
  if (parts.length !== 3) return undefined;

  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const { exp } = JSON.parse(json);
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return undefined;

    const at = new Date(exp * 1000);
    if (Number.isNaN(at.getTime())) return undefined;

    return at.toISOString();
  } catch {
    return undefined;
  }
}

/**
 * Probes a read-only endpoint on the receiver, using this service's real token.
 *
 * The endpoint MUST be read-only. Never infer liveness from a write: a probe
 * running every 30 minutes that mutates state is a scheduled corruption job.
 * Where a service has no safe read to call, do not invent one — skip reporting
 * so the principal shows as `silent`, which is true, rather than `accepted`,
 * which would be a lie.
 *
 * @param {Object} opts
 * @param {string} opts.url            Absolute URL of a read-only endpoint on the receiver.
 * @param {string} opts.token          This service's deployed credential.
 * @param {number} [opts.timeoutMs]    Default 10000.
 * @param {string} [opts.serviceName]  Sent as x-service-name, for receiver-side attribution.
 * @param {typeof fetch} [opts.fetchImpl] Injectable for tests.
 * @returns {Promise<ProbeResult>}
 */
async function probeCredential({
  url,
  token,
  timeoutMs = 10000,
  serviceName,
  fetchImpl = globalThis.fetch,
}) {
  // An empty token is the catalog-contract-monitor failure exactly: it ran for
  // weeks with JWT_TOKEN set to "" and 401'd every time. Report it as rejected
  // without making a request -- the credential is genuinely unusable, and there
  // is nothing to ask a receiver about.
  if (!token) {
    return { verdict: 'rejected', detail: 'no credential present (empty or unset token)' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(serviceName ? { 'x-service-name': serviceName } : {}),
      },
      signal: controller.signal,
    });

    return {
      verdict: classifyStatus(res.status),
      status: res.status,
      detail: `${url} returned ${res.status}`,
    };
  } catch (err) {
    // Timeout, DNS failure, connection refused, TLS error. The receiver did not
    // answer, so nothing is known about the credential -- which is precisely
    // what `indeterminate` means, and why it must not clear an alert either.
    return {
      verdict: 'indeterminate',
      detail: truncate(`probe failed: ${err?.message ?? String(err)}`),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Posts a verdict to monitoring.
 *
 * There is no token field in the payload and there must never be one. The
 * verdict travels; the credential does not.
 *
 * @param {Object} opts
 * @param {string} opts.monitoringUrl  Base URL of monitoring-microservice.
 * @param {string} opts.ingestToken    Static token accepted by MonitoringIngestGuard.
 * @param {string} opts.principal      Principal this service authenticates as, exactly as auth lists it.
 * @param {string} opts.target         Service that accepted or rejected the credential.
 * @param {ProbeResult} opts.result
 * @param {string} [opts.expiresAt]    ISO-8601, from readTokenExpiry.
 * @param {number} [opts.timeoutMs]    Default 10000.
 * @param {typeof fetch} [opts.fetchImpl]
 * @returns {Promise<{posted: boolean, status?: number, error?: string}>}
 */
async function postReport({
  monitoringUrl,
  ingestToken,
  principal,
  target,
  result,
  expiresAt,
  timeoutMs = 10000,
  fetchImpl = globalThis.fetch,
}) {
  const body = {
    principal,
    target,
    verdict: result.verdict,
    ...(result.status !== undefined ? { status: result.status } : {}),
    ...(result.detail ? { detail: truncate(result.detail) } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${trimSlash(monitoringUrl)}/api/credentials/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ingestToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    return { posted: res.ok, status: res.status };
  } catch (err) {
    return { posted: false, error: err?.message ?? String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe, then report. The whole reporter in one call.
 *
 * Never throws. A reporter that crashes its host on a monitoring outage would
 * make this observability tool an availability risk — the opposite of its
 * purpose. Every failure path returns a result object instead.
 *
 * @param {Object} opts All of probeCredential's and postReport's options, plus:
 * @param {string} opts.principal
 * @param {string} opts.target
 * @returns {Promise<{verdict: ProbeVerdict, posted: boolean, status?: number, error?: string}>}
 */
async function reportCredential(opts) {
  try {
    const result = await probeCredential(opts);
    const expiresAt = readTokenExpiry(opts.token);

    const posted = await postReport({ ...opts, result, expiresAt });

    return {
      verdict: result.verdict,
      posted: posted.posted,
      ...(posted.status !== undefined ? { status: posted.status } : {}),
      ...(posted.error ? { error: posted.error } : {}),
    };
  } catch (err) {
    return { verdict: 'indeterminate', posted: false, error: err?.message ?? String(err) };
  }
}

/** @param {string} s */
function truncate(s) {
  return s.length > DETAIL_MAX ? `${s.slice(0, DETAIL_MAX - 1)}…` : s;
}

/** @param {string} u */
function trimSlash(u) {
  return u.replace(/\/+$/, '');
}

/**
 * CommonJS exports.
 *
 * Deliberately NOT ESM, unlike shared/packages/consent. That package is served
 * to browsers; this one is imported by NestJS services compiled to CommonJS,
 * where `export` syntax fails at require() time with "Unexpected token 'export'".
 * CommonJS is importable from both, so it is the shape that works for every
 * consumer this module actually has.
 */
module.exports = {
  classifyStatus,
  readTokenExpiry,
  probeCredential,
  postReport,
  reportCredential,
};
