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

  return (
    <div className="min-h-screen bg-surface text-ink">
      <PageHeaderContext.Provider value={{ pageHeader, setPageHeader }}>
        <div className="relative flex min-h-screen">
          <Sidebar
            expanded={sidebarExpanded}
            onDesktopMouseEnter={() => setSidebarExpanded(true)}
            onDesktopMouseLeave={() => setSidebarExpanded(false)}
          />
          <div className="hidden shrink-0 transition-[width] duration-200 lg:block lg:w-16" />
          <MobileNav open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} />
          <div className="flex min-w-0 flex-1 flex-col pb-28 lg:pb-0">
            <Header
              menuOpen={menuOpen}
              onMenuClick={() => setMenuOpen(true)}
              pageHeader={pageHeader}
            />
            <motion.main
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className={`mx-auto w-full max-w-[1440px] flex-1 px-4 pb-4 ${pageHeader?.activeFilters ? "pt-24" : "pt-16"} sm:px-6 sm:pb-6 lg:px-6`}
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
