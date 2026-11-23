import { profileFields, type ProfileFields } from "@keyhall/core/profile";
import { Button } from "@keyhall/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@keyhall/ui/components/dialog";
import { Input } from "@keyhall/ui/components/input";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Launcher } from "./launcher.ts";

const FIELDS: [keyof ProfileFields, string, string, string?][] = [
  ["name", "Name", "Shown to friends and in other Nostr apps"],
  ["picture", "Picture", "An https:// image address", "https://"],
  ["lud16", "Lightning address", "Where zaps reach you", "you@wallet.example"],
];

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  );
}

export function ProfileDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const state = Launcher.useSelector((s) => s.value.profile);
  const event = Launcher.useSelector((s) => s.context.profileEvent);
  const error = Launcher.useSelector((s) => s.context.profileError);
  const { send } = Launcher.useActorRef();
  const [fields, setFields] = useState(() => profileFields(event));
  useEffect(() => {
    if (open) send({ type: "profile.edit" });
  }, [open, send]);
  useEffect(() => setFields(profileFields(event)), [event]);
  const wasSaving = useRef(false);
  useEffect(() => {
    if (wasSaving.current && state === "ready") onClose();
    wasSaving.current = state === "saving";
  }, [state, onClose]);
  const close = () => {
    send({ type: "profile.cancel" });
    onClose();
  };
  const set = (key: keyof ProfileFields) => (value: string) =>
    setFields({ ...fields, [key]: value });
  const editable = state === "editing" || state === "saving";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your profile</DialogTitle>
          <DialogDescription>
            Keyhall starts from your latest profile on your relays and keeps everything it doesn't
            show here, like your NIP-05 and website. Saving signs and publishes a new kind 0.
          </DialogDescription>
        </DialogHeader>
        {state === "fetching" && (
          <p className="text-sm text-muted-foreground">Loading your latest profile…</p>
        )}
        {editable && (
          <>
            {FIELDS.map(([key, label, hint, placeholder]) => (
              <Field key={key} label={label} hint={hint}>
                <Input
                  value={fields[key]}
                  placeholder={placeholder}
                  onChange={(e) => set(key)(e.target.value)}
                />
              </Field>
            ))}
            <Field label="About" hint="A line or two about you">
              <textarea
                rows={3}
                value={fields.about}
                onChange={(e) => set("about")(e.target.value)}
                className="w-full resize-none rounded-2xl bg-input/50 px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              />
            </Field>
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          {editable ? (
            <Button
              disabled={state === "saving"}
              onClick={() => send({ type: "profile.save", fields })}
            >
              Sign and publish
            </Button>
          ) : (
            error && <Button onClick={() => send({ type: "profile.edit" })}>Try again</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
