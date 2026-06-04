import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action && (
        <Button>
          <Plus className="h-4 w-4" /> {action}
        </Button>
      )}
    </div>
  );
}
