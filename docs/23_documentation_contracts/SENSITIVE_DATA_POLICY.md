# Sensitive Data Policy

## Purpose

IPS work must be safe to review, test and replay locally. Prompts, plans, examples, tests, logs, reports and generated artifacts must not expose secrets, raw production records, confidential identifiers or real customer data.

## Forbidden content

Do not place any of the following in prompts, tests, examples, fixtures, screenshots, logs, validation reports, execution plans or audit reports:

- passwords, API keys, tokens, private keys, client secrets or session cookies;
- raw production records, raw customer messages, raw attachments or operational exports;
- real customer, supplier, employee or patient identifiers;
- real email addresses, phone numbers, account numbers or tenant identifiers;
- confidential URLs, workbook IDs, object IDs, database IDs or ticket contents;
- unmasked screenshots of production systems;
- logs containing credentials, authorization headers or personally identifiable information.

## Allowed test material

Use synthetic or masked material instead:

- `CUSTOMER_SYNTHETIC_001`
- `SUPPLIER_SYNTHETIC_001`
- `MESSAGE_SYNTHETIC_001`
- `TENANT_SYNTHETIC_001`
- `sha256:<synthetic-hash>`
- `example.invalid` email domains
- placeholder URLs under `https://example.invalid/`

## Classification

Every task and execution plan must classify its data exposure:

| Classification | Meaning | Required handling |
|---|---|---|
| `none` | No data-bearing examples or logs. | No additional handling. |
| `synthetic` | Artificial examples only. | State generation method or fixture source. |
| `masked` | Real structure with identifiers removed. | Describe masking method and residual risk. |
| `sensitive` | Confidential or production-derived material. | Do not include in IPS artifacts; use approved secure workflow outside AI prompts. |

## Gate behavior

Pre-coding and deployment-readiness gates scan repository text files for common secret and raw-production-data patterns. A finding blocks the gate until the content is removed, masked or justified by an approved security owner.
