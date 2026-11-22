import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { decode } from "nostr-tools/nip19";
import { SimplePool } from "nostr-tools/pool";
import { finalizeEvent, getPublicKey, type Event } from "nostr-tools/pure";
import { hexToBytes } from "nostr-tools/utils";
import { listingEvent, parseGame, parsePicks, picksEvent } from "../src/catalog";
import { PICKS_PUBKEY } from "../src/curation";
import { parseListings } from "../src/listing";
import { RELAYS } from "../src/relays";

const IMAGES = "https://anchorman-lol.github.io/keyhall/games";
const PUBLISH_RELAYS = ["wss://relay.anchorman.lol", ...RELAYS];
const root = new URL("../../../", import.meta.url);

const { values } = parseArgs({
  options: { publish: { type: "boolean" }, unsigned: { type: "string" } },
});
const games = readdirSync(new URL("games/", root)).map((id) =>
  parseGame(id, readFileSync(new URL(`games/${id}/README.md`, root), "utf8")),
);
const own = games.flatMap((g) => ("listing" in g ? [] : [g]));
const now = Math.floor(Date.now() / 1000);

if (values.unsigned) {
  const game = own.find((g) => g.id === values.unsigned);
  if (!game) throw new Error(`${values.unsigned} is not a game folder without a listing`);
  console.log(JSON.stringify(listingEvent(game, IMAGES, now, false), null, 2));
  console.error(
    `Point picture and banner at images you host, sign this with the developer's key and publish it, then replace games/${game.id}/README.md's metadata with listing: 31990:<developer hex pubkey>:${game.id}`,
  );
  process.exit(0);
}

const secret = execFileSync(
  "security",
  ["find-generic-password", "-s", "lol.anchorman.keyhall.project", "-a", "picks", "-w"],
  { encoding: "utf8" },
).trim();
const key = secret.startsWith("nsec1")
  ? (decode(secret as `nsec1${string}`).data as Uint8Array)
  : hexToBytes(secret);
if (getPublicKey(key) !== PICKS_PUBKEY) throw new Error("The keychain key isn't the project key");

const picks = parsePicks(readFileSync(new URL("picks.yaml", root), "utf8"));
const events = [
  ...own.map((g) => listingEvent(g, IMAGES, now)),
  picksEvent(picks, games, PICKS_PUBKEY, now),
].map((e) => finalizeEvent(e, key));

const pool = new SimplePool();
const query = (filter: Parameters<typeof pool.querySync>[1]) =>
  pool.querySync(PUBLISH_RELAYS, filter, { maxWait: 8000 });
const remote = await query({
  kinds: [31990, 30267],
  authors: [PICKS_PUBKEY],
  "#d": [...own.map((g) => g.id), "games-default"],
});

const d = (e: Pick<Event, "tags">) => e.tags.find((t) => t[0] === "d")?.[1];
const lines = (e: Pick<Event, "content" | "tags">) => [
  `content ${e.content}`,
  ...e.tags.map((t) => JSON.stringify(t)),
];
const changed: Event[] = [];
for (const event of events) {
  const [current] = remote
    .filter((r) => r.kind === event.kind && d(r) === d(event))
    .sort((a, b) => b.created_at - a.created_at);
  console.log(`\n== ${event.kind}:${PICKS_PUBKEY}:${d(event)}`);
  if (!current) console.log("new: not on the relays");
  else {
    const before = lines(current);
    const after = lines(event);
    const diff = [
      ...before.filter((l) => !after.includes(l)).map((l) => `- ${l}`),
      ...after.filter((l) => !before.includes(l)).map((l) => `+ ${l}`),
    ];
    console.log(diff.length ? `changed:\n${diff.join("\n")}` : "unchanged");
    if (!diff.length) continue;
  }
  changed.push(event);
  console.log(JSON.stringify(event));
}

const site = (url: string) => {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
};
const handlers = parseListings(
  [
    ...(await query({ kinds: [31990], "#t": ["game", "games", "Game", "Games"] })),
    ...(await query({ kinds: [31990], limit: 2000 })),
  ],
  true,
).filter((h) => h.pubkey !== PICKS_PUBKEY);
console.log("\n== Developer listings");
for (const game of own)
  for (const h of handlers.filter((h) => site(h.url) === site(game.url)))
    console.log(`${game.id}: developer listing found: switch to listing: ${h.coordinate}`);
const listed = games.flatMap((g) => ("listing" in g ? [g] : []));
const found = await query({
  kinds: [31990],
  authors: listed.map((g) => g.listing.split(":")[1]!),
});
for (const game of listed)
  if (!found.some((e) => `31990:${e.pubkey}:${d(e)}` === game.listing))
    console.log(`${game.id}: its listing ${game.listing} isn't on ${PUBLISH_RELAYS.join(", ")}`);

console.log(`\n${changed.length} of ${events.length} events differ from the relays.`);
if (values.publish && changed.length) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `Publish ${changed.length} events to ${PUBLISH_RELAYS.join(", ")}? [y/N] `,
  );
  rl.close();
  if (answer.trim().toLowerCase() === "y")
    for (const event of changed) {
      const results = await Promise.allSettled(pool.publish(PUBLISH_RELAYS, event));
      console.log(d(event), results.map((r) => r.status).join(" "));
    }
} else if (!values.publish) console.log("Dry run: pass --publish to send the changed events.");
pool.destroy();
