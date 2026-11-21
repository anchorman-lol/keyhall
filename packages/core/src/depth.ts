export type Depth = "multiplayer" | "identity" | "none";
export const DEPTHS: readonly string[] = ["multiplayer", "identity", "none"] satisfies Depth[];

export interface Observation {
  kinds: number[];
  signer: boolean;
  keyField?: boolean;
}

const IDENTITY_KINDS = new Set([
  0, 1, 3, 5, 6, 7, 8, 16, 1111, 9734, 9735, 10000, 10002, 10050, 30008, 30009, 30315, 30762, 31990,
]);
const isEphemeral = (kind: number) => kind >= 20000 && kind < 30000;

export function classifyDepth({ kinds, signer }: Observation): Depth | undefined {
  if (kinds.some((k) => !IDENTITY_KINDS.has(k) && !isEphemeral(k))) return "multiplayer";
  if (signer || kinds.some((k) => IDENTITY_KINDS.has(k))) return "identity";
  return kinds.length ? "none" : undefined;
}
