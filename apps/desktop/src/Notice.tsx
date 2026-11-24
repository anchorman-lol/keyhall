import { Button } from "@keyhall/ui/components/button";
import { invoke } from "@tauri-apps/api/core";

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

export function Notice({ game, kind, content }: Notice) {
  const answer = (allow: boolean) => void invoke("answer_notice", { allow });
  return (
    <div className="grid h-screen content-center gap-3 p-6 text-[13px]">
      {kind === undefined ? (
        <>
          <h1 className="text-base font-semibold">{game} asks for your private key</h1>
          <p className="text-muted-foreground">
            Don't paste your nsec here: anything typed into a game can leave with it. Keyhall signs
            for {game} without sharing your key, so pick its extension or signer login, or play as a
            guest.
          </p>
          <Button className="mt-2 justify-self-end" onClick={() => answer(false)}>
            Got it
          </Button>
        </>
      ) : (
        <>
          <h1 className="text-base font-semibold">
            {game} wants to sign {KINDS[kind] ?? `a kind ${kind} event`} as you
          </h1>
          <p className="text-muted-foreground">
            Allowing lets it sign kind {kind} events until Keyhall quits. Your key stays in Keyhall.
          </p>
          {content && (
            <pre className="max-h-24 overflow-auto rounded-lg bg-muted p-2 text-xs whitespace-pre-wrap">
              {content}
            </pre>
          )}
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => answer(false)}>
              Deny
            </Button>
            <Button onClick={() => answer(true)}>Allow kind {kind}</Button>
          </div>
        </>
      )}
    </div>
  );
}
