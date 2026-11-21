import { DEPTHS, type Depth } from "@keyhall/core/depth";
import { AUTH_METHODS, labelTemplate } from "@keyhall/core/labels";
import type { Game } from "@keyhall/core/listing";
import { Button } from "@keyhall/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@keyhall/ui/components/dialog";
import { TagIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { DEPTH } from "./badges.tsx";
import { Launcher } from "./launcher.ts";

function Choice({ on, onClick, children }: { on: boolean; onClick(): void; children: string }) {
  return (
    <Button size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={onClick}>
      {children}
    </Button>
  );
}

export function LabelDialog({ game, depth: shown }: { game: Game; depth: Depth | undefined }) {
  const [open, setOpen] = useState(false);
  const [methods, setMethods] = useState<string[]>([]);
  const [depth, setDepth] = useState(shown);
  const publishing = Launcher.useSelector((s) => s.matches({ label: "publishing" }));
  const error = Launcher.useSelector((s) => s.context.labelError);
  const { send } = Launcher.useActorRef();
  const wasPublishing = useRef(false);
  useEffect(() => {
    if (wasPublishing.current && !publishing && !error) setOpen(false);
    wasPublishing.current = publishing;
  }, [publishing, error]);
  const toggle = (m: string) =>
    setMethods(methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m]);
  const { tags } = labelTemplate(game.coordinate, methods, depth, 0);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" variant="secondary" />}>
        <TagIcon data-icon="inline-start" />
        Label this game
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Label {game.name}</DialogTitle>
          <DialogDescription>
            Your label is a NIP-32 event signed with your key. Players who follow your list see it
            on the badges. Nothing is published until you press Sign and publish.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium">Sign-in methods it offers</p>
        <div className="flex flex-wrap gap-1.5">
          {AUTH_METHODS.map((m) => (
            <Choice key={m} on={methods.includes(m)} onClick={() => toggle(m)}>
              {m}
            </Choice>
          ))}
        </div>
        <p className="text-sm font-medium">Nostr depth</p>
        <div className="flex flex-wrap gap-1.5">
          {(DEPTHS as Depth[]).map((d) => (
            <Choice key={d} on={depth === d} onClick={() => setDepth(depth === d ? undefined : d)}>
              {DEPTH[d].label}
            </Choice>
          ))}
        </div>
        <pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs break-all whitespace-pre-wrap">
          {JSON.stringify(tags)}
        </pre>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={publishing || (!methods.length && !depth)}
            onClick={() => send({ type: "label.publish", game, methods, depth })}
          >
            Sign and publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
