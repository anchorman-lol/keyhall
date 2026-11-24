import { addMessage, sendDm, watchDms, type Message } from "@keyhall/core/dm";
import { pubkeyOf } from "@keyhall/core/launcher";
import { friendName, type Friend } from "@keyhall/core/presence";
import { Button } from "@keyhall/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@keyhall/ui/components/dialog";
import { Input } from "@keyhall/ui/components/input";
import { useEffect, useState, type FormEvent } from "react";
import { Avatar } from "./Friends.tsx";
import { dms, Launcher } from "./launcher.ts";

export function DmDialog({ friend, onClose }: { friend?: Friend; onClose(): void }) {
  const me = Launcher.useSelector((s) => pubkeyOf(s.context));
  const [thread, setThread] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setThread([]);
    if (!friend || !me) return;
    return watchDms(dms, me, (m) => {
      if ((m.from === me ? m.to : m.from) === friend.pubkey) setThread((t) => addMessage(t, m));
    });
  }, [friend, me]);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const sent = await sendDm(dms, me!, friend!.pubkey, text.trim());
      setThread((t) => addMessage(t, sent));
      setText("");
    } catch (err) {
      setError(typeof err === "string" ? err : "Couldn't reach the relays");
    }
    setSending(false);
  };
  return (
    <Dialog open={!!friend} onOpenChange={(o) => !o && onClose()}>
      {friend && (
        <DialogContent className="gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Avatar friend={friend} className="size-6" />
              {friendName(friend)}
            </DialogTitle>
            <DialogDescription>
              Your regular Nostr DMs, readable in any app with your key, unless you set a DM relay
              list (kind 10050).
            </DialogDescription>
          </DialogHeader>
          <div className="flex h-72 flex-col-reverse gap-1.5 overflow-y-auto">
            {!thread.length && <p className="m-auto text-muted-foreground">No messages yet.</p>}
            {thread.toReversed().map((m) => (
              <p
                key={m.id}
                title={new Date(m.at * 1000).toLocaleString()}
                className={`max-w-[80%] rounded-2xl px-3 py-1.5 break-words whitespace-pre-wrap ${
                  m.from === me
                    ? "self-end bg-primary text-primary-foreground"
                    : "self-start bg-muted"
                }`}
              >
                {m.text}
              </p>
            ))}
          </div>
          {error && <p className="text-destructive">{error}</p>}
          <form onSubmit={send} className="flex gap-2">
            <Input
              autoFocus
              value={text}
              placeholder="Message"
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" disabled={sending || !text.trim()}>
              Send
            </Button>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
