// Real Windows Tauri/WebView2 workflow test. No model setup/inference or OS input.
// Prepare a separate --no-bundle QA executable with the requested native size.
// node scripts/check-phase4-desktop.mjs APP NEW_PROFILE EVIDENCE PLAYWRIGHT_ROOT LOCALE WIDTH HEIGHT
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const [appArg, homeArg, evidenceArg, dependencyArg, locale = "en", widthArg = "1280", heightArg = "720"] = process.argv.slice(2);
assert(appArg && homeArg && evidenceArg && dependencyArg, "Usage: APP NEW_PROFILE EVIDENCE PLAYWRIGHT_ROOT [en|pt-BR] WIDTH HEIGHT");
assert(["en", "pt-BR"].includes(locale));
const home = path.resolve(homeArg), app = path.resolve(appArg);
const stable = path.join(os.homedir(), ".sonariel");
const inside = (a, b) => a.toLowerCase() === b.toLowerCase() || a.toLowerCase().startsWith(b.toLowerCase() + path.sep);
assert(!inside(home, stable) && !inside(home, process.cwd()), "Use a new profile outside production and Git");
assert(!fs.existsSync(home), "Never reuse an existing profile");
assert(fs.existsSync(app));
const evidence = path.resolve(evidenceArg, path.basename(home));
assert(!fs.existsSync(evidence), "Preserve existing evidence");
fs.mkdirSync(evidence, { recursive: true });
fs.mkdirSync(home, { recursive: true });
fs.writeFileSync(path.join(home, "phase4-test.marker"), "Synthetic test profile; no production assets.\n");
const require = createRequire(path.resolve(dependencyArg, "phase4-loader.cjs"));
const { chromium } = require("playwright");
const catalogs = Object.fromEntries(["workspace", "studio", "storage", "library", "production", "common", "settings"].map(ns => [ns,
  JSON.parse(fs.readFileSync(path.join("src/i18n/locales", locale, `${ns}.json`), "utf8"))]));
const t = (ns, key, vars = {}) => {
  assert.equal(typeof catalogs[ns][key], "string", `Missing ${locale}/${ns}/${key}`);
  return catalogs[ns][key].replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
};
const hash = f => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const steps = [];
let info, browser, page, appProcess;
const fixtures = path.join(home, "fixtures");
fs.mkdirSync(fixtures);
function wav(name, frequency = 220) {
  const file = path.join(fixtures, name), samples = 12 * 24000, data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF"); data.writeUInt32LE(data.length - 8, 4); data.write("WAVEfmt ", 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(24000, 24); data.writeUInt32LE(48000, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write("data", 36); data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(2400 * Math.sin(2 * Math.PI * frequency * i / 24000)), 44 + i * 2);
  fs.writeFileSync(file, data, { flag: "wx" }); return file;
}
async function rpc(method, args = {}) {
  assert.equal(new URL(info.url).hostname, "127.0.0.1");
  const r = await fetch(info.url + "/rpc", { method: "POST", headers: { Authorization: "Bearer " + info.token, "Content-Type": "application/json" }, body: JSON.stringify({ method, args }) });
  const body = await r.json(); if (body.error) throw Error(`${method}: ${body.error}`); return body.result;
}
async function until(fn, label, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const result = await fn(); if (result) return result; await sleep(150); }
  throw Error("Timeout: " + label);
}
async function completed(id) {
  return until(async () => { const j = await rpc("job_get", { job_id: id });
    if (["error", "interrupted", "cancelled"].includes(j.state)) throw Error(JSON.stringify({ id, state: j.state, error: j.error }));
    return j.state === "completed" && j;
  }, "native DSP job " + id);
}
async function uiRender(preview) {
  const before = new Set((await rpc("snapshot")).jobs.map(j => j.id));
  await page.getByRole("button", { name: t("studio", preview ? "renderPreviewUpTo10S" : "renderFullVersion"), exact: true }).click();
  const job = await until(async () => (await rpc("snapshot")).jobs.find(j => !before.has(j.id)), "UI accepted one DSP job");
  const done = await completed(job.id); assert.equal(done.params.preview, preview); return done;
}
async function nav(key) { await page.getByRole("button", { name: t("workspace", key), exact: true }).click(); }
async function option(label, name) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
  await page.getByRole("listbox").waitFor({ state: "hidden" });
}
async function shot(name) {
  await page.locator(".rail").evaluate(element => { element.scrollTop = 0; });
  if (["projects", "library", "voice"].includes(name)) await page.locator("main").evaluate(element => { element.scrollTop = 0; });
  await sleep(350); // finish the existing short component transitions
  await page.screenshot({ path: path.join(evidence, `${name}-${locale}.png`) });
  const geometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, bodyOverflow: document.documentElement.scrollWidth > innerWidth }));
  assert.equal(geometry.width, Number(widthArg)); assert.equal(geometry.height, Number(heightArg)); assert(!geometry.bodyOverflow, name + " horizontal overflow");
}
const card = id => page.locator(`[data-asset-id="${id}"]`);
try {
  const socket = net.createServer(); await new Promise(r => socket.listen(0, "127.0.0.1", r));
  const port = socket.address().port; await new Promise(r => socket.close(r));
  appProcess = spawn(app, [], { windowsHide: true, stdio: "ignore", env: { ...process.env, SONARIEL_HOME: home,
    WEBVIEW2_USER_DATA_FOLDER: path.join(home, "webview"),
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-address=127.0.0.1 --remote-debugging-port=${port}` } });
  appProcess.unref();
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { return false; } }, "owned WebView2 CDP endpoint");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  page = await until(() => browser.contexts()[0].pages().find(p => p.url().startsWith("http://tauri.localhost/")), "actual Tauri page");
  assert(await page.evaluate(() => typeof window.__TAURI_INTERNALS__.invoke === "function"));
  await until(() => { try { info = JSON.parse(fs.readFileSync(path.join(home, "run/connection.json"), "utf8")); return info; } catch { return false; } }, "isolated core registry");
  await rpc("ui_preferences_save", { locale });
  const mcp = spawn(path.join(path.dirname(app), "runtime", "sonariel-core.exe"), ["mcp"], {
    windowsHide: true, env: { ...process.env, SONARIEL_HOME: home }, stdio: ["pipe", "pipe", "pipe"] });
  let protocolOutput = "", protocolErrors = "";
  mcp.stdout.on("data", chunk => protocolOutput += chunk);
  mcp.stderr.on("data", chunk => protocolErrors += chunk);
  const protocolExit = new Promise((resolve, reject) => { mcp.on("error", reject); mcp.on("exit", resolve); });
  mcp.stdin.end([
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "phase4-isolated-qa", version: "1" } } },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  ].map(v => JSON.stringify(v)).join("\n") + "\n");
  assert.equal(await protocolExit, 0, protocolErrors);
  const protocolReplies = protocolOutput.trim().split(/\r?\n/).map(line => JSON.parse(line));
  assert(protocolReplies.every(reply => !reply.error));
  const discovered = protocolReplies.find(reply => reply.id === 2).result.tools;
  const linkSchema = discovered.find(tool => tool.name === "sonariel_environment_link").inputSchema;
  assert.deepEqual(linkSchema.required, ["root"]); assert(linkSchema.properties.audacity_path);
  assert(!discovered.some(tool => tool.name === "sonariel_fx_loop_render"));
  fs.writeFileSync(path.join(evidence, "mcp-contract.json"), JSON.stringify({ tool_count: discovered.length, environment_link: linkSchema, handshake: protocolReplies[0].result.serverInfo, generation_requested: false }, null, 2));
  // Fixtures are prepared through RPC; workflow actions below use real UI.
  const alpha = (await rpc("project_create", { name: "Signal studies", context: "Synthetic Phase 4 fixtures only." })).project_id;
  const session = (await rpc("session_create", { project_id: alpha, name: "First exploration" })).session_id;
  const catalog = [];
  for (let i = 1; i <= 51; i++) catalog.push(await rpc("result_import", { project_id: alpha, session_id: session,
    path: wav(`catalog-${i}.wav`, 220 + i), name: `Catalog sample ${String(i).padStart(2, "0")}` }));
  const reference = await rpc("reference_register", { project_id: alpha, path: wav("reference.wav", 330), name: "Protected reference" });
  const beta = (await rpc("project_create", { name: "Other study" })).project_id;
  const betaSource = await rpc("result_import", { project_id: beta, path: wav("beta.wav", 440), name: "Other project source" });
  const seedJob = await rpc("fx_render", { asset_id: betaSource.id, request_key: crypto.randomUUID(),
    recipe: { name: "Fixture seed", schema_version: 1, output_channels: 2, tail_seconds: 0, bypass: false, chain: [{ wet: 1, effect: { type: "gain", db: -3 } }] } });
  const betaResult = (await completed(seedJob.job_id)).results[0];
  await rpc("result_feedback", { asset_id: betaResult.id, favorite: false, selected: true, notes: "Synthetic project choice" });
  await rpc("project_select", { project_id: alpha });
  const source = wav("ui-source.wav", 262), sourceHash = hash(source);
  await page.evaluate(() => localStorage.setItem("sonariel.workflow-guide.v1", "completed")); await page.reload();
  await page.getByRole("button", { name: t("workspace", "newProject"), exact: true }).click();
  await page.getByRole("textbox", { name: t("workspace", "projectName"), exact: true }).fill("UI study");
  await page.getByRole("button", { name: t("workspace", "createProject"), exact: true }).click();
  await until(async () => (await rpc("snapshot")).projects.some(p => p.name === "UI study"), "project created through UI");
  await page.getByRole("button", { name: t("workspace", "createMusic"), exact: true }).click();
  await page.getByRole("button", { name: t("workspace", "inspectAndLink"), exact: true }).waitFor();
  assert.equal(await page.getByRole("textbox", { name: t("workspace", "audacityExecutable"), exact: true }).count(), 0);
  await nav("projectsSessions");
  await page.getByRole("button", { name: t("workspace", "produceVoice"), exact: true }).click();
  await page.getByText(t("studio", "voiceSetupNext"), { exact: true }).waitFor();
  await page.getByRole("textbox", { name: t("studio", "profileName"), exact: true }).fill("Language-only study");
  await page.getByRole("combobox", { name: t("studio", "voiceProfileLanguage"), exact: true }).click();
  await page.getByRole("option", { name: /\(sw\)$/ }).click();
  await page.getByRole("button", { name: t("studio", "saveVoiceProfile"), exact: true }).click();
  await page.locator(".studio-result").filter({ has: page.getByText("Language-only study", { exact: true }) }).waitFor();
  await shot("voice");
  await nav("projectsSessions"); await option(t("workspace", "activeProject2"), "Signal studies"); await shot("projects");
  steps.push({ workflow: "A/B", pass: true, actions: "UI project creation and music/voice guidance; no engine setup or generation" });
  await page.getByRole("button", { name: t("workspace", "processExistingAudio"), exact: true }).click();
  const form = page.locator("form").filter({ has: page.getByRole("textbox", { name: t("workspace", "absoluteLocalPath"), exact: true }) });
  await form.getByRole("textbox", { name: t("workspace", "name"), exact: true }).fill("Imported source");
  await form.getByRole("textbox", { name: t("workspace", "absoluteLocalPath"), exact: true }).fill(source);
  await option(t("library", "importSession"), "First exploration");
  await form.getByRole("button", { name: t("workspace", "registerFile"), exact: true }).click();
  const imported = await until(async () => (await rpc("snapshot")).assets.find(a => a.name === "Imported source" && a.project_id === alpha), "WAV imported by UI");
  await card(imported.id).getByRole("button", { name: t("workspace", "openInFx"), exact: true }).click();
  assert((await page.getByRole("combobox", { name: t("studio", "wavToProcess"), exact: true }).innerText()).includes(imported.name));
  await page.getByRole("button", { name: t("studio", "addEffect"), exact: true }).click();
  await page.getByRole("spinbutton", { name: t("studio", "tailS"), exact: true }).fill("0");
  const previewJob = await uiRender(true), preview = previewJob.results[0]; assert.equal(preview.kind, "preview");
  await page.locator("audio").evaluate(e => e.muted = true);
  await page.locator(".studio-result").filter({ has: page.getByText(preview.name, { exact: true }) }).getByRole("button", { name: t("studio", "playVersion"), exact: true }).click();
  await page.waitForFunction(() => document.querySelector("audio")?.currentTime > .1);
  await page.getByRole("button", { name: t("workspace", "pauseAudio"), exact: true }).click();
  const fullJob = await uiRender(false), full = fullJob.results[0]; assert.equal(full.kind, "processed");
  await page.locator(".studio-result").filter({ has: page.getByText(full.name, { exact: true }) }).waitFor();
  const exportButton = page.getByRole("button", { name: t("studio", "exportWav"), exact: true });
  const destination = path.join(fixtures, "explicit-copy.wav");
  await page.getByRole("textbox", { name: t("studio", "newWavDestination"), exact: true }).fill(destination); assert(await exportButton.isDisabled());
  await page.getByRole("combobox", { name: t("studio", "versionToExport"), exact: true }).click();
  const options = await page.getByRole("option").allTextContents(); assert.equal(options.length, 2); assert(!options.some(o => o.includes(preview.id.slice(0, 8))));
  await page.getByRole("option").filter({ hasText: full.id.slice(0, 8) }).click(); await page.getByRole("listbox").waitFor({ state: "hidden" });
  await exportButton.click(); await until(() => fs.existsSync(destination) && hash(destination) === full.metadata.sha256, "export completed with verified bytes");
  assert.equal(hash(destination), full.metadata.sha256); assert.equal(hash(source), sourceHash); assert.notEqual(hash(destination), sourceHash); await shot("fx-export");
  // Module navigation must retain the current project's FX draft and player.
  await page.getByRole("spinbutton", { name: t("studio", "gainDb"), exact: true }).fill("-9");
  await nav("voiceStudio"); await nav("fxProcessing");
  assert.equal(await page.getByRole("spinbutton", { name: t("studio", "gainDb"), exact: true }).inputValue(), "-9");
  steps.push({ workflow: "C", pass: true, preview_job: previewJob.id, full_job: fullJob.id, export_asset: full.id,
    preview_key: previewJob.request_key, full_key: fullJob.request_key, exported_sha256: hash(destination), original_preserved: true, player_progressed_muted: true, fx_draft_retained: true });
  await nav("generationQueue");
  const history = page.locator("details.history-row").filter({ has: page.getByText(seedJob.job_id.slice(0, 10), { exact: true }) });
  await history.locator("summary").click(); await history.getByRole("button", { name: t("workspace", "listenToResult"), exact: true }).click();
  await until(async () => (await rpc("snapshot")).selected_project === beta, "player navigation chooses result project");
  await page.waitForFunction(id => document.querySelector("audio")?.src.includes(id), betaResult.id);
  await history.getByRole("button", { name: t("workspace", "openResultInLibrary"), exact: true }).click();
  await card(betaResult.id).waitFor(); assert.equal(await card(imported.id).count(), 0); await shot("queue-result");
  steps.push({ workflow: "D", pass: true, result_id: betaResult.id, project_id: beta, fixture_seeded_by_rpc: true });
  await nav("projectsSessions"); await option(t("workspace", "activeProject2"), "Signal studies");
  await page.getByRole("button", { name: t("workspace", "openSessionResults"), exact: true }).click();
  await page.getByText(t("workspace", "activeFiltersSummary") + ": First exploration", { exact: true }).waitFor();
  await nav("voiceStudio"); await nav("libraryVersions");
  await page.getByText(t("workspace", "activeFiltersSummary") + ": First exploration", { exact: true }).waitFor();
  assert.equal(await page.locator(".library-grid [data-asset-id]").count(), 50);
  const matchingCount = (await rpc("snapshot")).assets.filter(a => a.project_id === alpha && a.session_id === session && a.kind !== "preview").length;
  await page.getByRole("button", { name: t("library", "showMore", { shown: 50, total: matchingCount }), exact: true }).click();
  assert((await page.locator(".library-grid [data-asset-id]").count()) > 50);
  steps.push({ workflow: "E", pass: true, session_id: session, filters_retained: true, pagination_expanded: true });
  const favorite = catalog.at(-1);
  await card(imported.id).getByRole("checkbox", { name: t("workspace", "compare"), exact: true }).check();
  await card(favorite.id).getByRole("checkbox", { name: t("workspace", "compare"), exact: true }).check();
  await card(favorite.id).getByRole("button", { name: t("production", "favoriteAsset", { name: favorite.name }), exact: true }).click();
  await until(async () => (await rpc("snapshot")).assets.find(a => a.id === favorite.id)?.favorite, "favorite saved before opening details");
  await card(favorite.id).getByRole("button", { name: t("workspace", "details"), exact: true }).click();
  const details = page.getByRole("dialog"); await details.waitFor();
  await details.getByRole("button", { name: t("workspace", "selectVersion"), exact: true }).click();
  await until(async () => (await rpc("snapshot")).assets.some(a => a.id === favorite.id && a.selected && a.favorite), "favorite and per-project choice persisted");
  await page.keyboard.press("Escape"); await details.waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), t("workspace", "details"));
  await card(imported.id).getByRole("checkbox", { name: t("library", "selectCandidate", { name: imported.name }), exact: true }).check();
  assert.equal(await page.getByRole("checkbox", { name: t("workspace", "compare"), exact: true }).evaluateAll(es => es.filter(e => e.checked).length), 2);
  await page.getByRole("heading", { name: t("production", "batchExport"), exact: true }).waitFor(); await shot("library");
  assert((await rpc("snapshot")).assets.some(a => a.id === betaResult.id && a.selected));
  steps.push({ workflow: "F", pass: true, choice: favorite.id, comparison_count: 2, batch_count: 1, focus_restored: true, other_project_choice_preserved: true });
  await nav("audacityCodex");
  await page.getByText(t("workspace", "agentAndEditorScope"), { exact: true }).waitFor();
  await page.getByText(t("workspace", "audacityUnavailableHelp"), { exact: true }).waitFor();
  steps.push({ workflow: "H", pass: true, editor_optional: true, no_probe_or_configuration_performed: true });
  await nav("environment");
  await page.getByText(t("studio", "setUpStableAudio3ExperimentalLitertCpu"), { exact: true }).click();
  await option(t("studio", "stableAudioFamily"), "Medium");
  await option(t("studio", "qualityProfile"), t("studio", "fidelityProfile"));
  await page.getByText(t("studio", "fidelityIntro"), { exact: true }).waitFor();
  await page.getByRole("textbox", { name: t("studio", "newDedicatedFolderOutsideGit"), exact: true }).fill(path.join(home, "never-installed"));
  await page.getByRole("button", { name: t("studio", "reviewLitertRecipe"), exact: true }).click();
  await page.getByText(t("studio", "fidelityDownload"), { exact: true }).waitFor();
  assert(await page.getByRole("button", { name: t("studio", "installLitertCpu"), exact: true }).isDisabled());
  assert(!fs.existsSync(path.join(home, "never-installed"))); await shot("setup");
  steps.push({ workflow: "I", pass: true, optional_fp32_reviewed: true, install_disabled_without_authorization: true, models_downloaded: false });
  await nav("storage");
  const discardable = catalog.at(-2), physicalPath = discardable.path, digest = hash(physicalPath);
  assert(await page.getByRole("checkbox", { name: t("storage", "selectValue", { value0: favorite.name }), exact: true }).isDisabled());
  assert(await page.getByRole("checkbox", { name: t("storage", "selectValue", { value0: "Protected reference" }), exact: true }).isDisabled());
  const select = () => page.getByRole("checkbox", { name: t("storage", "selectValue", { value0: discardable.name }), exact: true });
  const reviewDiscard = () => page.getByRole("button", { name: t("storage", "reviewDiscard") + "1)", exact: true });
  await select().check(); await page.getByRole("checkbox", { name: t("storage", "moveExternalFiles"), exact: true }).check(); await reviewDiscard().click();
  let dialog = page.getByRole("dialog"); await dialog.getByText(physicalPath, { exact: true }).waitFor();
  await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" }); assert.equal(hash(physicalPath), digest);
  await reviewDiscard().click(); await page.getByRole("button", { name: t("common", "confirmRecoverableDiscard"), exact: true }).click();
  await until(async () => (await rpc("storage_list")).items.find(a => a.id === discardable.id && a.trashed), "actual imported file moved"); assert(!fs.existsSync(physicalPath));
  await page.getByRole("button", { name: t("storage", "recoverableTrash"), exact: true }).click();
  await page.getByRole("button", { name: t("storage", "restore"), exact: true }).click(); await until(() => fs.existsSync(physicalPath), "physical restore"); assert.equal(hash(physicalPath), digest);
  await page.getByRole("button", { name: t("storage", "available"), exact: true }).click();
  await select().check(); await page.getByRole("checkbox", { name: t("storage", "moveExternalFiles"), exact: true }).check(); await reviewDiscard().click();
  await page.getByRole("button", { name: t("common", "confirmRecoverableDiscard"), exact: true }).click();
  const item = await until(async () => (await rpc("storage_list")).items.find(a => a.id === discardable.id && a.trashed), "second reviewed discard");
  await page.getByRole("button", { name: t("storage", "recoverableTrash"), exact: true }).click(); await select().check();
  await page.getByRole("button", { name: t("storage", "reviewPermanentDeletion") + "1)", exact: true }).click();
  dialog = page.getByRole("dialog"); await dialog.getByText(item.trash_path, { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), t("common", "keepFiles")); await shot("storage-confirm");
  await dialog.getByRole("button", { name: t("storage", "confirmPermanentDeletion"), exact: true }).click();
  await until(() => !fs.existsSync(item.trash_path), "actual permanent unlink"); assert(!fs.existsSync(physicalPath));
  assert.equal(hash(source), sourceHash); assert.equal(hash(reference.path), reference.metadata.sha256);
  const snapshot = await rpc("snapshot"); assert.equal(snapshot.capabilities.loop_creation, false);
  assert.equal(snapshot.engine.managed, false); assert(!snapshot.environment); assert(!snapshot.voice_environment);
  steps.push({ workflow: "J", pass: true, cancel_preserved: true, moved_restored_purged: discardable.id, protected_controls: true, original_and_reference_preserved: true });
  // Swap language through the real settings control, then verify retained context.
  await page.getByRole("button", { name: t("settings", "title"), exact: true }).click();
  const nextLocale = locale === "en" ? "pt-BR" : "en";
  const languageOption = nextLocale === "en" ? "English" : "Português (Brasil)";
  await option(t("settings", "language"), languageOption);
  await until(async () => (await rpc("snapshot")).ui_preferences.locale === nextLocale, "language saved through UI");
  await page.keyboard.press("Escape"); assert.equal(await page.locator("html").getAttribute("lang"), nextLocale);
  fs.writeFileSync(path.join(evidence, "receipt.json"), JSON.stringify({ surface: "actual Windows Tauri/WebView2", source_origin: page.url(), native_ipc: true, width: Number(widthArg), height: Number(heightArg), locale,
    ui_workflows: steps, G: "covered by synthetic React/queue-state tests; no generative job submitted", language_switched_to: nextLocale,
    fixture_seed_rpc_job: seedJob.job_id, no_music_or_voice_inference: true, models_installed: false, original_sha256: sourceHash }, null, 2));
  console.log(JSON.stringify({ surface: "native Tauri", locale, width: Number(widthArg), height: Number(heightArg), workflows: steps.map(s => s.workflow), receipt: path.join(evidence, "receipt.json") }));
} catch (error) {
  if (page) { await page.screenshot({ path: path.join(evidence, "failure.png") }).catch(() => {});
    fs.writeFileSync(path.join(evidence, "failure.txt"), String(error) + "\n" + await page.locator("main").innerText().catch(() => "")); }
  throw error;
} finally {
  // Close only the owned QA app/window and its isolated core, never force-kill.
  if (page && !page.isClosed()) { try { await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("plugin:window|close", { label: "main" })); } catch (error) { if (!String(error).includes("closed")) console.error("QA window close:", String(error)); } }
  if (info) await rpc("__desktop_prepare_update").catch(error => console.error("QA core preserved:", String(error)));
  if (browser) await browser.close().catch(() => {});
}
