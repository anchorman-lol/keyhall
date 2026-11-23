export const combo = (e: KeyboardEvent) =>
  [e.ctrlKey && "Ctrl", e.altKey && "Alt", e.shiftKey && "Shift", e.metaKey && "Cmd", e.key]
    .filter(Boolean)
    .join("+");

function install(hotkey: string, keys: typeof combo) {
  const invoke = (
    window as unknown as {
      __TAURI_INTERNALS__: { invoke(cmd: string, args: object): Promise<never> };
    }
  ).__TAURI_INTERNALS__.invoke;
  (window as unknown as { nostr: object }).nostr = {
    getPublicKey: () => invoke("nostr_get_public_key", {}),
    signEvent: ({ kind, content, tags, created_at }: Record<string, unknown>) =>
      invoke("nostr_sign_event", { event: { kind, content, tags, created_at } }),
  };

  addEventListener(
    "keydown",
    (e) => {
      if (keys(e) !== hotkey) return;
      e.preventDefault();
      e.stopPropagation();
      invoke("open_overlay", {}).catch(() => {});
    },
    true,
  );

  const seen = new Set<number>();
  const send = WebSocket.prototype.send;
  WebSocket.prototype.send = function (data) {
    try {
      const [type, ...rest] = JSON.parse(String(data)) as [string, ...Record<string, unknown>[]];
      const kinds =
        type === "EVENT"
          ? [rest[0]?.kind]
          : type === "REQ"
            ? rest.slice(1).flatMap((f) => (Array.isArray(f.kinds) ? f.kinds : []))
            : [];
      const fresh = [...new Set(kinds)].filter(
        (k): k is number => Number.isInteger(k) && !seen.has(k as number),
      );
      fresh.forEach((k) => seen.add(k));
      if (fresh.length) invoke("nostr_observe", { kinds: fresh }).catch(() => {});
    } catch {}
    return send.call(this, data);
  };

  const KEY = /\bnsec|priv(ate)?[\s_-]*key|secret[\s_-]*key|\b[0-9a-f]{64}\b/i;
  const onFocus = ({ target: field }: FocusEvent) => {
    if (
      !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) ||
      ![
        field.getAttribute("placeholder"),
        field.getAttribute("name"),
        field.getAttribute("id"),
        field.getAttribute("aria-label"),
        ...Array.from(field.labels ?? [], (l) => l.textContent),
      ].some((text) => text && KEY.test(text))
    )
      return;
    document.removeEventListener("focusin", onFocus, true);
    invoke("nostr_key_field", {}).catch(() => {});
  };
  document.addEventListener("focusin", onFocus, true);
}

export const shimScript = (hotkey: string) =>
  `(${install.toString()})(${JSON.stringify(hotkey)}, ${combo.toString()});`;
