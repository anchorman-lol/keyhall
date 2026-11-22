// Headless check of the exported builder: check.mjs <file.html> <shots-dir>
// For each combination: regions tile the window (no overlap, no gap), no text overlaps or
// overflows its box, no broken images; plus no external requests or page errors overall.
import { chromium, firefox } from "playwright-core";
import { mkdirSync, readdirSync } from "node:fs";

const [file, shots] = process.argv.slice(2);
mkdirSync(shots, { recursive: true });

const base = {
  nav: "labels",
  main: "grid",
  filterbar: "toolbar",
  detail: "wide",
  sections: "trust,stats,friends,signatures,listing",
  bottom: "none",
  friends: "column",
  running: "nav",
  density: "comfortable",
  page: "library",
  playing: "true",
  signing: "false",
  filtered: "false",
  selected: "forgerealms",
};
const status = { bottom: "status", running: "status" };
const dock = { bottom: "dock", running: "dock" };
export const COMBOS = [
  ["default", {}],
  ["default-signing", { signing: "true" }],
  ["hover-page-chips", { nav: "hover", detail: "page", filterbar: "chips", selected: "nochess" }],
  ["sidebar-expand-signing", { nav: "sidebar", detail: "expand", friends: "nav", signing: "true" }],
  [
    "icons-sheet-tabs",
    { nav: "icons", detail: "sheet", filterbar: "tabs", friends: "nav", selected: "pallasite" },
  ],
  ["list-expand-dock", { main: "list", detail: "expand", ...dock, selected: "nochess" }],
  ["dock-signing-sheet", { ...dock, signing: "true", detail: "sheet", filterbar: "chips" }],
  [
    "status-compact-wide-list",
    { ...status, density: "compact", main: "list", filterbar: "tabs", signing: "true" },
  ],
  ["filtered-toolbar-wide", { filtered: "true", selected: "xenophon" }],
  [
    "filtered-chips-expand-compact",
    {
      filtered: "true",
      filterbar: "chips",
      detail: "expand",
      density: "compact",
      selected: "nomad",
    },
  ],
  ["filtered-tabs-none", { filtered: "true", filterbar: "tabs", selected: "none", nav: "hover" }],
  ["friends-page-sidebar", { page: "friends", nav: "sidebar", ...status }],
  ["budget-page-hover", { page: "budget", nav: "hover", ...dock }],
  ["settings-page-icons", { page: "settings", nav: "icons", friends: "page" }],
  [
    "not-running-game-page",
    { playing: "false", ...dock, detail: "page", friends: "page", selected: "neonsentinel" },
  ],
  ["no-sections-sheet", { sections: "", detail: "sheet", nav: "sidebar", friends: "page" }],
  [
    "sidebar-page-compact-dock",
    { nav: "sidebar", detail: "page", density: "compact", ...dock, friends: "nav" },
  ],
  ["list-none-hover-nav", { main: "list", selected: "none", nav: "hover", friends: "nav" }],
  ["list-sheet-status-tabs", { main: "list", detail: "sheet", filterbar: "tabs", ...status }],
];
// States a hash can't hold: [name, combo patch, what to do on the page].
const INTERACTIONS = [
  [
    "hover-rail-open",
    { nav: "hover", friends: "nav", selected: "none" },
    (p) => p.hover("[data-hover-rail]"),
  ],
  [
    "hover-rail-signing",
    { nav: "hover", signing: "true", detail: "sheet" },
    (p) => p.hover("[data-hover-rail]"),
  ],
  ["sources-menu-open", { selected: "none" }, (p) => p.click('[data-menu="Sources"] button')],
  ["filters-menu-open", { filtered: "true" }, (p) => p.click('[data-menu="Filters"] button')],
  ["search-no-match", { selected: "none" }, (p) => p.fill("[data-search]:visible", "zzz")],
];
const hash = (patch) =>
  `#${new URLSearchParams({ ...base, ...patch }).toString().replaceAll("%2C", ",")}`;

const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const latest = (prefix) =>
  readdirSync(cache)
    .filter((d) => d.startsWith(prefix))
    .sort()
    .at(-1);
const browsers = {
  chromium: () =>
    chromium.launch({
      executablePath: `${cache}/${latest("chromium-")}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
    }),
  firefox: () =>
    firefox.launch({
      executablePath: `${cache}/${latest("firefox-")}/firefox/Nightly.app/Contents/MacOS/firefox`,
    }),
};

function inspect() {
  const win = document.querySelector(".frame > div");
  const W = win.getBoundingClientRect();
  const problems = [];
  const area = (r) => Math.max(0, r.width) * Math.max(0, r.height);
  const inter = (a, b) => ({
    width: Math.min(a.right, b.right) - Math.max(a.left, b.left),
    height: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
  });

  const regions = [...win.querySelectorAll("[data-region]")].map((el) => ({
    name: el.dataset.region,
    r: el.getBoundingClientRect(),
  }));
  let covered = 0;
  for (const [i, a] of regions.entries()) {
    covered += area(a.r);
    if (
      a.r.left < W.left - 0.5 ||
      a.r.right > W.right + 0.5 ||
      a.r.top < W.top - 0.5 ||
      a.r.bottom > W.bottom + 0.5
    )
      problems.push(`region ${a.name} leaves the window`);
    for (const b of regions.slice(i + 1))
      if (area(inter(a.r, b.r)) > 1) problems.push(`regions ${a.name} and ${b.name} overlap`);
  }
  if (Math.abs(covered - area(W)) > W.width)
    problems.push(`regions leave ${Math.round(area(W) - covered)} px² uncovered`);

  const clipper = (el) => {
    for (let p = el.parentElement; p && p !== win; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX !== "visible" || s.overflowY !== "visible") return p;
    }
    return win;
  };
  const truncates = (el) => {
    for (let p = el; p && p !== win; p = p.parentElement)
      if (getComputedStyle(p).textOverflow === "ellipsis") return true;
    return false;
  };
  const visible = (el) => {
    for (let p = el; p && p !== win; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
    }
    return true;
  };

  const texts = [];
  const walker = document.createTreeWalker(win, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.textContent.trim() || !visible(n.parentElement)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    const el = n.parentElement;
    const clip = clipper(el);
    const c = clip.getBoundingClientRect();
    const s = el.closest("[data-scroll]")?.getBoundingClientRect();
    const sideways = el.closest("[data-scroll-x]")?.getBoundingClientRect();
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      const label = n.textContent.trim().slice(0, 40);
      // Rows scrolled past the edge of a scrolling list are meant to be out of view,
      // and so are chips scrolled past the side of a horizontal scroller.
      if (s && (r.top < s.top - 1 || r.bottom > s.bottom + 1)) continue;
      if (sideways && (r.left < sideways.left - 1 || r.right > sideways.right + 1)) continue;
      // Text under an overlay (a sheet, a menu, the open hover rail) is covered, not overlapping.
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top || !(el.contains(top) || top.contains(el))) continue;
      const outX = r.left < c.left - 1 || r.right > c.right + 1;
      const outY = r.top < c.top - 1 || r.bottom > c.bottom + 1;
      if (outX && !truncates(el)) problems.push(`text "${label}" overflows sideways`);
      if (outY) problems.push(`text "${label}" is cut off vertically`);
      texts.push({ label, r, el });
    }
  }
  for (const [i, a] of texts.entries())
    for (const b of texts.slice(i + 1)) {
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const o = inter(a.r, b.r);
      if (o.width > 1.5 && o.height > 1.5) problems.push(`text "${a.label}" overlaps "${b.label}"`);
    }

  const imgs = [...win.querySelectorAll("img")];
  const broken = imgs
    .filter((i) => !(i.complete && i.naturalWidth > 0))
    .map((i) => i.getAttribute("src"));
  return {
    problems: [...new Set(problems)],
    images: imgs.length,
    broken,
    size: `${Math.round(W.width)}x${Math.round(W.height)}`,
    regions: regions.map((r) => `${r.name}:${Math.round(r.r.width)}`).join(" "),
  };
}

let failed = 0;
for (const [name, launch] of Object.entries(browsers)) {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1860, height: 1000 } });
  const external = [];
  const errors = [];
  page.on("request", (r) => !/^(file|data|blob):/.test(r.url()) && external.push(r.url()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`file://${file}`);
  await page.waitForSelector("[data-region]");

  let problems = 0;
  let images = 0;
  let broken = 0;
  const run = async (id, patch, act) => {
    await page.evaluate((h) => (location.hash = h), hash(patch));
    await page.waitForTimeout(120);
    if (act) {
      await act(page);
      await page.waitForTimeout(400);
    }
    await page.evaluate(() =>
      Promise.all([...document.images].map((i) => i.decode().catch(() => {}))),
    );
    const r = await page.evaluate(inspect);
    problems += r.problems.length;
    images += r.images;
    broken += r.broken.length;
    const flag = r.problems.length || r.broken.length ? "FAIL" : "ok  ";
    console.log(`[${name}] ${flag} ${id.padEnd(32)} ${r.size} ${r.regions}`);
    for (const p of r.problems.slice(0, 8)) console.log(`         ${p}`);
    for (const b of r.broken) console.log(`         broken image ${b}`);
    if (name === "chromium")
      await page
        .locator(".frame > div")
        .screenshot({ path: `${shots}/${id}.png`, animations: "disabled" });
    if (act) {
      await page.mouse.move(1850, 990);
      await page.keyboard.press("Escape");
      await page.evaluate(() => document.activeElement?.blur());
      await page.fill("[data-search]:visible", "");
    }
  };
  for (const [id, patch] of COMBOS) await run(id, patch);
  for (const [id, patch, act] of INTERACTIONS) await run(id, patch, act);

  await page.evaluate((h) => (location.hash = h), hash({}));
  if (name === "chromium") {
    await page.setViewportSize({ width: 1728, height: 1050 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${shots}/page.png` });
    await page.setViewportSize({ width: 1860, height: 1000 });
  }
  await page.locator('[data-game="nochess"]').first().click();
  await page.locator('[data-control="bottom"] [data-value="status"]').click();
  await page.fill("#notes", "dock, but thinner");
  await page.reload();
  await page.waitForSelector("[data-region]");
  const kept = await page.evaluate(() => ({
    hash: location.hash,
    notes: document.querySelector("#notes").value,
    bottom: document.querySelector('[data-control="bottom"] [aria-checked="true"]').dataset.value,
  }));
  const keptOk =
    kept.hash.includes("selected=nochess") &&
    kept.bottom === "status" &&
    kept.notes === "dock, but thinner";
  let copied = "(clipboard not readable in this browser)";
  if (name === "chromium") {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.click("#copy-layout");
    copied = await page.evaluate(() => navigator.clipboard.readText());
  }
  await page.evaluate(() => localStorage.clear());

  console.log(
    `[${name}] combinations ${COMBOS.length} + ${INTERACTIONS.length} interactions, layout problems ${problems}`,
  );
  console.log(`[${name}] images ${images}, broken ${broken}`);
  console.log(`[${name}] external requests ${external.length} ${external.slice(0, 5).join(" ")}`);
  console.log(`[${name}] page errors ${errors.length} ${errors.slice(0, 5).join(" | ")}`);
  console.log(`[${name}] after reload: ${keptOk ? "kept" : "LOST"} selection, bottom and notes`);
  if (name === "chromium") console.log(`[${name}] copy my layout:\n${copied}`);
  failed += problems + broken + external.length + errors.length + (keptOk ? 0 : 1);
  await browser.close();
}
process.exit(failed ? 1 : 0);
