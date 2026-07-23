import React from "react";
import { captureFrontendError } from "../../lib/monitoring";
import { translate, type Language } from "../../lib/i18n";

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

function getLanguage(): Language {
  const saved = window.localStorage.getItem("ai_smb_language");
  return saved === "kk" || saved === "en" || saved === "ru" ? saved : "ru";
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : translate(getLanguage(), "errorBoundary.unknown"),
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    captureFrontendError(error, { componentStack: errorInfo.componentStack });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    const language = getLanguage();

    return (
      <main className="min-h-screen bg-zani-bg px-4 py-8 text-zani-ink sm:px-8">
        <section className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
          <div className="zani-surface w-full p-6 sm:p-8">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-card bg-[var(--zani-danger-soft)] text-2xl font-semibold text-zani-danger">
              !
            </div>
            <p className="text-sm font-bold text-zani-danger">{translate(language, "errorBoundary.eyebrow")}</p>
            <h1 className="mt-3 text-3xl font-semibold text-zani-ink sm:text-4xl">
              {translate(language, "errorBoundary.title")}
            </h1>
            <p className="mt-4 text-base font-semibold leading-7 text-zani-subtle">
              {translate(language, "errorBoundary.text")}
            </p>
            {this.state.message ? (
              <p className="mt-4 rounded-card border border-[rgba(194,65,12,0.2)] bg-[var(--zani-danger-soft)] px-4 py-3 text-sm font-semibold text-zani-danger">
                {this.state.message}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="zani-focus-ring rounded-control bg-brand-500 px-5 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-brand-600/10 transition hover:bg-brand-600"
                onClick={() => window.location.reload()}
              >
                {translate(language, "errorBoundary.reload")}
              </button>
              <button
                type="button"
                className="zani-focus-ring rounded-control border border-zani-border bg-surface-card px-5 py-3 text-sm font-semibold text-zani-text shadow-sm transition hover:border-brand-100 hover:bg-surface-warm"
                onClick={() => window.location.assign("/app")}
              >
                {translate(language, "errorBoundary.home")}
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }
}
