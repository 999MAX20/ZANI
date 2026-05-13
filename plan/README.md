# NeuroBoost Roadmap

Основной рабочий план лежит в:

```text
plan/neuroboost_codex_step_prompts.docx
```

## Правила выполнения

- Один prompt = один изолированный этап.
- Не переходить к следующему этапу, пока текущий не прошел проверки.
- Не смешивать public product core и internal developer tools.
- После каждого этапа запускать:

```bash
python manage.py check
python manage.py test
cd frontend && npm run build
```

## Очередность этапов

1. Platform Access Foundation — выполнено.
2. Platform Layout Polish — выполнено.
3. Security Hardening — выполнено.
4. Public Website Shell — выполнено.
5. Billing Foundation — выполнено.
6. Merchant CRM UI Upgrade — выполнено.
7. Bots Foundation — выполнено.
8. Website Chat Widget Foundation — выполнено.
9. Telegram Integration Skeleton — выполнено.
10. AI Core Foundation — выполнено.
11. AI Assistant for CRM — выполнено.
12. AI Bot Replies MVP — выполнено.
13. Automation Foundation — выполнено.
14. Notifications and Tasks Polish — выполнено.
15. Production Infrastructure.
16. Internal Dev Tools Boundary.
17. Final Smoke Test.

## Архитектурные границы

- Public product core: основной Django backend и React frontend.
- Infrastructure: PostgreSQL, Redis, Celery, Docker, storage, monitoring.
- Internal developer tools: parser, landing generator, developer outreach, prospect scraping. Эти инструменты не добавляются в product core до отдельного этапа.
