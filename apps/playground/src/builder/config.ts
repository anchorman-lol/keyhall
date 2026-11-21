export type Option<V extends string> = { value: V; label: string; hint: string };

export const SIDEBAR = [
  {
    value: "sources",
    label: "Source list",
    hint: "Mail-style: library views, then each source as a row with its count.",
  },
  {
    value: "switches",
    label: "Switches",
    hint: "Compact navigation, sources with on/off switches.",
  },
  { value: "rail", label: "Icon rail", hint: "A 72 px rail of icons and curator faces." },
] as const satisfies Option<string>[];

export const MAIN = [
  {
    value: "list",
    label: "Grouped list",
    hint: "Playing now, Friends are in, Recently played, Not played yet.",
  },
  { value: "grid", label: "Cover grid", hint: "Cover art first, sorted by last played." },
] as const satisfies Option<string>[];

export const INSPECTOR = [
  { value: "pane", label: "Right pane", hint: "A 420 px pane beside the library." },
  {
    value: "wide",
    label: "Wide pane",
    hint: "The game takes the room, the library narrows to a column.",
  },
  {
    value: "none",
    label: "None",
    hint: "Selecting a game does nothing here; the library fills the window.",
  },
] as const satisfies Option<string>[];

export const SECTIONS = [
  { value: "trust", label: "Sign-in trust", hint: "How the game signs you in." },
  { value: "stats", label: "Play and budget", hint: "Your play time and its share of the budget." },
  { value: "friends", label: "Friends", hint: "Who plays it, with Join." },
  { value: "signatures", label: "Signatures", hint: "What Keyhall signed for it." },
  { value: "listing", label: "Listing", hint: "Developer, relays, window." },
] as const satisfies Option<string>[];

export const BOTTOM = [
  {
    value: "dock",
    label: "Dock",
    hint: "The now-playing dock belongs to the running game and folds away when nothing runs.",
  },
  {
    value: "status",
    label: "Status bar",
    hint: "Signer, last signature and the month's budget in 34 px.",
  },
  { value: "none", label: "None", hint: "Nothing along the bottom edge." },
] as const satisfies Option<string>[];

export const FRIENDS_AT = [
  { value: "column", label: "Right column", hint: "A full column: playing, online, offline." },
  { value: "sidebar", label: "In the sidebar", hint: "Who's playing, under the sources." },
  {
    value: "inspector",
    label: "Inspector only",
    hint: "Only on a game's page: who plays this one.",
  },
  { value: "none", label: "None", hint: "No friends anywhere." },
] as const satisfies Option<string>[];

export const RUNNING_AT = [
  { value: "dock", label: "Dock", hint: "Uses the now-playing dock." },
  { value: "sidebar", label: "Sidebar card", hint: "A card at the foot of the sidebar." },
  { value: "status", label: "Status bar", hint: "A segment at the left of the status bar." },
] as const satisfies Option<string>[];

export const DENSITY = [
  { value: "comfortable", label: "Comfortable", hint: "" },
  { value: "compact", label: "Compact", hint: "" },
] as const satisfies Option<string>[];

export const SELECTABLE = ["forgerealms", "neonsentinel", "nochess", "pallasite"] as const;

type V<T extends readonly { value: string }[]> = T[number]["value"];
export type Sidebar = V<typeof SIDEBAR>;
export type Main = V<typeof MAIN>;
export type InspectorAt = V<typeof INSPECTOR>;
export type Section = V<typeof SECTIONS>;
export type Bottom = V<typeof BOTTOM>;
export type FriendsAt = V<typeof FRIENDS_AT>;
export type RunningAt = V<typeof RUNNING_AT>;
export type Density = V<typeof DENSITY>;

export type Layout = {
  sidebar: Sidebar;
  main: Main;
  inspector: InspectorAt;
  sections: Section[];
  bottom: Bottom;
  friends: FriendsAt;
  running: RunningAt;
  density: Density;
  playing: boolean;
  signing: boolean;
  selected: string | null;
};

export const DEFAULT: Layout = {
  sidebar: "sources",
  main: "list",
  inspector: "pane",
  sections: ["trust", "stats", "friends", "listing"],
  bottom: "dock",
  friends: "sidebar",
  running: "dock",
  density: "comfortable",
  playing: true,
  signing: false,
  selected: "forgerealms",
};

/** Keeps the bottom edge and the running game consistent: the dock is the running game's surface. */
export function apply(layout: Layout, patch: Partial<Layout>): Layout {
  const next = { ...layout, ...patch };
  if (patch.running === "dock") next.bottom = "dock";
  if (patch.running === "status") next.bottom = "status";
  if (patch.running === "sidebar" && next.bottom === "dock") next.bottom = "status";
  if (patch.bottom === "dock") next.running = "dock";
  if (patch.bottom === "status" && next.running === "dock") next.running = "status";
  if (patch.bottom === "none" && next.running !== "sidebar") next.running = "sidebar";
  if (patch.friends === "inspector" && !next.sections.includes("friends"))
    next.sections = [...next.sections, "friends"];
  if (!next.playing) next.signing = false;
  return next;
}

const ORDER: (keyof Layout)[] = [
  "sidebar",
  "main",
  "inspector",
  "sections",
  "bottom",
  "friends",
  "running",
  "density",
  "playing",
  "signing",
  "selected",
];

export function toHash(l: Layout) {
  const p = new URLSearchParams();
  for (const k of ORDER) {
    const v = l[k];
    p.set(k, Array.isArray(v) ? v.join(",") : v === null ? "none" : String(v));
  }
  return `#${p.toString().replaceAll("%2C", ",")}`;
}

const pick = <T extends string>(options: readonly { value: T }[], v: string | null, d: T): T =>
  options.find((o) => o.value === v)?.value ?? d;

export function fromHash(hash: string): Layout | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (!p.has("sidebar")) return null;
  const sel = p.get("selected");
  const sections = p.has("sections")
    ? SECTIONS.map((s) => s.value).filter((s) => p.get("sections")!.split(",").includes(s))
    : DEFAULT.sections;
  return apply(
    {
      sidebar: pick(SIDEBAR, p.get("sidebar"), DEFAULT.sidebar),
      main: pick(MAIN, p.get("main"), DEFAULT.main),
      inspector: pick(INSPECTOR, p.get("inspector"), DEFAULT.inspector),
      sections,
      bottom: pick(BOTTOM, p.get("bottom"), DEFAULT.bottom),
      friends: pick(FRIENDS_AT, p.get("friends"), DEFAULT.friends),
      running: pick(RUNNING_AT, p.get("running"), DEFAULT.running),
      density: pick(DENSITY, p.get("density"), DEFAULT.density),
      playing: p.get("playing") !== "false",
      signing: p.get("signing") === "true",
      selected: sel && sel !== "none" ? sel : null,
    },
    {},
  );
}

const label = <T extends string>(options: readonly Option<T>[], v: T) =>
  options.find((o) => o.value === v)!.label;

export function spec(l: Layout, gameName: (id: string) => string, notes: string, link: string) {
  const sections = l.sections.map((s) => label(SECTIONS, s)).join(", ") || "no sections";
  return [
    "Keyhall layout",
    `Left sidebar: ${label(SIDEBAR, l.sidebar)}`,
    `Main area: ${label(MAIN, l.main)}`,
    `Inspector: ${label(INSPECTOR, l.inspector)}${l.inspector === "none" ? "" : ` (${sections})`}`,
    `Bottom: ${label(BOTTOM, l.bottom)}`,
    `Friends: ${label(FRIENDS_AT, l.friends)}`,
    `Running game: ${label(RUNNING_AT, l.running)}`,
    `Density: ${label(DENSITY, l.density)}`,
    `Previewed with: ${[
      l.playing ? "a game running" : "nothing running",
      l.signing && "a signing request",
      l.selected ? `${gameName(l.selected)} selected` : "no selection",
    ]
      .filter(Boolean)
      .join(", ")}`,
    `Link: ${link}`,
    ...(notes.trim() ? ["", "Notes:", notes.trim()] : []),
  ].join("\n");
}
