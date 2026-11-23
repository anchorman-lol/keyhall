import type { Event, EventTemplate } from "nostr-tools/pure";

export interface ProfileFields {
  name: string;
  picture: string;
  about: string;
  lud16: string;
}

function content(event: Event | undefined): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(event?.content ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function profileFields(event: Event | undefined): ProfileFields {
  const c = content(event);
  const text = (key: string) => (typeof c[key] === "string" ? c[key] : "");
  return {
    name: text("display_name") || text("name"),
    picture: text("picture"),
    about: text("about"),
    lud16: text("lud16"),
  };
}

export function profileTemplate(
  previous: Event | undefined,
  fields: ProfileFields,
  now: number,
): EventTemplate {
  const c = content(previous);
  const { name, ...rest } = fields;
  const edits = { [c.display_name ? "display_name" : "name"]: name, ...rest };
  for (const [key, value] of Object.entries(edits))
    if (value.trim()) c[key] = value.trim();
    else delete c[key];
  return { kind: 0, content: JSON.stringify(c), tags: previous?.tags ?? [], created_at: now };
}
