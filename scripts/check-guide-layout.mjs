// Run against the local dev app. Optional argv[2]: external directory containing playwright.
// Uses a disposable browser profile; never changes the desktop's tutorial preference.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(
  path.resolve(process.argv[2] ?? ".", "layout-check.cjs"),
);
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "msedge", headless: true });

async function sampleClick(page, button) {
  await page.evaluate(() => {
    window.guideSamples = new Promise((resolve) => {
      document.addEventListener(
        "click",
        () => {
          const start = performance.now();
          const frames = [];
          function sample() {
            const dialog = document.querySelector(".workflow-guide");
            const fill = document.querySelector(".guide-progress > span");
            frames.push({
              overflow: dialog.scrollWidth - dialog.clientWidth,
              scale: new DOMMatrixReadOnly(getComputedStyle(fill).transform).a,
            });
            if (performance.now() - start < 380) requestAnimationFrame(sample);
            else resolve(frames);
          }
          requestAnimationFrame(sample);
        },
        { once: true, capture: true },
      );
    });
  });
  await button.click();
  return page.evaluate(() => window.guideSamples);
}

try {
  for (const viewport of [
    { width: 1440, height: 940 },
    { width: 1000, height: 700 },
    { width: 1000, height: 520 },
  ]) {
    const page = await browser.newPage({
      viewport,
      reducedMotion: "no-preference",
    });
    await page.goto("http://127.0.0.1:1420");
    await page.getByRole("dialog", { name: "Conheça o Sonariel" }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const next = page.getByRole("button", { name: "Próximo passo" });
    // Establish the regression with the original overflow rules, in the disposable page only.
    const oldRules = await page.addStyleTag({
      content:
        ".workflow-guide { overflow: auto } .guide-step-viewport { overflow: visible }",
    });
    const reproduced = await sampleClick(page, next);
    assert(
      reproduced.some((frame) => frame.overflow > 0),
      "Original CSS should reproduce transient horizontal overflow",
    );
    await oldRules.evaluate((element) => element.remove());
    await page.getByRole("button", { name: "Passo anterior" }).click();
    let framesChecked = 0;
    let smoothProgress = false;
    for (let index = 0; index < 5; index++) {
      const frames = await sampleClick(page, next);
      assert(
        frames.every((frame) => frame.overflow === 0),
        "Horizontal overflow during forward animation",
      );
      if (index === 0)
        smoothProgress = frames.some(
          (frame) => frame.scale > 1 / 6 + 0.001 && frame.scale < 2 / 6 - 0.001,
        );
      framesChecked += frames.length;
    }
    assert(smoothProgress, "Progress should interpolate instead of jumping");
    for (let index = 0; index < 5; index++) {
      const frames = await sampleClick(
        page,
        page.getByRole("button", { name: "Passo anterior" }),
      );
      assert(
        frames.every((frame) => frame.overflow === 0),
        "Horizontal overflow during reverse animation",
      );
      framesChecked += frames.length;
    }
    const vertical = await page.evaluate(() => {
      const dialog = document.querySelector(".workflow-guide");
      dialog.scrollTop = dialog.scrollHeight;
      const footer = dialog
        .querySelector(".guide-actions")
        .getBoundingClientRect();
      const bounds = dialog.getBoundingClientRect();
      return {
        scrollable: dialog.scrollHeight > dialog.clientHeight,
        overflowY: getComputedStyle(dialog).overflowY,
        footerVisible:
          footer.bottom <= bounds.bottom && footer.top >= bounds.top,
      };
    });
    assert.equal(vertical.overflowY, "auto");
    assert(
      vertical.footerVisible,
      "Footer must remain reachable on short windows",
    );
    if (viewport.height === 520)
      assert(
        vertical.scrollable,
        "Short dialog should retain vertical scrolling",
      );
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector(".guide-progress > span"))
          .transitionDuration,
    );
    assert.equal(reduced, "0s");
    console.log(
      JSON.stringify({
        viewport,
        reproducedOldOverflow: true,
        framesChecked,
        smoothProgress,
        ...vertical,
        reducedMotion: true,
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
