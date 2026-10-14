import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const page = await readFile(`${root}index.html`, "utf8");
const scenes = page.match(/var sceneData = \[([\s\S]*?)\n\s*\];/)?.[1];
if (!scenes) throw new Error("Could not find the seven Japanese scripts in index.html");
const scripts = [...scenes.matchAll(/speech: ("(?:\\.|[^"\\])*")/g)].map((m) => JSON.parse(m[1]));
if (scripts.length !== 7 || scripts.some((text) => !text.trim())) throw new Error("Expected seven nonempty scripts");
await mkdir(`${root}src/audio`, { recursive: true });
await writeFile(`${root}src/audio/narration.json`, JSON.stringify(scripts, null, 2) + "\n");
console.log("Exported seven Japanese scene scripts to src/audio/narration.json");
