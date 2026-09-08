import type { ButtonVariant } from "./Button";

export type ActionTone = "brand" | "neutral" | "warning" | "danger" | "ai";

const buttonVariants: Record<ActionTone, ButtonVariant> = {
  brand: "primary",
  neutral: "secondary",
  warning: "warning",
  danger: "danger",
  ai: "ai",
};

const crmActionTones: Partial<Record<string, ActionTone>> = {
  cancel: "warning",
  lost: "warning",
  merge: "danger",
  no_show: "warning",
};

export function buttonVariantForActionTone(tone: ActionTone): ButtonVariant {
  return buttonVariants[tone];
}

export function resolveCrmActionTone(action: { id: string; destructive?: boolean }): ActionTone {
  return crmActionTones[action.id] || (action.destructive ? "danger" : "neutral");
}
