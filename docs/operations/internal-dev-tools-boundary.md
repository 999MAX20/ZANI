# Internal Dev Tools Boundary

Zani product core is the merchant-facing AI CRM / Business OS. It must stay clean, stable, tenant-safe and simple for SMB users.

The following tools are not public product core:

- parser;
- landing generator;
- developer outreach;
- prospect scraping;
- internal lead research tools.

They may be useful for growth, support, sales enablement or internal operations, but they should not be mixed into the main CRM domain unless they become explicit product modules with clear permissions, billing and UX.

## Why Keep Them Separate

Zani core handles merchant data:

- businesses;
- clients;
- leads;
- deals;
- appointments;
- conversations;
- bots;
- automations;
- billing;
- platform admin.

Internal dev/growth tools have different risks:

- scraping and enrichment may have legal/compliance constraints;
- prospect data is not the same as merchant-owned CRM data;
- outreach workflows can hurt domain reputation and deliverability;
- landing generation can become a large product surface by itself;
- internal tooling often needs looser experimentation speed than production CRM.

Keeping these systems separate protects:

- tenant isolation;
- product simplicity;
- security review scope;
- database performance;
- SMB UX clarity;
- future compliance posture.

## Tool Boundaries

### Parser

Parser tools can discover or enrich public business data. They should live outside the CRM core and should not write directly into merchant tables.

Allowed future integration:

- import vetted records through controlled API endpoints;
- write only to explicit prospect/import tables if those are added later;
- keep logs of source, consent/status and import actor.

### Landing Generator

Landing generation can use CRM business data as input, but it should not own core CRM entities.

Allowed future integration:

- read business/service data through API;
- write generated page metadata to a dedicated landing module or external service;
- publish through a separate deploy/storage pipeline.

### Developer Outreach

Developer outreach is an internal acquisition/support workflow. It should not be visible inside merchant CRM unless intentionally exposed as a product feature.

Allowed future integration:

- separate outreach repo/app;
- separate database;
- API import of qualified leads into Zani;
- strict audit trail for any write into CRM.

### Prospect Scraping

Prospects are not clients until a merchant explicitly imports or creates them. Scraped prospects should not appear in client lists by default.

Allowed future integration:

- separate prospect database;
- deduplication before import;
- compliance metadata;
- rate-limited controlled import endpoints.

## Recommended Future Architectures

### Separate Repository

Best for fast-moving internal tools. Keeps dependencies, experiments and scraping logic away from production CRM.

### Separate Database

Best when prospect/outreach data grows quickly or has different retention/compliance rules.

### API-Based Integration

Preferred write path into Zani:

- authenticated service account;
- scoped API token;
- rate limits;
- validation;
- audit logs;
- idempotency keys for imports.

### Controlled CRM Import

Any future import should go through dedicated endpoints, for example:

```text
POST /api/imports/prospects/
POST /api/imports/prospects/{id}/convert-to-lead/
```

These endpoints should validate tenant, source, duplicate detection and user permissions before writing to clients/leads/deals.

## Hard Rules

- Do not let scraping tools write directly to `clients`, `leads` or `deals`.
- Do not mix internal prospects with merchant-owned CRM contacts.
- Do not expose internal tools in Merchant CRM navigation by default.
- Do not give platform/support users unrestricted merchant data access without explicit support grant policy.
- Do not make landing generator, parser or outreach a blocker for the core CRM roadmap.

## Current Decision

For the current roadmap stage, parser, landing generator and developer outreach remain outside Zani product core. Zani core stays focused on a stable merchant CRM, bots, inbox, automations, billing foundation and platform admin.
