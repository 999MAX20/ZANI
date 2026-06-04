import { motion } from "framer-motion";
import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-soft-mesh text-ink">
      <div className="relative flex min-h-screen">
        <Sidebar
          expanded={sidebarExpanded}
          onDesktopMouseEnter={() => setSidebarExpanded(true)}
          onDesktopMouseLeave={() => setSidebarExpanded(false)}
        />
        <div className="hidden shrink-0 transition-[width] duration-200 lg:block lg:w-[72px]" />
        <MobileNav open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col pb-28 lg:pb-0">
          <Header onMenuClick={() => setMenuOpen(true)} />
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-4 pt-20 sm:px-6 sm:pb-6 lg:px-6"
          >
            <Outlet />
          </motion.main>
        </div>
      </div>
    </div>
  );
}
