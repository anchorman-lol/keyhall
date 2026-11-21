import { Button } from "@keyhall/ui/components/button";
import { Switch } from "@keyhall/ui/components/switch";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { Window } from "./kit.tsx";
import { Dock } from "./variants/Dock.tsx";
import { Inspector } from "./variants/Inspector.tsx";
import { NowColumn } from "./variants/NowColumn.tsx";
import { Shelves } from "./variants/Shelves.tsx";
import { SourceList } from "./variants/SourceList.tsx";

type Variant = { id: string; name: string; idea: string; why: string[]; View: ComponentType };

const VARIANTS: Variant[] = [
  {
    id: "source-list",
    name: "Source list",
    idea: "Sources are mailboxes: a Mail-style sidebar, friends in a column on the right, and an editor-style status bar for everything that is running.",
    why: [
      "Every curator is a first-class row with its own count, so turning a source off or adding one is never more than one click away.",
      "The status bar holds the running game, the last signature and the month's budget in 40 pixels. It is always there and never in the way.",
      "Friends get a full column, so who is playing what can be read at a glance without opening anything.",
    ],
    View: SourceList,
  },
  {
    id: "dock",
    name: "Now-playing dock",
    idea: "A music-player layout: tabs in the title bar, the library full width, and a dock along the bottom that belongs to the running game.",
    why: [
      "The library gets the whole window, so cover art leads and sources become a row of filters.",
      "The dock is the game's control surface: session time, who can see you, every signature as it happens, friends in the same game and what this game earns from your budget.",
      "When nothing runs, the dock folds away and the window is all library.",
    ],
    View: Dock,
  },
  {
    id: "now-column",
    name: "Now column",
    idea: "The window splits by time: a left column for what is live right now, the library for everything else.",
    why: [
      "Keyhall's difference is that play is social and signed. This puts both at the top-left, where the eye lands first.",
      "Friends' games show as art with a Join button, so the shortest path to playing is joining someone.",
      "Sources are tabs over the library, a lighter control than a sidebar for something set up once.",
    ],
    View: NowColumn,
  },
  {
    id: "inspector",
    name: "Inspector",
    idea: "Three panes, as in Mail or Things: navigation, a dense game list, and a large inspector for the selected game.",
    why: [
      "Picking a game never leaves the library; the inspector answers 'can I trust it, who plays it, what does it cost me' beside the list.",
      "The list is dense enough for a library of hundreds of games from many curators.",
      "Running game and signer sit at the foot of the sidebar, like a now-playing card.",
    ],
    View: Inspector,
  },
  {
    id: "shelves",
    name: "Shelves and friend rail",
    idea: "Each source is a shelf, the running game is a banner, and friends are a slim rail of faces on the right edge.",
    why: [
      "Curators read like people with taste: each shelf carries its curator's name and pitch, and hiding a shelf is unfollowing.",
      "The running game is a banner at the top of home, so getting back into it is one click and its signatures are visible.",
      "The friend rail costs 72 pixels; faces in a game wear that game's cover, so presence shows without a column of text.",
    ],
    View: Shelves,
  },
];

type Picks = Record<string, { pick: boolean; note: string }>;
const KEY = "keyhall-ui-layout-picks";

function load(): Picks {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

function Fit({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / 1440)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full" style={{ height: 900 * scale }}>
      <div className="mx-auto w-[1440px] origin-top-left" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

export function Page() {
  const [picks, setPicks] = useState<Picks>(load);
  const [copied, setCopied] = useState(false);
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(picks)), [picks]);
  const set = (id: string, patch: Partial<Picks[string]>) =>
    setPicks((p) => ({ ...p, [id]: { pick: false, note: "", ...p[id], ...patch } }));
  const chosen = VARIANTS.filter((v) => picks[v.id]?.pick || picks[v.id]?.note);
  const copy = async () => {
    const text = [
      "Keyhall layout picks",
      ...VARIANTS.map((v, i) => {
        const p = picks[v.id];
        const mark = p?.pick ? "PICK" : "-";
        return `${i + 1}. ${v.name}: ${mark}${p?.note ? ` (${p.note})` : ""}`;
      }),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] pb-24">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b0c10]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-6">
          <span className="font-semibold">Keyhall layout</span>
          <nav className="flex gap-1 text-[13px] text-muted-foreground">
            {VARIANTS.map((v, i) => (
              <a
                key={v.id}
                href={`#${v.id}`}
                className="rounded-md px-2.5 py-1 hover:bg-white/[0.06] hover:text-foreground"
              >
                {i + 1}. {v.name}
                {picks[v.id]?.pick && (
                  <CheckIcon weight="bold" className="ml-1 inline size-3 text-primary" />
                )}
              </a>
            ))}
          </nav>
          <Button size="sm" className="ml-auto" onClick={copy} id="copy-picks">
            {copied ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copied ? "Copied" : `Copy picks${chosen.length ? ` (${chosen.length})` : ""}`}
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-6 pt-14 pb-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-balance">
          Part 1: the window layout
        </h1>
        <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-foreground/80 text-pretty">
          Five ways to arrange the Keyhall window: where the library, sources, friends, budget and
          the running game with its signer live, and how the main area is divided. Colours, cards
          and the game page come in later rounds, so judge the structure. Each is drawn at 1440 ×
          900 with the app's own theme and components. Pick one or more, leave a note, and copy your
          picks back.
        </p>
        <p className="mt-3 max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">
          Game names, art and descriptions come from the November scout. Friends, play time,
          signatures and budget figures are illustrative.
        </p>
      </section>

      {VARIANTS.map((v, i) => {
        const p = picks[v.id];
        return (
          <section
            key={v.id}
            id={v.id}
            className="variant mx-auto max-w-[1440px] scroll-mt-14 pt-16"
          >
            <div className="grid grid-cols-[1fr_340px] gap-12 px-6 pb-7">
              <div>
                <h2 className="flex items-baseline gap-3 text-[22px] font-semibold tracking-[-0.015em]">
                  <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                  {v.name}
                </h2>
                <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-foreground/90">
                  {v.idea}
                </p>
                <ul className="mt-3 grid max-w-[78ch] gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {v.why.map((w) => (
                    <li key={w} className="flex gap-2.5">
                      <span className="mt-[9px] size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pick self-end rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
                <label className="flex items-center justify-between gap-3 text-[13px] font-medium">
                  Pick this
                  <Switch
                    checked={!!p?.pick}
                    onCheckedChange={(pick) => set(v.id, { pick })}
                    aria-label={`Pick ${v.name}`}
                  />
                </label>
                <textarea
                  value={p?.note ?? ""}
                  onChange={(e) => set(v.id, { note: e.target.value })}
                  placeholder="Note: what to keep, what to change"
                  rows={2}
                  className="mt-3 w-full resize-none rounded-lg bg-black/30 px-3 py-2 text-[13px] ring-1 ring-white/[0.08] outline-none placeholder:text-muted-foreground focus:ring-primary/60"
                />
              </div>
            </div>
            <Fit>
              <div className="frame">
                <Window>
                  <v.View />
                </Window>
              </div>
            </Fit>
          </section>
        );
      })}
    </div>
  );
}
