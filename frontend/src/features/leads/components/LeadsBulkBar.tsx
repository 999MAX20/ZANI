import { MessageCircle, XCircle } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import type { Id } from "../../../types";

type TeamMemberOption = {
  user: {
    id: Id;
    full_name?: string;
    email: string;
  };
};

export function LeadsBulkBar({
  selectedCount,
  teamMembers,
  labels,
  onAssign,
  onContact,
  onArchive,
  onReset,
}: {
  selectedCount: number;
  teamMembers: TeamMemberOption[];
  labels: {
    selected: string;
    assign: string;
    contact: string;
    archive: string;
    reset: string;
  };
  onAssign: (userId?: Id) => void;
  onContact: () => void;
  onArchive: () => void;
  onReset: () => void;
}) {
  if (!selectedCount) return null;

  return (
    <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="flex max-w-full flex-wrap items-center gap-2 rounded-card border border-slate-200 bg-white px-4 py-3 text-midnight shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
        <span className="mr-2 rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-black text-brand-700">{labels.selected}</span>
        <select
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-midnight outline-none transition focus:border-brand-300 focus:ring-4 focus:ring-brand-50"
          defaultValue=""
          onChange={(event) => onAssign(event.target.value ? Number(event.target.value) : undefined)}
        >
          <option value="">{labels.assign}</option>
          {teamMembers.map((member) => (
            <option key={member.user.id} value={member.user.id}>{member.user.full_name || member.user.email}</option>
          ))}
        </select>
        <Button size="sm" variant="secondary" className="rounded-lg shadow-none active:scale-[0.98]" onClick={onContact}>
          <MessageCircle size={15} /> {labels.contact}
        </Button>
        <Button size="sm" variant="secondary" className="rounded-lg shadow-none active:scale-[0.98]" onClick={onArchive}>
          <XCircle size={15} /> {labels.archive}
        </Button>
        <Button size="sm" variant="ghost" className="rounded-lg text-slate-500 hover:bg-slate-50 hover:text-midnight active:scale-[0.98]" onClick={onReset}>
          {labels.reset}
        </Button>
      </div>
    </div>
  );
}
