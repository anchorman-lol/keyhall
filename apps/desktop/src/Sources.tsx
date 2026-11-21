import { sourceCount, sourceLabel } from "@keyhall/core/launcher";
import { PICKS_ID, sourceList } from "@keyhall/core/sources";
import { Button } from "@keyhall/ui/components/button";
import { Input } from "@keyhall/ui/components/input";
import { Switch } from "@keyhall/ui/components/switch";
import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { Launcher } from "./launcher.ts";

export function Sources() {
  const context = Launcher.useSelector((s) => s.context);
  const { send } = Launcher.useActorRef();
  return (
    <>
      <ul className="grid gap-1">
        {sourceList(context.sources).map(({ id, ref, enabled }) => (
          <li key={id} className="flex items-center gap-2 px-3 py-1 text-sm">
            <Switch
              size="sm"
              checked={enabled}
              onCheckedChange={() => send({ type: "source.toggle", id })}
              aria-label={sourceLabel(context, id)}
            />
            <span className="min-w-0 flex-1 truncate">{sourceLabel(context, id)}</span>
            <span className="text-muted-foreground">
              {context.loading.includes(id) ? "…" : sourceCount(context, id)}
            </span>
            {ref && id !== PICKS_ID && (
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove ${sourceLabel(context, id)}`}
                onClick={() => send({ type: "source.remove", id })}
              >
                <XIcon />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-1.5 px-1"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("curator") as HTMLInputElement;
          send({ type: "source.add", input: input.value });
          input.value = "";
        }}
      >
        <Input
          name="curator"
          placeholder="Curator npub or naddr"
          aria-invalid={!!context.sourceError}
          className="h-8 text-xs"
        />
        <Button type="submit" size="icon-sm" variant="secondary" aria-label="Add source">
          <PlusIcon />
        </Button>
      </form>
      {context.sourceError && (
        <p className="mt-1.5 px-2 text-xs text-destructive">{context.sourceError}</p>
      )}
    </>
  );
}
