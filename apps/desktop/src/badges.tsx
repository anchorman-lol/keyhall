import type { Depth } from "@keyhall/core/depth";
import type { SignIn } from "@keyhall/core/listing";
import { Badge } from "@keyhall/ui/components/badge";
import { CheckIcon } from "@phosphor-icons/react";

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

export function SignInBadge({ signIn }: { signIn: SignIn }) {
  return <Badge variant={SIGN_IN[signIn].tone}>{SIGN_IN[signIn].label}</Badge>;
}

export function DepthBadge({ depth, verified }: { depth: Depth | undefined; verified: boolean }) {
  if (!depth) return null;
  return (
    <Badge variant="depth" title={verified ? "Seen in the game window" : "Declared by the listing"}>
      {DEPTH[depth].label}
      {verified && <CheckIcon data-icon="inline-end" weight="bold" />}
    </Badge>
  );
}
