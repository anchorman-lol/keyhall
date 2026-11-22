import { Button } from "@keyhall/ui/components/button";
import { Switch } from "@keyhall/ui/components/switch";
import { cn } from "@keyhall/ui/lib/utils";
import { ArrowCounterClockwiseIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  apply,
  BOTTOM,
  DEFAULT,
  DENSITY,
  DETAIL,
  FILTERBAR,
  FRIENDS_AT,
  fromHash,
  MAIN,
  NAV,
  PAGES,
  RUNNING_AT,
  SECTIONS,
  SELECTABLE,
  spec,
  toHash,
  type Layout,
  type Option,
} from "./builder/config.ts";
import { Shell } from "./builder/Shell.tsx";
import { WinProvider } from "./builder/state.tsx";
import { game } from "./data.ts";
import { Cover, Window } from "./kit.tsx";

const KEY = "keyhall-ui-builder-r4";
const NOTES = "keyhall-ui-builder-r4-notes";

function initial(): Layout {
  const fromUrl = fromHash(location.hash);
  if (fromUrl) return fromUrl;
  const saved = fromHash(localStorage.getItem(KEY) ?? "");
  return saved ?? DEFAULT;
}

function Fit({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() =>
      setScale(Math.min(1, el.clientWidth / 1440, (window.innerHeight - 48) / 900)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="min-w-0 flex-1">
      <div style={{ height: 900 * scale, width: 1440 * scale }} className="mx-auto">
        <div className="frame w-[1440px] origin-top-left" style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="py-3.5">
      <div className="mb-2 text-[12px] font-medium text-foreground/90">{label}</div>
      {children}
      {hint && (
        <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground text-pretty">{hint}</p>
      )}
    </div>
  );
}

function Segmented<V extends string>({
  name,
  options,
  value,
  onChange,
  disabled,
}: {
  name: string;
  options: readonly Option<V>[];
  value: V;
  onChange: (v: V) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      data-control={name}
      className={cn(
        "grid gap-0.5 rounded-lg bg-black/30 p-0.5 ring-1 ring-white/[0.06]",
        options.length === 3
          ? "grid-cols-3"
          : options.length === 4 && name === "page"
            ? "grid-cols-4"
            : "grid-cols-2",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          data-value={o.value}
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 truncate rounded-md px-1.5 text-[12px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
            value === o.value
              ? "bg-white/[0.1] font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
              : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const hintOf = <V extends string>(options: readonly Option<V>[], v: V) =>
  options.find((o) => o.value === v)!.hint;

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
  name,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  name: string;
}) {
  return (
    <label className={cn("flex items-center gap-3 py-2", disabled && "opacity-45")}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px]">{label}</div>
        {hint && <div className="text-[12px] text-muted-foreground">{hint}</div>}
      </div>
      <Switch
        data-control={name}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/[0.06] px-5 pt-4 pb-1">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </section>
  );
}

export function Page() {
  const [layout, setLayout] = useState<Layout>(initial);
  const [notes, setNotes] = useState(() => localStorage.getItem(NOTES) ?? "");
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<Layout>) => setLayout((l) => apply(l, patch));

  useEffect(() => {
    const hash = toHash(layout);
    if (location.hash !== hash) history.replaceState(null, "", hash);
    localStorage.setItem(KEY, hash);
  }, [layout]);
  useEffect(() => localStorage.setItem(NOTES, notes), [notes]);
  useEffect(() => {
    const onHash = () => {
      const next = fromHash(location.hash);
      if (next) setLayout(next);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const copy = async () => {
    const text = spec(layout, (id) => game(id).name, notes, location.href);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = Object.assign(document.createElement("textarea"), { value: text });
      document.body.append(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex min-h-screen items-start gap-6 bg-[#0b0c10] py-6 pl-6">
      <Fit>
        <Window className="shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          <WinProvider layout={layout} set={set}>
            <Shell />
          </WinProvider>
        </Window>
      </Fit>

      <aside className="no-scrollbar sticky top-0 -my-6 flex h-screen w-[340px] shrink-0 flex-col overflow-y-auto border-l border-white/[0.06] bg-[#111217]">
        <header className="px-5 pt-6 pb-4">
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Keyhall layout builder</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground text-pretty">
            Round 4 starts from your layout: a rail, the cover grid, the wide pane and the friends
            column. Sources moved out of the navigation into a filter bar, and a game can now open
            four ways. The window is live: click games, filters and the navigation.
          </p>
        </header>

        <Group title="Regions">
          <Field label="Navigation" hint={hintOf(NAV, layout.nav)}>
            <Segmented
              name="nav"
              options={NAV}
              value={layout.nav}
              onChange={(nav) => set({ nav })}
            />
          </Field>
          <Field label="Main area" hint={hintOf(MAIN, layout.main)}>
            <Segmented
              name="main"
              options={MAIN}
              value={layout.main}
              onChange={(main) => set({ main })}
            />
          </Field>
          <Field label="Filter bar" hint={hintOf(FILTERBAR, layout.filterbar)}>
            <Segmented
              name="filterbar"
              options={FILTERBAR}
              value={layout.filterbar}
              onChange={(filterbar) => set({ filterbar })}
            />
          </Field>
          <Field
            label="Game detail"
            hint={
              layout.selected
                ? hintOf(DETAIL, layout.detail)
                : `${hintOf(DETAIL, layout.detail)} Pick a game below or in the window to see it.`
            }
          >
            <Segmented
              name="detail"
              options={DETAIL}
              value={layout.detail}
              onChange={(detail) => set({ detail, page: "library" })}
            />
          </Field>
          <Field label="Detail sections">
            <div data-control="sections" className="flex flex-wrap gap-1.5">
              {SECTIONS.map((s) => {
                const on = layout.sections.includes(s.value);
                return (
                  <button
                    key={s.value}
                    aria-pressed={on}
                    data-value={s.value}
                    title={s.hint}
                    onClick={() =>
                      set({
                        sections: on
                          ? layout.sections.filter((x) => x !== s.value)
                          : SECTIONS.map((x) => x.value).filter(
                              (x) => x === s.value || layout.sections.includes(x),
                            ),
                      })
                    }
                    className={cn(
                      "flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] ring-1 transition-colors",
                      on
                        ? "bg-primary/[0.12] text-primary ring-primary/35"
                        : "text-muted-foreground ring-white/10 hover:text-foreground hover:ring-white/20",
                    )}
                  >
                    {on && <CheckIcon weight="bold" className="size-3" />}
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Bottom" hint={hintOf(BOTTOM, layout.bottom)}>
            <Segmented
              name="bottom"
              options={BOTTOM}
              value={layout.bottom}
              onChange={(bottom) => set({ bottom })}
            />
          </Field>
          <Field label="Friends" hint={hintOf(FRIENDS_AT, layout.friends)}>
            <Segmented
              name="friends"
              options={FRIENDS_AT}
              value={layout.friends}
              onChange={(friends) => set({ friends })}
            />
          </Field>
          <Field
            label="Running game"
            hint={`${hintOf(RUNNING_AT, layout.running)} Moves with Bottom: the dock and the status bar both hold it.`}
          >
            <Segmented
              name="running"
              options={RUNNING_AT}
              value={layout.running}
              onChange={(running) => set({ running })}
            />
          </Field>
          <Field label="Density">
            <Segmented
              name="density"
              options={DENSITY}
              value={layout.density}
              onChange={(density) => set({ density })}
            />
          </Field>
        </Group>

        <Group title="State">
          <Field label="Showing">
            <Segmented
              name="page"
              options={PAGES}
              value={layout.page}
              onChange={(page) => set({ page })}
            />
          </Field>
          <Toggle
            name="playing"
            label="A game is running"
            hint="Neon Sentinel, 23 min in"
            checked={layout.playing}
            onChange={(playing) => set({ playing })}
          />
          <Toggle
            name="signing"
            label="Signing request"
            hint={layout.playing ? "It asks to sign a score" : "Needs a running game"}
            checked={layout.signing}
            disabled={!layout.playing}
            onChange={(signing) => set({ signing })}
          />
          <Toggle
            name="filtered"
            label="Filters applied"
            hint="Multiplayer, signs through Keyhall, no Board-game table"
            checked={layout.filtered}
            onChange={(filtered) => set({ filtered })}
          />
          <Field label="Open game">
            <div data-control="selected" className="grid grid-cols-5 gap-1.5">
              {[null, ...SELECTABLE].map((id) => {
                const on = layout.selected === id;
                return (
                  <button
                    key={id ?? "none"}
                    data-value={id ?? "none"}
                    aria-pressed={on}
                    title={id ? game(id).name : "No game open"}
                    onClick={() => set({ selected: id, page: "library" })}
                    className={cn(
                      "aspect-[4/3] overflow-hidden rounded-md ring-1 transition-shadow",
                      on ? "ring-2 ring-primary" : "ring-white/10 hover:ring-white/30",
                    )}
                  >
                    {id ? (
                      <Cover game={game(id)} className="size-full" />
                    ) : (
                      <span className="grid size-full place-items-center bg-black/30 text-[11px] text-muted-foreground">
                        None
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              {layout.selected ? game(layout.selected).name : "No game open"}
            </p>
          </Field>
        </Group>

        <section className="mt-auto border-t border-white/[0.06] px-5 pt-4 pb-5">
          <label htmlFor="notes" className="text-[13px] font-semibold">
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What to keep, what to change"
            rows={3}
            className="mt-2 w-full resize-none rounded-lg bg-black/30 px-3 py-2 text-[13px] ring-1 ring-white/[0.08] outline-none placeholder:text-muted-foreground focus:ring-primary/60"
          />
          <div className="mt-3 flex gap-2">
            <Button id="copy-layout" className="flex-1" onClick={copy}>
              {copied ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <CopyIcon data-icon="inline-start" />
              )}
              {copied ? "Copied" : "Copy my layout"}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Reset to the round 4 start"
              title="Reset to the round 4 start"
              onClick={() => setLayout(DEFAULT)}
            >
              <ArrowCounterClockwiseIcon />
            </Button>
          </div>
        </section>
      </aside>
    </div>
  );
}
