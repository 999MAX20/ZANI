# Product Capabilities

Zani uses one CRM codebase with business-level capabilities. A vertical is a default profile, not a fork.

## Registry

```text
inbox, leads, clients, appointments, tasks, deals,
analytics, ai, automations, integrations
```

`GET /api/auth/me/` exposes the effective module map for each membership. Owners with settings update access can use `/api/business-capabilities/` to enable or disable modules.

## Defaults

- Standard SMB profiles enable all current modules.
- Dentistry uses `appointment_first` workflow mode and disables Deals by default.
- Dentistry adds the doctor role preset for appointment-compatible work.

## Enforcement

Capability checks run on the backend. They guard tenant viewsets, work queues, inbox links, operational analytics, AI tools and automation actions. Frontend navigation may hide a disabled module, but hiding is not the security boundary.

Disabling a module never deletes records. Re-enabling it restores API access to the same tenant-scoped data.
