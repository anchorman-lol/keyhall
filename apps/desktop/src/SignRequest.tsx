import { Button } from "@keyhall/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@keyhall/ui/components/dialog";
import { Launcher } from "./launcher.ts";

export function SignRequest() {
  const request = Launcher.useSelector((s) => s.context.requests[0]);
  const { send } = Launcher.useActorRef();
  const answer = (allow: boolean) => send({ type: "answer", allow });
  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && answer(false)}>
      {request && (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {request.game} wants to sign a kind {request.kind} event as you
            </DialogTitle>
            <DialogDescription>
              Allowing it lets {request.game} sign kind {request.kind} events until Keyhall quits.
            </DialogDescription>
          </DialogHeader>
          {request.content && (
            <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
              {request.content}
            </pre>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => answer(false)}>
              Deny
            </Button>
            <Button onClick={() => answer(true)}>Allow</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
