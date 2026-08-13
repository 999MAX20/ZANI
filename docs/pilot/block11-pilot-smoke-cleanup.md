# Block 11 — Pilot smoke script cleanup

## Goal

Make the pilot smoke check clear and fast enough for local QA before every handoff.

The previous smoke script executed each backend suite in a separate `manage.py test` process. Django created and migrated a fresh in-memory test database for every suite, so the terminal looked like an endless migration loop even when the tests were passing.

## What changed

- All pilot backend test suites now run in one `manage.py test` command.
- `--keepdb` is enabled by default for the smoke test command.
- The demo seed reset is checked twice in a row to prove `seed_pilot_demo --reset` is idempotent and no longer fails on protected relations.
- Frontend build can be skipped with `SKIP_FRONTEND_BUILD=true` for quick backend-only checks.
- `TEST_VERBOSITY` and `TEST_KEEPDB` can be overridden from the shell.

## Standard command

```bash
./scripts/pilot_smoke_check.sh
```

## Faster backend-only command

```bash
SKIP_FRONTEND_BUILD=true ./scripts/pilot_smoke_check.sh
```

## Debug command without keepdb

```bash
TEST_KEEPDB=false ./scripts/pilot_smoke_check.sh
```

## Success criteria

The script should finish with:

```text
Pilot smoke checks completed successfully.
```

It is normal to see `Bad Request`, `Forbidden`, and `Unauthorized` lines inside test output when tests are intentionally checking permissions and validation.
