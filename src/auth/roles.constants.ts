/**
 * Suppliers role vocabulary.
 *
 * Every route must carry exactly one of these constants, or @Public. The guard
 * default used to be ['authenticated', 'global:superadmin',
 * 'internal:suppliers-microservice:admin'] — and 'authenticated' means any valid
 * token in the ecosystem, so every undecorated route here was reachable by any
 * caller holding any credential, including supplier creation and import runs.
 *
 * Two tiers, narrowest first:
 *   READ   - list and inspect suppliers, mappings and import runs.
 *   WRITE  - create or update suppliers and mappings, trigger imports.
 */

export const SUPPLIERS_READ_ROLES = [
  'global:superadmin',
  'internal:suppliers-microservice:admin',
  'internal:suppliers-microservice:readonly',
] as const;

export const SUPPLIERS_WRITE_ROLES = [
  'global:superadmin',
  'internal:suppliers-microservice:admin',
] as const;
