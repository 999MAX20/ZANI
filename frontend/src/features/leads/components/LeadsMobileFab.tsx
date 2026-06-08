import { Plus } from "lucide-react";

import { cn } from "../../../lib/cn";

/**
 * Floating Action Button для mobile
 * Соответствует дизайн-референсам:
 * - Крупная кнопка (56px) для удобного нажатия
 * - Расположена в bottom-right углу
 * - Не перекрывает bottom navigation
 */
export function LeadsMobileFab({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 lg:hidden",
        className,
      )}
      aria-label="Создать заявку"
    >
      <Plus size={24} />
    </button>
  );
}
