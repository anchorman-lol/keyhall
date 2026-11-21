function install() {
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
}

export const shimScript = () => `(${install.toString()})();`;
