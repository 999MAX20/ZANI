# PRIMARY-SESSION — Platforma.CRM

Дата: 2026-09-24. Это карточка исполнения, не продуктовый backlog.

## Managed handoff command — implemented and docs-verified, 2026-09-25

- Source: owner approved the proposed one-command handoff; archive-button trigger
  explicitly not needed. Mode: instruction implementation; gap: workflow entry point.
- Owner: registered primary 01a0c36e-33aa-7c72-be9b-72624dd2c739; canonical
  C:\Users\user\Desktop\Zani; branch codex/ui-testing-toolkit; clean base
  61b2b6400381793cd2daca63915dad40cea9e8eb; registry idle, no other dirty paths.
- Scope: AGENTS command routing; existing SESSION_ROLLOVER command, prompt and
  failure/retry procedure; STATUS and project handoff routing; this checkpoint.
  Reuse native create/read/wait/send/archive tools and existing registry, no new daemon.
- Observable result: future explicit command «Передай работу новому чату» authorizes
  one same-project/local successor named Platforma.CRM, prepared context prompt,
  read-only comprehension review, exclusive-owner switch and source archive/readback.
- Acceptance: explicit trigger differs from quotes/setup/close/compact; project identity
  and source root checked; ambiguous creation never blindly retried; successor cannot
  write before verification; release survives source archival; failures keep source/
  pending transition recoverable; no new product scope is inferred.
- Non-goals: actual handoff in this setup task, registry/hook/CI/app changes, archive
  event automation, new worktree, deployment or live providers. Runtime impacts N/A.
- Gates: docs diff/index/range hygiene, local links, tool-schema and scenario review,
  explicit commit/push/readback; report actual CI separately. Full backend/frontend CI
  is not an acceptance prerequisite for this docs-only task; do not wait merely because
  push starts it. Actual cross-chat end-to-end transfer remains untested until invoked.
- Previous rules phase complete: 61b2b64, both CI jobs success; receipt in
  output/agent-rules-20260924/result.json. No need to repeat those checks.
- Implemented: explicit command routing in AGENTS; same-project/local tool sequence,
  prepared successor + finalization prompts, comprehension checklist and retry/failure
  table in existing protocol. STATUS and project handoff route to the command; prior
  rules phase no longer appears unfinished. Registry and hook files unchanged.
- Docs verification PASS: added Markdown links resolve; complete intended diff and
  tool signatures reviewed; git diff --check. Scenario review covered setup vs actual
  command, incomplete source, duplicate/ambiguous create, wrong comprehension,
  awaiting_archive retry, missing archive confirmation and repeat after release.
  This is instruction review, not an executed cross-chat test or hook activation.
- Exact staged/range checks, final SHA, push/readback and observed CI are recorded
  in output/managed-handoff-20260925/result.json. Only docs changed; no app tests,
  install/build, live provider calls or working-DB operations were required/run.
- Completion boundary: verified instruction setup + normal publication, not actual
  transfer. After publication stop. Next permitted action is an explicit user command
  to hand off, or a separately selected product task; neither starts automatically.

## Streamline repository instructions — locally verified; publication tracked in receipt, 2026-09-24

- Source: owner voice request to rewrite AGENTS.md after discussing focused checks,
  concise rules and recovery. Mode: documentation; gap: policy clarity, not runtime.
- Owner: registered primary; canonical C:\Users\user\Desktop\Zani;
  branch codex/ui-testing-toolkit; clean base 4f8ca077969763040901b973bb9839f13fd86ec3.
- Scope: AGENTS.md, recovery clarification in SESSION_ROLLOVER, STATUS.md and this
  checkpoint. Reuse testing matrix, task template and existing domain contracts.
- Result: shorter root instructions with ordered workflow and risk-based checks;
  no lost security/domain/publication/UI invariant. Unexpected chat loss permits
  read-only reconstruction, not self-appointed ownership or automatic transfer.
  Actual exceptional transfer requires an explicit owner decision and evidence.
- Non-goals: application code, CI configuration, hooks, registry mutation, new chat,
  archive, deployment, test weakening or product phase. All runtime impacts N/A.
- Required gate: full old/new rule comparison, link and command consistency,
  working/index/range hygiene, reviewed explicit docs commit, normal HEAD:main
  push/readback and actual CI. No local application rerun for unchanged inputs.
- Previous root-status phase published as 4f8ca07; both CI jobs successful:
  https://github.com/999MAX20/ZANI/actions/runs/36040110474.
- Implemented: AGENTS reduced from 475 to 229 lines (24428 to 15936 characters),
  ordered workflow and verification matrix; unavailable-chat diagnostic path added
  to existing rollover protocol. Explicit owner recovery decision still required;
  no self-assignment, automatic transfer or new registry/hook behavior.
- Verified: old/new rule-group review, all local links/contract paths, working diff
  hygiene PASS. Report/commands, staged/range hygiene, final SHA and actual CI:
  output/agent-rules-20260924/report.md and result.json. No app rerun for docs only.
- Next: normal publication/readback and CI. COMPLETE_PUBLISHED_CI_SUCCESS receipt
  closes this phase; stop without starting another task or transferring ownership.

## Root status entry point — locally verified; publication tracked in receipt, 2026-09-24

- Source: owner voice approval «давай попробуем реализовать» after discussing
  recovery in a new chat. Mode: documentation implementation; gap: evidence routing.
- Result: root STATUS.md summarizes current state, completed work, decisions,
  blockers and one next step; links retain detailed evidence in existing owners.
- Owner: registered primary; canonical C:\Users\user\Desktop\Zani;
  branch codex/ui-testing-toolkit; clean base 443f69ed317a4f7f35ad07fe11ad0b4f5d40ded8.
  No pre-existing WIP; registry idle. Scope: STATUS.md, AGENTS.md, docs index,
  task template and this checkpoint. No application/hook/registry changes,
  automatic transfer, new product phase or new backlog.
- Acceptance: a new reader can locate scope, closure evidence, remaining work,
  authority and next action without chat history; status updates required at
  meaningful checkpoints; missing local evidence is explicit, not assumed PASS.
- Reuse: PRIMARY-SESSION, project handoff, session registry and rollover protocol.
  Permission/tenant/notification/BusinessEvent/AI runtime/migration/env: N/A, docs only.
- Required gate: working/index/range diff hygiene, local links and consistency
  review, secret/untracked review; normal HEAD:main publication and SHA readback.
  Full application rerun not required for docs-only delta. Record actual CI
  separately; do not infer green from prior code evidence or a queued run.
- Implemented: STATUS.md with current/product state, approved decisions,
  limitations, recovery path and maintenance cadence; AGENTS/template/index routing.
- Verified: new local Markdown targets exist; source/decision/ownership consistency
  reviewed; git diff --check PASS. Staged/range hygiene and exact publication/CI
  outcome are recorded in output/status-entry-20260924/result.json.
  No runtime tests/build/live calls: application inputs unchanged, docs-only gate.
- Next: reviewed docs commit, normal publication/readback and actual CI; then stop.
  COMPLETE_PUBLISHED_CI_SUCCESS in the receipt closes publication. New chat creation,
  ownership transfer and archival are not part of this task.

## Simplified AI agent setup — locally verified; publication tracked in receipt

- Authorization: owner approved profile → knowledge → behavior → test → launch
  workflow (annotation «согласен — приступай»); bounded implementation phase.
- Roots: V1-A01/A02/A10 and AI_ASSISTANT_RULES. Gap: code/user-flow/evidence.
- Owner primary 01a0c36e-33aa-7c72-be9b-72624dd2c739; single writer, registry idle.
  Canonical C:\Users\user\Desktop\Zani; branch codex/ui-testing-toolkit;
  clean base feeb006e157008083e2136e15333cdde5e25d23f. Keep current branch.
- Reuse bot lifecycle/readiness, profiles, knowledge, provider/qualification/
  scheduling, existing API and UI primitives. Simplify primary profile form,
  dental role preset, advanced prompts/temperature, clear behavior controls,
  typed dry-run dialogue using saved settings and shared runtime decisions.
- Acceptance: saved name/language/tone/rules affect replies; existing business
  services/prices/schedules and knowledge are reused; preview supports draft
  agents without channels, exposes sources/provider/handoff, creates no CRM,
  Inbox messages or notifications; role/tenant denial, provider failure, empty
  knowledge and mandatory staff confirmations remain enforced; readiness and
  activate/pause reachable; desktop/mobile/i18n/error/dirty-state coverage.
- Permission impact: preview requires existing ai_automation:manage and
  ai_assistant:suggest; no new roles. AI request logs/usage use existing layer.
  No notification/BusinessEvent side effects from preview. No migration/env
  changes intended; no working DB modifications. No channels, public deploy,
  chairs, billing or prior closed foundation redesign.
- Checks: focused isolated Django tests; frontend build/i18n; targeted UI smoke
  and manual desktop/mobile with disposable fixtures; bounded live provider
  proof where needed; full codex_verify --mode full --base-ref feeb006e157008083e2136e15333cdde5e25d23f
  after code candidate. Review explicit diff, normal push HEAD:main, readback
  SHA and actual backend/frontend CI. Prior phase receipt is COMPLETE.
- Current checkpoint: implementation committed as 56e1853b8203ad6fe2d9f6398e1cb01f8aba19ab;
  deterministic test-fixture correction committed as
  7200a4bf183f7300cc9f9ecfac7e390610a897e9. Final closeout changes only docs;
  application/test inputs are frozen. Publication/CI readback belongs to receipt.
- Verified: 41 focused tests PASS; final desktop/mobile setup + behavior-save
  tests 2 PASS /1.9m. Screenshots inspected; no horizontal overflow. Live bounded
  OpenRouter tests: price KZT, real next-day slots, complaint handoff, saved KK
  reply, no CRM/Inbox/notification writes. 13 provider calls total; disposable
  databases removed. First live cases exposed missing currency/date and ignored
  KK; minimal context/system-language fixes and rechecks recorded in report.
- Initial full gate on 56e1853: 1158 tests /936.851s, exactly 1 failure + 1 error
  in unchanged today's-hours bot fixtures after 17:00 UTC. Exact focused
  reproduction failed; same tests PASS at 08:00 UTC (2/2.068s). Moved only those
  fixtures to tomorrow, all assertions retained; real-clock 2 PASS /1.933s.
  This is proven clock-sensitive baseline, not a product scheduling regression.
- Required final full gate on 7200a4b PASS, exit 0:
  `.venv\Scripts\python.exe -X utf8 scripts/codex_verify.py --mode full --base-ref feeb006e157008083e2136e15333cdde5e25d23f`.
  Log output/agent-setup-20260924/full-final-gate.log: 1158 tests /953.162s PASS;
  check/migration drift, app/widget build, 5007 RU/KK/EN keys, bundle budgets,
  2 mobile role tests /1.2m and pip/npm audits PASS (no known vulnerabilities).
  Earlier full-gate.log remains FAILED; frontend/security stages had not run.
- Evidence/report/status: output/agent-setup-20260924/report.md and result.json.
  UI iteration failures were fixture precondition/custom-combobox test issues;
  initial live testserver host rejection happened before any provider call.
- Remote main is feeb006 (ls-remote and GitHub readback); local fetch mapping
  excludes main, so use explicit refs/heads/main:refs/remotes/origin/main.
  Publication: normal push HEAD:main after docs hygiene/outgoing review; exact
  final SHA, remote readback and backend/frontend CI in result.json. Only
  COMPLETE_PUBLISHED_CI_SUCCESS closes this phase; pending/failure stays unfinished.
  Stop after that receipt; no further product phase or task rotation authorized.
  No working DB/.env changes, public deployment, new channels or further phase.

Previous phase below is closed by output/ai-quality-20260922/result.json.

## V1-A01/A02/A10 — locally verified; publication tracked in receipt

### Local closeout — 2026-09-24

Owner resumed the same phase. Canonical root C:\Users\user\Desktop\Zani,
branch codex/ui-testing-toolkit, primary registry idle, clean resume HEAD
2a3cab1. Application/config/lock/runner inputs are identical to code candidate
26d0ad8bbb6356f4221b7888b9739976ac721bf1; subsequent changes are docs only.

All required local stages are now proven for those unchanged application inputs:
- Preserved full-run evidence: 1151 Django tests /944.729s, drift/system check,
  npm ci/Vite isolation, 4980 RU/KK/EN keys/types/app/widget/bundle and 2 mobile
  role smoke /1.4m PASS; synthetic live GPT-4o and manual desktop/mobile PASS.
- Resumed command PASS:
  `.venv\Scripts\python.exe -X utf8 scripts/codex_verify.py --mode security --base-ref 4f99927c25f44570a6686e1e092c8d7991f4ecda`.
  Both hashed Python lock installability checks, pip-audit (no known
  vulnerabilities), npm audit --audit-level=moderate (0 vulnerabilities),
  drift/system check and diff hygiene PASS. Log: security-resume-20260924.log.
- This completes the interrupted full-stage set by reusing unchanged verified
  inputs; the historical full command remains recorded as interrupted, not
  rewritten to PASS. No backend/frontend/live repetition needed for docs alone.
- Scope verified: permitted staff sources/no-data, analyst source validation,
  bot settings/knowledge/scheduling, handoff without automatic CRM creation,
  safe provider errors, requester-only queued jobs/replay and UI recovery.

Outgoing range reviewed against fetched main4f99927; only task-owned code/tests/
docs, no credentials or unrelated WIP. CI workflow contains checks, no deploy.
Closeout doc links/diff hygiene require review before commit. Final commit,
normal push HEAD:main, remote SHA readback and actual CI are recorded in
`output/ai-quality-20260922/result.json`, with exact commands/limits in report.md.
Until COMPLETE_PUBLISHED_CI_SUCCESS, publication/CI remain unfinished. After
that receipt this phase is complete; stop without starting the next product phase.

Skipped: additional paid calls and repeated unchanged suites (evidence reused);
real worker/channel delivery, deployment, working-DB migrations, RAG, arbitrary
answer accuracy and billing acceptance remain outside this phase. The local
server receipt is historical, not a current uptime claim. Temporary live
fixtures were already removed. No new runtime was started on resume.
Next unstarted scope: simplified agent setup and separately authorized channels.
Previous finance/scheduling/staff-confirmation closures remain intact.

The following pause and original contract are historical continuity evidence.

### Historical pause — 2026-09-22

Owner: «зафиксируй выполненные задачи; продолжим завтра». Stop implementation
and publication now; no phase completion or automatic continuation authorized.
Canonical root/branch unchanged. Code committed locally as c2c5e6a and
26d0ad8bbb6356f4221b7888b9739976ac721bf1; remote main readback remains
4f99927c25f44570a6686e1e092c8d7991f4ecda. No push for this package.

Latest full command:
`.venv\Scripts\python.exe -X utf8 scripts/codex_verify.py --mode full --base-ref 4f99927c25f44570a6686e1e092c8d7991f4ecda`
Evidence `output/ai-quality-20260922/full-gate.log` on 26d0ad8:
- PASS: drift/system check, 1151 Django tests / 944.729s;
- PASS: npm ci, Vite env isolation, 4980 RU/KK/EN keys, types, app/widget builds,
  bundle budget, 2 mobile role smoke / 1.4m;
- PASS: Python application and verification-tool lock installability;
- INTERRUPTED: Python dependency audit exited 1073807364; no vulnerability
  conclusion available. Frontend dependency audit/final hygiene not reached.
  Full gate is incomplete, not green. No remaining owned gate/provider process.

Live GPT-4o and manual desktop/mobile results below are preserved. Disposable
live DB removed, owned test servers and browser tab closed, viewport reset.
Requested ordinary backend intentionally remains on http://127.0.0.1:8000,
health200, code26d0ad8; launcher31564/listener27528 (reverify before touching).
Working DB and .env unchanged, no working migrations. Receipts/report under
output/ai-quality-20260922; only bounded synthetic data used.

Resume: read this checkpoint, reconcile Git/ownership and unchanged app inputs.
Finish remaining dependency-audit/hygiene stages with
`.venv\Scripts\python.exe -X utf8 scripts/codex_verify.py --mode security --base-ref 4f99927c25f44570a6686e1e092c8d7991f4ecda`.
Reuse exact unchanged backend/frontend/browser evidence above; do not repeat
implementation or completed live calls. Code/lock changes invalidate affected
checks. Then final review, docs closeout, normal push HEAD:main, SHA readback and
actual CI. Do not start agent-page redesign/channels or rotate tasks. Prior
completed finance/scheduling/staff-confirmation phases must not be reopened.

Below is the original phase contract and chronological evidence.

- Authorization: owner "приступай" after file/logic scope and request for broad
  tests; small synthetic CRM fixtures and real OpenRouter requests authorized.
- Mode implementation/verification; gap code/evidence. One phase: all three AI
  surfaces use scoped facts, expose missing/invalid/provider-error states, and
  recover without bypassing the completed staff-confirmation contract.
- Owner primary 01a0c36e-33aa-7c72-be9b-72624dd2c739, single writer; canonical
  C:\Users\user\Desktop\Zani, branch codex/ui-testing-toolkit, clean starting
  HEAD/base 4f99927c25f44570a6686e1e092c8d7991f4ecda, registry idle.
- Reuse ai_core provider/prompt/context/job/analyst layers, bot reply/lifecycle,
  Inbox qualification, existing AI API/UI and tests. Fix observed gaps only.
- Acceptance matrix: scoped staff answer + citations; analyst valid/malformed/
  unknown sources/no-data; bot knowledge/settings/real scheduling context and
  escalation; provider timeout/401/429/5xx/empty response with safe errors;
  queue retry/replay; cross-business/role denial; CRM confirmations unchanged;
  UI success/loading/error/recovery; a small real GPT-4o scenario set.
- Permissions/tenant remain enforced; no new capabilities or financial claims.
  Notifications/BusinessEvents reuse existing handoff/audit; no external sends.
  Env: keep secrets ignored; no planned schema migration. Prefer disposable DB
  for repeatable tests despite owner allowing small working-data fixtures.
- Non-goals: agent-page redesign, new channels/public deployment, chairs,
  billing/pricing policy, mass messaging, unrelated CRM work. Do not reopen
  completed finance/scheduling/confirmation foundations without regression.
- Required gates: isolated focused regressions, affected AI/bot/conversation/
  permission/job suites and check/drift; frontend i18n/type/build; reachable
  desktop/mobile UI/API; full candidate gate with this base, reviewed normal
  push origin/main, readback and actual CI. Live checks separate from mocked CI.
- Existing owned server: launcher 24872 / listener 26848, port8000, canonical
  root, process-only synchronous AI. Verify identity before restarting; no
  other process may be stopped. Evidence in output/openrouter-live-20260922.
- Implementation ready for candidate gate: shared provider failures never become
  live-looking mocks; bounded JSON/source validation; scoped job visibility and
  execution-time permission refresh; UI accepts queued jobs and source chips.
  Bot model/temperature validation, relevant knowledge, current-request schedule
  and complaint/provider-failure handoff reuse existing domain services.
- Focused evidence: 141 tests PASS (117.629s), then 55 PASS, then 78 PASS
  (38.674s). Final small regression invocation had an invalid module label
  apps.bots.tests_scheduling; its 23 quality tests passed, label error is not
  an application failure. Full suite remains required after candidate commit.
- Live OpenRouter/openai/gpt-4o: 8 API cases succeeded (staff price/tasks,
  no financial data, malicious invented revenue, bot price/free slots,
  analyst source, complaint qualification). Final extra checks: complaint
  handoff + replay creates no CRM records or outbound; absent doctor has no
  offered slot; analyst Russian output and server-owned navigation.
- Browser manager desktop/mobile: queued loading, safe failed-response state,
  retry recovery and CRM-summary source chip observed. JSON code fences from
  GPT-4o are normalized before the same strict source validation. Last inbound
  message takes priority when the client changes specialist.
- Environment: isolated SQLite + loopback Vite/Django from canonical root,
  Celery eager with memory broker/cache result backend. This does not verify
  Redis/worker recovery, real channels, deployment or paid usage accounting.
  Working DB and .env unchanged; no migrations. Limited lexical knowledge
  retrieval and source-ID validation do not prove semantic hallucination-free
  answers, RAG or arbitrary natural-language date/doctor matching.
- First full gate on c2c5e6a: Django drift/check and 1151 tests PASS
  (894.463s); npm ci failed EPERM because the owned live Vite held its native
  binding on Windows. Close owned live runtime before install; no baseline
  application failure claimed. Final review additionally hardened malformed
  provider finish_reason and transport/encoding errors; repeat full gate on
  the updated candidate, not reuse an obsolete application snapshot.
- Browser cleanup: temporary viewport reset and tab closed; synthetic runtime
  stop requested. Usage receipt excludes rejected outputs, is not billing.
- Candidate/full gate/publication/CI pending. Receipt and exact commands:
  output/ai-quality-20260922/{report.md,result.json,full-gate.log}; absence of
  COMPLETE_PUBLISHED_CI_SUCCESS means unfinished. Next: reviewed candidate,
  full gate, final cleanup/owned-server refresh, normal push and actual CI.

## V1-A03–A09 — подтверждение локально проверено; публикация по квитанции

Code candidate `ade376c0be57a4073428721dbe6f2ea4d16e7310`, base
`8b41489f96f2c9d7a5cbc85bca560eae860e6ee9`; canonical root и branch прежние.
Full gate PASS: `.\.venv\Scripts\python.exe -X utf8 scripts/codex_verify.py --mode full --base-ref 8b41489f96f2c9d7a5cbc85bca560eae860e6ee9`.
1128 Django tests / 1339.085s; migration drift/system check, npm ci,
RU/KK/EN 4976 keys/type/app/widget builds, bundle budget, 2 mobile smoke / 1.8m,
Python lock installability и Python/npm audits PASS. Working tree clean на candidate.

CUA final desktop/mobile 390x844: preview, cancel, task-only creation/replay,
new inbound invalidates open proposal, clear localized error and recovery through
new preview PASS. API readback: одна задача этого диалога, без Lead/Deal;
`output/ai-confirmation-20260922/browser-result-final.json`. Свои серверы/изолированная
БД закрыты, tab закрыт, viewport reset. Permissions/tenant проверены backend suites.

Этот closeout меняет только docs; application inputs равны проверенному candidate.
Normal push origin/main/readback и actual CI записываются в
`output/ai-confirmation-20260922/result.json`; точные commands/failures/skips/review —
в соседнем `report.md`, полный вывод — `full-gate.log`. До статуса
COMPLETE_PUBLISHED_CI_SUCCESS публикация/CI не считаются выполненными.
После квитанции завершена только эта фаза подтверждения, остановиться.
Следующее незавершённое: качество/источники/сбои трёх AI-направлений и live
приёмка, затем разрешённое подключение каналов; автоматически не начинать.
Не проверялись real AI/channels, billing, deploy, working DB migrations — вне scope.

Ниже исходный контракт и промежуточные checkpoints; их pending формулировки
исторические и не переоткрывают пройденные проверки.

- Авторизация: «приступай» после разбора кода и предложения первым закрыть
  единые правила действий ИИ. Mode implementation; gap code/policy conformity
  and evidence. Источники: V1_PRODUCT_RULES §6, local-crm-completion §5.
- Результат одной фазы: входящий диалог и ИИ не создают Lead/Task/Deal без
  конкретного подтверждения уполномоченного сотрудника; рабочий UI позволяет
  проверить предложение и выполнить ровно выбранные действия один раз.
  Автоматическая карточка клиента допустима; запись/перенос/отмена и результат
  сделки остаются действиями сотрудника. Автоответ и входящие сохраняются.
- Owner primary `01a0c36e-33aa-7c72-be9b-72624dd2c739`, единственный writer;
  canonical `C:\Users\user\Desktop\Zani`, branch `codex/ui-testing-toolkit`,
  starting HEAD/base `8b41489f96f2c9d7a5cbc85bca560eae860e6ee9`, clean tracked,
  staged and untracked snapshot. Registry idle; ветка и папка сохраняются.
- Reuse: conversation pipeline/qualification/booking, существующий AI preview,
  approval/tool execution/replay/audit, Inbox actions, agent settings/i18n.
  Старые авто-режимы и tests закрепляют автоматическое создание — это явное
  несоответствие утверждённому V1, а не переоткрытие ZD-009 или scheduling.
- Scope: минимальные domain/API/UI изменения для этого контракта, regressions,
  существующий runtime check и актуальные документы. Non-goals: качество LLM,
  RAG, analyst rewrite, live AI/channels, billing, рабочая БД, кресла/рассылка,
  политика closed/archive/spam и сторонние автоматизации/формы без AI.
- Permissions/tenant: сохранять существующие права, проверять конкретные
  действия и связанные сущности на backend; отказ без частичных записей.
  Notifications: существующие employee review/result notifications, без новой
  внешней рассылки. Activity/audit отражают предложение и подтверждённый результат;
  BusinessEvent не расширять. AI: общая граница подтверждения всех затронутых путей.
  Schema/env: миграции и настройки окружения не планируются, провайдеры отключены.
- Acceptance: legacy settings не обходят подтверждение; разрешённый автоответ
  продолжает работать; actionable UI preview → staff confirmation → CRM result;
  отмена/отказ/устаревшее предложение/повтор/чужая компания покрыты; no automatic
  appointment/deal outcome. Поддерживаемые RU/KK/EN согласованы.
- Required checks: isolated focused regression, affected AI/bots/conversations
  permission/lifecycle suites + check/drift; frontend i18n/type/build и targeted
  desktop/mobile browser; полный `codex_verify.py --mode full --base-ref 8b41489f96f2c9d7a5cbc85bca560eae860e6ee9`
  после candidate commit; normal push origin/main/readback и actual CI.
- Delivery: reviewed conventional commit, normal push to agreed origin/main,
  CI; без deployment/live acceptance. Последний финансовый пакет COMPLETE
  по `output/v1-finance-source-20260922/result.json`, не переоткрывается.
- Checkpoint 11:32 UTC: task-owned local diff; branch/base unchanged. Backend
  and desktop/mobile Inbox implement preview, selected actions and explicit
  staff confirmation. Website chat bypass removed; lead.captured now occurs
  at actual confirmed creation. Preview replacement/new-message/race guards,
  domain permissions/tenant and replay audit are covered.
- Focused PASS: 36 tests / 38.441s (`output/ai-confirmation-final-focused.log`),
  preview delta 10 / 9.867s, final 11 / 5.758s including event/audit exactly once
  (`output/ai-confirmation-20260922/final-event-regression.log`). Each wrapper
  also ran check and makemigrations --check --dry-run in isolated runtime.
- Initial failures: 79 tests with 7 FAIL/2 fixture errors, then affected 140
  tests with 2 old expectation failures; corrected under the approved contract.
  Full suite is still required, no broad PASS inferred from focused results.
- Frontend build/i18n/type/app/widget/bundle and 11 policy tests PASS before
  final mobile/copy delta; initial missing actions.cancel fixed to common.cancel.
  Final delta will be covered by full candidate gate.
- Browser: isolated canonical servers, desktop preview/cancel/task-only confirm
  and mobile 390x844 accessible confirmation/replay PASS. API readback: one
  task, no lead/deal. `output/ai-confirmation-20260922/browser-result.json` records
  boundary: backend preceded final event/preview race delta. Owned servers
  stopped and isolated runtime cleaned. Final candidate browser recheck remains.
- Browser candidate delta: stale preview was correctly rejected but UI displayed
  generic validation. Fixed explicit RU/KK/EN recovery text using preview_id field
  errors; CUA mobile confirms error and new-preview recovery. First full run on
  2045f32 interrupted during backend for this UI fix (not a PASS/FAIL result).
  Owned gate processes confirmed stopped. Restart full on corrected candidate.
- Next: reviewed candidate commit then full gate against the true starting base;
  final browser, exact evidence/docs, normal push/readback and actual CI.
  No migrations on working DB, providers/live channels, billing or next phase.

## V1-M01/M02 — локально проверено; публикация по конечной квитанции

Code candidate `cc7050eb8f1ac5b59a56ff4ae922f6eb17aebadd`, base `5821941`.
Полный gate PASS: `.\.venv\Scripts\python.exe -X utf8 scripts/codex_verify.py --mode full --base-ref 5821941880f1ed26aa1e34e34e155de1f326b813`.
1117 Django tests / 994.257s, migration drift/system check, npm ci, i18n/type,
app/widget builds, bundle budget, 2 mobile owner/manager smoke и Python/npm audits
PASS. Canonical root/branch/owner прежние, рабочая папка чистая после code commit.
Следующий commit только обновляет эти docs; application inputs не изменяются.

Публикация normal push origin/main, точный remote readback и фактический CI
фиксируются в `output/v1-finance-source-20260922/result.json`; подробные commands,
failures/skips и review — в `report.md` той же папки. До конечной квитанции
COMPLETE_PUBLISHED_CI_SUCCESS публикация/CI не считаются выполненными.
Ниже — исходный контракт и промежуточные checkpoints; их pending формулировки
не переоткрывают пройденные проверки. После публикации остановиться в этом scope.

Ограничения: production financial readers отсутствуют; проверенный конкретный
провайдер не добавлен. Положительные состояния доказаны isolated API/UI fixtures.
Рабочая БД, live channels/AI/accounting, billing, deploy не затрагивались.
Два старых optional daily-workspaces policy FAIL воспроизведены на base, не
ослаблены; обязательный full gate и текущие flows PASS. Авто-проверка запретила
удаление одной остаточной тестовой temp-папки (`blocked by policy`); она оставлена.
Исправленная очистка собственных тестовых процессов отдельно прошла проверку.

- Owner authorization через Оркестратор 2026-09-22: «да» на отдельный ручной
  журнал и финансовые показатели общей аналитики только из проверенной
  подключённой учётной системы. Прежнее предложение суммировать Payment ledger
  в общие financial KPI отменено. Источник: V1-M01/M02 и блок 4 local-crm-completion.
- Mode: implementation; gap: approved policy change + code/UI/API evidence.
  Один полный ограниченный пакет; не вся очередь пилота.
- Единственный writer/primary `01a0c36e-33aa-7c72-be9b-72624dd2c739`, registry idle.
  Canonical root `C:\Users\user\Desktop\Zani`, branch `codex/ui-testing-toolkit`,
  clean starting HEAD/base `5821941880f1ed26aa1e34e34e155de1f326b813`.
  Snapshot: `output/v1-finance-source-20260922/starting-snapshot.json`.
- Observable result: ручной журнал сохраняет данные/входы/права/историю/replay и
  называется «Ручной учёт». Общая финансовая аналитика показывает поступления,
  возвраты и итог только при проверенном источнике с полным покрытием периода;
  иначе явное unavailable, не ноль. Операционные CRM показатели остаются.
  Ошибка/остановка обновления не стирает прежний доступный снимок: предупреждение,
  источник, период, реальное время последнего успешного обновления. Нет снимка —
  нет финансовых данных. Ноль допустим только при подтверждённой полноте периода.
- Reuse: Payment ledger/services/UI без новой денежной записи; analytics dashboard,
  reports/exports и потребители; BusinessConnector, ConnectorSyncRun/provider/status
  слой, общие permissions, frontend API/i18n/design primitives. Не дублировать
  аналитику и не считать generic sale BusinessEvent подтверждением поступления.
- Discovery: dashboard суммирует service.price_from и generic sales events;
  source ROI/LTV выводят оценки. Зарегистрированные коннекторы не доказывают
  полноту финансового периода/верификацию поступлений. Production не получает
  выдуманный финансовый источник; положительные состояния только в явных
  изолированных проверках контракта. TTL и правила внешней сверки не выдумывать.
- Scope: минимальный общий контракт доступности/источника/периода/актуальности,
  соответствующие backend/API/frontend и AI/export потребители, профильные тесты,
  канонические V1/client-payments/CRM/inventory docs. Требования уточняются сейчас;
  реализацию не отмечать завершённой до gate/publication/CI.
- Permissions/tenant: сохранить backend scope, не раскрывать общий финансовый
  снимок через OWN/TEAM или чужой business; просроченность не обходит права.
  Notification/BusinessEvent writes: новых отправок/триггеров нет. AI: только
  источник/контекст и no-data граница, без живых запросов и новых write actions.
  Billing SaaS/entitlements не менять и не скрывать как финансы клиники.
- Schema/env: переиспользовать существующий integration слой; необходимость
  схемы установить по коду. Любая намеренная migration только generation/test DB.
  Не делать конкретный коннектор/1C/MacDent, live API/AI/WA/Instagram, новые метрики,
  долг/бухгалтерию, redesign/pricing, scheduling, Market, deploy, working-DB
  migrate/seed, worktree или ротацию.
- Acceptance: API и browser для no source, first/incomplete load, verified zero,
  receipt+refund, failed sync after successful snapshot; без двойного учёта;
  manual journal сохранён отдельно; permission/tenant denial и consumers/export
  не дают обхода; source/period/as-of не выдуманы. Live integration не объявлять.
- Gates: isolated focused analytics/integrations/payments/affected AI/access/export;
  type/i18n/build и targeted browser всех состояний + ручного журнала; full gate
  на code candidate против captured base; review, explicit commit, normal push
  origin/main, remote readback, фактический CI. Остановиться после этого пакета.
- Checkpoint 2026-09-22: HEAD/base прежний `5821941`, diff только этого пакета.
  Общий financial_report/adapter contract, API/UI/RU/EN/KK, estimates/CSV и AI
  boundary реализованы; production registry пустой, schema без изменений.
  PASS: первые 12 contract tests; affected 274 имел один старый assertion о
  «росте» из CSV-суммы, исправлен под утверждённое правило; analytics 21 PASS;
  итоговые analytics/AI/import-export 75 PASS. Check/migration drift PASS.
  I18n 4963 keys и tsc PASS. Desktop/mobile: 14 групп assertions PASS — no-source,
  manual receipt/refund/replay/оба входа, initial/zero/positive/stale/stopped.
  Положительная финансовая UI-проверка — явные response fixtures, не live provider.
  Уточнение: final browser assertions PASS; ошибка wrapper только при cleanup
  временной SQLite на Windows; адресный cleanup-only PASS после завершения
  собственного дерева процессов. Все browser assertions прошли до этой ошибки.
  Optional daily-workspaces policy: 4 PASS / 2 FAIL, те же два FAIL доказаны
  read-only на `5821941` через git show in-memory. Не ослаблены и не исправляются
  вне scope; backend permissions и reachable flows проверены отдельно.
  Следующий шаг: review/кандидат, обязательный full gate против captured base,
  затем normal push/readback/actual CI. Commit/push ещё не выполнены.
  Evidence: `output/v1-finance-source-20260922/`, точные commands/results/skips
  в `report.md`; текущий статус всегда сверять с конечным `result.json`.
- Закрытый scheduling пакет на `5821941` завершён с push/CI; его квитанция
  `output/v1-scheduling-20260921/result.json` = COMPLETE_PUBLISHED_CI_SUCCESS.
  Старые pending формулировки ниже — история. Scheduling/W05/W06/Git не повторять.

## V1-F06 / V1-W02 — реализация проверена, публикация по квитанции

Финальный local checkpoint 2026-09-21: полный gate PASS на code candidate
`47c998b994e3c993fb4b9029d02309d1038b502f`, base
`1d876d9216ced0c9815d4b0de62ef0a583cc1c85`. Canonical root/branch/owner ниже
не изменились, candidate clean. Следующий commit содержит только документацию;
application tree остаётся тем же проверенным кандидатом.

- Команда: `.\.venv\Scripts\python.exe scripts/codex_verify.py --mode full --base-ref 1d876d9216ced0c9815d4b0de62ef0a583cc1c85`.
- PASS: migration drift/system check, 1103 Django tests / 856.560s, npm ci,
  i18n/type/build/widget/bundle, 2 mobile owner/manager smoke, hashed lock
  installability, Python/npm audits и итоговый working/index/range diff hygiene.
- До full: affected 142 PASS, final focused 86 scheduling + activities PASS;
  14 specialist tests включают login/membership independence и foreign denial.
  Desktop/mobile отсутствие: 10 записей/3 клиента → замена → 9 → отмена → 8,
  pagination >50 часов; calendar create/reschedule и weekly/deep-link PASS.
  Два прежних mobile duplicate tests skipped по их дизайну, новый absence mobile
  и обязательные mobile owner/manager выполнены.
- Первые failures сохранены ниже/в логах: fixtures без обязательного специалиста,
  прежний auto-booking contract и сохранение прежнего inactive linked account.
  Исправлены; текущих required-gate failures нет.
- Среда: Windows, Python 3.12.14, disposable SQLite, locmem/eager,
  providers disabled/mocked. Migration `scheduling.0008` только в test DB.
  Рабочая БД, deploy, live channels, кресла и несколько смен в день не проверялись:
  они вне текущего scope. Новая рассылка только задокументирована.
- Publication boundary: normal push `origin/main`, exact remote readback и CI
  ещё должны быть подтверждены. Операционная квитанция с конечным SHA/CI/result:
  `output/v1-scheduling-20260921/result.json`; exact commands/logs/skips/review:
  `output/v1-scheduling-20260921/report.md`. Не завершать задачу по одному local PASS.
- После публикации остановиться в этой фазе. Следующие возможности (кресла,
  клиентская рассылка) остаются отдельным scope; общий V1-W02 не объявлен закрытым.

Ниже — исходный контракт и последовательные checkpoints этой же фазы.

Актуальный checkpoint 2026-09-21 19:57 +05:00: candidate `b80d1ff` создан,
но не опубликован. Full gate завершился: 1101 tests / 863.479s, один FAIL —
старый activity fixture создавал запись без специалиста; timeline assertions
сохранены, fixture исправлен. Отдельная isolated диагностика показала 400 вместо
200 при сохранении ResourceForm с прежним отключённым linked_user. Исправление
разрешает сохранение прежней связи, новые inactive/foreign назначения запрещены;
добавлены регрессии. Focused scheduling + activities: 86 tests PASS / 38.129s,
`focused-linked-account.log`. Следующий шаг: новый candidate и полный gate.
`output/v1-scheduling-20260921/result.json` и report.md
хранят текущую квитанцию, точные команды и старые/новые результаты. Публикация и
CI ещё не выполнялись. Более ранние checkpoints ниже — история этой же фазы.

- Owner authorization 2026-09-21: «согласен, приступай к реализации», включая
  собственный график специалиста; вопрос о креслах рассматривается отдельно.
- Mode: implementation; gaps: code + UI/API evidence. Источник:
  `docs/pilot/local-crm-completion.md`, `docs/product/V1_PRODUCT_RULES.md`.
- Единственный writer: primary `01a0c36e-33aa-7c72-be9b-72624dd2c739`.
  Canonical root `C:\Users\user\Desktop\Zani`, branch `codex/ui-testing-toolkit`,
  clean starting HEAD/base `1d876d9216ced0c9815d4b0de62ef0a583cc1c85`.
  Snapshot всех tracked paths: `output/v1-scheduling-20260921/starting-snapshot.json`.
- Observable outcome: администратор добавляет специалиста без CRM-аккаунта,
  задаёт индивидуальную неделю и исключения по датам, создаёт/переносит запись
  на свободное время выбранного специалиста и видит её в его календаре.
- Reuse: Resource + optional linked_user, WorkingHours, availability/services,
  существующие calendar/Resource/WorkingHours forms, lifecycle/audit/notifications.
  Не создавать дублирующую Employee-модель или новый календарь.
- Scope: scheduling services/models/API, связанные lead/inbox booking entrances,
  frontend API/types/forms/resource/schedule views, i18n, соответствующие тесты
  и текущие документы. Разовые изменения смены — отдельные date exceptions.
- Owner confirmed: кресла позже; legacy история сохраняется без автозаполнения;
  новые записи/переносы требуют активного специалиста; CRM login и scheduling
  active независимы. Форс-мажор не отменяет записи: администратор вручную
  переназначает на свободного специалиста или другую дату. Уведомления клиентам
  о таком изменении — желаемая реализация, сейчас только документирование.
- Permissions/tenant: settings:update для специалиста/графика; appointment actions
  сохраняют текущие права и OWN scope. Все связи внутри Business. linked_user
  только активный same-business account при назначении, не обязательный логин.
- Notification/activity/audit: сохранить существующие lifecycle routes/recipients,
  не отправлять приглашение при создании специалиста; новые schedule mutations
  audit через существующий слой. BusinessEvent/integrations: новых событий нет.
  AI: не расширять booking write policy, не обходить staff/availability validation.
- Schema/env: только намеренная migration для exceptions (и кресел, если утверждены);
  generation и test migration в isolated DB; рабочие БД/seed/deploy не разрешены.
  Billing/seat counting, медицинские карты, Market и прочие фазы вне scope.
- Acceptance: atomic creation with editable individual schedule and no login;
  availability/date exceptions/overlap; mandatory selected specialist across
  authorized booking entrypoints after policy resolution; lifecycle and history;
  permission denial, cross-tenant rejection, linked-account independence;
  reachable UI including specialist calendar and errors/loading/empty states.
- Gates: focused isolated scheduling + affected lead/inbox/access regressions;
  migration/check; i18n/type/build; browser create specialist/schedule/book/reschedule
  flow; full candidate integration gate against captured base; reviewed explicit
  commit paths, normal push origin/main, remote readback and actual CI.
- Owner steering: после сохранения отсутствия — окно всех доступных активных
  записей выбранного дня, counts записей/клиентов, ручная замена/перенос/отмена,
  обновляемый остаток. Рассылка/подтверждение клиента документируются отдельно,
  ни интеграций, ни отправки в текущем scope.
- Реализовано локально: atomic Resource + week, ScheduleException/migration/API,
  обязательный active staff в общей availability, legacy note compatibility,
  создание специалиста через два шага, исключения/окно разбора/ручные действия.
  Старый auto-booking по ответу клиента закрыт в пользу staff action по уже
  утверждённой V1 policy; runtime smoke сохраняет реальные проверки после staff
  booking. Контракт: `docs/crm/specialist-scheduling.md`.
- Проверено: первый isolated check + migration drift + 9 новых backend tests PASS;
  dictionary parity PASS после исправления размещения keys, TypeScript PASS до
  последнего test/UI delta. 196 affected tests: 21 несовпадение старых fixtures/
  auto-booking expectations с утверждённым контрактом; assertions overlap/history/
  idempotency сохраняются, fixtures теперь выбирают специалиста, AI tests требуют
  staff booking. Повтор изменённых целей и новый browser flow выполняются.
- Evidence: `output/v1-scheduling-20260921/`; starting-snapshot.json,
  focused-initial.log, affected-initial.log, affected-contract.log, browser-initial.log.
  Delivery: dirty/local only, commit/push/full gate/CI ещё не выполнялись.
  Next: candidate commit и полный integration gate против starting base.
  Не повторять завершённые W05/W06, Git consolidation или governance checks.

Checkpoint 2026-09-21 19:40 +05:00: affected contract rerun 142 tests PASS;
последний focused 82 tests PASS, включая 12 новых specialist tests. Browser:
создание специалиста/недели → 10 записей → отсутствие → замена → отмена PASS на
desktop + mobile; последняя версия дополнительно проверяет неделю при >50 rows
(pagination). Отдельно calendar create/reschedule 2 PASS; deep-link lifecycle
и weekly editor 2 PASS desktop, их прежние mobile duplicates skipped; новый
absence workflow на mobile выполнен. i18n 4939 keys и TypeScript PASS; новые
7 docs links, Python parse и diff hygiene PASS. Screenshots визуально проверены.
Full local integration и actual push CI пока НЕ запускались; локальный PASS
не означает доставку. Рабочая БД/реальные провайдеры не затрагивались.

Профильные exact labels/grep сохранены в логах и итоговом
`output/v1-scheduling-20260921/report.md`; финальная операционная квитанция будет
`output/v1-scheduling-20260921/result.json`. Для range gate нужен task candidate
commit (testing.md); push только после успешного полного gate и review.

## Завершённый bounded governance change — продолжение после compact

Owner decision 2026-09-21 через Оркестратор; единственный writer остаётся
`01a0c36e-33aa-7c72-be9b-72624dd2c739`. Root `C:\Users\user\Desktop\Zani`,
branch `codex/ui-testing-toolkit`, clean starting HEAD и fetched origin/main
`31a8b5f0fc0f4cfb94589206139b42314a0d0f85`.

Предыдущий Git-пакет полностью завершён ДО начала этой правки: normal push,
remote readback совпал, оба jobs и [CI run](https://github.com/999MAX20/ZANI/actions/runs/35603891558)
success; полный local gate и финальный static/docs PASS. Его квитанция:
`output/git-publication-20260921/publication-result.json`.

- Mode: governance implementation + focused verification; gap: прежняя политика
  ошибочно требовала передачи незавершённой работы при compact.
- Outcome: compact/приближение конца окна всегда restore/recheck/continue в той же
  задаче. Ротация возможна только после полного согласованного DoD, checks/review,
  публикации с фактическим CI где требуется, завершения операций и comprehension.
  FAILED/BLOCKED/PENDING/unknown не означают завершения; задачу не дробить ради
  формального готового подпункта. Сжатие движка не отключать.
- Scope/reuse: существующие AGENTS, task template, SESSION_ROLLOVER, handoff,
  checkpoint, project-session registry и read-only Node hook/hooks/unit tests.
  Защиты retired/non-primary/unfinished transition сохранить. Добавить только
  ограниченное идемпотентное завершение уже проверенной передачи записанным
  преемником/оркестратором после native archive readback, без захвата ownership.
- Non-goals: реальная ротация/новые задачи/worktrees, trust bypass, Market,
  scheduling/features, продуктовые permissions/notification/BusinessEvent/AI,
  schema/env/deploy и working DB. Runtime hook activation остаётся не доказана.
- Gates: meaningful node unit/CLI regressions; JSON/metadata consistency,
  changed links/commands, retired/non-primary/transition decisions, complete
  intended diff/secrets review, working/index/committed-range hygiene. Только
  эти профильные local gates; продуктовые suites не повторять. Отдельный reviewed
  commit/normal push origin/main и реальный применимый CI обязательны.
- Starting snapshot/попытки/evidence: `output/governance-continuity-20260921/`.
  Первичная сверка выявила только stale remote-tracking main из-за ограниченного
  fetch-refspec: FETCH_HEAD и ls-remote уже равнялись base. Explicit non-forced
  fetch main:origin/main обновил локальную tracking-ссылку; source drift не было.
- Реализовано: compact всегда restore/continue, legacy auto flag игнорируется;
  complete DoD/comprehension и совпадающие участники/generation нужны для узкого
  HANDOFF_FINALIZATION_ONLY. Native archive readback остаётся обязательным; hook
  сам не меняет registry. Guards для retired/unknown/non-primary/stale proof
  сохранены; engine compaction и hook trust не менялись.
- Reproducer на старом hook: 26 tests, 11 ожидаемых FAIL; после fix и дополнительных
  проверок 28/28 PASS. Есть active/failed/blocked/pending/unknown/missing cases,
  stale generation/identity/proof, повторяемость, отсутствие мутаций, реальный CLI.
  AGENTS/template/protocol/registry/hooks/handoff/checkpoint синхронизированы.
- Источник механики прочитан через OpenAI Docs:
  https://learn.chatgpt.com/docs/hooks#sessionstart. Это подтверждает формат hook,
  а политика завершения/передачи принадлежит владельцу проекта.
- Профильный local gate PASS: 28 unit/CLI tests, syntax, JSON/metadata, 5 changed
  local links, diff hygiene; весь diff девяти paths reviewed. Product inputs,
  primary/generation/retired IDs и trust status не изменились.
- Завершающий шаг: отдельный commit/normal push/readback и фактический CI.
  Состояние этого отдельного пакета, точный SHA,
  команды и CI result сохраняются в `output/governance-continuity-20260921/result.json`;
  при resume прочитать квитанцию, не повторять завершённое. После success остановиться.
  Реальная передача не запускается; никаких scheduling/features.

Профильные команды из canonical root:

```powershell
node --check .codex/continuity-hook.cjs
node --check .codex/continuity-hook.test.cjs
node --test .codex/continuity-hook.test.cjs
.\.venv\Scripts\python.exe output/governance-continuity-20260921/verify.py
git diff --check
git diff --cached --check
git diff --check 31a8b5f0fc0f4cfb94589206139b42314a0d0f85...HEAD
```

Продуктовые local suites/build/migration checks для governance не повторяются:
их inputs не менялись. Существующий push CI применяется как настроен; его PASS
проверяется отдельно. Runtime activation/trust и реальная передача не тестируются:
не входят в разрешённую правку; статус REQUIRES_REVIEW_AND_TRUST сохраняется.

## Git-пакет — проверенный кандидат и публикационная квитанция (2026-09-21)

- Единственный owner/writer: primary `01a0c36e-33aa-7c72-be9b-72624dd2c739`;
  Оркестратор не пишет. Canonical root `C:\Users\user\Desktop\Zani`, branch
  `codex/ui-testing-toolkit`; один checkout, без новых задач/worktrees/source copies.
- Scope: опубликовать выбранное владельцем каноническое содержимое в
  `origin` (`https://github.com/999MAX20/ZANI.git`), `main`, сохранив обе истории.
  Legacy native mobile/offline/push, theme toggle, старые marketing/public/demo
  страницы сохраняются в истории/резерве, сейчас не переносятся. Рабочие login,
  registration и CRM сохраняются. Force/reset/rebase/deploy не разрешены.
- Start: local `4ba3cbf9fddcc6e1baa172b494c781550c090693`, 192 status entries,
  staged 0; legacy main/base `73482a3bea7f168113c58d8cb928214c97f032d5`.
  246 изменённых/untracked paths явно reviewed и разделены на manifests
  product/toolkit/docs (118/28/100), blind add -A не использовался.
- Commits: product `7fc450e`, toolkit `02fefc7`, docs `0d901be`, разрешённый
  history merge `1e5a85d`; обе исходные истории — предки. Tree до/после merge
  одинаковый `bd9aae25f0c6de216d1b7b63d649f7ea46258e54`: legacy code не внесён.
  `1a9ce8b` нормализует только whitespace четырёх migrations и archived plan;
  AST/non-whitespace совпадают. `25efa55` изолирует test public/private media
  в runner; regression воспроизведён до fix, 15 runner tests PASS после fix.
- Полный integration gate PASS на code candidate
  `25efa559a85f08454cac45199dde52b656d6955a` и указанном реальном legacy base.
  1089 Django tests / 867.841s; check и migration drift PASS; npm ci, Vite env
  isolation, i18n/types, app/widget build, bundle budgets PASS; mobile owner/manager
  smoke 2/2 PASS; hashed prod/dev Python lock dry-run PASS; pip-audit и npm moderate
  audit: 0 известных vulnerabilities; final diff hygiene PASS. Полный log:
  `output/git-publication-20260921/full-gate.log`.
- Среда: Windows, Python 3.12.14, Node 24.18.0, npm 12.0.1; disposable SQLite,
  media и loopback ports, locmem/eager, synthetic identities; live providers
  выключены. CI Python 3.11 / Node 22.22 проверяется отдельно после push.
- Дополнительные gates: runner unit 15/15, continuity hook 16/16, frontend
  sidebar/timeline/toolkit/chromatic helpers 25/25 PASS. Реальный hook trust,
  Chromatic upload, live provider/payment/deployed acceptance и working-DB
  migrations не запускались: вне разрешённого Git-пакета. Полный gate не закрывает
  отдельные FC-003/FC-008/manual/live критерии и не означает приёмку клиникой.
- Backup: `C:\Users\user\Documents\Codex\project-backups\crm-publication-20260921T123341Z`:
  source ZIP 1373 files, CRC + каждый SHA-256 PASS; all-refs bundle verify PASS,
  bundle SHA-256 `77e242a2c2ac59230a4057ee631f5c75ea97dfcc7abe16d54b5e99dda3f01a99`.
  На code candidate 1360 файлов идентичны резерву; 13 намеренных изменений
  перечислены в `output/git-publication-20260921/candidate-proof.json`.
- Review: 138 outgoing local-history commits / 2830 blobs проверены на
  high-signal credentials/private keys; 41 совпадение — placeholders и проверенный
  URL-redaction fixture, unresolved 0. Working .env/DB/media/generated outputs
  не публикуются. Это проверка состава публикации, не новая security certification.
- Push effects: repo workflows выполняют CI, Pages source — gh-pages; доступный
  Render workspace пуст. Владелец прямо подтвердил отсутствие действующих
  autodeploy подключений. Hosting settings/deploy не менялись. Git Workflow Master
  прочитан из `C:\Users\user\Desktop\Agentic Skills\agency-agents-main\engineering\engineering-git-workflow-master.md`;
  проектные ограничения важнее общих примеров. Verification skill применён.
- После code gate допускается только данный docs closeout. Проверить точный
  docs-only delta, ссылки/команды и diff hygiene; runtime evidence переиспользуется
  только при неизменных code/config/lock/test inputs. Новую реализацию не начинать.
- Единственный завершающий шаг: normal `git push origin HEAD:main`, readback SHA,
  фактический CI conclusion для этого SHA. Операционная квитанция обновляется
  отдельно от публикуемого дерева в
  `output/git-publication-20260921/publication-result.json` (candidate/base,
  remote SHA, clean status, команды, CI URL/status). При возобновлении читать её
  вместе с этим checkpoint и свежим Git: queued/pending не равно PASS.
  После подтверждённого success — остановиться; повторный push без нового diff
  и новый продуктовый пакет не нужны. При drift/failed required gate — стоп публикации.
- Следующий продуктовый пакет утверждён как направление, здесь не реализуется:
  специалист бизнеса с расписанием без обязательного CRM-account/login/access,
  новый врач без автоматического пользователя/приглашения; переиспользовать
  пригодный Resource, не дублировать известного специалиста, имя не уникальный ID.
  Это не свободная пометка без guards. Место формы не задано; scheduling/UI/seats/
  AI booking не менялись. Market вне scope. Нужен отдельный запуск следующей фазы.

Точные команды из canonical root (frontend helper — из `frontend`):

```powershell
.\.venv\Scripts\python.exe scripts/codex_verify.py --mode full --base-ref 73482a3bea7f168113c58d8cb928214c97f032d5
.\.venv\Scripts\python.exe -m unittest scripts.tests.test_codex_verify -v
node --test .codex/continuity-hook.test.cjs
node --test scripts/tests/sidebar-navigation-policy.test.mjs scripts/tests/timeline-presentation.test.mjs scripts/tests/ui-toolkit-policy.test.mjs scripts/tests/chromatic-runtime.test.mjs
```

Ниже сохранено evidence предыдущего локального пакета. Его исторические
Git-blocker/pending-решения не переоткрывают уже разрешённые выше вопросы.

## Завершённый локальный пакет — W05/W06 и конечный остаток до пилота

Последнее уточнение scope: довести W05/W06 до текущего gate, затем один список
в `docs/pilot/` с существующими ID, кодом, остатком и критериями завершения.
Не начинать новые блоки реализации из этого списка. Рубеж A — локальная
классическая CRM; рубеж B — передача одной клинике для работы сотрудников с
реальными клиентами/данными: живые WA/Instagram, полноценный ИИ, безопасная
среда и приёмка обязательны. Пилот подтверждён платным: подписка и оплата
использования ИИ обязательны до передачи, коммерческий блок B/P0.
Telegram/форма сайта остаются в платной V1;
их состав именно для пилота ещё не решён. ИИ нужен во всех трёх направлениях
с реальным провайдером, но текущая работа не разрешает активацию/расходы/передачу
реальных данных. Новый опрос не отправлять: вопросы агрегирует Оркестратор.
Узкое разрешённое исключение frontend: убрать только marketplace-карточки
и их пустой фильтр в /integrations через существующий каталог; messaging,
backend и данные сохраняются. Проверки: локальная production build и проверка
реального набора каталога/рендера. Общий UI/UX и создание новых задач запрещены.

- Owner/writer: primary `01a0c36e-33aa-7c72-be9b-72624dd2c739`; Оркестратор
  освободил запись. Режим implementation + verification, последовательная работа.
- Scope: только недостающие внутренние правила утверждённых CRM-процессов V1
  и их backend/API-проверки. Новых задач/агентов/worktrees/смены ветки нет.
- Non-goals: общий frontend/UI/UX (кроме marketplace visibility), AI/provider/live billing, инфраструктура, рабочая БД,
  старый main/mobile/theme/public pages, новый общий аудит и повтор закрытых FC/AUD-027.
- Root: `C:\Users\user\Desktop\Zani`; branch `codex/ui-testing-toolkit`;
  starting HEAD/base `4ba3cbf9fddcc6e1baa172b494c781550c090693`.
- Исходный смешанный WIP: 139 tracked unstaged + 48 untracked status entries,
  staged 0. SHA-256 всех исходных source files и status сохранены в
  `output/v1-internal-backend-20260921/starting-snapshot.json`. Чужой WIP сохранять.
- Delivery: локальный проверяемый delta. Публикация в origin/main заблокирована
  несвязанными историями; не включать чужой WIP в commit и не решать историю самим.

Исходный backend-контракт (W05/W06 локально проверены; пункты 3/4 в inventory,
их реализация сейчас не разрешена):

| Порядок / источник | Незавершённый outcome / тип разрыва | Критерий и проверки |
| --- | --- | --- |
| 1. V1-W05 / V1-F12 | Запрет архива клиента с активной работой: code gap в POST archive и DELETE soft archive | Все незавершённые lead/deal/task/appointment и открытые/ожидающие оператора conversation блокируют; нет каскадного закрытия; завершённая работа допускает архив/restore; API happy/denial/tenant/hidden child, audit и dependent tests |
| 2. V1-W06 | Отключённый сотрудник: неполное актуальное доказательство полного внутреннего цикла | API отключение прекращает доступ только к компании, сохраняет историю/ответственность, руководитель может вручную переназначить; запрет неактивного нового назначения, role/tenant tests; код менять только при воспроизведённом пробеле |
| 3. V1-F06 / V1-W02 | Запись к сотруднику: code/policy delta относительно прежнего необязательного Resource | Нужен ответ о linked_user; затем API создание/перенос, active same-business staff, часы/overlap и permissions; старые lifecycle-механизмы не переписывать |
| 4. V1-M01/M02 / client-payments.md | Локальный manual-payment WIP: evidence delta при существующих операционных циклах | Проверить существующие receipt/partial/refund, права/tenant/idempotency, merge/history, отсутствие автоматической оплаты от завершения услуги и раздельные суммы; спорные формулы не выбирать |

- Вопрос 1 разрешён владельцем в этой задаче: архив блокируют также открытые
  диалоги и диалоги, ожидающие сотрудника. Это уточнение V1-W05, не принятие D-01…D-09.
- Вопрос 2 pending: сотрудник для записи обязан иметь активный CRM-account или
  допустим Resource сотрудника без linked_user. Зависимое изменение не начинать.
- Первый контракт: V1-W05; использовать существующие Client/CRM relations,
  archive helper, domain service, permission checks и activity/audit taxonomy.
  Новые models/endpoints не нужны. Tenant и существующие права сохраняются;
  успешный архив пишет прежние activity/audit, отказ не создаёт effects.
  Notification/BusinessEvent/AI/provider/schema/env changes: none planned.
- Gates: reproducer, затем regression API tests; Django check, migration drift,
  affected/dependent backend suites через существующий isolated_runtime и .venv.
  Только disposable SQLite/locmem/eager, без live providers. Полный committed-range
  gate пока неприменим (base=HEAD); frontend/browser/release acceptance вне scope.
- Выполнено V1-W05: воспроизведён архив при открытой задаче (POST 200 / DELETE 204
  вместо 409); `w05-reproducer.log`. Добавлен service-backed guard обоих путей,
  единое clients:delete, проверки прямых и косвенных связей, отказ без child details.
  Успешное действие атомарно использует прежний archive/activity/audit helper.
- Verified: первоначальный focused suite 11/11 PASS + Django check/drift;
  затем добавлены проверки archived-parent task, unresolved handoff, PATCH bypass
  и rollback. Промежуточный dependent gate: `w05-dependent.log`; финальный ниже.
  Это не повтор одинаковой ошибки: исходный воспроизведённый defect исправлен.
- Own delta пока: apps/clients/lifecycle.py, tests_archive_dependencies.py,
  узкие additions apps/clients/views.py, PRIMARY-SESSION и уточнение V1-W05.
  Старые additions views.py и services.py сохранены, services.py не менялся нами.
- V1-W05 dependent gate: 83 tests, 82 PASS / 1 FAIL, 63.507s; Django check/drift PASS.
  Единственный FAIL: прежний `ArchiveGuardrailTests.test_manager_delete_archives_client_instead_of_hard_delete`
  ожидает менеджеру 204 через DELETE при clients:update, тогда как POST и
  PERMISSION_MATRIX требуют clients:delete/явного разрешения. Это policy conflict,
  не baseline excuse. После рекомендации владелец явно утвердил «Да, единое
  clients:delete». Противоречащий тест теперь разрешено обновить; повторить gate.
- V1-W06 focused: 5/5 PASS, check/drift PASS (`w06-focused.log`), оба membership
  endpoint, ранее выданный JWT, изоляция компаний, история и ручное переназначение.
  Production код W06 не менялся; требуется dependent gate.
- Перед продолжением: HEAD/branch прежние; SHA-256 1369 исходных файлов сверены,
  изменены только собственные views/V1/checkpoint. Неожиданных чужих изменений нет.
- Финальный backend gate W05/W06: 226/226 PASS, 231.486s; check/drift PASS.
  Команда и labels: [inventory](../../pilot/local-crm-completion.md#проверки-этого-поручения),
  лог `output/v1-internal-backend-20260921/w05-w06-final.log`. 16 W05 + 5 W06
  новых тестов; остальное — существующие dependency suites. Старый permission
  FAIL разрешён прямым решением владельца, а не ослаблением защитных assertions.
- Marketplace UI: ровно два узких изменения — фильтр integrationProviderCatalog
  исключает marketplace и удалён пустой group filter. Полный catalog и messaging
  definitions сохранены; backend/data не менялись. Actual catalog + page render
  PASS (context/query mocked), production app/widget build, i18n/types/bundle PASS;
  `frontend-check.py` / `frontend-check.log`. Нового общего UI/UX нет.
- Единый результат: `docs/pilot/local-crm-completion.md` — 9 цельных блоков с
  существующими ID, статусом, точным остатком и полным критерием. A — внутренние
  циклы; B — живая клиника с WA/Instagram, реальным ИИ, безопасной средой и
  приёмкой и обязательным платным commercial cycle. AI provider/model/cost и
  Telegram/форма вопросы агрегирует Оркестратор. Новые блоки
  реализации, внешние вызовы и настройки среды не начинались.
- Own delta: три новых Python-файла (client lifecycle/archive tests, member
  deactivation tests), узкие client views/core archive test, два frontend-файла,
  V1 product clarification, permission matrix, CRM plan/doc index/checkpoint и
  новый inventory. Pre-existing WIP сохраняется; services.py не менялся нами.
- Skip: full committed-range gate (base=HEAD), browser E2E/общая UI-приёмка,
  provider/live/production/CI. Среда проверок disposable SQLite/locmem/eager,
  safe Vite env, providers/telemetry off; working DB не затронута. Не доказаны
  PostgreSQL concurrent child-create/archive races. Нет schema/env/notification/
  BusinessEvent/AI runtime delta. Commit/push не выполнены: unrelated origin/main
  и несогласованный общий candidate остаются блокером публикации.
- Docs/diff/hash closeout PASS: `closeout.py`, `git diff --check`,
  `git diff --cached --check`, новые links/anchors, syntax/hygiene новых файлов.
  1360 исходных non-owned файлов неизменны; SHA-256 собственного diff и всего
  снимка сохранены в `output/v1-internal-backend-20260921/final-snapshot.json`.
- Текущий ограниченный пакет завершён локально; запись остановлена. W05/W06
  не стоят в очереди реализации; общая UI/версионная приёмка отдельно в inventory.
  Следующий шаг: передать конечный список владельцу и ждать следующего поручения.
  После отдельного следующего поручения — staff appointment policy (вопрос pending)
  либо другой утверждённый цельный блок; не реализовывать список автоматически.
- Stop: неожиданный writer/Git drift; unresolved policy для зависимого действия;
  два одинаковых failure без новой гипотезы. UI/E2E и production не объявлять готовыми.

## Историческая передача задач (завершена до поручения выше)

- Основная задача: 01a0c36e-33aa-7c72-be9b-72624dd2c739; .codex/project-session.json — реестр ID.
- Фаза: idle / AWAITING_OWNER_TASK; COMPREHENSION_READY проверен, четыре
  прежние задачи архивированы нативными инструментами с подтверждением.
- Основной исполнитель проекта: 01a0c36e-33aa-7c72-be9b-72624dd2c739.
  Активного продуктового writer нет. Оркестратор завершает только публикацию
  и итоговую проверку своего организационного diff; параллельная запись запрещена.
- Продуктовая реализация: NONE_AUTHORIZED / ожидание следующего поручения.
- Разрешено: handoff, workflow/hook настройки, чтение новым исполнителем,
  проверка понимания и архив старых задач после READY.
- Не разрешено этим поручением: новые функции, исправление старого CI, миграции
  БД, смена ветки, новый worktree, force-push или перенос всего старого backlog.
- Snapshot: codex/ui-testing-toolkit @ 4ba3cbf9fddcc6e1baa172b494c781550c090693, 186 pre-existing status entries.
- Источники/выполненное/остаток: actual_docs/PROJECT_HANDOFF.md; подробные gates в профильных docs.
- Блокер продукта: несвязанные local/origin main истории, решение по уникальным функциям старого main; WIP не публиковать целиком.
- Hooks: REQUIRES_REVIEW_AND_TRUST, фактическое срабатывание в приложении
  не подтверждено. Unit tests не заменяют trust/runtime.
- Собственные изменяющие процессы/БД этой организационной задачи: нет.
- Проверки адаптера: расширенный набор 16/16 PASS (включая незавершённую передачу,
  отключённую ротацию и защиту от повторного создания). Ссылки и JSON проверены.
- Non-owned file preservation: SHA-256 всех остальных исходных файлов совпал
  со снимком до организационных изменений; продуктовый код не менялся.
- Передача 21.09 завершена: создана одна задача в saved project/environment=local,
  проверены продукт, checkout, требования, история/остаток, ограничения и протокол.
- Старые task IDs перечислены в retiredThreadIds реестра, история не удалена.
- Следующий шаг основной задачи: ждать конкретного нового поручения;
  продуктовая разработка и исправление известных блокеров не запускались.
- Stop: разночтение Git/владения, ошибка handoff/comprehension или неизвестный
  результат создания задачи; не создавать дубликаты.
