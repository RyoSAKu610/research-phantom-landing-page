import { createHash } from "node:crypto";
import { readFile, lstat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const guideIds = ["phantom", "kitsune", "owl", "meiji"];
export const names = guideIds.flatMap((guide) => Array.from({ length: 7 }, (_, index) => `${guide}/0${index + 1}-guide.mp3`));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function narrationHash() {
  return hash(await readFile(`${root}src/audio/narration.json`));
}

export async function importedTracks(scriptHash) {
  for (const [folderName, provider] of [["local-mp3", "local-qwen3-tts"], ["ondoku", "ondoku3-beta"]]) {
    const result = await tracksFromFolder(`${root}src/audio/${folderName}`, provider, scriptHash);
    if (result) return { ...result, folderName };
  }
  return null;
}

export async function ondokuTracks(scriptHash) {
  return tracksFromFolder(`${root}src/audio/ondoku`, "ondoku3-beta", scriptHash);
}

async function tracksFromFolder(folder, provider, scriptHash) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(`${folder}/manifest.json`, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  if (manifest.provider !== provider || manifest.script_sha256 !== scriptHash ||
      !Array.isArray(manifest.tracks) || manifest.tracks.length !== 28 ||
      manifest.tracks.some((entry, index) => entry.file !== names[index] ||
        !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isInteger(entry.bytes) || entry.bytes <= 0 ||
        !Number.isFinite(entry.duration_seconds) || entry.duration_seconds <= 0)) {
    throw new Error(`${provider} manifest incomplete or stale; import all 28 again.`);
  }
  const seen = new Set();
  const tracks = {};
  for (const entry of manifest.tracks) {
    const fullPath = `${folder}/${entry.file}`;
    const directory = await lstat(`${folder}/${entry.file.split("/")[0]}`);
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error(`Unsafe MP3 directory: ${entry.file}`);
    const stat = await lstat(fullPath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Unsafe MP3 clip: ${entry.file}`);
    const bytes = await readFile(fullPath);
    const digest = hash(bytes);
    if (bytes.length !== entry.bytes || digest !== entry.sha256 || seen.has(digest)) {
      throw new Error(`MP3 clip integrity failed: ${entry.file}`);
    }
    seen.add(digest);
    const probe = spawnSync(process.env.FFPROBE || "ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,codec_type:format=duration", "-of", "json", fullPath], { encoding: "utf8" });
    if (probe.error || probe.status !== 0) throw new Error(`ffprobe failed for ${entry.file}: ${probe.stderr || probe.error}`);
    const media = JSON.parse(probe.stdout);
    if (!media.streams?.some((stream) => stream.codec_type === "audio" && stream.codec_name === "mp3") ||
        media.streams?.some((stream) => stream.codec_type === "audio" && stream.codec_name !== "mp3") ||
        !(Number(media.format?.duration) > 0)) throw new Error(`Not a playable MP3: ${entry.file}`);
    const [guide] = entry.file.split("/");
    (tracks[guide] ??= []).push(`data:audio/mpeg;base64,${bytes.toString("base64")}`);
  }
  return { manifest, tracks };
}
