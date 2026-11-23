import { finalizeEvent, generateSecretKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";
import { profileFields, profileTemplate } from "./profile";

const profile = (content: object | string, tags: string[][] = []) =>
  finalizeEvent(
    {
      kind: 0,
      created_at: 1,
      content: typeof content === "string" ? content : JSON.stringify(content),
      tags,
    },
    generateSecretKey(),
  );

const fields = { name: "Mira", picture: "https://x.test/m.png", about: "Plays chess", lud16: "" };

describe("profile fields", () => {
  it("reads the shown name, picture, about and lightning address", () => {
    const e = profile({ name: "mira", display_name: "Mira M", about: "hi", lud16: "m@x.test" });
    expect(profileFields(e)).toEqual({
      name: "Mira M",
      picture: "",
      about: "hi",
      lud16: "m@x.test",
    });
  });

  it("is empty without a profile, with broken JSON or with non-string fields", () => {
    const empty = { name: "", picture: "", about: "", lud16: "" };
    expect(profileFields(undefined)).toEqual(empty);
    expect(profileFields(profile("{"))).toEqual(empty);
    expect(profileFields(profile({ name: 3, about: null }))).toEqual(empty);
  });
});

describe("profile template", () => {
  it("is a kind 0 with the edited fields", () => {
    const t = profileTemplate(undefined, fields, 50);
    expect(t).toMatchObject({ kind: 0, tags: [], created_at: 50 });
    expect(JSON.parse(t.content)).toEqual({
      name: "Mira",
      picture: "https://x.test/m.png",
      about: "Plays chess",
    });
  });

  it("keeps fields and tags Keyhall doesn't show", () => {
    const previous = profile(
      { name: "old", nip05: "m@x.test", website: "https://m.test", bot: false },
      [["i", "github:mira", "proof"]],
    );
    const t = profileTemplate(previous, fields, 50);
    expect(t.tags).toEqual([["i", "github:mira", "proof"]]);
    expect(JSON.parse(t.content)).toEqual({
      name: "Mira",
      nip05: "m@x.test",
      website: "https://m.test",
      bot: false,
      picture: "https://x.test/m.png",
      about: "Plays chess",
    });
  });

  it("edits the display name when the profile has one, leaving the handle", () => {
    const previous = profile({ name: "mira", display_name: "Mira M" });
    const content = JSON.parse(profileTemplate(previous, fields, 50).content);
    expect(content).toMatchObject({ name: "mira", display_name: "Mira" });
  });

  it("removes cleared fields and trims the rest", () => {
    const previous = profile({ name: "mira", about: "old", lud16: "m@x.test" });
    const edit = { name: " Mira ", picture: "", about: " ", lud16: "" };
    expect(JSON.parse(profileTemplate(previous, edit, 50).content)).toEqual({ name: "Mira" });
  });

  it("starts fresh from a profile with broken JSON", () => {
    expect(JSON.parse(profileTemplate(profile("{"), fields, 50).content)).toEqual({
      name: "Mira",
      picture: "https://x.test/m.png",
      about: "Plays chess",
    });
  });
});
