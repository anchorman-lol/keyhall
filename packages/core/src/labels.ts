import { classifyDepth, DEPTHS, type Depth, type Observation } from "./depth";
import { signInBadge, type NostrEvent, type SignIn } from "./listing";

export const AUTH_NS = "game.auth";
export const DEPTH_NS = "game.depth";
export const AUTH_METHODS = ["nip07", "nip46", "nip55", "session", "guest", "nsec", "none"];

export interface Label {
  curator: string;
  coordinate: string;
  signIn?: SignIn;
  depth?: Depth;
}

export interface Claim<T> {
  from: string;
  value: T;
}

export interface Verdict<T> {
  value: T | undefined;
  seen?: true;
  verifiedBy: string[];
  conflicts: Claim<T>[];
}

const values = (e: NostrEvent, ns: string) =>
  e.tags.filter((t) => t[0] === "l" && t[2] === ns).map((t) => t[1]!);

export function parseLabels(events: NostrEvent[]): Label[] {
  const newest = new Map<string, Label>();
  for (const e of [...events].sort((a, b) => a.created_at - b.created_at)) {
    if (e.kind !== 1985) continue;
    const methods = values(e, AUTH_NS);
    const depth = values(e, DEPTH_NS).find((d) => DEPTHS.includes(d)) as Depth | undefined;
    if (!methods.length && !depth) continue;
    for (const [, coordinate] of e.tags.filter((t) => t[0] === "a" && t[1]?.startsWith("31990:"))) {
      const key = `${e.pubkey} ${coordinate}`;
      const label = newest.get(key) ?? { curator: e.pubkey, coordinate: coordinate! };
      if (methods.length) label.signIn = signInBadge(methods.map((m) => ["auth", m]));
      if (depth) label.depth = depth;
      newest.set(key, label);
    }
  }
  return [...newest.values()];
}

function decide<T>(declared: T | undefined, labels: Claim<T>[], seen?: T): Verdict<T> {
  const claims =
    declared === undefined ? labels : [{ from: "listing", value: declared }, ...labels];
  const value = seen ?? labels[0]?.value ?? declared;
  return {
    value,
    ...(seen !== undefined && { seen: true }),
    verifiedBy: labels.filter((c) => c.value === value).map((c) => c.from),
    conflicts: claims.filter((c) => c.value !== value),
  };
}

const FITS: Record<string, SignIn[]> = {
  "signer-or-nsec": ["signer-or-nsec"],
  nsec: ["signer-or-nsec", "nsec"],
  signer: ["signer", "signer-or-nsec", "throwaway", "unknown"],
};

function seenSignIn({ signer, keyField }: Observation): SignIn | undefined {
  if (keyField) return signer ? "signer-or-nsec" : "nsec";
  return signer ? "signer" : undefined;
}

export function signInVerdict(
  declared: SignIn,
  labels: Claim<SignIn>[],
  seen?: Observation,
): Verdict<SignIn> {
  const verdict = decide(declared === "unknown" ? undefined : declared, labels);
  const value = verdict.value ?? "unknown";
  const window = seen && seenSignIn(seen);
  if (window && !FITS[window]!.includes(value))
    verdict.conflicts.push({ from: "window", value: window });
  return { ...verdict, value };
}

export const depthVerdict = (
  declared: Depth | undefined,
  labels: Claim<Depth>[],
  seen?: Observation,
): Verdict<Depth> => decide(declared, labels, seen && classifyDepth(seen));

export function labelTemplate(
  coordinate: string,
  methods: string[],
  depth: Depth | undefined,
  created_at = Math.floor(Date.now() / 1000),
) {
  return {
    kind: 1985,
    created_at,
    content: "",
    tags: [
      ...(methods.length ? [["L", AUTH_NS], ...methods.map((m) => ["l", m, AUTH_NS])] : []),
      ...(depth
        ? [
            ["L", DEPTH_NS],
            ["l", depth, DEPTH_NS],
          ]
        : []),
      ["a", coordinate],
    ],
  };
}
