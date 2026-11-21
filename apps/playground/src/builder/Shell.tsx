import type { ReactNode } from "react";
import type { Layout } from "./config.ts";
import { FriendsColumn } from "./FriendsColumn.tsx";
import { Inspector } from "./Inspector.tsx";
import { Library } from "./Library.tsx";
import { Dock, StatusBar } from "./Running.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { useWin } from "./state.tsx";

const SIDEBAR_W = { sources: 240, switches: 228, rail: 72 };

/** Which regions are on screen and how wide each is, from the layout and the window's state. */
export function regions(l: Layout) {
  const inspector = l.inspector !== "none" && l.selected !== null;
  const bottom = l.bottom === "dock" ? (l.playing ? 84 : 0) : l.bottom === "status" ? 34 : 0;
  const cols: [string, string][] = [
    ["sidebar", `${SIDEBAR_W[l.sidebar]}px`],
    [
      "library",
      inspector && l.inspector === "wide"
        ? l.density === "compact"
          ? "360px"
          : "384px"
        : "minmax(0,1fr)",
    ],
  ];
  if (inspector) cols.push(["inspector", l.inspector === "wide" ? "minmax(0,1fr)" : "420px"]);
  if (l.friends === "column") cols.push(["friends", "264px"]);
  return { cols, bottom };
}

function Region({ name, col, children }: { name: string; col: number; children: ReactNode }) {
  return (
    <div data-region={name} className="min-h-0 min-w-0" style={{ gridColumn: col, gridRow: 1 }}>
      {children}
    </div>
  );
}

export function Shell() {
  const { layout } = useWin();
  const { cols, bottom } = regions(layout);
  const banner =
    layout.signing && layout.playing && layout.running === "sidebar" && layout.sidebar === "rail";
  const view: Record<string, ReactNode> = {
    sidebar: <Sidebar />,
    library: <Library banner={banner} />,
    inspector: <Inspector />,
    friends: <FriendsColumn />,
  };
  return (
    <div
      className="grid h-full"
      style={{
        gridTemplateColumns: cols.map(([, w]) => w).join(" "),
        gridTemplateRows: bottom ? `minmax(0,1fr) ${bottom}px` : "minmax(0,1fr)",
      }}
    >
      {cols.map(([name], i) => (
        <Region key={name} name={name} col={i + 1}>
          {view[name]}
        </Region>
      ))}
      {bottom > 0 && (
        <div data-region="bottom" className="min-w-0" style={{ gridColumn: "1 / -1", gridRow: 2 }}>
          {layout.bottom === "dock" ? <Dock /> : <StatusBar />}
        </div>
      )}
    </div>
  );
}
