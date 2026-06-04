import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
  xl: "h-28 w-28",
};

const iconSizes = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-9 w-9",
  xl: "h-12 w-12",
};

export function MemberAvatar({ src, alt, size = "md", className }: { src?: string | null; alt: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-churchblue ring-1 ring-blue-100", sizes[size], className)}>
      {src ? (
        // Supabase Storage URLs are user-uploaded and already thumbnail-sized where possible.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt} className="h-full w-full object-cover" src={src} />
      ) : <UserRound className={iconSizes[size]} />}
    </div>
  );
}
