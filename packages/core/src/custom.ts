import { https, type Game } from "./listing";

export interface CustomGame {
  id: string;
  name: string;
  url: string;
  lud16?: string;
  addedAt: number;
}

export type CustomInput = Pick<CustomGame, "name" | "url"> & Partial<CustomGame>;

export const CUSTOM_ID = "custom";
const LUD16 = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const isApp = (url: string) => /^(\/|[a-z]:\\)/i.test(url);

export function saveCustom(list: CustomGame[], input: CustomInput, now: number) {
  const name = input.name.trim();
  const url = input.url.trim();
  const lud16 = input.lud16?.trim();
  if (!name) return "Give it a name.";
  if (!https(url) && !isApp(url)) return "Enter an https:// address or choose an application.";
  if (lud16 && !LUD16.test(lud16)) return "A lightning address looks like name@domain.com.";
  const old = list.find((c) => c.id === input.id);
  const saved = {
    id: old?.id ?? crypto.randomUUID(),
    name,
    url,
    ...(lud16 && { lud16 }),
    addedAt: old?.addedAt ?? now,
  };
  return old ? list.map((c) => (c === old ? saved : c)) : [...list, saved];
}

export const removeCustom = (list: CustomGame[], id: string) => list.filter((c) => c.id !== id);

export const loadCustom = (saved: unknown): CustomGame[] =>
  Array.isArray(saved)
    ? saved.filter(
        (c) =>
          typeof c?.id === "string" &&
          typeof c.name === "string" &&
          typeof c.url === "string" &&
          typeof c.addedAt === "number",
      )
    : [];

export const customGame = (c: CustomGame): Game => ({
  coordinate: `${CUSTOM_ID}:${c.id}`,
  pubkey: "",
  name: c.name,
  about: undefined,
  picture: undefined,
  banner: undefined,
  url: c.url,
  createdAt: c.addedAt,
  signIn: "unknown",
  depth: undefined,
  repos: [],
  payTo: c.lud16 ? [{ pubkey: "", weight: 1, lud16: c.lud16 }] : [],
  custom: isApp(c.url) ? "app" : "web",
});
