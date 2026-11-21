import type { Depth } from "@keyhall/core/depth";
import type { Verdict } from "@keyhall/core/labels";
import { curatorName, type LauncherContext } from "@keyhall/core/launcher";
import type { SignIn } from "@keyhall/core/listing";
import { Badge } from "@keyhall/ui/components/badge";
import { CheckIcon, SealCheckIcon, WarningIcon } from "@phosphor-icons/react";

type Tone = "success" | "warning" | "destructive" | "info" | "secondary";

export const SIGN_IN: Record<SignIn, { label: string; tone: Tone; text: string }> = {
  signer: {
    label: "Signer only",
    tone: "success",
    text: "Signs in through Keyhall, an extension or a bunker. Your nsec never touches the game.",
  },
  "signer-or-nsec": {
    label: "Signer or nsec",
    tone: "warning",
    text: "Offers a signer but also accepts a pasted key. Use the signer.",
  },
  nsec: {
    label: "Asks for nsec",
    tone: "destructive",
    text: "The only way in is pasting your private key. Play as a guest instead.",
  },
  throwaway: {
    label: "Throwaway key",
    tone: "info",
    text: "Generates a guest or session key. Safe, but not your identity.",
  },
  none: { label: "No login", tone: "secondary", text: "Doesn't use your Nostr identity." },
  unknown: {
    label: "Unknown",
    tone: "secondary",
    text: "The listing doesn't say how the game signs you in.",
  },
};

export const DEPTH: Record<Depth, { label: string; text: string }> = {
  multiplayer: {
    label: "Multiplayer on relays",
    text: "Game state or matchmaking travels over relays.",
  },
  identity: {
    label: "Identity only",
    text: "Nostr is your identity and maybe your scores; the game runs elsewhere.",
  },
  none: { label: "No Nostr", text: "Relays at most carry signalling for a lobby." },
};

function Marks({ verdict, by }: { verdict: Verdict<unknown>; by: string }) {
  return (
    <>
      {verdict.seen && <CheckIcon data-icon="inline-end" weight="bold" />}
      {by && (
        <SealCheckIcon data-icon="inline-end" weight="fill" aria-label={`verified by ${by}`} />
      )}
      {verdict.conflicts.length > 0 && (
        <WarningIcon data-icon="inline-end" weight="fill" aria-label="sources disagree" />
      )}
    </>
  );
}

const title = (verdict: Verdict<unknown>, by: string, fallback: string) =>
  [
    verdict.seen ? "Seen in the game window" : by ? `Verified by ${by}` : fallback,
    verdict.conflicts.length > 0 && "Sources disagree",
  ]
    .filter(Boolean)
    .join(". ");

export function SignInBadge({ verdict, by }: { verdict: Verdict<SignIn>; by: string }) {
  const signIn = verdict.value ?? "unknown";
  return (
    <Badge variant={SIGN_IN[signIn].tone} title={title(verdict, by, "Declared by the listing")}>
      {SIGN_IN[signIn].label}
      <Marks verdict={verdict} by={by} />
    </Badge>
  );
}

export function DepthBadge({ verdict, by }: { verdict: Verdict<Depth>; by: string }) {
  if (!verdict.value) return null;
  return (
    <Badge variant="depth" title={title(verdict, by, "Declared by the listing")}>
      {DEPTH[verdict.value].label}
      <Marks verdict={verdict} by={by} />
    </Badge>
  );
}

export const verifiers = (context: LauncherContext, verdict: Verdict<unknown>) =>
  verdict.verifiedBy.map((p) => curatorName(context, p)).join(", ");
