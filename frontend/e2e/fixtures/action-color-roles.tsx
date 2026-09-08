import React from "react";
import ReactDOM from "react-dom/client";

import { Button } from "../../src/components/ui/Button";
import {
  buttonVariantForActionTone,
  type ActionTone,
} from "../../src/components/ui/actionTone";
import { I18nProvider } from "../../src/lib/i18n";
import "@fontsource-variable/manrope";
import "../../src/styles.css";

const roles: Array<{ tone: ActionTone; label: string; example: string }> = [
  { tone: "brand", label: "Brand", example: "Create" },
  { tone: "neutral", label: "Neutral", example: "Edit" },
  { tone: "warning", label: "Warning", example: "Archive" },
  { tone: "danger", label: "Danger", example: "Delete" },
  { tone: "ai", label: "AI", example: "Generate" },
];

function ActionColorRolesFixture() {
  return (
    <main className="min-h-screen bg-zani-page p-6 text-zani-text sm:p-10">
      <section className="mx-auto max-w-4xl rounded-card border border-zani-border bg-surface-card p-5 shadow-panel sm:p-8">
        <h1 className="text-2xl font-bold text-zani-ink">Action color roles</h1>
        <p className="mt-2 text-sm text-zani-subtle">Semantic role matrix for default, focus, hover, pressed and disabled verification.</p>
        <div className="mt-6 grid gap-3" data-testid="action-color-matrix">
          {roles.map((role) => (
            <div key={role.tone} className="grid gap-3 rounded-card border border-zani-border bg-surface-warm p-4 sm:grid-cols-[120px_1fr_1fr] sm:items-center">
              <strong>{role.label}</strong>
              <Button data-testid={`tone-${role.tone}`} variant={buttonVariantForActionTone(role.tone)}>
                {role.example}
              </Button>
              <Button data-testid={`tone-${role.tone}-disabled`} variant={buttonVariantForActionTone(role.tone)} disabled>
                {role.example} disabled
              </Button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <ActionColorRolesFixture />
    </I18nProvider>
  </React.StrictMode>,
);
