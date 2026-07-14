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
      <div className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
        <span className="mr-2 text-sm font-black">{labels.selected}</span>
        <select
          className="h-9 rounded-lg border border-white/10 bg-white/10 px-3 text-sm font-bold text-white outline-none"
          defaultValue=""
          onChange={(event) => onAssign(event.target.value ? Number(event.target.value) : undefined)}
        >
          <option className="text-slate-900" value="">{labels.assign}</option>
          {teamMembers.map((member) => (
            <option className="text-slate-900" key={member.user.id} value={member.user.id}>{member.user.full_name || member.user.email}</option>
          ))}
        </select>
        <Button size="sm" variant="secondary" className="rounded-lg bg-white text-slate-950 hover:bg-slate-100" onClick={onContact}>
          <MessageCircle size={15} /> {labels.contact}
        </Button>
        <Button size="sm" variant="secondary" className="rounded-lg bg-white text-slate-950 hover:bg-slate-100" onClick={onArchive}>
          <XCircle size={15} /> {labels.archive}
        </Button>
        <Button size="sm" variant="ghost" className="rounded-lg text-white hover:bg-white/10" onClick={onReset}>
          {labels.reset}
        </Button>
      </div>
    </div>
  );
}
