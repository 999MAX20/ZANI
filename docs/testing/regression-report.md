# Final Regression Report

Date: 2026-05-13

Scope: final regression pass after prompts 00-15.

## Automated Checks

Passed:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py test
cd frontend && npm ci
cd frontend && npm run build
```

Results:

- Backend: 76 tests passed.
- Django system check: no issues.
- Migrations check: no changes detected.
- Frontend: TypeScript/Vite build passed.
- Widget bundle: `frontend/dist/widget/zani-widget.js` built.
- npm audit from `npm ci`: 0 vulnerabilities.

## Browser Smoke

Checked against local backend/frontend:

- public `/` opens without auth;
- public `/pricing` opens without auth;
- public `/bots` opens without auth;
- public `/crm` opens without auth;
- public `/contacts` opens without auth;
- platform user logs into `/platform`;
- `/platform/merchants` loads;
- merchant user logs into `/dashboard`;
- merchant user is redirected away from `/platform`;
- merchant pages load without application error:
  - `/dashboard/leads`;
  - `/dashboard/clients`;
  - `/dashboard/deals`;
  - `/dashboard/tasks`;
  - `/dashboard/calendar`;
  - `/dashboard/bots`.

## API Smoke

Passed:

- website chat public conversation create: `201`;
- Telegram webhook mock inbound: `200`;
- AI assistant without `OPENAI_API_KEY`: `200`, mock response;
- automation lead-created flow: created task and notification.

## Security Smoke

Checked:

- clean archive script generated `zani-clean.zip`;
- archive does not include `.env`, `.venv`, `node_modules`, `frontend/dist` or `db.sqlite3`;
- docs/env examples contain placeholders only, no real service tokens;
- tests run with external OpenAI/Telegram/WhatsApp/Instagram disabled.

## Notes

- Local JWT warnings appear when `SECRET_KEY` is short. This is expected for local placeholder keys and is documented; production must use a strong 32+ character secret.
- Browser smoke used temporary local QA users in the SQLite development database only.
