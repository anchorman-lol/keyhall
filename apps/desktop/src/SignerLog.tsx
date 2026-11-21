import { CheckCircleIcon, KeyIcon, XCircleIcon } from "@phosphor-icons/react";
import type { ShimCall } from "@keyhall/core/launcher";

export function SignerLog({ calls, name }: { calls: ShimCall[]; name?: (c: ShimCall) => string }) {
  return (
    <ul className="grid grid-cols-1 gap-1.5">
      {calls.map((call, i) => {
        const text = call.event
          ? `signEvent kind ${call.event.kind}: ${call.verified ? "signature verified" : "signature invalid"}`
          : "getPublicKey: answered with your key";
        return (
          <li key={i} className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
            {!call.event ? (
              <KeyIcon className="mt-0.5 shrink-0 text-muted-foreground" />
            ) : call.verified ? (
              <CheckCircleIcon weight="fill" className="mt-0.5 shrink-0 text-emerald-400" />
            ) : (
              <XCircleIcon weight="fill" className="mt-0.5 shrink-0 text-destructive" />
            )}
            <div className="min-w-0">
              <p className="truncate" title={[name?.(call), text].filter(Boolean).join(" ")}>
                {name && <strong className="mr-1">{name(call)}</strong>}
                {text}
              </p>
              {call.event && (
                <code className="block truncate text-muted-foreground">{call.event.sig}</code>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
