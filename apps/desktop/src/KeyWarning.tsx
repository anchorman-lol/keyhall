import { findGame } from "@keyhall/core/launcher";
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

export function KeyWarning() {
  const name = Launcher.useSelector((s) => {
    const coordinate = s.context.keyWarnings[0];
    return coordinate && (findGame(s.context, coordinate)?.name ?? "A game");
  });
  const { send } = Launcher.useActorRef();
  const dismiss = () => send({ type: "warning.dismiss" });
  return (
    <Dialog open={!!name} onOpenChange={(open) => !open && dismiss()}>
      {name && (
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{name} has a field that asks for your private key</DialogTitle>
            <DialogDescription>
              Don't paste your nsec there: anything typed into a game can leave with it. Keyhall
              already signs for {name} without sharing your key, so pick its extension or signer
              login instead, or play as a guest. Keyhall didn't read the field.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismiss}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
