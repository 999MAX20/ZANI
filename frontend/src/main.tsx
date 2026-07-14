import React from "react";
import ReactDOM from "react-dom/client";

import { AppProviders } from "./app/providers";
import { AppRouter } from "./app/router";
import { AppErrorBoundary } from "./components/ui/AppErrorBoundary";
import { initFrontendMonitoring } from "./lib/monitoring";
import "./styles.css";

initFrontendMonitoring();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </AppErrorBoundary>
  </React.StrictMode>,
);
