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
    <div className="min-h-screen bg-soft-mesh text-ink">
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
            className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8"
          >
            <Outlet />
          </motion.main>
        </div>
      </div>
    </div>
  );
}
