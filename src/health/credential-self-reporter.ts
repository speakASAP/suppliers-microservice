import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LoggerService } from '../logger/logger.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const reporter = require('./vendor/credential-reporter.js');

const SELF_REPORT_CRON = process.env.CREDENTIAL_SELF_REPORT_CRON || '*/30 * * * *';

const WAREHOUSE_URL =
  process.env.WAREHOUSE_SERVICE_URL ||
  'http://warehouse-microservice.statex-apps.svc.cluster.local:3201';

const MONITORING_URL =
  process.env.MONITORING_URL ||
  'http://monitoring-microservice.statex-apps.svc.cluster.local:3395';

/**
 * This service's warehouse principal, exactly as auth lists it.
 *
 * Hardcoded rather than derived from the token, because the reporter must name
 * the principal the inventory knows even if the deployed token is wrong — which
 * is precisely the case worth reporting. Deriving it from the token would make a
 * broken credential report under a broken name, or not at all.
 *
 * **This is the PRE-STANDARD principal, and that is deliberate.** Task B's
 * evidence (2026-09-03) decoded the `sub` of the token actually mounted in this
 * pod: it is `suppliers-warehouse-service@alfares.cz`, not
 * `svc-suppliers-microservice--warehouse-microservice@alfares.cz`, which this
 * constant originally named. The `svc-` principal exists in auth but no token
 * was ever issued for it — Vault holds the pre-standard one under the same key.
 *
 * Reporting the `svc-` name filed an `accepted` verdict against a credential
 * that is not the one being probed: the wrong principal looked healthy while
 * the one actually in use stayed silent. Naming the principal whose token is
 * presented is the whole point of the field.
 *
 * Note the domain is `@alfares.cz`, not `@internal.alfares.cz`. The string must
 * match auth exactly or the report reconciles against nothing.
 */
const PRINCIPAL = 'suppliers-warehouse-service@alfares.cz';

const TARGET = 'warehouse-microservice';

/**
 * A product id used only to exercise the guard, never for its response body.
 *
 * `GET /api/stock/:productId` returns 200 with an empty array for an unknown id,
 * so the probe does not depend on any particular product existing. What is being
 * tested is whether the credential passes `WAREHOUSE_READ_ROLES`, not what the
 * warehouse holds.
 */
const PROBE_PRODUCT_ID = 'credential-probe';

/**
 * Reports on this service's warehouse credential, per
 * `monitoring-microservice/docs/CREDENTIAL_SELF_REPORT_CONTRACT.md`.
 *
 * Wave 1 of the prober plan's Task A, and the first adoption outside the
 * monitoring pilot.
 *
 * **Why warehouse and not catalog.** Suppliers holds two per-pair principals and
 * only this one is probeable. Catalog's `CatalogAuthGuard` derives a caller's
 * grants from the `SERVICE_NAME` header rather than from the JWT's role, and
 * falls back to read access for any unlisted name
 * (`catalog-auth.guard.ts`, `grants[source] ?? READ`). A GET against catalog
 * would therefore return 200 even for a revoked or expired credential, so the
 * probe would report `accepted` for a credential that is not being enforced —
 * the catalog-contract-monitor failure reproduced by the tool built to catch it.
 * `svc-suppliers-microservice--catalog-microservice` is recorded unprobeable and
 * stays `silent` until catalog grows a route that enforces the token's own role.
 *
 * **Why this route.** `GET /api/stock/:productId` is decorated
 * `@Roles(...WAREHOUSE_READ_ROLES)`, which includes
 * `internal:warehouse-microservice:admin` — the role this credential actually
 * holds. So a 200 proves the credential and a 401/403 disproves it. `/api/health`
 * would have been wrong for the opposite reason to catalog's: it answers 200 with
 * no credential at all, so it cannot fail.
 */
@Injectable()
export class CredentialSelfReporter {
  constructor(private readonly logger: LoggerService) {}

  @Cron(SELF_REPORT_CRON)
  async scheduledReport(): Promise<void> {
    if (process.env.CREDENTIAL_SELF_REPORT_ENABLED === 'false') return;
    await this.runReport();
  }

  async runReport(): Promise<{ verdict: string; posted: boolean } | null> {
    const token = (process.env.WAREHOUSE_SERVICE_TOKEN || '').trim();
    const ingestToken = (process.env.NOTIFICATION_SERVICE_TOKEN || '').trim();

    if (!ingestToken) {
      // Without the ingest credential the verdict cannot be delivered. Log it
      // rather than returning quietly: a reporter that stops reporting is
      // indistinguishable from a credential that broke, and silence is this
      // design's primary signal.
      this.logger.error(
        'credential_self_report_undeliverable',
        'CredentialSelfReporter',
        { principal: PRINCIPAL, reason: 'NOTIFICATION_SERVICE_TOKEN is empty' },
      );
      return null;
    }

    const outcome = await reporter.reportCredential({
      url: `${WAREHOUSE_URL}/api/stock/${PROBE_PRODUCT_ID}`,
      token,
      serviceName: 'suppliers-microservice',
      monitoringUrl: MONITORING_URL,
      ingestToken,
      principal: PRINCIPAL,
      target: TARGET,
    });

    this.logger.log('credential_self_report_sent', 'CredentialSelfReporter', {
      principal: PRINCIPAL,
      target: TARGET,
      verdict: outcome.verdict,
      posted: outcome.posted,
      error: outcome.error ?? null,
    });

    if (!outcome.posted) {
      this.logger.warn(
        `probe said ${outcome.verdict} but the report was not accepted` +
          (outcome.error ? `: ${outcome.error}` : ''),
        'CredentialSelfReporter',
        { principal: PRINCIPAL },
      );
    }

    return { verdict: outcome.verdict, posted: outcome.posted };
  }
}
