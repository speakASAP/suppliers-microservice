# Goal 2 - Supplier Contract And Credential Safety

Status: done. Owner: suppliers-owner. Created: 2026-06-12. Completed: 2026-06-12.

## Intent

Supplier records must accept only validated metadata and runtime secret references. Supplier API credentials, decoded tokens, passwords, and keys must not be returned from supplier read, create, or update responses.

## Scope

- Review supplier create/update payload handling.
- Define `apiCredentials` persistence as runtime secret-reference metadata only.
- Add DTO validation for supplier name, code, API type, URL, schedule, active flag, and credential references.
- Redact credential reference payloads from supplier API responses while preserving the `{ success, data }` envelope.

## Files Changed

- `src/suppliers/dto/supplier.dto.ts`
- `src/suppliers/supplier.entity.ts`
- `src/suppliers/suppliers.service.ts`
- `src/suppliers/suppliers.controller.ts`

## Sensitive-Data Review

Data classification: sensitive. No real credentials, supplier payloads, customer data, or production identifiers were added. DTOs allow `apiKeyRef`, `usernameRef`, `passwordRef`, and `tokenRef` reference strings only; decoded secret values remain outside this service contract.

## Contract Notes

The existing `apiCredentials` JSONB column remains for compatibility, but its application contract is now secret-reference metadata. Supplier response bodies omit `apiCredentials` and expose only `hasCredentials` so callers can see whether references exist without receiving sensitive fields.

## Validation Evidence

- `python3 scripts/pre_coding_gate.py --root .` passed before source edits.
- `npm run build` passed after source edits.

## Deviations

`TASK-002` remains draft and supplier-specific API integration was not implemented because the execution plan requires owner-supplied supplier identity and source contract details before adapter work. This goal completed the narrower, already-listed credential-safety implementation chunk.
