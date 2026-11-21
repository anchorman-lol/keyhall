// Headless check of an exported page: check.mjs <file.html> <shots-dir>
import { chromium, firefox } from "playwright-core";
import { mkdirSync, readdirSync } from "node:fs";

const [file, shots] = process.argv.slice(2);
const url = `file://${file}`;
mkdirSync(shots, { recursive: true });
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

for (const [name, launch] of Object.entries(browsers)) {
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const external = [];
  const errors = [];
  page.on("request", (r) => !/^(file|data|blob):/.test(r.url()) && external.push(r.url()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url);
  await page.waitForSelector(".frame");
  await page.evaluate(async () => {
    for (const el of document.querySelectorAll(".frame")) {
      el.scrollIntoView();
      await new Promise((r) => setTimeout(r, 50));
    }
    await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
  });
  const imgs = await page.evaluate(() => {
    const all = [...document.images];
    return {
      total: all.length,
      broken: all.filter((i) => !(i.naturalWidth > 0)).map((i) => i.getAttribute("src")),
    };
  });
  const frames = await page
    .locator(".frame")
    .evaluateAll((els) =>
      els.map(
        (e) =>
          `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`,
      ),
    );

  await page.locator(".pick").nth(1).getByRole("switch").click();
  await page.locator(".pick textarea").nth(3).fill("inspector, but with the dock");
  await page.reload();
  await page.waitForSelector(".frame");
  const kept = await page.evaluate(() => ({
    pick2:
      document.querySelectorAll(".pick [role=switch]")[1].getAttribute("aria-checked") ??
      document.querySelectorAll(".pick [role=switch]")[1].dataset.checked,
    note4: document.querySelectorAll(".pick textarea")[3].value,
  }));
  let copied = "(clipboard not readable in this browser)";
  if (name === "chromium") {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.click("#copy-picks");
    copied = await page.evaluate(() => navigator.clipboard.readText());
    for (let i = 0; i < frames.length; i++)
      await page
        .locator(".frame")
        .nth(i)
        .screenshot({ path: `${shots}/layout-${i + 1}.png`, animations: "disabled" });
  }
  await page.evaluate(() => localStorage.clear());

  console.log(
    `[${name}] images ${imgs.total}, broken ${imgs.broken.length} ${imgs.broken.join(" ")}`,
  );
  console.log(`[${name}] frames ${frames.length}: ${frames.join(", ")}`);
  console.log(`[${name}] external requests ${external.length} ${external.slice(0, 5).join(" ")}`);
  console.log(`[${name}] page errors ${errors.length} ${errors.slice(0, 5).join(" | ")}`);
  console.log(`[${name}] after reload: pick 2 = ${kept.pick2}, note 4 = "${kept.note4}"`);
  if (name === "chromium") console.log(`[${name}] copy picks:\n${copied}`);
  await browser.close();
}
