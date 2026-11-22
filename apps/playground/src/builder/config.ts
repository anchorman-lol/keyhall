export type Option<V extends string> = { value: V; label: string; hint: string };

export const NAV = [
  {
    value: "labels",
    label: "Labelled rail",
    hint: "The rail's icons with a short label under each, 84 px.",
  },
  {
    value: "hover",
    label: "Hover rail",
    hint: "A 72 px rail that opens over the library with labels while you hover or tab into it.",
  },
  {
    value: "sidebar",
    label: "Slim sidebar",
    hint: "A 200 px sidebar with icon and name on each row.",
  },
  { value: "icons", label: "Icon rail", hint: "Round 3's rail, icons only, for comparison." },
] as const satisfies Option<string>[];

export const MAIN = [
  { value: "grid", label: "Cover grid", hint: "Cover art first." },
  {
    value: "list",
    label: "List",
    hint: "Grouped rows; a table with Source, Friends, This month and Last played once it is wide enough.",
  },
] as const satisfies Option<string>[];

export const FILTERBAR = [
  {
    value: "toolbar",
    label: "Toolbar",
    hint: "One row: search, a Sources menu, a Filters menu and sort. What you picked shows as chips.",
  },
  {
    value: "chips",
    label: "Chip rows",
    hint: "Search and sort, then every source and filter as a chip you can see and tap.",
  },
  {
    value: "tabs",
    label: "Source tabs",
    hint: "Sources as tabs along the top, search and a Filters menu beside them.",
  },
] as const satisfies Option<string>[];

export const DETAIL = [
  {
    value: "page",
    label: "Game page",
    hint: "The game takes the whole library area with a big hero; Library takes you back.",
  },
  {
    value: "expand",
    label: "In place",
    hint: "The game opens inside the library, under the row you clicked.",
  },
  {
    value: "sheet",
    label: "Slide-over",
    hint: "A sheet slides in from the right over the library, which stays where it was.",
  },
  {
    value: "wide",
    label: "Wide pane",
    hint: "Round 3's wide pane: the library narrows to a column.",
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
  {
    value: "nav",
    label: "In the nav",
    hint: "Who's playing, under the destinations: rows in the sidebar, faces on a rail.",
  },
  {
    value: "page",
    label: "Friends page",
    hint: "Only behind Friends in the navigation, and on each game.",
  },
] as const satisfies Option<string>[];

export const RUNNING_AT = [
  {
    value: "nav",
    label: "Nav card",
    hint: "A card at the foot of the navigation; on a rail it shrinks to the cover.",
  },
  { value: "dock", label: "Dock", hint: "Uses the now-playing dock." },
  { value: "status", label: "Status bar", hint: "A segment at the left of the status bar." },
] as const satisfies Option<string>[];

export const DENSITY = [
  { value: "comfortable", label: "Comfortable", hint: "" },
  { value: "compact", label: "Compact", hint: "" },
] as const satisfies Option<string>[];

export const PAGES = [
  { value: "library", label: "Library", hint: "" },
  { value: "friends", label: "Friends", hint: "" },
  { value: "budget", label: "Budget", hint: "" },
  { value: "settings", label: "Settings", hint: "" },
] as const satisfies Option<string>[];

export const SELECTABLE = ["forgerealms", "neonsentinel", "nochess", "pallasite"] as const;

type V<T extends readonly { value: string }[]> = T[number]["value"];
export type Nav = V<typeof NAV>;
export type Main = V<typeof MAIN>;
export type FilterBar = V<typeof FILTERBAR>;
export type Detail = V<typeof DETAIL>;
export type Section = V<typeof SECTIONS>;
export type Bottom = V<typeof BOTTOM>;
export type FriendsAt = V<typeof FRIENDS_AT>;
export type RunningAt = V<typeof RUNNING_AT>;
export type Density = V<typeof DENSITY>;
export type PageId = V<typeof PAGES>;

export type Layout = {
  nav: Nav;
  main: Main;
  filterbar: FilterBar;
  detail: Detail;
  sections: Section[];
  bottom: Bottom;
  friends: FriendsAt;
  running: RunningAt;
  density: Density;
  page: PageId;
  playing: boolean;
  signing: boolean;
  filtered: boolean;
  selected: string | null;
};

export const DEFAULT: Layout = {
  nav: "labels",
  main: "grid",
  filterbar: "toolbar",
  detail: "wide",
  sections: ["trust", "stats", "friends", "signatures", "listing"],
  bottom: "none",
  friends: "column",
  running: "nav",
  density: "comfortable",
  page: "library",
  playing: true,
  signing: false,
  filtered: false,
  selected: "forgerealms",
};

/** Keeps the bottom edge and the running game consistent: the dock is the running game's surface. */
export function apply(layout: Layout, patch: Partial<Layout>): Layout {
  const next = { ...layout, ...patch };
  if (patch.running === "dock") next.bottom = "dock";
  if (patch.running === "status") next.bottom = "status";
  if (patch.running === "nav" && next.bottom === "dock") next.bottom = "none";
  if (patch.bottom === "dock") next.running = "dock";
  if (patch.bottom === "status" && next.running === "dock") next.running = "status";
  if (patch.bottom === "none" && next.running !== "nav") next.running = "nav";
  if (!next.playing) next.signing = false;
  return next;
}

const ORDER: (keyof Layout)[] = [
  "nav",
  "main",
  "filterbar",
  "detail",
  "sections",
  "bottom",
  "friends",
  "running",
  "density",
  "page",
  "playing",
  "signing",
  "filtered",
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
  if (!p.has("nav")) return null;
  const sel = p.get("selected");
  const sections = p.has("sections")
    ? SECTIONS.map((s) => s.value).filter((s) => p.get("sections")!.split(",").includes(s))
    : DEFAULT.sections;
  return apply(
    {
      nav: pick(NAV, p.get("nav"), DEFAULT.nav),
      main: pick(MAIN, p.get("main"), DEFAULT.main),
      filterbar: pick(FILTERBAR, p.get("filterbar"), DEFAULT.filterbar),
      detail: pick(DETAIL, p.get("detail"), DEFAULT.detail),
      sections,
      bottom: pick(BOTTOM, p.get("bottom"), DEFAULT.bottom),
      friends: pick(FRIENDS_AT, p.get("friends"), DEFAULT.friends),
      running: pick(RUNNING_AT, p.get("running"), DEFAULT.running),
      density: pick(DENSITY, p.get("density"), DEFAULT.density),
      page: pick(PAGES, p.get("page"), DEFAULT.page),
      playing: p.get("playing") !== "false",
      signing: p.get("signing") === "true",
      filtered: p.get("filtered") === "true",
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
    `Navigation: ${label(NAV, l.nav)}`,
    `Main area: ${label(MAIN, l.main)}`,
    `Filter bar: ${label(FILTERBAR, l.filterbar)}`,
    `Game detail: ${label(DETAIL, l.detail)} (${sections})`,
    `Bottom: ${label(BOTTOM, l.bottom)}`,
    `Friends: ${label(FRIENDS_AT, l.friends)}`,
    `Running game: ${label(RUNNING_AT, l.running)}`,
    `Density: ${label(DENSITY, l.density)}`,
    `Previewed with: ${[
      `the ${label(PAGES, l.page)} page`,
      l.playing ? "a game running" : "nothing running",
      l.signing && "a signing request",
      l.filtered && "filters applied",
      l.selected ? `${gameName(l.selected)} open` : "no game open",
    ]
      .filter(Boolean)
      .join(", ")}`,
    `Link: ${link}`,
    ...(notes.trim() ? ["", "Notes:", notes.trim()] : []),
  ].join("\n");
}
