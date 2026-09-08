import {
  lazy,
  memo,
  Profiler,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ProfilerOnRenderCallback,
} from "react";
import { Outlet, useLocation } from "react-router";

import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { PageHeaderContext, type PageHeaderConfig } from "./PageHeaderContext";
import { Sidebar } from "./Sidebar";

const CommandPalette = lazy(() => import("./CommandPalette").then((module) => ({ default: module.CommandPalette })));

const WorkspaceOutlet = memo(function WorkspaceOutlet() {
  return <Outlet />;
});

function MeasuredWorkspaceOutlet() {
  const onRender = (
    window as typeof window & {
      __ZANI_RUNTIME_PROFILER__?: ProfilerOnRenderCallback;
    }
  ).__ZANI_RUNTIME_PROFILER__;

  if (!onRender) return <WorkspaceOutlet />;

  return (
    <Profiler id="workspace-outlet" onRender={onRender}>
      <WorkspaceOutlet />
    </Profiler>
  );
}

function DesktopSidebar() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <>
      <Sidebar
        expanded={sidebarExpanded}
        onDesktopMouseEnter={() => setSidebarExpanded(true)}
        onDesktopMouseLeave={() => setSidebarExpanded(false)}
      />
      <div className="hidden w-16 shrink-0 lg:block" aria-hidden="true" />
    </>
  );
}

function WorkspaceNavigation({
  pageHeader,
}: {
  pageHeader: PageHeaderConfig | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <MobileNav
        open={menuOpen}
        onOpen={() => setMenuOpen(true)}
        onClose={() => setMenuOpen(false)}
      />
      <Header
        menuOpen={menuOpen}
        onMenuClick={() => setMenuOpen(true)}
        pageHeader={pageHeader}
      />
    </>
  );
}

function CommandPaletteController() {
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!commandOpen) return null;

  return (
    <Suspense fallback={null}>
      <CommandPalette onClose={() => setCommandOpen(false)} />
    </Suspense>
  );
}

export function AppLayout() {
  const [pageHeader, setPageHeader] = useState<PageHeaderConfig | null>(null);
  const location = useLocation();
  const pageHeaderActions = useMemo(() => ({ setPageHeader }), []);
  const usesWideCrmWorkspace = /^\/app\/(leads|clients|deals)\/?$/.test(
    location.pathname,
  );
  const usesEdgeToEdgeDeals = /^\/app\/deals\/?$/.test(location.pathname);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <PageHeaderContext.Provider value={pageHeaderActions}>
        <div className="relative flex min-h-screen">
          <DesktopSidebar />
          <div className="flex min-w-0 flex-1 flex-col pb-28 lg:pb-0">
            <WorkspaceNavigation pageHeader={pageHeader} />
            <main
              key={location.pathname}
              className={`animate-fade-in mx-auto w-full flex-1 ${usesEdgeToEdgeDeals ? "px-2 pb-2" : "px-4 pb-4 sm:px-6 sm:pb-6 lg:px-6"} ${usesWideCrmWorkspace ? "max-w-none" : "max-w-[1440px]"} ${pageHeader?.activeFilters ? "pt-24" : "pt-16"}`}
            >
              <MeasuredWorkspaceOutlet />
            </main>
          </div>
        </div>
      </PageHeaderContext.Provider>
      <CommandPaletteController />
    </div>
  );
}
