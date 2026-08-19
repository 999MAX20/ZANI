# Connector Credential Key Rotation

This runbook is the source of truth for rotating encrypted `ConnectorCredential` values. It applies to Telegram, WhatsApp, Instagram, Kaspi, MoySklad, Wildberries, Ozon and future providers using the shared credential store.

## Security contract

- New values use an AES-256-GCM envelope with `v`, `alg` and `kid` metadata.
- `CONNECTOR_CREDENTIAL_KEYS` is independent from Django `SECRET_KEY`.
- Only `CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID` encrypts new or rotated values.
- Older AEAD keys remain decrypt-only while they are present in the keyring.
- Legacy v1 values can be read only while `CONNECTOR_CREDENTIAL_ALLOW_LEGACY_DECRYPT=True`.
- Local development uses a machine-specific key file outside the repository. Back it up if local credentials must survive OS/profile recovery; production must not use it.
- Production should use a managed KMS/secret store to inject the keyring into every web and worker process.

The environment format is a JSON mapping of key IDs to base64url-encoded 32-byte keys:

```env
CONNECTOR_CREDENTIAL_ACTIVE_KEY_ID=prod-2026-08
CONNECTOR_CREDENTIAL_KEYS={"prod-2026-08":"<base64url-32-byte-key>","prod-previous":"<base64url-32-byte-key>"}
CONNECTOR_CREDENTIAL_ALLOW_LEGACY_DECRYPT=True
```

Generate a key in an approved secure terminal, then place it directly in the environment/secret manager. Do not commit the output:

```powershell
.\.venv\Scripts\python.exe -c "import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

## Pre-migration gate

1. Take and verify a database backup or managed PITR restore point.
2. Preserve the current `SECRET_KEY`; legacy v1 decryption depends on it until migration is complete.
3. Preserve every existing AEAD key. Never remove an old key before its envelope count is zero.
4. Deploy the code that understands both v1 and v2 before rotating any row.
5. Put the new key in every web and worker environment and set it active.
6. Run `manage.py check`; resolve `zani.W018`. `zani.W019` is expected only during the legacy migration window.
7. Pause connector writes or use a quiet maintenance window so credentials are not changed during the rotation transaction.

## Rotation procedure

The command decrypts and re-encrypts each selected row in memory. It never prints or exports plaintext. The database changes are one transaction: any corrupt envelope, missing key or other credential failure rolls back the complete command.

```powershell
.\.venv\Scripts\python.exe manage.py rotate_connector_credentials --dry-run
.\.venv\Scripts\python.exe manage.py rotate_connector_credentials
```

For a specific source or explicit target:

```powershell
.\.venv\Scripts\python.exe manage.py rotate_connector_credentials --from-key-id legacy-v1 --target-key-id prod-2026-08 --dry-run
.\.venv\Scripts\python.exe manage.py rotate_connector_credentials --from-key-id legacy-v1 --target-key-id prod-2026-08
```

The report contains counts and key IDs only. It must show zero decrypt failures and, after the final run, zero envelopes requiring the previous key.

## Post-rotation verification

1. Repeat `--dry-run`; the active-key rows must report as already current.
2. Run connector configuration/status tests with mock credentials locally.
3. In an approved staging environment, test one credential-backed provider per adapter family without logging provider payloads.
4. Confirm API responses, Django admin and application logs contain no raw credential values.
5. Keep the previous key and database restore point through the agreed recovery window.
6. After every legacy v1 row is rotated, set `CONNECTOR_CREDENTIAL_ALLOW_LEGACY_DECRYPT=False` and confirm `zani.W019` disappears.
7. Remove an old AEAD key only after its envelope count is zero and the recovery window has closed.

## Rollback and key recovery

### Failure before any rotation

- Revert the application release if needed.
- Leave the database and keyring unchanged.
- Do not change `SECRET_KEY`.

### Rotation command fails

- The command rolls back its transaction automatically.
- Restore the missing/incorrect old key or original `SECRET_KEY` and repeat `--dry-run`.
- Do not overwrite or delete the failing ciphertext.

### Failure after v2 rows were committed

- Prefer a forward fix while keeping the new and old keys available.
- Do not roll back to application code that understands only v1; it cannot decrypt v2 envelopes.
- If a forward fix is impossible, restore both the pre-rotation database snapshot and the exact pre-rotation key configuration as one recovery operation.

### Key is lost

- Restore the exact key from the managed secret store/backup and repeat `--dry-run`.
- If the key cannot be recovered, its ciphertext is intentionally unrecoverable. Reconnect the affected provider and store a replacement credential.
- Never attempt plaintext export, weak fallback encryption or derivation from Django `SECRET_KEY`.

Record for every production rotation:

```text
Environment:
Change owner:
Active target key ID:
Retained source key IDs:
Backup/PITR reference:
Dry-run counts:
Rotation counts:
Mock/staging verification:
Legacy decrypt disabled at:
Old-key removal date:
Rollback decision and result:
```
