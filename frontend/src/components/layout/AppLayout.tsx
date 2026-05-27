import { motion } from "framer-motion";
import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="min-h-screen bg-soft-mesh">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="zani-depth-field absolute inset-0 opacity-90" />
        <div className="zani-perspective-panel absolute right-[6%] top-24 hidden h-64 w-80 lg:block" />
        <div className="zani-perspective-panel zani-perspective-panel-alt absolute bottom-24 left-[34%] hidden h-44 w-72 xl:block" />
      </div>
      <div className="relative flex min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        <div className={collapsed ? "hidden shrink-0 transition-[width] duration-300 lg:block lg:w-[116px]" : "hidden shrink-0 transition-[width] duration-300 lg:block lg:w-[342px]"} />
        <MobileNav open={menuOpen} onOpen={() => setMenuOpen(true)} onClose={() => setMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col pb-28 lg:pb-0">
          <Header onMenuClick={() => setMenuOpen(true)} />
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8"
          >
            <Outlet />
          </motion.main>
        </div>
      </div>
    </div>
  );
}
