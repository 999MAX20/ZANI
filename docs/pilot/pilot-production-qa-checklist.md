# ZANI Pilot Production QA Checklist

Use this checklist before every staging or production deploy. The goal is to catch broken clicks, role regressions, calendar setup issues and mobile UX problems before merchants see them.

## 1. Required Automated Checks

Run from repository root:

```bash
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py makemigrations --check --dry-run
DATABASE_URL=sqlite:///db.sqlite3 .venv/bin/python manage.py check
DATABASE_URL=sqlite:///db.sqlite3 SECURE_SSL_REDIRECT=False SESSION_COOKIE_SECURE=False CSRF_COOKIE_SECURE=False REDIS_URL=memory:// CELERY_TASK_ALWAYS_EAGER=True CELERY_TASK_STORE_EAGER_RESULT=False AUTOMATIONS_RUN_INLINE=True .venv/bin/python manage.py test --verbosity=1
cd frontend && npm run build
```

## 2. Login And Roles

- Platform admin can log in and opens `/platform`.
- Business owner can log in and sees all merchant sections.
- Business operator can log in and sees only allowed sections.
- Logout works from desktop and mobile.
- Direct URL access respects permissions for owner/operator/platform users.

## 3. Mobile Smoke

Viewport: 390x844.

- Header buttons are tappable: menu, search, notifications, logout.
- Bottom navigation links open the correct pages.
- More/sidebar opens, links are visible, and sidebar closes after selecting a link.
- Modals fit the screen and close buttons are large enough.
- Tables/cards do not overflow horizontally on core pages.

## 4. Calendar And Booking

- Working hours preset can be applied.
- Weekly working hours form saves all seven days.
- Invalid working time is blocked.
- Resource-specific schedule can be saved.
- Calendar previous/next date buttons work.
- Calendar picker opens, changes month and selects a date.
- Clicking an available day slot opens booking flow.
- Booking form shows available slots after business/service/date selection.
- Appointment can be created and appears in calendar and appointments list.
- Appointment status can be changed.

## 5. CRM Core

- Dashboard loads without runtime errors.
- Leads page: search, status change, open drawer, create appointment from lead.
- Clients page: list, create, edit/open card.
- Deals page: kanban/status move and detail actions.
- Tasks page: create, assign, complete, comment.
- Conversations page: open conversation, send reply/test quick reply where configured.
- Timeline page: loads activity events or empty state.

## 6. Team And Access

- Owner can invite employee by email, WhatsApp or Telegram contact path.
- Invite preview and accept screens work.
- Employee can set password on invite acceptance.
- Owner can change member role.
- Operator cannot delete or hide business-critical history.
- Audit log/security pages remain restricted to allowed roles.

## 7. Integrations

- Telegram card shows setup status and beta prerequisites.
- Excel/CSV import preview and confirm work on sample file.
- WhatsApp request creates support-assisted request without exposing secrets.
- Kaspi mock-sync creates read-only BusinessEvents.
- 1C and МойСклад connectors stay lightweight and do not expose raw token/API UX to merchants.
- Dashboard surfaces imported revenue, connector health and latest events.

## 8. Language QA

Check RU, KK and EN:

- Language switcher persists after reload.
- Main navigation, login, dashboard, calendar, integrations and settings do not mix languages.
- Brand names can remain as-is: Telegram, WhatsApp, Instagram, Kaspi, Google, Apple.

## 9. Render Staging

- Frontend route rewrite works on page refresh.
- Backend health endpoint returns 200.
- CORS allows frontend domain.
- `/api/auth/me/` returns current user and memberships.
- Cold start delay is acceptable or documented for free tier.

