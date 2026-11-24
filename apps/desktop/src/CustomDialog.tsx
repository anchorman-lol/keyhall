import type { CustomGame } from "@keyhall/core/custom";
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
import { Input } from "@keyhall/ui/components/input";
import { AppWindowIcon, GlobeIcon } from "@phosphor-icons/react";
import { useState, type ReactElement, type ReactNode } from "react";
import { Launcher, pickApp } from "./launcher.ts";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

const blank = { name: "", url: "", lud16: "" };

export function CustomDialog({
  entry,
  trigger,
  children,
}: {
  entry?: CustomGame;
  trigger: ReactElement;
  children: ReactNode;
}) {
  const actor = Launcher.useActorRef();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(blank);
  const [app, setApp] = useState(false);
  const [error, setError] = useState("");
  const set = (f: Partial<typeof blank>) => setFields({ ...fields, ...f });
  const reset = (o: boolean) => {
    setOpen(o);
    setError("");
    setFields(entry ? { ...blank, ...entry } : blank);
    setApp(!!entry?.url.startsWith("/"));
  };
  const choose = async () => {
    const path = await pickApp();
    if (path)
      set({
        url: path,
        name:
          fields.name ||
          path
            .split("/")
            .pop()!
            .replace(/\.app$/, ""),
      });
  };
  const save = () => {
    actor.send({ type: "custom.save", input: { ...entry, ...fields } });
    const { customError } = actor.getSnapshot().context;
    if (customError) setError(customError);
    else setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger render={trigger}>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? `Edit ${entry.name}` : "Add a game"}</DialogTitle>
          <DialogDescription>
            Only on this Mac: nothing about it is published except your presence while you play.
          </DialogDescription>
        </DialogHeader>
        {!entry && (
          <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-black/30 p-0.5 ring-1 ring-white/[0.06]">
            {(
              [
                [false, GlobeIcon, "Web game"],
                [true, AppWindowIcon, "Mac app"],
              ] as const
            ).map(([isApp, Icon, label]) => (
              <button
                key={label}
                aria-pressed={app === isApp}
                onClick={() => {
                  setApp(isApp);
                  set({ url: "" });
                }}
                className="flex h-8 items-center justify-center gap-1.5 rounded-md text-[13px] text-muted-foreground hover:text-foreground aria-pressed:bg-white/[0.1] aria-pressed:font-medium aria-pressed:text-foreground"
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        )}
        {app ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">App</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {fields.url || "None chosen"}
            </span>
            <Button variant="secondary" size="sm" onClick={choose}>
              Choose…
            </Button>
          </div>
        ) : (
          <Field label="Address" hint="Opens in its own Keyhall window">
            <Input
              value={fields.url}
              placeholder="https://"
              onChange={(e) => set({ url: e.target.value })}
            />
          </Field>
        )}
        <Field label="Name" hint="Friends see “Playing” and this name">
          <Input value={fields.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field
          label="Lightning address"
          hint="Optional. Without one it gets no share of your monthly budget."
        >
          <Input
            value={fields.lud16}
            placeholder="dev@wallet.example"
            onChange={(e) => set({ lud16: e.target.value })}
          />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>{entry ? "Save" : "Add to library"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
