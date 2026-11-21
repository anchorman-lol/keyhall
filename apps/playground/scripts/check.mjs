// Headless check of the exported builder: check.mjs <file.html> <shots-dir>
// For each combination: regions tile the window (no overlap, no gap), no text overlaps or
// overflows its box, no broken images; plus no external requests or page errors overall.
import { chromium, firefox } from "playwright-core";
import { mkdirSync, readdirSync } from "node:fs";

const [file, shots] = process.argv.slice(2);
mkdirSync(shots, { recursive: true });

const base = {
  sidebar: "sources",
  main: "list",
  inspector: "pane",
  sections: "trust,stats,friends,listing",
  bottom: "dock",
  friends: "sidebar",
  running: "dock",
  density: "comfortable",
  playing: "true",
  signing: "false",
  selected: "forgerealms",
};
export const COMBOS = [
  ["default-124", {}],
  ["default-signing", { signing: "true" }],
  [
    "column-wide-dock",
    { friends: "column", inspector: "wide", sections: "trust,stats,friends,signatures,listing" },
  ],
  [
    "switches-grid-status",
    {
      sidebar: "switches",
      main: "grid",
      bottom: "status",
      running: "status",
      friends: "column",
      selected: "nochess",
    },
  ],
  [
    "status-signing-compact",
    {
      sidebar: "switches",
      bottom: "status",
      running: "status",
      signing: "true",
      density: "compact",
      friends: "column",
    },
  ],
  [
    "rail-grid-only",
    {
      sidebar: "rail",
      main: "grid",
      inspector: "none",
      bottom: "none",
      running: "sidebar",
      friends: "none",
    },
  ],
  [
    "rail-sidebar-signing",
    {
      sidebar: "rail",
      bottom: "none",
      running: "sidebar",
      signing: "true",
      friends: "sidebar",
      selected: "pallasite",
    },
  ],
  ["card-signing", { bottom: "status", running: "sidebar", signing: "true", friends: "sidebar" }],
  [
    "card-compact-inspector-friends",
    {
      sidebar: "switches",
      bottom: "none",
      running: "sidebar",
      friends: "inspector",
      density: "compact",
      sections: "trust,friends,signatures",
    },
  ],
  ["not-running-dock", { playing: "false", friends: "column" }],
  [
    "no-selection-list",
    { selected: "none", friends: "column", bottom: "status", running: "status" },
  ],
  [
    "grid-wide-running",
    { main: "grid", inspector: "wide", selected: "neonsentinel", sections: "stats,signatures" },
  ],
  [
    "rail-wide-column",
    {
      sidebar: "rail",
      inspector: "wide",
      friends: "column",
      bottom: "status",
      running: "status",
      selected: "nochess",
      density: "compact",
    },
  ],
  [
    "list-no-inspector",
    { inspector: "none", friends: "none", bottom: "status", running: "status", playing: "false" },
  ],
  ["no-sections", { sections: "", selected: "pallasite", sidebar: "switches" }],
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
    const scroller = el.closest("[data-scroll]");
    const s = scroller?.getBoundingClientRect();
    for (const r of range.getClientRects()) {
      if (r.width < 1 || r.height < 1) continue;
      const label = n.textContent.trim().slice(0, 40);
      // Rows scrolled past the edge of a scrolling list are meant to be out of view.
      if (s && (r.top < s.top - 1 || r.bottom > s.bottom + 1)) continue;
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
  for (const [id, patch] of COMBOS) {
    await page.evaluate((h) => (location.hash = h), hash(patch));
    await page.waitForTimeout(120);
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
  }

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

  console.log(`[${name}] combinations ${COMBOS.length}, layout problems ${problems}`);
  console.log(`[${name}] images ${images}, broken ${broken}`);
  console.log(`[${name}] external requests ${external.length} ${external.slice(0, 5).join(" ")}`);
  console.log(`[${name}] page errors ${errors.length} ${errors.slice(0, 5).join(" | ")}`);
  console.log(`[${name}] after reload: ${keptOk ? "kept" : "LOST"} selection, bottom and notes`);
  if (name === "chromium") console.log(`[${name}] copy my layout:\n${copied}`);
  failed += problems + broken + external.length + errors.length + (keptOk ? 0 : 1);
  await browser.close();
}
process.exit(failed ? 1 : 0);
