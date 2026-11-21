import { launcherMachine, type ShimCall, type SignRequest } from "@keyhall/core/launcher";
import {
  fetchFriends,
  fetchGames,
  fetchLabels,
  fetchLastUpdated,
  fetchListings,
  fetchLists,
  publish,
  subscribe,
  zap,
} from "@keyhall/core/relays";
import { loadSources } from "@keyhall/core/sources";
import { shimScript } from "@keyhall/core/shim";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createActorContext } from "@xstate/react";

export const formatDate = (t: number) =>
  new Date(t * 1000).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const machine = launcherMachine(
  {
    keyStatus: () => invoke("key_status"),
    saveKey: (command, nsec) => invoke(command, { nsec }),
    fetchLists,
    fetchListings,
    fetchGames,
    fetchLastUpdated,
    fetchLabels,
    signLabel: (event) => invoke("sign_label", { event }),
    publish,
    openGame: (game) =>
      invoke("open_game", {
        name: game.name,
        coordinate: game.coordinate,
        url: game.url,
        shim: shimScript(),
      }),
    checkGame: (label) => void invoke("check_game", { label }),
    answer: (id, allow) => void invoke("answer_sign_request", { id, allow }),
    listen: (send) => {
      const subscriptions = [
        listen<ShimCall>("shim", ({ payload }) => send({ type: "shim", call: payload })),
        listen<{ coordinate: string; kinds: number[] }>("observed", ({ payload }) =>
          send({ type: "observed", ...payload }),
        ),
        listen<{ coordinate: string }>("closed", ({ payload }) =>
          send({ type: "closed", ...payload }),
        ),
        listen<SignRequest>("sign-request", ({ payload }) =>
          send({ type: "sign-request", request: payload }),
        ),
        listen<string>("key-field", ({ payload }) =>
          send({ type: "key-field", coordinate: payload }),
        ),
      ];
      return () => subscriptions.forEach((s) => s.then((unlisten) => unlisten()));
    },
    saveObserved: (observed) => localStorage.setItem("observed", JSON.stringify(observed)),
    saveSources: (sources) => localStorage.setItem("sources", JSON.stringify(sources)),
    fetchFriends,
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
      }),
    saveBudget: (budget) => localStorage.setItem("budget", JSON.stringify(budget)),
  },
  {
    observed: JSON.parse(localStorage.getItem("observed") ?? "{}"),
    sources: loadSources(JSON.parse(localStorage.getItem("sources") ?? "null")),
    budget: JSON.parse(localStorage.getItem("budget") ?? "null") ?? undefined,
    ...JSON.parse(localStorage.getItem("presence") ?? "{}"),
  },
);

export const Launcher = createActorContext(machine);
