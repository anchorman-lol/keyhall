import { cn } from "@keyhall/ui/lib/utils";
import type { ReactNode } from "react";
import { cover, type Friend, type Game } from "./data.ts";

export function Window({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative h-[900px] w-[1440px] overflow-hidden rounded-[12px] bg-background text-[13px] text-foreground ring-1 ring-white/10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TrafficLights({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-2", className)} aria-hidden>
      <span className="size-3 rounded-full bg-[#ff5f57]" />
      <span className="size-3 rounded-full bg-[#febc2e]" />
      <span className="size-3 rounded-full bg-[#28c840]" />
    </div>
  );
}

export function Cover({ game, className }: { game: Game; className?: string }) {
  return (
    <span className={cn("block overflow-hidden bg-muted", className)}>
      <img
        src={cover(game)}
        alt=""
        draggable={false}
        style={{
          objectPosition: game.focus,
          transform: game.zoom ? `scale(${game.zoom})` : undefined,
          transformOrigin: game.focus,
        }}
        className="block size-full object-cover"
      />
    </span>
  );
}

const avatarSize = {
  xs: "size-5 text-[10px]",
  sm: "size-6 text-[11px]",
  md: "size-8 text-[13px]",
  lg: "size-10 text-[15px]",
};

export function Avatar({
  person,
  size = "md",
  dot,
  className,
}: {
  person: Pick<Friend, "name" | "hue"> & { status?: Friend["status"] };
  size?: keyof typeof avatarSize;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <span
        className={cn("grid place-items-center rounded-full font-semibold", avatarSize[size])}
        style={{
          background: `oklch(0.42 0.09 ${person.hue})`,
          color: `oklch(0.93 0.04 ${person.hue})`,
        }}
      >
        {person.name.slice(0, 1).toUpperCase()}
      </span>
      {dot && person.status && person.status !== "offline" && (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-[var(--ring-bg,var(--background))]",
            person.status === "ingame" ? "bg-ingame" : "bg-online",
          )}
        />
      )}
    </span>
  );
}

export function Sats({ n, className }: { n: number; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{n.toLocaleString("en-US")}</span>;
}

export function Live({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      <span className="absolute inset-0 animate-ping rounded-full bg-online/60 motion-reduce:hidden" />
      <span className="relative size-2 rounded-full bg-online" />
    </span>
  );
}

export function sourceTint(hue: number, l = 0.75, c = 0.12) {
  return `oklch(${l} ${c} ${hue})`;
}
