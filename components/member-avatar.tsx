import { cn } from "@/lib/utils";

const sizes = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
  xl: "h-28 w-28",
};

const textSizes = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-lg",
  xl: "text-2xl",
};

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts : ["M"]).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function MemberAvatar({ src, alt, size = "md", className }: { src?: string | null; alt: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 font-bold text-churchblue ring-1 ring-blue-100", sizes[size], textSizes[size], className)}>
      {src ? (
        // Supabase Storage URLs are user-uploaded and already thumbnail-sized where possible.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt} className="h-full w-full object-cover" src={src} />
      ) : <span aria-label={`${alt} initials`}>{initialsFrom(alt)}</span>}
    </div>
  );
}
