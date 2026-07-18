# PROMPT-SUP-FRONTEND-ADMIN

Build frontend surfaces for Suppliers without changing domain ownership boundaries.

Implement public static pages for the landing page, login, and registration. Implement an admin dashboard that requires a stored bearer JWT before reading protected Suppliers APIs. Use the current service data model: suppliers, import jobs, category mappings, Catalog and Warehouse integration boundaries, and marketplace/order consumers. Keep supplier credentials represented only as safe references or `hasCredentials`.

Validate with the IPS pre-coding gate, TypeScript build, static route smoke checks, and deployment readiness gate. Do not deploy without explicit owner approval.
