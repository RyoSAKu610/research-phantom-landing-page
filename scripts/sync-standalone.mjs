import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { guideIds, narrationHash, importedTracks } from "./ondoku-audio.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const path = `${root}index.html`;
let html = await readFile(path, "utf8");
const markup = await readFile(`${root}src/payments/agent-payments.html`, "utf8");
const researchMarkup = await readFile(`${root}src/research/library.html`, "utf8");
const bundle = await build({
  absWorkingDir: root,
  entryPoints: ["src/standalone.ts"],
  bundle: true,
  format: "iife",
  target: "es2020",
  loader: { ".jpg": "dataurl", ".jpeg": "dataurl", ".png": "dataurl" },
  minify: true,
  write: false,
});
const guideFolder = `${root}src/audio/guides`;
const guideMeta = JSON.parse(await readFile(`${guideFolder}/voice.json`, "utf8"));
const scriptHash = await narrationHash();
if (guideMeta.provider !== "mixed-offline-guide-voices" || guideMeta.script_sha256 !== scriptHash ||
    guideMeta.guides?.meiji?.provider !== "ondoku3-beta" ||
    guideIds.some((id) => !guideMeta.guides?.[id])) {
  throw new Error("Guide narration changed. Regenerate all guide clips before building.");
}
const imported = await importedTracks(scriptHash);
const guideAudio = imported?.tracks ?? Object.fromEntries(await Promise.all(guideIds.map(async (guide) => {
  const files = (await readdir(`${guideFolder}/${guide}`)).filter((name) => /^0[1-7]-guide\.m4a$/.test(name)).sort();
  if (files.length !== 7 || files.some((name, index) => !name.startsWith(`0${index + 1}-`))) {
    throw new Error(`Expected seven numbered clips for ${guide}`);
  }
  const audio = await Promise.all(files.map(async (name) => {
    const bytes = await readFile(`${guideFolder}/${guide}/${name}`);
    if (bytes.length < 2000) throw new Error(`Guide clip is too small: ${guide}/${name}`);
    return `data:audio/mp4;base64,${bytes.toString("base64")}`;
  }));
  return [guide, audio];
})));
const embeddedMeta = imported ? {
  provider: imported.manifest.provider,
  script_sha256: scriptHash,
  guides: Object.fromEntries(guideIds.map((id) => [id, { provider: imported.manifest.provider }])),
  spoken_variants: guideMeta.spoken_variants,
} : guideMeta;
for (const [name, content] of [
  ["RESEARCH_LIBRARY", researchMarkup.trim()],
  ["AGENT_PAYMENTS", markup.trim()],
  ["AGENT_SCRIPT", `<script data-static-only>${bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`],
  ["EMBEDDED_AUDIO", `<script id="embedded-guide-audio" type="application/json">${JSON.stringify(guideAudio)}</script>\n<script id="embedded-guide-meta" type="application/json">${JSON.stringify(embeddedMeta)}</script>`],
]) {
  const start = `<!-- ${name}_START -->`;
  const end = `<!-- ${name}_END -->`;
  if (!html.includes(start) || !html.includes(end)) throw new Error(`Missing ${name} markers`);
  const from = html.indexOf(start) + start.length;
  html = html.slice(0, from) + "\n" + content + "\n" + html.slice(html.indexOf(end, from));
}
await writeFile(path, html);
let standalone = html;
for (const relative of ["src/standalone.css", "src/payments/agent-payments.css", "src/research/library.css", "src/guide-pet.css"]) {
  const stylesheet = await readFile(`${root}${relative}`, "utf8");
  standalone = standalone.replace(`<link rel="stylesheet" href="./${relative}" />`, `<style>\n${stylesheet.replace(/<\/style/gi, "<\\/style")}\n</style>`);
}
for (const relative of ["src/assets/guide-phantom.jpg", "src/assets/guide-fox.jpg", "src/assets/guide-owl.jpg", "src/assets/guide-meiji.jpg"]) {
  const image = await readFile(`${root}${relative}`);
  standalone = standalone.replaceAll(`./${relative}`, `data:image/jpeg;base64,${image.toString("base64")}`);
}
standalone = standalone.replace(/\s*<script type="module" data-react-bootstrap>[\s\S]*?<\/script>/, "");
await writeFile(`${root}standalone-offline.html`, standalone);
console.log("Synced shared research and Agent payment templates with the file:// controllers.");
console.log("Created standalone-offline.html with inline styles and artwork.");
console.log(`Embedded ${guideIds.length * 7} guide-voice scenes for offline playback (${embeddedMeta.provider}).`);
