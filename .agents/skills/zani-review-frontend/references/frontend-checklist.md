# Frontend Completion Checklist

- The page answers an operational question or supports a concrete merchant action.
- No raw API call lives in a React component.
- Existing shared primitives, page patterns, types, and tokens are reused.
- Data is real or the UI explicitly reports no data; no production mock or vanity value is shown.
- Loading, error, empty, forbidden, success, retry, and disabled states are handled where relevant.
- Backend permission errors are handled even when controls are hidden by role.
- Forms preserve validation errors, pending state, focus, and safe repeat submission behavior.
- Tables/lists expose operational fields such as status, source, responsible user, next action, and last activity when relevant.
- Text uses i18n/constants and all supported locales stay structurally aligned.
- Keyboard navigation, labels, contrast, focus, truncation, small screens, and long localized text were checked.
- Frontend build and relevant component or E2E checks were run.
