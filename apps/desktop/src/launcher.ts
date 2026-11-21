import { launcherMachine, type ShimCall, type SignRequest } from "@keyhall/core/launcher";
import { fetchGames, fetchLastUpdated, fetchListings, fetchLists } from "@keyhall/core/relays";
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
        listen<SignRequest>("sign-request", ({ payload }) =>
          send({ type: "sign-request", request: payload }),
        ),
      ];
      return () => subscriptions.forEach((s) => s.then((unlisten) => unlisten()));
    },
    saveObserved: (observed) => localStorage.setItem("observed", JSON.stringify(observed)),
    saveSources: (sources) => localStorage.setItem("sources", JSON.stringify(sources)),
  },
  JSON.parse(localStorage.getItem("observed") ?? "{}"),
  loadSources(JSON.parse(localStorage.getItem("sources") ?? "null")),
);

export const Launcher = createActorContext(machine);
