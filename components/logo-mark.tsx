import { Cross } from "lucide-react";

export function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`${small ? "h-10 w-10" : "h-12 w-12"} flex shrink-0 items-center justify-center rounded-xl bg-gold text-navy-deep shadow-sm`}>
      <Cross className={small ? "h-5 w-5" : "h-6 w-6"} strokeWidth={2.4} />
    </div>
  );
}
