import React from "react";

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

const errorCopy = {
  ru: {
    unknown: "Неизвестная ошибка интерфейса.",
    eyebrow: "Ошибка интерфейса",
    title: "Мы поймали сбой и сохранили управление.",
    text: "Обновите страницу или вернитесь на рабочий стол. Если ошибка повторится, передайте её в поддержку вместе с текущим действием.",
    reload: "Обновить",
    home: "На главную",
  },
  kk: {
    unknown: "Интерфейстің белгісіз қатесі.",
    eyebrow: "Интерфейс қатесі",
    title: "Қате ұсталды, басқару сақталды.",
    text: "Бетті жаңартыңыз немесе басты экранға оралыңыз. Қате қайталанса, ағымдағы әрекетпен бірге қолдауға жіберіңіз.",
    reload: "Жаңарту",
    home: "Басты бет",
  },
  en: {
    unknown: "Unknown interface error.",
    eyebrow: "Interface error",
    title: "We caught the issue and kept control.",
    text: "Refresh the page or return to dashboard. If the issue repeats, send it to support with the current action.",
    reload: "Refresh",
    home: "Home",
  },
};

function getCopy() {
  const saved = window.localStorage.getItem("ai_smb_language");
  return saved === "kk" || saved === "en" ? errorCopy[saved] : errorCopy.ru;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const copy = getCopy();
    return {
      hasError: true,
      message: error instanceof Error ? error.message : copy.unknown,
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    console.error("Zani frontend error", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    const copy = getCopy();

    return (
      <main className="min-h-screen bg-app-gradient px-4 py-8 text-midnight sm:px-8">
        <section className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
          <div className="zani-surface w-full p-6 shadow-soft-xl sm:p-8">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-red-50 text-2xl font-black text-red-600">
              !
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-500">{copy.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-black text-midnight sm:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-4 text-base font-semibold leading-7 text-slate-600">
              {copy.text}
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
                {copy.reload}
              </button>
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-soft transition hover:-translate-y-0.5 hover:shadow-soft-lg"
                onClick={() => window.location.assign("/dashboard")}
              >
                {copy.home}
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }
}
