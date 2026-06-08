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
      <main className="min-h-screen bg-app-gradient px-4 py-8 text-midnight sm:px-8">
        <section className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
          <div className="zani-surface w-full p-6 shadow-soft-xl sm:p-8">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-2xl font-black text-red-600">
              !
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-500">{translate(language, "errorBoundary.eyebrow")}</p>
            <h1 className="mt-3 text-3xl font-black text-midnight sm:text-4xl">
              {translate(language, "errorBoundary.title")}
            </h1>
            <p className="mt-4 text-base font-semibold leading-7 text-slate-600">
              {translate(language, "errorBoundary.text")}
            </p>
            {this.state.message ? (
              <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {this.state.message}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-2xl bg-midnight px-5 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-soft-lg"
                onClick={() => window.location.reload()}
              >
                {translate(language, "errorBoundary.reload")}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-soft transition hover:-translate-y-0.5 hover:shadow-soft-lg"
                onClick={() => window.location.assign("/dashboard")}
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
