import React from "react";
import { captureFrontendError } from "../../lib/monitoring";
import { translate, type Language } from "../../lib/i18n";
import { Button } from "./Button";
import { PageFallbackLayout } from "./FallbackSurfaces";

type AppErrorBoundaryState = {
  hasError: boolean;
};

type AppErrorBoundaryProps = React.PropsWithChildren<{
  onErrorCaptured?: (error: unknown, errorInfo: React.ErrorInfo) => void;
}>;

function getLanguage(): Language {
  const saved = window.localStorage.getItem("ai_smb_language");
  return saved === "kk" || saved === "en" || saved === "ru" ? saved : "ru";
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    this.props.onErrorCaptured?.(error, errorInfo);
    captureFrontendError(error, { componentStack: errorInfo.componentStack });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    const language = getLanguage();

    return (
      <main className="min-h-screen bg-zani-bg px-4 py-8 text-zani-ink sm:px-8">
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
          <PageFallbackLayout
            testId="app-error-boundary"
            title={translate(language, "errorBoundary.title")}
            message={translate(language, "errorBoundary.text")}
            actions={(
              <>
                <Button type="button" onClick={() => window.location.reload()}>
                  {translate(language, "errorBoundary.reload")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => window.location.assign("/app")}>
                  {translate(language, "errorBoundary.home")}
                </Button>
              </>
            )}
          />
        </div>
      </main>
    );
  }
}
