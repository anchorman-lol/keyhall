import type { CSSProperties, ReactNode } from "react";
import type { Layout } from "./config.ts";
import { GamePage, WidePane } from "./Detail.tsx";
import { FriendsColumn } from "./FriendsColumn.tsx";
import { Library } from "./Library.tsx";
import { Nav, NAV_W } from "./Nav.tsx";
import { OtherPage } from "./Pages.tsx";
import { Dock, RequestBanner, StatusBar } from "./Running.tsx";
import { useWin } from "./state.tsx";

type Main = "library" | "game" | "detail" | "page";

/** Which regions are on screen and how wide each is, from the layout and the window's state. */
export function regions(l: Layout) {
  const open = l.page === "library" && l.selected !== null;
  const main: [Main, string][] =
    l.page !== "library"
      ? [["page", "minmax(0,1fr)"]]
      : open && l.detail === "page"
        ? [["game", "minmax(0,1fr)"]]
        : open && l.detail === "wide"
          ? [
              ["library", l.density === "compact" ? "360px" : "384px"],
              ["detail", "minmax(0,1fr)"],
            ]
          : [["library", "minmax(0,1fr)"]];
  return {
    nav: `${NAV_W[l.nav]}px`,
    main,
    friends: l.friends === "column" && l.page !== "friends",
    banner: l.playing && l.signing && l.running === "nav" && l.nav !== "sidebar",
    bottom: l.bottom === "dock" ? (l.playing ? 84 : 0) : l.bottom === "status" ? 34 : 0,
  };
}

function Region({
  name,
  style,
  children,
}: {
  name: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div data-region={name} className="min-h-0 min-w-0" style={style}>
      {children}
    </div>
  );
}

const VIEW: Record<Main, () => ReactNode> = {
  library: Library,
  game: GamePage,
  detail: WidePane,
  page: OtherPage,
};

export function Shell() {
  const { layout } = useWin();
  const r = regions(layout);
  const top = r.banner ? 2 : 1;
  const span = `1 / span ${top}`;
  const cols = [r.nav, ...r.main.map(([, w]) => w), ...(r.friends ? ["264px"] : [])];
  const rows = [r.banner && "52px", "minmax(0,1fr)", r.bottom && `${r.bottom}px`].filter(Boolean);
  return (
    <div
      className="grid h-full"
      style={{ gridTemplateColumns: cols.join(" "), gridTemplateRows: rows.join(" ") }}
    >
      <Region name="nav" style={{ gridColumn: 1, gridRow: span, zIndex: 40 }}>
        <Nav />
      </Region>
      {r.banner && (
        <Region name="banner" style={{ gridColumn: `2 / span ${r.main.length}`, gridRow: 1 }}>
          <RequestBanner />
        </Region>
      )}
      {r.main.map(([name], i) => {
        const V = VIEW[name];
        return (
          <Region key={name} name={name} style={{ gridColumn: i + 2, gridRow: top }}>
            <V />
          </Region>
        );
      })}
      {r.friends && (
        <Region name="friends" style={{ gridColumn: cols.length, gridRow: span }}>
          <FriendsColumn />
        </Region>
      )}
      {r.bottom > 0 && (
        <Region name="bottom" style={{ gridColumn: "1 / -1", gridRow: top + 1 }}>
          {layout.bottom === "dock" ? <Dock /> : <StatusBar />}
        </Region>
      )}
    </div>
  );
}
