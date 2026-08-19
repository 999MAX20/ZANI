# Privileged Account MFA

This document is the source of truth for the ZANI privileged-account multi-factor authentication contract introduced by `BE-REM-006`.

## Policy

- `AUTH_PRIVILEGED_MFA_REQUIRED=True` is mandatory for staging, production and the first paid pilot.
- The policy applies to platform administrators, business owners and active business administrators.
- Manager, operator and specialist roles are not forced into MFA by this phase.
- A user with an already confirmed MFA device must continue to complete MFA even if the mandatory environment flag is temporarily disabled.

## Authentication flow

1. Password or verified social identity completes the primary factor.
2. The backend returns HTTP `202` with a short-lived, one-time challenge instead of access or refresh credentials.
3. A user without a confirmed device enrolls a TOTP authenticator and confirms the first code.
4. A user with a confirmed device verifies a TOTP or single-use recovery code.
5. Only after successful verification does the backend issue the access token and HttpOnly refresh cookie.

Refresh tokens for accounts that require MFA carry an `mfa_verified` claim. A legacy or newly unverified privileged refresh token is rejected. TOTP counters are persisted to reject replay within the accepted clock-skew window.

## Credential storage

- TOTP secrets use the versioned AES-256-GCM connector credential keyring. Plaintext secrets are returned only during enrollment and are never logged.
- Recovery codes contain 96 bits of cryptographic randomness. Only a deterministic HMAC-SHA256 digest keyed by the application secret is stored.
- Recovery codes are returned once after enrollment or explicit regeneration and are individually marked as used.
- Challenge tokens are stored only as SHA-256 digests, expire after five minutes by default and become unusable after five failed attempts.

## Security actions

- Password changes require the current password plus a current TOTP or recovery code when MFA is enabled.
- Recovery-code regeneration, session revocation and MFA reset require a current factor.
- MFA reset also requires the current password and an audited reason.
- When mandatory MFA applies, reset revokes every refresh session and returns a new enrollment challenge. It never creates an MFA-free privileged session.
- A short-lived, user-bound step-up token contract is available for future sensitive operations and passkey/WebAuthn adoption.

## Audit events

Security audit metadata records enrollment, verification, failed verification, recovery-code regeneration, password-change MFA failures, session revocation and controlled reset. It never contains TOTP secrets, raw recovery codes, challenge tokens, passwords or refresh tokens.

## API surface

```text
POST /api/auth/mfa/enrollment/start/
POST /api/auth/mfa/enrollment/confirm/
POST /api/auth/mfa/verify/
GET  /api/auth/mfa/status/
POST /api/auth/mfa/step-up/
POST /api/auth/mfa/recovery-codes/
POST /api/auth/mfa/sessions/revoke/
POST /api/auth/mfa/disable/
```

The status endpoint is always scoped to the authenticated user; query parameters cannot select another tenant or account.

## Environment variables

```env
AUTH_MFA_RATE=10/min
AUTH_PRIVILEGED_MFA_REQUIRED=True
AUTH_MFA_ISSUER=Zani
AUTH_MFA_CHALLENGE_SECONDS=300
AUTH_MFA_STEP_UP_SECONDS=300
```

Production-like environments also need the managed credential keyring described in `docs/integrations/connector-credential-key-rotation.md`. Keep `SECRET_KEY` stable because it keys recovery-code digests and signed step-up tokens.

## Recovery runbook

1. First use an unused recovery code through the normal login screen.
2. After login, regenerate recovery codes or reset the authenticator from Account Security.
3. A mandatory-policy reset immediately forces enrollment of a new authenticator and revokes old sessions.
4. If no factor remains, an authorized operator must validate the account owner outside the application and perform a controlled administrative recovery. Never expose, export or reconstruct existing secret material.

Passkeys/WebAuthn remain a later additive factor. They should complete the same challenge and produce the same `mfa_verified` session claim instead of introducing a second session model.
