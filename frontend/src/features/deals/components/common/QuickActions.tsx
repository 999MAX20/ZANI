import { CalendarPlus, MessageCircle, MoreHorizontal, Phone } from "lucide-react";

import { Button } from "../../../../components/ui/Button";
import type { Client, Deal } from "../../../../types";

export function QuickActions<TDeal extends Deal>({ deal, client, onTask, onMore }: { deal: TDeal; client?: Client; onTask: (deal: TDeal) => void; onMore: (deal: TDeal) => void }) {
  const phone = client?.phone?.replace(/\D/g, "");
  return (
    <div className="flex items-center gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="Позвонить" onClick={(event) => event.stopPropagation()}>
        <Phone size={16} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label="WhatsApp"
        onClick={(event) => {
          event.stopPropagation();
          if (phone) window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");
        }}
      >
        <MessageCircle size={16} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label="Создать задачу"
        onClick={(event) => {
          event.stopPropagation();
          onTask(deal);
        }}
      >
        <CalendarPlus size={16} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        aria-label="Еще"
        onClick={(event) => {
          event.stopPropagation();
          onMore(deal);
        }}
      >
        <MoreHorizontal size={16} />
      </Button>
    </div>
  );
}
