import { Button } from "@keyhall/ui/components/button";
import { Switch } from "@keyhall/ui/components/switch";
import { cn } from "@keyhall/ui/lib/utils";
import {
  CaretDownIcon,
  CheckIcon,
  EyeSlashIcon,
  FunnelSimpleIcon,
  GridFourIcon,
  KeyholeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  RowsIcon,
  SortAscendingIcon,
  StackIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DEPTH, friend, gamesIn, SOURCES, UNVETTED, type Source } from "../data.ts";
import { Avatar, sourceTint } from "../kit.tsx";
import { activeFilters, SORTS, useWin, visibleGames, type Sort } from "./state.tsx";

type Menu = "sources" | "filters" | "sort" | null;

function SourceMark({ s, on }: { s: Source; on: boolean }) {
  if (s.by)
    return <Avatar person={friend(s.by)} size="xs" className={cn(!on && "opacity-40 grayscale")} />;
  return (
    <span
      className="grid size-5 place-items-center rounded-[5px]"
      style={{ background: sourceTint(s.hue, on ? 0.42 : 0.3, on ? 0.09 : 0.02) }}
    >
      <KeyholeIcon
        weight="fill"
        className="size-3"
        style={{ color: sourceTint(s.hue, on ? 0.88 : 0.6, on ? 0.12 : 0.02) }}
      />
    </span>
  );
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("mousedown", down);
    addEventListener("keydown", key);
    return () => {
      removeEventListener("mousedown", down);
      removeEventListener("keydown", key);
    };
  }, [open, close]);
  return ref;
}

function Popover({
  label,
  trigger,
  open,
  onOpen,
  onClose,
  width = 300,
  children,
}: {
  label: string;
  trigger: ReactNode;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const ref = useDismiss(open, onClose);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    const main = el?.closest("main");
    if (!open || !el || !main) return;
    const m = main.getBoundingClientRect();
    const scale = m.width / main.offsetWidth;
    const left = el.getBoundingClientRect().right - width * scale;
    setShift(Math.max(0, (m.left + 12 * scale - left) / scale));
  }, [open, width, ref]);
  return (
    <div ref={ref} data-menu={label} className="relative shrink-0">
      <div
        onClick={open ? onClose : onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
      >
        {trigger}
      </div>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          style={{ width, right: -shift }}
          className={cn(
            "absolute top-full z-40 mt-1.5 origin-top rounded-xl bg-popover p-1.5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75)] ring-1 ring-white/[0.09] animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuRow({
  children,
  end,
  onClick,
  muted,
}: {
  children: ReactNode;
  end?: ReactNode;
  onClick?: () => void;
  muted?: boolean;
}) {
  return (
    <label
      onClick={onClick}
      className={cn(
        "flex min-h-9 cursor-default items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.05]",
        muted && "text-muted-foreground",
      )}
    >
      {children}
      {end}
    </label>
  );
}

function Search({ wide }: { wide?: boolean }) {
  const { filters, setFilters } = useWin();
  return (
    <label
      className={cn(
        "flex h-8 min-w-0 items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 text-muted-foreground ring-1 ring-white/[0.05] focus-within:ring-primary/50",
        wide ? "flex-1" : "w-56",
      )}
    >
      <MagnifyingGlassIcon className="size-4 shrink-0" />
      <input
        data-search
        value={filters.q}
        onChange={(e) => setFilters({ q: e.target.value })}
        placeholder="Search games"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
      />
      {filters.q ? (
        <button aria-label="Clear search" onClick={() => setFilters({ q: "" })}>
          <XIcon className="size-3.5" />
        </button>
      ) : (
        <kbd className="font-sans text-[11px]">⌘K</kbd>
      )}
    </label>
  );
}

function ViewToggle() {
  const { layout, set } = useWin();
  return (
    <div className="flex shrink-0 rounded-lg bg-white/[0.05] p-0.5">
      {(
        [
          ["grid", GridFourIcon, "Cover grid"],
          ["list", RowsIcon, "List"],
        ] as const
      ).map(([v, Icon, label]) => (
        <button
          key={v}
          aria-label={label}
          aria-pressed={layout.main === v}
          onClick={() => set({ main: v })}
          className={cn(
            "grid size-7 place-items-center rounded-md transition-colors",
            layout.main === v
              ? "bg-white/[0.09] text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

function SortMenu({ menu, setMenu }: { menu: Menu; setMenu: (m: Menu) => void }) {
  const { filters, setFilters } = useWin();
  return (
    <Popover
      label="Sort"
      open={menu === "sort"}
      onOpen={() => setMenu("sort")}
      onClose={() => setMenu(null)}
      width={200}
      trigger={
        <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
          <SortAscendingIcon className="@max-[560px]:hidden" data-icon="inline-start" />
          <span className="@max-[480px]:hidden">{SORTS[filters.sort]}</span>
          <SortAscendingIcon className="@min-[481px]:hidden" />
          <CaretDownIcon data-icon="inline-end" className="@max-[480px]:hidden" />
        </Button>
      }
    >
      {(Object.keys(SORTS) as Sort[]).map((s) => (
        <MenuRow
          key={s}
          onClick={() => {
            setFilters({ sort: s });
            setMenu(null);
          }}
          end={filters.sort === s && <CheckIcon weight="bold" className="size-3.5 text-primary" />}
        >
          <span className="flex-1">{SORTS[s]}</span>
        </MenuRow>
      ))}
    </Popover>
  );
}

function SourcesList() {
  const { filters, setFilters } = useWin();
  return (
    <>
      <div className="px-2 pt-1.5 pb-1 text-[12px] font-medium text-muted-foreground">
        Curator lists
      </div>
      {SOURCES.map((s) => (
        <MenuRow
          key={s.id}
          muted={!filters.sources[s.id]}
          end={
            <Switch
              size="sm"
              checked={filters.sources[s.id]}
              onCheckedChange={(v) => setFilters({ sources: { ...filters.sources, [s.id]: v } })}
              aria-label={s.name}
            />
          }
        >
          <SourceMark s={s} on={filters.sources[s.id]} />
          <span className="min-w-0 flex-1 truncate">
            {s.name}
            <span className="ml-1.5 text-[12px] text-muted-foreground tabular-nums">
              {gamesIn(s.id).length}
            </span>
          </span>
        </MenuRow>
      ))}
      <div className="mx-2 my-1.5 h-px bg-white/[0.07]" />
      <MenuRow
        end={
          <Switch
            size="sm"
            checked={filters.unvetted}
            onCheckedChange={(unvetted) => setFilters({ unvetted })}
            aria-label="Unvetted listings"
          />
        }
      >
        <span className="grid size-5 place-items-center">
          <EyeSlashIcon className="size-4 text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1 truncate">
          Unvetted
          <span className="ml-1.5 text-[12px] text-muted-foreground tabular-nums">{UNVETTED}</span>
        </span>
      </MenuRow>
      <p className="px-2 pb-1.5 text-[12px] leading-snug text-muted-foreground">
        Listings no curator has checked. Keyhall asks before signing anything for them.
      </p>
      <MenuRow muted>
        <span className="grid size-5 place-items-center">
          <PlusIcon className="size-3.5" />
        </span>
        <span className="flex-1">Add a curator list</span>
      </MenuRow>
    </>
  );
}

function DepthPicker() {
  const { filters, setFilters } = useWin();
  return (
    <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-black/30 p-0.5 ring-1 ring-white/[0.06]">
      {DEPTH.map((d, i) => (
        <button
          key={d}
          aria-pressed={filters.depth === i}
          onClick={() => setFilters({ depth: i })}
          className={cn(
            "h-11 rounded-md px-1 text-[11px] leading-tight text-balance transition-colors",
            filters.depth === i
              ? "bg-white/[0.1] font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

function FilterList() {
  const { filters, setFilters, clearFilters } = useWin();
  const toggles = [
    ["signer", "Signs through Keyhall", "Your key never reaches the game"],
    ["multiplayer", "Multiplayer", "Plays with others over relays"],
    ["friends", "Friends playing", "Someone you follow is in it now"],
    ["updated", "Updated recently", "In the last two weeks"],
  ] as const;
  return (
    <>
      {toggles.map(([k, label, hint]) => (
        <MenuRow
          key={k}
          end={
            <Switch
              size="sm"
              checked={filters[k]}
              onCheckedChange={(v) => setFilters({ [k]: v })}
              aria-label={label}
            />
          }
        >
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate">{label}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>
          </span>
        </MenuRow>
      ))}
      <div className="px-2 pt-2.5 pb-1.5 text-[12px] font-medium text-muted-foreground">
        Nostr depth, at least
      </div>
      <div className="px-1 pb-1">
        <DepthPicker />
      </div>
      <div className="mx-2 my-1.5 h-px bg-white/[0.07]" />
      <div className="flex justify-end px-1 pb-0.5">
        <Button size="xs" variant="ghost" onClick={clearFilters}>
          Clear all
        </Button>
      </div>
    </>
  );
}

function Tokens({ skipSources }: { skipSources?: boolean }) {
  const { filters, setFilters, clearFilters } = useWin();
  const tokens = activeFilters(filters, setFilters).filter(
    (t) => !skipSources || !(SOURCES.some((s) => s.id === t.key) || t.key === "unvetted"),
  );
  if (!tokens.length) return null;
  return (
    <div
      data-scroll-x
      className="no-scrollbar flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto px-5 [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]"
    >
      {tokens.map((t) => (
        <button
          key={t.key}
          onClick={t.clear}
          className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-primary/[0.12] pr-1.5 pl-2.5 text-[12px] text-primary ring-1 ring-primary/30 hover:bg-primary/[0.18]"
        >
          {t.label}
          <XIcon className="size-3" />
        </button>
      ))}
      <button
        onClick={clearFilters}
        className="shrink-0 px-2 text-[12px] text-muted-foreground hover:text-foreground"
      >
        Clear all
      </button>
    </div>
  );
}

function Count() {
  const { filters, running } = useWin();
  return (
    <span className="shrink-0 text-muted-foreground tabular-nums">
      {visibleGames(filters, running).length}
    </span>
  );
}

function Title() {
  return (
    <>
      <h1 className="shrink-0 text-[15px] font-semibold tracking-[-0.01em]">Library</h1>
      <Count />
    </>
  );
}

const row = "flex h-[52px] shrink-0 items-center gap-2 px-5";

function Toolbar() {
  const [menu, setMenu] = useState<Menu>(null);
  const { filters, setFilters } = useWin();
  const on = SOURCES.filter((s) => filters.sources[s.id]).length;
  const n = activeFilters(filters, setFilters).filter(
    (t) => !SOURCES.some((s) => s.id === t.key) && t.key !== "unvetted",
  ).length;
  return (
    <>
      <div className={cn(row, "border-b border-white/[0.06]")}>
        <Title />
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <div className="hidden min-w-0 @min-[620px]:flex">
            <Search />
          </div>
          <Popover
            label="Sources"
            open={menu === "sources"}
            onOpen={() => setMenu("sources")}
            onClose={() => setMenu(null)}
            trigger={
              <Button variant="secondary" size="sm" className="rounded-lg">
                <StackIcon data-icon="inline-start" />
                <span className="@max-[440px]:hidden">Sources</span>
                <span className="text-muted-foreground tabular-nums">
                  {on}/{SOURCES.length}
                </span>
              </Button>
            }
          >
            <SourcesList />
          </Popover>
          <Popover
            label="Filters"
            open={menu === "filters"}
            onOpen={() => setMenu("filters")}
            onClose={() => setMenu(null)}
            width={316}
            trigger={
              <Button variant="secondary" size="sm" className="rounded-lg">
                <FunnelSimpleIcon data-icon="inline-start" />
                <span className="@max-[440px]:hidden">Filters</span>
                {n > 0 && (
                  <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {n}
                  </span>
                )}
              </Button>
            }
          >
            <FilterList />
          </Popover>
          <SortMenu menu={menu} setMenu={setMenu} />
          <ViewToggle />
        </div>
      </div>
      <div className="@min-[620px]:hidden border-b border-white/[0.06] px-5 py-2.5">
        <Search wide />
      </div>
      <Tokens />
    </>
  );
}

function Chip({
  on,
  onClick,
  children,
  dashed,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  dashed?: boolean;
}) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] transition-colors",
        on
          ? "bg-primary/[0.12] text-primary ring-1 ring-primary/35"
          : "text-muted-foreground ring-1 ring-white/10 hover:text-foreground hover:ring-white/25",
        dashed && !on && "ring-0 outline-1 -outline-offset-1 outline-white/20 outline-dashed",
      )}
    >
      {children}
    </button>
  );
}

function Chips() {
  const [menu, setMenu] = useState<Menu>(null);
  const { filters, setFilters } = useWin();
  const nextDepth = (filters.depth + 1) % DEPTH.length;
  return (
    <>
      <div className={row}>
        <Title />
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <div className="hidden min-w-0 @min-[620px]:flex">
            <Search />
          </div>
          <SortMenu menu={menu} setMenu={setMenu} />
          <ViewToggle />
        </div>
      </div>
      <div className="@min-[620px]:hidden px-5 pb-2">
        <Search wide />
      </div>
      <div
        data-scroll-x
        className="no-scrollbar flex h-11 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-white/[0.06] px-5 pb-2 [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]"
      >
        {SOURCES.map((s) => (
          <Chip
            key={s.id}
            on={filters.sources[s.id]}
            onClick={() =>
              setFilters({ sources: { ...filters.sources, [s.id]: !filters.sources[s.id] } })
            }
          >
            <SourceMark s={s} on={filters.sources[s.id]} />
            {s.name}
          </Chip>
        ))}
        <Chip
          dashed
          on={filters.unvetted}
          onClick={() => setFilters({ unvetted: !filters.unvetted })}
        >
          <EyeSlashIcon className="size-3.5" /> Unvetted {UNVETTED}
        </Chip>
        <span className="mx-1.5 h-4 w-px shrink-0 bg-white/10" />
        <Chip on={filters.signer} onClick={() => setFilters({ signer: !filters.signer })}>
          Signs through Keyhall
        </Chip>
        <Chip on={filters.depth > 0} onClick={() => setFilters({ depth: nextDepth })}>
          {filters.depth ? DEPTH[filters.depth] : "Nostr depth"}
          <CaretDownIcon className="size-3" />
        </Chip>
        <Chip
          on={filters.multiplayer}
          onClick={() => setFilters({ multiplayer: !filters.multiplayer })}
        >
          Multiplayer
        </Chip>
        <Chip on={filters.friends} onClick={() => setFilters({ friends: !filters.friends })}>
          Friends playing
        </Chip>
        <Chip on={filters.updated} onClick={() => setFilters({ updated: !filters.updated })}>
          Updated recently
        </Chip>
      </div>
    </>
  );
}

function Tabs() {
  const [menu, setMenu] = useState<Menu>(null);
  const { filters, setFilters } = useWin();
  const only = SOURCES.filter((s) => filters.sources[s.id]);
  const tab =
    filters.unvetted && !only.length ? "unvetted" : only.length === 1 ? only[0]!.id : "all";
  const all = Object.fromEntries(SOURCES.map((s) => [s.id, s.on])) as typeof filters.sources;
  const none = Object.fromEntries(SOURCES.map((s) => [s.id, false])) as typeof filters.sources;
  const n = activeFilters(filters, setFilters).filter(
    (t) => !SOURCES.some((s) => s.id === t.key) && t.key !== "unvetted",
  ).length;
  const tabs: { id: string; label: ReactNode; pick: () => void }[] = [
    { id: "all", label: "All sources", pick: () => setFilters({ sources: all, unvetted: false }) },
    ...SOURCES.map((s) => ({
      id: s.id as string,
      label: (
        <>
          {s.name}
          <span className="text-muted-foreground tabular-nums">{gamesIn(s.id).length}</span>
        </>
      ),
      pick: () => setFilters({ sources: { ...none, [s.id]: true }, unvetted: false }),
    })),
    {
      id: "unvetted",
      label: (
        <>
          <EyeSlashIcon className="size-3.5" /> Unvetted
          <span className="tabular-nums">{UNVETTED}</span>
        </>
      ),
      pick: () => setFilters({ sources: none, unvetted: true }),
    },
  ];
  return (
    <>
      <div className={row}>
        <Title />
        <div className="ml-auto flex min-w-0 items-center gap-1.5">
          <div className="hidden min-w-0 @min-[560px]:flex">
            <Search />
          </div>
          <Popover
            label="Filters"
            open={menu === "filters"}
            onOpen={() => setMenu("filters")}
            onClose={() => setMenu(null)}
            width={316}
            trigger={
              <Button variant="secondary" size="sm" className="rounded-lg">
                <FunnelSimpleIcon data-icon="inline-start" />
                <span className="@max-[440px]:hidden">Filters</span>
                {n > 0 && (
                  <span className="grid size-4 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                    {n}
                  </span>
                )}
              </Button>
            }
          >
            <FilterList />
          </Popover>
          <SortMenu menu={menu} setMenu={setMenu} />
          <ViewToggle />
        </div>
      </div>
      <div className="@min-[560px]:hidden px-5 pb-2">
        <Search wide />
      </div>
      <div
        role="tablist"
        data-scroll-x
        className="no-scrollbar flex h-10 shrink-0 items-stretch gap-5 overflow-x-auto border-b border-white/[0.06] px-5 [mask-image:linear-gradient(to_right,black_calc(100%-32px),transparent)]"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={t.pick}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 text-[13px] transition-colors",
              tab === t.id
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
              t.id === "unvetted" && tab !== t.id && "text-muted-foreground/80",
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>
      <Tokens skipSources={tab !== "all"} />
    </>
  );
}

export function LibraryHeader() {
  const { layout } = useWin();
  return (
    <header className="relative z-20 flex shrink-0 flex-col bg-background">
      {layout.filterbar === "toolbar" && <Toolbar />}
      {layout.filterbar === "chips" && <Chips />}
      {layout.filterbar === "tabs" && <Tabs />}
    </header>
  );
}
