import { motion } from "framer-motion";
import { lazy, Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { PageHeaderContext, type PageHeaderConfig } from "./PageHeaderContext";
import { Sidebar } from "./Sidebar";

const CommandPalette = lazy(() => import("./CommandPalette").then((module) => ({ default: module.CommandPalette })));

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [pageHeader, setPageHeader] = useState<PageHeaderConfig | null>(null);
  const location = useLocation();
  const routeSlug = location.pathname.replace(/^\/app\/?/, "").split("/")[0] || "dashboard";
  const routeClass = `zani-route-${routeSlug.replace(/[^a-z0-9-]/gi, "-")}`;
  const routeScopeClass = "zani-route-restyled";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        window.dispatchEvent(new Event("zani:open-global-search"));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="zani-merchant-shell min-h-screen bg-soft-mesh text-ink">
      <PageHeaderContext.Provider value={{ pageHeader, setPageHeader }}>
        <div className="relative flex min-h-screen">
          <Sidebar
            expanded={sidebarExpanded}
            onDesktopMouseEnter={() => setSidebarExpanded(true)}
            onDesktopMouseLeave={() => setSidebarExpanded(false)}
          />
          <div className="hidden shrink-0 transition-[width] duration-200 lg:block lg:w-[72px]" />
          <MobileNav open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col pb-28 lg:pb-0">
            <Header onMenuClick={() => setMenuOpen(true)} pageHeader={pageHeader} />
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className={`zani-app-route ${routeClass} ${routeScopeClass} mx-auto w-full max-w-[1400px] flex-1 px-4 pb-4 ${pageHeader?.activeFilters ? "pt-28" : "pt-20"} sm:px-6 sm:pb-6 lg:px-6`}
            >
              <Outlet />
            </motion.main>
          </div>
        </div>
      </PageHeaderContext.Provider>
      {commandOpen ? (
        <Suspense fallback={null}>
          <CommandPalette onClose={() => setCommandOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}
