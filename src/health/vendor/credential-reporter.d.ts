export type ProbeVerdict = 'accepted' | 'rejected' | 'indeterminate';

export interface ProbeResult {
  verdict: ProbeVerdict;
  status?: number;
  detail?: string;
}

export interface ProbeOptions {
  /** Absolute URL of a READ-ONLY endpoint on the receiver. Never a write. */
  url: string;
  /** This service's deployed credential. Used, never transmitted. */
  token: string;
  timeoutMs?: number;
  serviceName?: string;
  fetchImpl?: typeof fetch;
}

export interface PostOptions {
  monitoringUrl: string;
  ingestToken: string;
  /** Exactly as auth lists it, e.g. `svc-catalog-microservice--orders-microservice@internal.alfares.cz`. */
  principal: string;
  /** The receiver actually called — not whatever the principal's address claims. */
  target: string;
  result: ProbeResult;
  expiresAt?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface ReportOutcome {
  verdict: ProbeVerdict;
  posted: boolean;
  status?: number;
  error?: string;
}

export function classifyStatus(status: number | null | undefined): ProbeVerdict;

/** Decodes `exp` without verifying the signature. Returns undefined on anything malformed. */
export function readTokenExpiry(token: string): string | undefined;

export function probeCredential(opts: ProbeOptions): Promise<ProbeResult>;

export function postReport(
  opts: PostOptions,
): Promise<{ posted: boolean; status?: number; error?: string }>;

/** Probe then report. Never throws. */
export function reportCredential(
  opts: ProbeOptions & Omit<PostOptions, 'result' | 'expiresAt'>,
): Promise<ReportOutcome>;
