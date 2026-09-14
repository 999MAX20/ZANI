# UI testing toolkit

Status: expanded catalogue and consecutive cloud comparison verified, 2026-09-14.

## Current phase: expanded visual coverage

Authorized scope: extend only the synthetic catalogue and its verification, then
publish and compare two consecutive builds in the existing Chromatic project.
No merchant code, backend, Git state, CI, subscriptions or account permissions change.

- [x] Configure six named cloud modes: RU/KK/EN × desktop 1440×1000 / mobile 390×844; configuration unit test passed.
- [x] Add current service table primitives/toolbar composition, the actual service edit modal, and the current CRM drawer presentation shell; 16-entry index/build verified.
- [x] Verify all stories locally with axe, overflow/runtime/network checks and focused keyboard/form interactions: 140/140 passed serially.
- [x] Run tooling policy checks (12/12), frontend build and bundle gate: passed.
- [x] Review the expanded cloud build and verify its modes/captures: Build 3, 96 captures; accepted as a technical baseline after checks and representative visual review.
- [x] Compare a second consecutive build against the expanded baseline: Build 4 → Build 3, 96 tests, 0 changes, Passed. Billing verified: 199 / 5,000 snapshots used.

The services toolbar is currently inline in `ServicesPage`; its catalogue example
composes the same shared controls, not a live copy of the authenticated page.
Services now use `ServiceEditModal`. The CRM drawer example covers `Drawer`,
`CrmEntityHeader`, `CrmEntityTabs` and presentation-only content, not the API-backed
`CrmEntityDrawer` or the obsolete desktop-only `CrmInspector`.

## Initial local-foundation scope and acceptance

One bounded phase: a free local Storybook for existing shared UI, using existing
Playwright/axe for verification, plus an opt-in Chromatic publishing entrypoint.
No merchant routes, backend behavior, database, roles, notifications or AI change.
No live credentials, production telemetry, paid subscription or cloud upload.

- [x] Build a local-only Storybook with existing tokens/fonts and RU/KK/EN.
- [x] Cover buttons, fields, tabs and dialog states using actual shared components.
- [x] Verify keyboard interaction, focus return, accessible names, automated contrast checks and narrow layouts within the catalogue scope below.
- [x] Prepare explicitly gated Chromatic configuration without a project token in Git.
- [x] Pass frontend build, bundle, dependency and focused tooling gates.
- [x] Record actual outcomes and remaining external setup steps below.

## Connection status

| Tool | Local setup | External step |
| --- | --- | --- |
| Storybook | Expanded source: 16 stories using real shared components | No account needed |
| Playwright + axe | Expanded 140-check gate; current-phase result recorded below | No account needed |
| Accessibility Insights | Browser extension, not an npm dependency; installation not verified | User installs from [official downloads](https://accessibilityinsights.io/downloads/) |
| Chromatic Free | Gated entrypoint, six locale/viewport modes | Build 3 accepted technical baseline; Build 4 passed with 96 tests and 0 changes |
| PostHog | Existing SDK remains unchanged | Deferred until privacy review and test users |
| BrowserStack / Maze | Not connected | Deferred by user; no subscription/trial activated |

## Safety boundary

Storybook must not import application providers, authenticate, fetch CRM data or
initialize monitoring. Use synthetic component examples only. Do not copy the app
public directory or load developer Vite environment files into the published
build. Never name the Chromatic token with a `VITE_` prefix.

Both local Storybook commands use a sanitized child-process environment. The
Chromatic token is excluded from the build process and passed only to the upload
process. Explicit independent Vite configurations prevent inheriting the app API
proxy, public assets and environment files. Storybook telemetry is disabled.

Even synthetic Storybook publication exposes compiled component code, styles,
localized copy and assets to the chosen provider/project audience. Review that
audience before uploading. A synthetic-only acknowledgement is a manual guard,
not a general-purpose sensitive-data scanner.

The component catalogue is not certification of complete merchant pages or
backend permissions. Screenshots attached by Playwright are review artifacts,
not approved design baselines. Neither Chromatic nor this gate automatically
certifies usability or WCAG compliance.

## Local workflow

From `frontend/`:

```sh
npm ci
npm run storybook
```

Open [local Storybook](http://127.0.0.1:6006/). The locale toolbar supports RU,
KK and EN. This server binds to loopback only; it is not a tablet/phone LAN server.
No Django server or business login is needed.

```sh
npm run build-storybook
npm run test:ui-toolkit:policy
npm run test:ui-toolkit
```

The browser gate serves the static build on `127.0.0.1:6016`, with its own config
and without reusing an unknown existing server. It does not start Django.
On a busy workstation run `npm run test:ui-toolkit -- --workers=1` after the
application build, rather than competing with it for browser/CPU resources.
The local HTML report is `frontend/playwright-report/ui-toolkit/index.html`;
screenshots and other generated artifacts are ignored by Git.

### Catalogue coverage

| Group | Actual components and examples | Interaction gate |
| --- | --- | --- |
| Buttons | Eight variants, default/disabled/loading matrix, icon button, long localized label | Primary button Tab/Enter, visible focus, hover/pressed screenshot, activation count and disabled/busy attributes |
| Fields | Input, Select, Switch; editable/disabled/read-only and validation examples | Typing preservation, keyboard selection and switch toggle |
| Navigation | Tabs and Modal; closed/open dialog examples | Arrow/Home tab selection, dialog opening, focus trap, Escape and exact trigger focus return |
| ServiceTable | DataTable, Input, Select, CrmPagination, ServiceActionsMenu and ServiceStatusBadge; populated/empty/loading | Local search/page reset, pagination, menu keyboard handling, Enter on desktop row/mobile card, modal Escape and exact row focus return |
| ServiceModal | Actual ServiceEditModal / ServiceForm; editable, archived, save-error and saving | Name validation, cancel/reset, local save callback, archived fields disabled, pending submit disabled and Escape guarded |
| CrmDrawer | Actual Drawer + entity header/tabs + presentation-only summary; empty-related/loading | Open, tab content, focus trap, Escape and exact trigger focus return |

Sixteen stories are checked at 1440×1000 and 390×844 in Chromium, in each of RU/KK/EN.
The 96 story checks cover axe rules tagged WCAG 2 A/AA and 2.1 AA, runtime errors,
locale and horizontal overflow; 42 additional checks cover interactions, and two
check that the fresh index exactly matches the tested story inventory. External and
`/api/` browser requests are blocked by the test harness. Hover/pressed behavior is
not an exhaustive matrix for every variant. The catalogue currently shows the
existing light theme; Storybook's own dark manager chrome is not a Zani dark-mode test.

## Optional Chromatic activation

1. Register and create a Zani project on [Chromatic](https://www.chromatic.com/).
   The [Free plan](https://www.chromatic.com/pricing) is sufficient for the initial
   catalogue; recheck current quota before increasing snapshot coverage.
2. Restrict repository access to Zani where the account flow permits. Review
   project visibility and who can see the published component catalogue.
3. Share the project URL for coordination, never its token. Copy
   `frontend/.env.chromatic.example` manually to the Git-ignored
   `frontend/.env.chromatic.local`; put the project token only in that local file.
4. Inspect the local catalogue and build contents. Only after approving this
   synthetic-only upload, set `ZANI_ALLOW_VISUAL_UPLOAD=synthetic-only` in the
   same local file and explicitly run `npm run chromatic` from `frontend/`.
5. Verify the cloud build and review snapshots before treating them as a baseline.

Do not put tokens in `VITE_*`, tracked configuration, shell arguments or chat.
The runner rebuilds Storybook before upload. Visual changes are not automatically
accepted and changed snapshots are not configured to produce a false green result.
See [Chromatic configuration](https://www.chromatic.com/docs/configure/).
There is no automatic CI upload in this phase. The default Storybook locale is RU.
`.storybook/modes.ts` configures RU/KK/EN × desktop/mobile using
[Chromatic modes](https://www.chromatic.com/docs/modes/) and explicit
[viewport dimensions](https://www.chromatic.com/docs/modes/viewports/).
Mode names are baseline identifiers: do not casually rename them or mix them
with the legacy `viewports` parameter. Sixteen stories × six modes = 96 visual
tests per complete Chrome build, not a claim that every CRM page is covered.

After reviewing the first expanded build, `npm run chromatic -- --force-rebuild`
can explicitly test the same commit again. The runner accepts only this optional
flag; arbitrary build directories, token arguments and auto-accept/false-green
flags are rejected. The repeat run still requires the token, synthetic upload
opt-in and a fresh safe build. No commit or Git mutation is needed.

- [ ] Verify the target Chromatic account/project and access scope.
- [x] Complete and verify the first explicitly approved cloud upload: Build 2.
- [x] Inspect the initial seven-story baseline: Build 2 shows seven accepted tests,
  no denied/unreviewed tests. These statuses already existed; no acceptance action
  was performed during the initial browser review. Expanded baseline is separate.
- [ ] Verify user installation of Accessibility Insights, if desired.

PostHog session recording, BrowserStack and Maze remain outside this phase. No
paid subscription, trial activation or production recording was initiated here.

## Verification results

Completed locally on 2026-09-14:

- `npm install --ignore-scripts --no-audit --no-fund`: passed for the initial tooling install.
- `npm ci --no-audit --no-fund`: passed, proving a clean lockfile install.
- `npm run build-storybook`: passed, including `tsc -p tsconfig.storybook.json`.
  Repeated through the sanitized launcher after `npm ci`.
- Synthetic secret probe: injected a recognizable fake value through
  `VITE_POSTHOG_KEY`, `STORYBOOK_TEST_SECRET` and `CHROMATIC_PROJECT_TOKEN` into
  the parent process; scanned 27 generated text assets and found zero occurrences.
  This proves the tested boundary, not absence of every possible future leak.
- `npm run test:ui-toolkit`: 60/60 passed; repeated after clean install/rebuild.
- `npm run test:ui-toolkit:policy`: 5/5 passed.
- Negative upload guard: direct runner with a sanitized environment and no token
  exited 1 before build/upload and gave the expected missing-token message.
- `npm audit --audit-level=moderate`: passed, zero reported vulnerabilities.
- `git -c core.safecrlf=false diff --check`: passed; generated builds, reports and
  `.env.chromatic.local` were verified as Git-ignored.
- Frontend lock validation via `scripts.codex_verify.validate_frontend_lock()`:
  passed. `npm run build` and `npm run check:bundle`, launched using the repository
  verifier's safe environment: passed. RU/KK/EN parity covered 4,858 keys; app-shell
  measured 269.2 KiB against its 400 KiB budget.
- In-app browser: Storybook manager, story navigation and rendered shared-button
  states inspected at `127.0.0.1:6006`; representative mobile and long-label
  Playwright screenshots also visually inspected.

Warnings retained: npm 12 reported blocked `core-js` and `esbuild` install scripts;
no extra script approval was granted and the subsequent build passed. Storybook
reports large development-only iframe/axe chunks and plugin timings; these are not
new application bundle-budget failures. Playwright emitted a terminal colour-variable
warning without test failures.

Skipped: full `scripts/codex_verify.sh`, backend/tenant/permission suites, migrations,
all-page app E2E, actual mobile devices, other browser engines, dark mode and manual
screen-reader certification. This is a component-tooling phase with no new business
behavior, not the corresponding full-product certification. Existing unrelated
working-tree changes are preserved; no commit or push was performed.

### Chromatic subdirectory launch correction (2026-09-14)

The direct CLI launch from `frontend/` reproduced a Chromatic 18.8.1 Git-path
defect: tracked files are listed relative to the repository root, while untracked
files are listed relative to `frontend/`. `git hash-object --stdin-paths` then
cannot open `.storybook/main.ts`. This warning alone does not prove the cause of
the separately reported cloud "no stories" failure.

Use `npm run chromatic`, not a direct token-bearing `npx chromatic` command.
The safe runner rebuilds the catalogue, rejects an empty/docs-only `index.json`,
then starts an isolated Chromatic Node API process. Its Git stage runs at the
repository root; package discovery and all other stages run in `frontend/`.
Absolute build/config paths prevent cwd ambiguity. The workaround uses public
experimental task hooks; revalidate it when upgrading Chromatic. No Git files,
index, commits or installed vendor source are rewritten by the workaround.

The config no longer specifies `buildScriptName` alongside a supplied static
build: the runner owns the fresh build. See the mutually exclusive options in
[Chromatic configuration](https://www.chromatic.com/docs/configure/).

Focused verification for this correction:

- [x] Fresh `npm run build-storybook`: passed; index contains all seven stories.
- [x] Runtime and policy tests: 8/8 passed via Node's test runner.
- [x] Real Chromatic `getGitInfo()` from the corrected Git-stage cwd: uncommitted
  hash obtained without hashing warnings; frontend cwd restored afterwards.
- [x] Separate Playwright CLI session on loopback port 6027: all seven iframe
  stories opened with non-empty content and no JavaScript page errors.
  A missing `favicon.ico` returned 404; it did not prevent story rendering.
- [x] `node --check` for both launch scripts and scoped `git diff --check`: passed.
- [x] Empty-token `npm run chromatic`: blocked before build/upload as intended.
- [x] Initial cloud publish/verification: user completed publication, and browser
  review confirmed [Build 2](https://www.chromatic.com/build?appId=6aa7a915242345262359a2a2&number=2)
  passed with three groups / seven stories. Its warning about no ancestor builds
  means it is an initial baseline, not a demonstrated successive-build comparison.

During expanded setup the user saved the token in `.env.chromatic.example`.
That file was moved to the Git-ignored `.env.chromatic.local`, preserving the token
without printing it; the example was recreated with empty values and the existing
synthetic-only acknowledgement was restored locally. A policy test now rejects
non-empty token/opt-in values in the distributable template. No Git commit or
push containing that template was performed by this task.

The authenticated billing screen was inspected read-only: Free plan, 5,000 billed
snapshots/month, 7 already billed before this expansion. No plan, payment,
notification, access or subscription settings were changed.

### Expanded local verification (2026-09-14)

- `npm run build-storybook`: passed, including catalogue TypeScript and 16-story index.
- `npm run test:ui-toolkit`: 137 passed / 3 timed out in the first parallel run.
  Two timeouts were waiting for the locale-ready marker; one was creating a browser
  page before the test body. No axe/layout assertion failed. Do not count that run
  as green or erase its failure from the report.
- `npm run test:ui-toolkit -- --workers=1`: all 140 passed in 6.9 minutes after the
  app build completed, without increasing timeouts, disabling assertions or retries.
- `npm run test:ui-toolkit:policy`: initially 11/11; final 12/12 passed, including
  empty template, six modes, non-empty index, Git cwd workaround, restricted
  repeat-build args and an isolated process-exit regression check.
- `npm run build` followed by `npm run check:bundle`, executed through
  `scripts.codex_verify.safe_environment`: passed. No database/server was created
  by these commands. i18n parity: 4,858 keys; app shell: 269.2 KiB / 400 KiB budget.
- `node --check` on both Chromatic launch modules; scoped
  `git -c core.safecrlf=false diff --check`: passed.
- Real Chrome: local service modal inspected with a long title. Generated
  desktop/mobile screenshots of the table/toolbar, modal and drawer were inspected;
  mobile form/footer remain visible, the table becomes cards and drawer tabs scroll.

The first local browser-tool attempts timed out; a subsequent Chrome visit opened
and rendered the fresh modal successfully. Existing development servers were not
stopped or reused as the test server. The Playwright-owned preview shuts down at
the end of its run; the user's Storybook dev server on port 6006 is untouched.

Skipped for this expansion: npm install/ci/audit (dependencies unchanged), global
verification gate (no approved base ref; isolated catalogue scope), backend/tenant
permission tests, migrations, complete merchant-route E2E, real mobile devices,
other browser engines, dark theme, manual screen-reader certification and CI setup.
Frontend skills kept this phase on real shared components with synthetic fixtures;
verification skill kept the business/backend gate explicitly outside certification.

### Expanded cloud baseline

`npm run chromatic` created
[Build 3](https://www.chromatic.com/build?appId=6aa7a915242345262359a2a2&number=3):
16 stories, six component groups, 96 Chrome snapshots, ancestor Build 2.
Chromatic reported exit code 1 because all 96 named-mode tests were new and required
review. The enclosing local runtime remained alive after this result (see below);
do not treat the printed result as a completed shell process. These were not
rendering failures; `exitZeroOnChanges` and automatic acceptance remain disabled.

The browser reviewer showed the expected locale/viewport globals. Representative
cloud images were manually inspected: Buttons/en desktop, CrmDrawer/kk mobile,
Fields/ru desktop, Navigation/en mobile, ServiceModal/kk desktop including footer,
and ServiceTable/ru mobile including toolbar. This is sampling across all six
groups and modes, not a claim of individual human review of every one of the 96
images. All 96 combinations had already passed the local automated story gate.

The build's `Accept all` action was then used once to establish the current
component appearance as a technical regression baseline. Confirmed result:
Passed, 96 accepted, 0 denied, 0 unreviewed. This does not approve the complete
product redesign or certify every merchant workflow.

The fresh catalogue's 36 JS/JSON/CSS/HTML files were checked in memory for the
local token: zero occurrences; the value was not printed or added to artifacts.

### Consecutive cloud comparison and local runtime exit

`npm run chromatic -- --force-rebuild` freshly rebuilt and published
[Build 4](https://www.chromatic.com/build?appId=6aa7a915242345262359a2a2&number=4).
CLI and authenticated browser both confirmed Passed: 16 stories in six groups,
96 visual tests, 0 changes. The browser explicitly lists Build 3 as the ancestor;
0 denied and 0 unreviewed tests remain. This proves an unchanged-build comparison,
not a deliberately introduced visual-regression test.

The read-only billing check after both uploads showed 199 billed snapshots this
month (7 + 96 + 96) on the Free plan's regular 5,000-snapshot allowance. A temporary
bonus also appeared but is not needed or relied on. No paid feature was activated.

Both Node API runtimes stayed alive after their completed cloud results. The
launcher now explicitly exits with the returned result code after awaited work,
matching the installed Chromatic CLI's termination pattern. A subprocess test
with a live interval verifies prompt termination and preservation of codes 0 and
1; the final policy gate passed 12/12, and both launch modules passed `node --check`.
Only the two identified upload runtimes started by this task were stopped after
cloud completion; their old shell sessions therefore ended with cleanup code 1.
No development server or unrelated Node process was stopped.

No third cloud upload was performed after this termination guard: its regression
check is local, not a claim of a new end-to-end cloud run. If a future invocation
stalls before the Node API promise returns, that is a separate unresolved stage
and must be diagnosed rather than hidden with a success code or blind timeout.

The full app build and 140-check UI matrix belong to this expansion and passed
before the final launch-only guard. They were not rerun for that guard; focused
policy/subprocess and syntax checks were used. Backend/permission suites and
the global gate remain explicitly skipped as listed above.
No merchant UI, API, database, permissions, notifications or AI behavior changed.
