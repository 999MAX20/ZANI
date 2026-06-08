import { money } from "../../utils/dealHelpers";

export function DealAmount({ value, currency, className = "" }: { value: string | number; currency?: string; className?: string }) {
  return <span className={className}>{money(value, currency)}</span>;
}
