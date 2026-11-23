import { Button } from "@keyhall/ui/components/button";
import { invoke } from "@tauri-apps/api/core";
import { Window } from "./Overlay.tsx";

export interface Notice {
  game: string;
  kind?: number;
  content?: string;
}

const KINDS: Record<number, string> = {
  0: "your profile",
  1: "a public note",
  3: "your follow list",
  4: "a direct message",
  7: "a reaction",
  30078: "app data",
};

export function Notice({
  game,
  kind,
  content,
  id,
  cascade,
  done,
}: Notice & { id: string; cascade: number; done(): void }) {
  if (kind === undefined)
    return (
      <Window
        kind="notice"
        title="Don't paste your private key"
        subtitle={`${game} has a field for a private key`}
        cascade={cascade}
        onClose={done}
      >
        <p className="text-muted-foreground">
          Keyhall already signs for {game}. Pick its extension or signer login, or play as a guest.
        </p>
        <Button onClick={done}>Got it</Button>
      </Window>
    );
  const answer = (allow: boolean) => {
    void invoke("answer_notice", { id, allow });
    done();
  };
  return (
    <Window
      kind="notice"
      title={`Sign ${KINDS[kind] ?? `kind ${kind} events`}?`}
      subtitle={`${game} wants to sign as you`}
      cascade={cascade}
      onClose={() => answer(false)}
    >
      <p className="text-muted-foreground">
        Allowing lets it sign kind {kind} events until Keyhall quits. Your key stays in Keyhall.
      </p>
      {content && (
        <pre className="max-h-24 overflow-auto rounded-lg bg-muted p-2 text-xs whitespace-pre-wrap">
          {content}
        </pre>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => answer(false)}>
          Deny
        </Button>
        <Button onClick={() => answer(true)}>Allow kind {kind}</Button>
      </div>
    </Window>
  );
}
