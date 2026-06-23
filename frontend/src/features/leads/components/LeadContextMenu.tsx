import { CircleDot, MessageCircle, Phone, UserCheck, XCircle } from "lucide-react";

import { PopoverSurface } from "../../../components/ui/Overlay";
import type { Lead } from "../../../types";

export function LeadContextMenu({
  x,
  y,
  lead,
  labels,
  onClose,
  onOpen,
  onCall,
  onWhatsApp,
  onTake,
  onArchive,
}: {
  x: number;
  y: number;
  lead: Lead;
  labels: {
    open: string;
    call: string;
    whatsApp: string;
    assignToMe: string;
    archive: string;
  };
  onClose: () => void;
  onOpen: (lead: Lead) => void;
  onCall: (lead: Lead) => void;
  onWhatsApp: (lead: Lead) => void;
  onTake: (lead: Lead) => void;
  onArchive: (lead: Lead) => void;
}) {
  const items = [
    { label: labels.open, icon: CircleDot, onClick: () => onOpen(lead) },
    { label: labels.call, icon: Phone, onClick: () => onCall(lead) },
    { label: labels.whatsApp, icon: MessageCircle, onClick: () => onWhatsApp(lead) },
    { label: labels.assignToMe, icon: UserCheck, onClick: () => onTake(lead) },
    { label: labels.archive, icon: XCircle, onClick: () => onArchive(lead) },
  ];

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <PopoverSurface
        className="absolute w-56 p-2"
        style={{ left: x, top: y }}
        onClick={(event) => event.stopPropagation()}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-midnight"
              onClick={() => {
                item.onClick();
                onClose();
              }}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </PopoverSurface>
    </div>
  );
}
