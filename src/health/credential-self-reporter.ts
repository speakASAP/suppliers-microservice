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
 */
const PRINCIPAL =
  'svc-suppliers-microservice--warehouse-microservice@internal.alfares.cz';

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
 * **Why warehouse and not catalog.** Catalog probe routes historically did not
 * enforce the JWT role for unlisted SERVICE_NAME values; warehouse
 * `GET /api/stock/:productId` is decorated `@Roles(...WAREHOUSE_READ_ROLES)`
 * including `internal:warehouse-microservice:admin` — the role this credential
 * holds. A 200 proves the credential and a 401/403 disproves it.
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
    const ingestToken = (process.env.MONITORING_INGEST_SERVICE_TOKEN || '').trim();

    if (!ingestToken) {
      // Without the ingest credential the verdict cannot be delivered. Log it
      // rather than returning quietly: a reporter that stops reporting is
      // indistinguishable from a credential that broke, and silence is this
      // design's primary signal.
      this.logger.error(
        'credential_self_report_undeliverable',
        'CredentialSelfReporter',
        { principal: PRINCIPAL, reason: 'MONITORING_INGEST_SERVICE_TOKEN is empty' },
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
