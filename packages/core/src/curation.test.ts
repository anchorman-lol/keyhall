import { naddrEncode, noteEncode, nprofileEncode, npubEncode } from "nostr-tools/nip19";
import { describe, expect, it } from "vitest";
import { listsFor, parseListRef } from "./curation";

const pubkey = "c".repeat(64);
const list = (d: string, tags: string[][] = [], created_at = 1) => ({
  kind: 30267,
  id: d,
  pubkey,
  created_at,
  sig: "s",
  content: "",
  tags: [["d", d], ...tags],
});

describe("parseListRef", () => {
  it("reads an npub as every game list by that curator", () => {
    expect(parseListRef(` nostr:${npubEncode(pubkey)} `)).toEqual({ pubkey });
  });

  it("reads an nprofile with its relays", () => {
    expect(parseListRef(nprofileEncode({ pubkey, relays: ["wss://r.example"] }))).toEqual({
      pubkey,
      relays: ["wss://r.example"],
    });
  });

  it("reads an naddr as one list", () => {
    const naddr = naddrEncode({ kind: 30267, pubkey, identifier: "chess", relays: [] });
    expect(parseListRef(naddr)).toEqual({ pubkey, d: "chess", relays: [] });
  });

  it("rejects anything else", () => {
    expect(parseListRef("hello")).toBeUndefined();
    expect(parseListRef(noteEncode("a".repeat(64)))).toBeUndefined();
    expect(parseListRef(naddrEncode({ kind: 30023, pubkey, identifier: "x" }))).toBeUndefined();
  });
});

describe("listsFor", () => {
  const chess = list("chess", [
    ["title", "Chess on Nostr"],
    ["description", "Every chess game that plays"],
    ["t", "games"],
    ["a", `31990:${"a".repeat(64)}:nochess`],
    ["a", `30617:${"a".repeat(64)}:repo`],
  ]);

  it("reads a curation set's title and game listings", () => {
    expect(listsFor({ pubkey, d: "chess" }, [chess])).toEqual([
      {
        address: `30267:${pubkey}:chess`,
        pubkey,
        title: "Chess on Nostr",
        description: "Every chess game that plays",
        image: undefined,
        games: [`31990:${"a".repeat(64)}:nochess`],
      },
    ]);
  });

  it("keeps the newest version of each list", () => {
    const newer = list("chess", [["a", "31990:x:y"]], 2);
    expect(listsFor({ pubkey, d: "chess" }, [newer, chess])[0]?.games).toEqual(["31990:x:y"]);
  });

  it("takes only game lists for a curator, or the one list asked for", () => {
    const apps = list("apps", [["title", "Apps"]]);
    expect(listsFor({ pubkey }, [chess, apps]).map((l) => l.title)).toEqual(["Chess on Nostr"]);
    expect(listsFor({ pubkey, d: "apps" }, [chess, apps]).map((l) => l.title)).toEqual(["Apps"]);
    expect(listsFor({ pubkey: "d".repeat(64) }, [chess])).toEqual([]);
  });
});
