import { Button } from "@keyhall/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@keyhall/ui/components/dialog";
import { Input } from "@keyhall/ui/components/input";
import { useState } from "react";
import { Launcher } from "./launcher.ts";

export function KeyDialog() {
  const [nsec, setNsec] = useState("");
  const error = Launcher.useSelector((s) => s.context.keyError);
  const saving = Launcher.useSelector((s) => s.matches({ key: "saving" }));
  const { send } = Launcher.useActorRef();
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>Set up your key</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your Nostr key</DialogTitle>
          <DialogDescription>
            Keyhall keeps your key in the macOS keychain. Games never see it: they ask Keyhall to
            sign.
          </DialogDescription>
        </DialogHeader>
        <Button disabled={saving} onClick={() => send({ type: "key.create" })}>
          Create a new key
        </Button>
        <p className="text-center text-sm text-muted-foreground">or import an existing one</p>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder="nsec1…"
            autoComplete="off"
            value={nsec}
            onChange={(e) => setNsec(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => send({ type: "key.import", nsec })}
          >
            Import
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
