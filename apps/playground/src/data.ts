export type SignIn = "signer" | "signer-or-nsec" | "throwaway" | "none" | "unknown";
export type SourceId = "picks" | "board" | "arcade" | "worlds" | "coop";

export type Game = {
  id: string;
  name: string;
  genre: string;
  what: string;
  source: SourceId;
  signIn: SignIn;
  multiplayer: boolean;
  updated: string;
  minutes?: number;
  lastPlayed?: string;
  focus?: string;
  zoom?: number;
};

const art = (id: string) => `${import.meta.env.BASE_URL}art/${id}.jpg`;
export const cover = (g: Game) => art(g.id);

export const GAMES: Game[] = [
  {
    id: "neonsentinel",
    name: "Neon Sentinel",
    genre: "Arcade shooter",
    what: "Radar-first arcade rescue shooter: hold the relay, save the keys.",
    source: "picks",
    signIn: "signer",
    multiplayer: false,
    updated: "2 days ago",
    minutes: 190,
    lastPlayed: "Now",
  },
  {
    id: "nochess",
    name: "Nochess",
    genre: "Chess",
    what: "Clocked chess between Nostr keys; both players sign every game, finished games become PGN notes.",
    source: "picks",
    signIn: "throwaway",
    multiplayer: true,
    updated: "Yesterday",
    minutes: 412,
    lastPlayed: "Today",
    focus: "76% 58%",
    zoom: 2.6,
  },
  {
    id: "xenophon",
    name: "Xenophon: Twin Stars",
    genre: "Space MMO",
    what: "Multiplayer pixel-art space game in a browser tab with no server.",
    source: "picks",
    signIn: "signer",
    multiplayer: true,
    updated: "2 days ago",
    minutes: 238,
    lastPlayed: "Today",
  },
  {
    id: "forgerealms",
    name: "Forge Realms",
    genre: "RTS",
    what: "Stone Age real-time strategy. Villages, trade routes and raids are events on shared relays, so a match outlives any server.",
    source: "worlds",
    signIn: "signer",
    multiplayer: true,
    updated: "Jul 26",
    minutes: 160,
    lastPlayed: "Yesterday",
  },
  {
    id: "blockstr",
    name: "Blockstr",
    genre: "Falling blocks",
    what: "8-bit falling blocks where mined score transfers when Bitcoin blocks are found.",
    source: "picks",
    signIn: "signer",
    multiplayer: false,
    updated: "3 mo ago",
    minutes: 61,
    lastPlayed: "Last week",
    focus: "50% 40%",
  },
  {
    id: "deadmans",
    name: "Dead Man's Draw",
    genre: "Card game",
    what: "Push-your-luck card game, Bitcoin pirate edition.",
    source: "board",
    signIn: "signer",
    multiplayer: true,
    updated: "Aug 24",
    minutes: 47,
    lastPlayed: "Nov 2",
  },
  {
    id: "nomad",
    name: "NOMAD",
    genre: "Text dungeon",
    what: "Persistent multiplayer text dungeon; your key is your character, the dead stay dead.",
    source: "picks",
    signIn: "signer",
    multiplayer: true,
    updated: "Yesterday",
    minutes: 64,
    lastPlayed: "Nov 18",
  },
  {
    id: "parlour",
    name: "Parlour",
    genre: "Card games",
    what: "Cozy card games with friends over a room code: Blitz, Hearts, Euchre, Spades.",
    source: "picks",
    signIn: "none",
    multiplayer: true,
    updated: "Sep 29",
    minutes: 9,
    lastPlayed: "Nov 9",
    focus: "50% 45%",
  },
  {
    id: "pallasite",
    name: "Pallasite",
    genre: "Arcade shooter",
    what: "Asteroids-style shooter with replays, kiosk and controller flows.",
    source: "picks",
    signIn: "unknown",
    multiplayer: false,
    updated: "Oct 12",
  },
  {
    id: "plume",
    name: "Plume Arcade",
    genre: "Casual bundle",
    what: "Snake, Minesweeper, Featherfall and three more inside the Plume client.",
    source: "picks",
    signIn: "signer",
    multiplayer: false,
    updated: "4 days ago",
    focus: "50% 45%",
  },
  {
    id: "vibecampvania",
    name: "Vibecampvania",
    genre: "Action RPG",
    what: "Gothic side-scrolling action RPG, five levels and a boss.",
    source: "worlds",
    signIn: "signer",
    multiplayer: false,
    updated: "Aug 22",
  },
  {
    id: "gorilator",
    name: "Gorilator",
    genre: "MMORPG sandbox",
    what: "Carry level and gear across community-run worlds.",
    source: "worlds",
    signIn: "signer",
    multiplayer: true,
    updated: "Jul 9",
  },
  {
    id: "vocabvegas",
    name: "Vocab Vegas",
    genre: "Word dice",
    what: "Bet chips while translating Spanish word dice against the clock.",
    source: "board",
    signIn: "throwaway",
    multiplayer: false,
    updated: "Aug 21",
  },
  {
    id: "pinpoint",
    name: "Pinpoint",
    genre: "Geography",
    what: "Match landmarks and figures to countries on a map.",
    source: "board",
    signIn: "signer",
    multiplayer: false,
    updated: "Aug 22",
  },
  {
    id: "spacezappers",
    name: "Space Zappers",
    genre: "Space invaders",
    what: "Retro invaders; 21 sats to play, free one-minute trial.",
    source: "arcade",
    signIn: "signer",
    multiplayer: false,
    updated: "Nov 6",
    minutes: 31,
    lastPlayed: "Nov 4",
  },
  {
    id: "satoshisnake",
    name: "Satoshi Snake",
    genre: "Snake",
    what: "Cyberpunk snake with halving and time-lock power-ups.",
    source: "arcade",
    signIn: "signer",
    multiplayer: false,
    updated: "Aug 26",
  },
  {
    id: "maze-sats",
    name: "Maze Sats",
    genre: "Maze chase",
    what: "Chase through the maze collecting sats.",
    source: "arcade",
    signIn: "throwaway",
    multiplayer: false,
    updated: "Aug 21",
  },
  {
    id: "nostrichrun",
    name: "Nostrich Run",
    genre: "Endless runner",
    what: "Endless side-scroller, 21 sats per run.",
    source: "arcade",
    signIn: "signer",
    multiplayer: false,
    updated: "Dec 31",
    focus: "50% 30%",
  },
  {
    id: "satsnake",
    name: "Sat Snake",
    genre: "Snake",
    what: "Snake where you pick a hashrate share and pay an invoice.",
    source: "arcade",
    signIn: "signer-or-nsec",
    multiplayer: false,
    updated: "Dec 29",
  },
  {
    id: "tropical",
    name: "Tropical Satoshis",
    genre: "Collector",
    what: "Coconut-boat collector dodging paper dollars.",
    source: "arcade",
    signIn: "throwaway",
    multiplayer: false,
    updated: "Aug 21",
  },
  {
    id: "decentralize",
    name: "Decentralize!",
    genre: "Whack-a-mole",
    what: "Three-minute whack-a-mole about decentralization.",
    source: "arcade",
    signIn: "none",
    multiplayer: false,
    updated: "Aug 21",
  },
  {
    id: "sanki",
    name: "Sanki",
    genre: "Chess variants",
    what: "Chess, shogi and xiangqi on one board, each side under its own rules.",
    source: "board",
    signIn: "throwaway",
    multiplayer: true,
    updated: "8 days ago",
    minutes: 95,
    lastPlayed: "3 days ago",
    focus: "100% 95%",
    zoom: 1.8,
  },
  {
    id: "fore",
    name: "VibeCamp: Fore!",
    genre: "Pixel golf",
    what: "Turn-based pixel golf battle with Nostr avatars.",
    source: "coop",
    signIn: "signer",
    multiplayer: true,
    updated: "Aug 21",
    minutes: 22,
    lastPlayed: "Oct 30",
  },
  {
    id: "hangonfren",
    name: "Hang On, Fren",
    genre: "Endless road",
    what: "Endless Riviera Vespa ride.",
    source: "coop",
    signIn: "none",
    multiplayer: false,
    updated: "Oct 12",
    focus: "50% 35%",
  },
  {
    id: "toomachia",
    name: "Toomachia",
    genre: "Party",
    what: "Five timed mini-events: reaction, math, memory, estimation, trivia.",
    source: "coop",
    signIn: "signer",
    multiplayer: true,
    updated: "Aug 24",
  },
  {
    id: "roadsense",
    name: "Road Sense",
    genre: "Driving",
    what: "A driving lesson you can fail: 50 scored cues in four minutes.",
    source: "coop",
    signIn: "signer",
    multiplayer: false,
    updated: "Yesterday",
  },
  {
    id: "island-vibe",
    name: "Island Bitcoin Vibe",
    genre: "Shop sim",
    what: "Teach island shops to accept bitcoin, then pay in sats.",
    source: "coop",
    signIn: "throwaway",
    multiplayer: false,
    updated: "Aug 21",
  },
  {
    id: "btcrally",
    name: "BTC Rally",
    genre: "Kart racing",
    what: "Split-screen kart racing; entrants pay sats, winners take the pot.",
    source: "coop",
    signIn: "signer",
    multiplayer: true,
    updated: "Jul 17",
  },
];

export const game = (id: string) => GAMES.find((g) => g.id === id)!;

export type Source = {
  id: SourceId;
  name: string;
  by?: string;
  hue: number;
  on: boolean;
  blurb: string;
};

export const SOURCES: Source[] = [
  {
    id: "picks",
    name: "Keyhall picks",
    hue: 85,
    on: true,
    blurb: "Loads, plays in five minutes, no paywall, no gambling.",
  },
  {
    id: "board",
    name: "Board-game table",
    by: "mira",
    hue: 30,
    on: true,
    blurb: "Cards, chess and slow games for two to four.",
  },
  {
    id: "arcade",
    name: "Arcade cabinet",
    by: "kestrel",
    hue: 220,
    on: true,
    blurb: "Short runs, high scores, sats on the line.",
  },
  {
    id: "coop",
    name: "Co-op nights",
    by: "juno",
    hue: 150,
    on: false,
    blurb: "Games that are better with the group call open.",
  },
  {
    id: "worlds",
    name: "Worlds & MMOs",
    by: "tomasz",
    hue: 300,
    on: true,
    blurb: "Persistent worlds where your key carries your character.",
  },
];

export const source = (id: SourceId) => SOURCES.find((s) => s.id === id)!;
export const UNVETTED = 137;

export const gamesIn = (id: SourceId) => GAMES.filter((g) => g.source === id);

export type Friend = {
  handle: string;
  name: string;
  hue: number;
  status: "ingame" | "online" | "offline";
  game?: string;
  line: string;
};

export const FRIENDS: Friend[] = [
  {
    handle: "kestrel",
    name: "kestrel",
    hue: 210,
    status: "ingame",
    game: "xenophon",
    line: "Docked at Twin Stars · 41 min",
  },
  {
    handle: "mira",
    name: "Mira Vasquez",
    hue: 35,
    status: "ingame",
    game: "nochess",
    line: "Move 23, her clock 4:12",
  },
  {
    handle: "tomasz",
    name: "Tomasz",
    hue: 290,
    status: "ingame",
    game: "forgerealms",
    line: "Raiding the river village",
  },
  { handle: "juno", name: "Juno", hue: 150, status: "online", line: "Online in Keyhall" },
  {
    handle: "pixelhen",
    name: "pixelhen",
    hue: 350,
    status: "online",
    line: "Online · presence to friends",
  },
  {
    handle: "ade",
    name: "Ade",
    hue: 60,
    status: "offline",
    game: "word5",
    line: "Played Word5 · 2 h ago",
  },
  { handle: "ren", name: "Ren", hue: 250, status: "offline", line: "Last seen 3 days ago" },
];

export const friendsIn = (gameId: string) =>
  FRIENDS.filter((f) => f.status === "ingame" && f.game === gameId);
export const friend = (handle: string) => FRIENDS.find((f) => f.handle === handle)!;

export const ME = { name: "leon", npub: "npub1dtf05…sfue", hue: 85 };

export const RUNNING = { game: "neonsentinel", session: "23 min", presence: "Friends" };

export type Signature = { game: string; what: string; kind: string; ago: string; ok: boolean };

export const SIGNATURES: Signature[] = [
  { game: "neonsentinel", what: "Score 11,660", kind: "30762", ago: "12 s", ok: true },
  { game: "neonsentinel", what: "Run replay", kind: "30078", ago: "4 min", ok: true },
  { game: "neonsentinel", what: "Score 9,410", kind: "30762", ago: "11 min", ok: true },
  { game: "nochess", what: "Finished game, PGN", kind: "64", ago: "1 h", ok: true },
  { game: "nochess", what: "Move 31, Qxf7+", kind: "30064", ago: "1 h", ok: true },
  {
    game: "forgerealms",
    what: "Trade route to Ashford",
    kind: "31337",
    ago: "Yesterday",
    ok: true,
  },
  {
    game: "forgerealms",
    what: "Village moves, 42 events",
    kind: "31337",
    ago: "Yesterday",
    ok: true,
  },
  { game: "forgerealms", what: "Joined realm Ember Vale", kind: "30078", ago: "Nov 19", ok: true },
  { game: "word5", what: "Rewrite follow list", kind: "3", ago: "Today", ok: false },
];

export const BUDGET = {
  month: "November",
  total: 5000,
  paysOn: "Dec 1",
  daysLeft: 9,
  split: [
    { game: "nochess", sats: 1720 },
    { game: "xenophon", sats: 1005 },
    { game: "neonsentinel", sats: 610 },
    { game: "sanki", sats: 400 },
    { game: "blockstr", sats: 258 },
    { game: "forgerealms", sats: 235 },
    { game: "deadmans", sats: 199 },
    { game: "nomad", sats: 144 },
    { game: "spacezappers", sats: 131 },
    { game: "fore", sats: 93 },
    { game: "parlour", sats: 79 },
    { game: "satoshisnake", sats: 76 },
  ],
};

export const REQUEST = {
  game: "neonsentinel",
  kind: "30762",
  what: "Score 12,040",
  content: '{"score":12040,"wave":7}',
};

export const PLAYED_BY: Record<string, { handle: string; line: string }[]> = {
  forgerealms: [
    { handle: "juno", line: "Played Saturday · 1 h 10 m" },
    { handle: "ren", line: "In their library" },
  ],
  neonsentinel: [{ handle: "kestrel", line: "Best 14,200 · Tuesday" }],
  nochess: [{ handle: "ade", line: "Lost to you on Nov 12" }],
};

export const CURATOR: Record<SourceId, string> = {
  picks: "Keyhall",
  board: "Mira",
  arcade: "kestrel",
  coop: "Juno",
  worlds: "Tomasz",
};
