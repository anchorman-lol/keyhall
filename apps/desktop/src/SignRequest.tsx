import { findGame } from "@keyhall/core/launcher";
import { Button } from "@keyhall/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@keyhall/ui/components/dialog";
import { KeyIcon } from "@phosphor-icons/react";
import { Launcher } from "./launcher.ts";
import { Cover, GameIcon } from "./Library.tsx";

const KINDS: Record<number, string> = {
  0: "your profile",
  1: "a public note",
  3: "your follow list",
  4: "a direct message",
  7: "a reaction",
  30078: "app data",
};

export function SignRequest() {
  const request = Launcher.useSelector((s) => s.context.requests[0]);
  const waiting = Launcher.useSelector((s) => s.context.requests.length - 1);
  const game = Launcher.useSelector((s) => request && findGame(s.context, request.coordinate));
  const { send } = Launcher.useActorRef();
  const answer = (allow: boolean) => send({ type: "answer", allow });
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => !open && answer(false)}
      disablePointerDismissal
    >
      {request && (
        <DialogContent
          showCloseButton={false}
          className="inset-0 top-0 left-0 grid h-full max-w-none translate-0 place-content-center rounded-none bg-background/80 p-10 ring-0 backdrop-blur-2xl sm:max-w-none"
        >
          {game && (
            <Cover
              game={game}
              className="absolute inset-0 -z-10 size-full scale-110 opacity-25 blur-3xl"
            />
          )}
          <div className="grid w-[460px] justify-items-center gap-5 text-center">
            <span className="relative">
              {game ? (
                <GameIcon
                  game={game}
                  className="size-20 rounded-2xl text-3xl ring-2 ring-primary"
                />
              ) : (
                <span className="block size-20 rounded-2xl bg-muted ring-2 ring-primary" />
              )}
              <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground ring-4 ring-background">
                <KeyIcon weight="fill" className="size-4" />
              </span>
            </span>
            <DialogTitle className="text-2xl leading-tight font-semibold text-balance">
              {request.game} wants to sign {KINDS[request.kind] ?? `a kind ${request.kind} event`}{" "}
              as you
            </DialogTitle>
            <DialogDescription className="text-[14px] text-pretty">
              Allowing it lets {request.game} sign kind {request.kind} events with your key until
              Keyhall quits. Your key stays in Keyhall either way.
            </DialogDescription>
            {request.content && (
              <pre className="max-h-40 w-full overflow-auto rounded-xl bg-muted p-3 text-left text-xs whitespace-pre-wrap">
                {request.content}
              </pre>
            )}
            <div className="mt-2 grid w-full grid-cols-2 gap-3">
              <Button size="lg" variant="secondary" onClick={() => answer(false)}>
                Deny
              </Button>
              <Button size="lg" onClick={() => answer(true)}>
                Allow kind {request.kind}
              </Button>
            </div>
            {waiting > 0 && (
              <p className="text-[12px] text-muted-foreground">
                {waiting} more {waiting === 1 ? "request" : "requests"} waiting
              </p>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
