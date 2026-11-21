import { cn } from "@keyhall/ui/lib/utils";
import { KeyholeIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cover, friendsIn, type Friend, type Game } from "./data.ts";

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

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.01em]",
        className,
      )}
    >
      <KeyholeIcon weight="fill" className="size-5 text-primary" />
      Keyhall
    </span>
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

export function Tile({
  game,
  running,
  className,
  meta,
}: {
  game: Game;
  running?: boolean;
  className?: string;
  meta?: ReactNode;
}) {
  const here = friendsIn(game.id);
  return (
    <button className={cn("group flex min-w-0 flex-col gap-2 text-left outline-none", className)}>
      <span className="relative overflow-hidden rounded-lg ring-1 ring-white/[0.06] transition group-hover:ring-2 group-hover:ring-primary/70 group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <Cover
          game={game}
          className="aspect-[16/10] w-full transition duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        {running && (
          <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            <Live className="size-1.5" /> Running
          </span>
        )}
      </span>
      <span className="flex items-start justify-between gap-2 px-0.5">
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium">{game.name}</span>
          <span className="block truncate text-[12px] text-muted-foreground">
            {meta ?? game.genre}
          </span>
        </span>
        {here.length > 0 && (
          <span className="flex -space-x-1.5 pt-0.5">
            {here.map((f) => (
              <Avatar
                key={f.handle}
                person={f}
                size="xs"
                className="ring-2 ring-background rounded-full"
              />
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

export function sourceTint(hue: number, l = 0.75, c = 0.12) {
  return `oklch(${l} ${c} ${hue})`;
}
