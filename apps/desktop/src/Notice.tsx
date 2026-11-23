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
        title="Keep your key in Keyhall"
        subtitle={`${game} has a field for a private key`}
        cascade={cascade}
        onClose={done}
      >
        <p className="text-muted-foreground">
          You don't need it in Keyhall: it already signs for {game} without sharing your key, so
          pick its extension or signer login, or play as a guest. Don't paste your nsec there,
          since anything typed into a game can leave with it.
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
