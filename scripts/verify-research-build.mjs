// Release invariants: no missing source links, mismatched narration, or external assets.
// Run after npm run build. Browser interaction checks are performed separately.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { narrationHash, importedTracks } from "./ondoku-audio.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const imported = await importedTracks(await narrationHash());
const bundle = await build({
  absWorkingDir: root,
  entryPoints: ["src/research/papers.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { PAPERS, searchPapers, parseSavedPaperIds } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

assert(PAPERS.length >= 4, "A usable starter library needs at least four curated papers");
assert.equal(new Set(PAPERS.map((paper) => paper.id)).size, PAPERS.length, "Paper identifiers must be unique");
const sceneKeys = ["question", "input", "process", "caution", "observation", "interpretation", "conclusion"];
for (const paper of PAPERS) {
  assert(paper.title && paper.titleJa && paper.abstractJa && paper.authors.length);
  assert(Number.isInteger(paper.year) && paper.year >= 1900 && paper.year <= new Date().getFullYear());
  for (const href of [paper.sourceUrl, paper.pdfUrl]) {
    const url = new URL(href);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "arxiv.org");
    assert(url.pathname.includes(paper.arxivId), `Source link must identify ${paper.id}`);
  }
  assert.deepEqual(paper.scenes.map((scene) => scene.key), sceneKeys);
  for (const scene of paper.scenes) assert(scene.body && scene.heading && scene.sourceNote);
  assert.equal(paper.audioStatus, "not-recorded", "LP demo audio must not be assigned to real papers");
  assert(searchPapers(PAPERS, paper.arxivId).some((found) => found.id === paper.id));
}
assert.equal(searchPapers(PAPERS, "\u3000  ").length, PAPERS.length);
assert.equal(searchPapers(PAPERS, "___no_such_paper___").length, 0);
assert.deepEqual(parseSavedPaperIds("{invalid json"), []);
assert.deepEqual(parseSavedPaperIds('{"injected":true}'), []);
assert.deepEqual(parseSavedPaperIds(JSON.stringify([PAPERS[0].id, PAPERS[0].id, "unknown", null])), [PAPERS[0].id]);

const settingsBundle = await build({
  absWorkingDir: root,
  entryPoints: ["src/character/motion-settings.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { normalizeMotionSettings, parseMotionSettings, DEFAULT_MOTION } = await import(
  `data:text/javascript;base64,${Buffer.from(settingsBundle.outputFiles[0].text).toString("base64")}`
);
assert.deepEqual(parseMotionSettings("{malformed"), DEFAULT_MOTION);
assert.deepEqual(parseMotionSettings(JSON.stringify({ intensity: 1000, tempo: -10, props: -5 })), { intensity: 100, tempo: 0.6, props: 0 });
assert.deepEqual(normalizeMotionSettings({ intensity: "100", tempo: NaN, props: null }), DEFAULT_MOTION);

for (const file of ["dist/index.html", "standalone-offline.html"]) {
  const html = await readFile(`${root}${file}`, "utf8");
  assert(html.includes('id="research-library"'), `${file}: no library mount`);
  assert(html.includes('href="#research-library"'), `${file}: no LP entry link`);
  assert(html.includes("data-motion-controls"), `${file}: no motion controls`);
  assert(html.includes("JPYC") && html.includes("per_use"), `${file}: payment options regressed`);
  assert(!/<(?:img|script)\b[^>]*\bsrc\s*=\s*["'](?:https?:|\.\/src\/)/i.test(html), `${file}: runtime images/scripts must be embedded`);
  const match = html.match(/<script id="embedded-guide-audio" type="application\/json">([\s\S]*?)<\/script>/);
  assert(match, `${file}: missing narration`);
  const voices = JSON.parse(match[1]);
  const metadataMatch = html.match(/<script id="embedded-guide-meta" type="application\/json">([\s\S]*?)<\/script>/);
  assert(metadataMatch, `${file}: missing narration provenance`);
  const metadata = JSON.parse(metadataMatch[1]);
  assert.equal(metadata.provider, imported ? imported.manifest.provider : "mixed-offline-guide-voices");
  assert.equal(metadata.script_sha256, await narrationHash());
  if (imported) {
    for (const guide of ["phantom", "kitsune", "owl", "meiji"]) {
      assert.equal(metadata.guides?.[guide]?.provider, imported.manifest.provider, `${file}: incorrect ${guide} provenance`);
    }
  } else {
    assert.equal(metadata.guides?.meiji?.provider, "ondoku3-beta", `${file}: incorrect Iris provenance`);
  }
  assert.deepEqual(Object.keys(voices).sort(), ["kitsune", "meiji", "owl", "phantom"]);
  for (const [guide, clips] of Object.entries(voices)) {
    assert.equal(clips.length, 7);
    for (let index = 0; index < clips.length; index += 1) {
      assert(clips[index].startsWith(imported ? "data:audio/mpeg;base64," : "data:audio/mp4;base64,"));
      const source = await readFile(`${root}src/audio/${imported ? imported.folderName : "guides"}/${guide}/0${index + 1}-guide.${imported ? "mp3" : "m4a"}`);
      assert(Buffer.from(clips[index].split(",")[1], "base64").equals(source), `${file}: ${guide} scene ${index + 1} differs from source`);
    }
  }
  for (const paper of PAPERS) assert(html.includes(paper.arxivId), `${file}: paper missing from offline bundle`);
  console.log(`${file}: library, controls, payments and all 28 embedded audio files verified`);
}
console.log(`${PAPERS.length} papers × 7 source-noted scenes; catalog/search/storage checks passed`);
