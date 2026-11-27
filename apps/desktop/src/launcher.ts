import type { DmDeps } from "@keyhall/core/dm";
import { launcherMachine, type LauncherEvent, type ShimCall } from "@keyhall/core/launcher";
import {
  fetchFriends,
  fetchGames,
  fetchInboxRelays,
  fetchLabels,
  fetchLastUpdated,
  fetchListings,
  fetchLists,
  fetchProfileEvent,
  probeRelay,
  publish,
  setRelays,
  subscribe,
  zap,
} from "@keyhall/core/relays";
import { loadRelays } from "@keyhall/core/relaySettings";
import { loadCustom } from "@keyhall/core/custom";
import { loadSources } from "@keyhall/core/sources";
import { shimScript } from "@keyhall/core/shim";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createActorContext } from "@xstate/react";
import { useEffect, useState } from "react";

export const formatDate = (t: number) =>
  new Date(t * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const minutes = (seconds: number) =>
  seconds < 3600
    ? `${Math.floor(seconds / 60)} min`
    : `${Math.floor(seconds / 3600)} h ${Math.floor(seconds / 60) % 60} min`;

export function useNow() {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() / 1000), 15_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export const dms = {
  wrap: (to, text) => invoke("dm_wrap", { to, text }),
  unwrap: (wrap) => invoke("dm_unwrap", { wrap }),
  inboxRelays: fetchInboxRelays,
  publish,
  subscribe,
} satisfies DmDeps & { subscribe: typeof subscribe };

export const pickApp = () => invoke<string | null>("pick_app");

const relays = loadRelays(JSON.parse(localStorage.getItem("relays") ?? "null"));
setRelays(relays);

const machine = launcherMachine(
  {
    keyStatus: () => invoke("key_status"),
    saveKey: (command, nsec) => invoke(command, { nsec }),
    forgetKey: () => invoke("sign_out"),
    fetchLists,
    fetchListings,
    fetchGames,
    fetchLastUpdated,
    fetchLabels,
    signLabel: (event) => invoke("sign_label", { event }),
    publish,
    openGame: (game, hotkey) =>
      game.custom === "app"
        ? invoke("launch_app", { name: game.name, coordinate: game.coordinate, path: game.url })
        : invoke("open_game", {
            name: game.name,
            coordinate: game.coordinate,
            url: game.url,
            shim: shimScript(hotkey),
          }),
    openPanel: (game, kind, id, props) => void invoke("open_panel", { game, kind, id, props }),
    saveHotkey: (hotkey) => localStorage.setItem("hotkey", JSON.stringify(hotkey)),
    checkGame: (label) => void invoke("check_game", { label }),
    closeGame: (label) => void invoke("close_game", { label }),
    listen: (send) => {
      const subscriptions = [
        listen<ShimCall>("shim", ({ payload }) => send({ type: "shim", call: payload })),
        listen<{ coordinate: string; kinds: number[] }>("observed", ({ payload }) =>
          send({ type: "observed", ...payload }),
        ),
        listen<{ coordinate: string }>("closed", ({ payload }) =>
          send({ type: "closed", ...payload }),
        ),
        listen<LauncherEvent & { type: "panel" }>("panel", ({ payload }) =>
          send({ ...payload, type: "panel" }),
        ),
        listen<string>("key-field", ({ payload }) =>
          send({ type: "key-field", coordinate: payload }),
        ),
        listen<string>("update-ready", ({ payload }) =>
          send({ type: "update-ready", version: payload }),
        ),
      ];
      return () => subscriptions.forEach((s) => s.then((unlisten) => unlisten()));
    },
    saveObserved: (observed) => localStorage.setItem("observed", JSON.stringify(observed)),
    saveSources: (sources) => localStorage.setItem("sources", JSON.stringify(sources)),
    saveCustom: (custom) => localStorage.setItem("custom", JSON.stringify(custom)),
    saveRelays: (relays) => {
      setRelays(relays);
      localStorage.setItem("relays", JSON.stringify(relays));
    },
    probeRelay,
    fetchFriends,
    fetchProfileEvent,
    saveFriendsOpen: (open) => localStorage.setItem("friendsOpen", JSON.stringify(open)),
    subscribe,
    signEvent: (event) => invoke("sign_event", { event }),
    nip44Encrypt: (pubkey, text) => invoke("nip44_encrypt", { pubkey, text }),
    nip44Decrypt: (pubkey, text) => invoke("nip44_decrypt", { pubkey, text }),
    savePresence: (presence, circle) =>
      localStorage.setItem("presence", JSON.stringify({ presence, circle })),
    sessions: () => invoke("play_sessions"),
    walletStatus: () => invoke("wallet_status"),
    connectWallet: (uri) => invoke("connect_wallet", { uri }),
    pay: (payment, comment) =>
      zap(payment, comment, {
        request: (invoice) => invoke("wallet_pay_request", { invoice }),
        result: (reply) => invoke("wallet_pay_result", { reply }),
        lnurl: (url) => invoke("lnurl_fetch", { url }),
      }),
    saveBudget: (budget) => localStorage.setItem("budget", JSON.stringify(budget)),
    restart: () => void invoke("restart_to_update"),
  },
  {
    observed: JSON.parse(localStorage.getItem("observed") ?? "{}"),
    sources: loadSources(JSON.parse(localStorage.getItem("sources") ?? "null")),
    custom: loadCustom(JSON.parse(localStorage.getItem("custom") ?? "null")),
    relays,
    budget: JSON.parse(localStorage.getItem("budget") ?? "null") ?? undefined,
    friendsOpen: JSON.parse(localStorage.getItem("friendsOpen") ?? "null") ?? undefined,
    hotkey: JSON.parse(localStorage.getItem("hotkey") ?? "null") ?? undefined,
    ...JSON.parse(localStorage.getItem("presence") ?? "{}"),
  },
);

export const Launcher = createActorContext(machine);
