import {
  DEFAULT_MOTION,
  MOTION_EVENT,
  MOTION_PRESETS,
  MOTION_STORAGE_KEY,
  normalizeMotionSettings,
  parseMotionSettings,
  type MotionSettings,
} from "./motion-settings";
import { reactionBeat, reactionForScene } from "./reactions";

type Panel = { owners: number; render: () => void; dispose: () => void };
type MotionStore = {
  settings: MotionSettings;
  reduced: boolean;
  panels: Map<HTMLElement, Panel>;
  connect: () => void;
  disconnect: () => void;
  change: (value: unknown) => void;
};

const stores = new WeakMap<Document, MotionStore>();
let nextPanelId = 0;

function storeFor(document: Document): MotionStore {
  const existing = stores.get(document);
  if (existing) return existing;
  const view = document.defaultView;
  const media = view?.matchMedia?.("(prefers-reduced-motion: reduce)");
  const panels = new Map<HTMLElement, Panel>();
  let connected = false;

  const render = () => {
    const { intensity, tempo, props } = store.settings;
    const root = document.documentElement;
    root.style.setProperty("--guide-motion-intensity", String(intensity / 100));
    root.style.setProperty("--guide-motion-tempo", String(tempo));
    root.style.setProperty("--guide-motion-duration", String(1 / tempo));
    root.style.setProperty("--guide-prop-strength", String(props / 100));
    // OS reduction is also enforced in CSS, even after the last panel unmounts.
    root.dataset.guideMotion = intensity === 0 ? "off" : "on";
    panels.forEach((panel) => panel.render());
  };
  const receive = (event: Event) => {
    store.settings = normalizeMotionSettings((event as CustomEvent<unknown>).detail);
    render();
  };
  const storage = (event: StorageEvent) => {
    if (event.key !== MOTION_STORAGE_KEY && event.key !== null) return;
    store.settings = parseMotionSettings(event.newValue);
    render();
  };
  const reduction = () => {
    store.reduced = media?.matches ?? false;
    render();
  };
  const store: MotionStore = {
    settings: { ...DEFAULT_MOTION },
    reduced: media?.matches ?? false,
    panels,
    connect() {
      if (connected) return;
      connected = true;
      try {
        store.settings = parseMotionSettings(view?.localStorage.getItem(MOTION_STORAGE_KEY) ?? null);
      } catch { /* Keep this document's in-memory settings when storage is unavailable. */ }
      view?.addEventListener(MOTION_EVENT, receive);
      view?.addEventListener("storage", storage);
      media?.addEventListener("change", reduction);
      reduction();
    },
    disconnect() {
      if (!connected) return;
      connected = false;
      view?.removeEventListener(MOTION_EVENT, receive);
      view?.removeEventListener("storage", storage);
      media?.removeEventListener("change", reduction);
    },
    change(value) {
      store.settings = normalizeMotionSettings(value);
      try {
        view?.localStorage.setItem(MOTION_STORAGE_KEY, JSON.stringify(store.settings));
      } catch { /* Sliders and same-page synchronization also work without storage. */ }
      render();
      view?.dispatchEvent(new CustomEvent(MOTION_EVENT, { detail: { ...store.settings } }));
    },
  };
  stores.set(document, store);
  return store;
}

function element<K extends keyof HTMLElementTagNameMap>(document: Document, tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function actorScope(marker: HTMLElement): HTMLElement {
  // An explicit scope is optional; the normal marker + nearby portrait needs no extra markup.
  const explicit = marker.closest<HTMLElement>("[data-motion-scope]");
  if (explicit) return explicit;
  let ancestor = marker.parentElement;
  while (ancestor) {
    if (ancestor.querySelector(".guide-pet")) return ancestor;
    ancestor = ancestor.parentElement;
  }
  return marker.parentElement ?? marker;
}

function bindPanel(marker: HTMLElement, store: MotionStore): Panel {
  const document = marker.ownerDocument;
  let id: string;
  do { id = `guide-motion-${++nextPanelId}`; } while (document.getElementById(id));

  const fieldset = element(document, "fieldset", "guide-motion-panel");
  fieldset.id = id;
  const legend = element(document, "legend", "guide-motion-title", "肖像の演出");
  const kicker = element(document, "span", "guide-motion-kicker", "PORTRAIT THEATER");
  legend.append(kicker);
  fieldset.append(legend);

  const presets = element(document, "div", "guide-motion-presets");
  presets.setAttribute("role", "group");
  presets.setAttribute("aria-label", "演出プリセット");
  const presetButtons = new Map<keyof typeof MOTION_PRESETS, HTMLButtonElement>();
  const cleanups: (() => void)[] = [];
  for (const [name, label] of [["focus", "集中"], ["standard", "標準"], ["cinema", "シネマ"]] as const) {
    const button = element(document, "button", "guide-motion-preset", label);
    button.type = "button";
    button.dataset.motionPreset = name;
    const choose = () => store.change(MOTION_PRESETS[name]);
    button.addEventListener("click", choose);
    cleanups.push(() => button.removeEventListener("click", choose));
    presetButtons.set(name, button);
    presets.append(button);
  }
  const reset = element(document, "button", "guide-motion-reset", "初期化");
  reset.type = "button";
  reset.setAttribute("aria-label", "演出設定を初期化（標準に戻す）");
  const resetSettings = () => store.change(DEFAULT_MOTION);
  reset.addEventListener("click", resetSettings);
  cleanups.push(() => reset.removeEventListener("click", resetSettings));
  presets.append(reset);
  fieldset.append(presets);

  const sliders = element(document, "div", "guide-motion-sliders");
  const inputs = new Map<keyof MotionSettings, { input: HTMLInputElement; output: HTMLOutputElement }>();
  const hint = element(document, "p", "guide-motion-hint");
  hint.id = `${id}-hint`;
  hint.setAttribute("role", "status");
  hint.setAttribute("aria-live", "polite");
  for (const [key, labelText, min, max, step] of [
    ["intensity", "動きの強さ", 0, 100, 1],
    ["tempo", "演出テンポ", 0.6, 1.4, 0.05],
    ["props", "小物・光", 0, 100, 1],
  ] as const) {
    const row = element(document, "div", "guide-motion-slider");
    const label = element(document, "label", "guide-motion-label", labelText);
    const input = element(document, "input", "guide-motion-range");
    const output = element(document, "output", "guide-motion-value");
    input.type = "range";
    input.id = `${id}-${key}`;
    input.name = key;
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute("aria-describedby", hint.id);
    label.htmlFor = input.id;
    output.setAttribute("for", input.id);
    // Range controls already announce their value; avoid three redundant live regions.
    output.setAttribute("aria-live", "off");
    const update = () => store.change({ ...store.settings, [key]: input.valueAsNumber });
    input.addEventListener("input", update);
    cleanups.push(() => input.removeEventListener("input", update));
    inputs.set(key, { input, output });
    row.append(label, output, input);
    sliders.append(row);
  }
  fieldset.append(sliders, hint);
  const note = element(document, "p", "guide-motion-note", "強さ0で静止 · OSの「動きを減らす」を優先 · 音声の速度・音量はプレーヤーで調整");
  fieldset.append(note);
  marker.append(fieldset);

  const scope = actorScope(marker);
  const renderHint = () => {
    const actor = scope.querySelector<HTMLElement>(".guide-pet");
    const reaction = reactionForScene(Number(actor?.dataset.scene ?? 1));
    const beat = reactionBeat(Number(actor?.dataset.beat ?? 0));
    const waiting = actor?.dataset.waiting === "true";
    const playing = actor?.dataset.playing === "true" && !waiting;
    const source = actor?.dataset.reactionSource;
    const activity = waiting ? "音声待機中・静止" : playing
      ? source === "voice" ? "音声再生中" : source === "preview" ? "反応プレビュー（音声なし）" : "反応中（音声 / プレビュー）"
      : "待機・静止";
    const override = store.reduced ? "OS設定で動きなし" : store.settings.intensity === 0 ? "強さ0・動きなし" : "";
    const text = actor
      ? `反応：${reaction.label} · ${override ? `${override} / ` : ""}${activity}${playing && !override ? ` · ${reaction.beats[beat]}` : ""}`
      : `7つの反応 · ${override || "再生・反応プレビューを待っています"}`;
    if (hint.textContent !== text) hint.textContent = text;
  };
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === "attributes" || !marker.contains(record.target))) renderHint();
  });
  observer.observe(scope, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-scene", "data-playing", "data-beat", "data-waiting", "data-reaction-source"],
  });

  const panel: Panel = {
    owners: 0,
    render() {
      inputs.forEach(({ input, output }, key) => {
        const value = store.settings[key];
        const formatted = key === "tempo" ? `${value.toFixed(2)}×` : `${value}%`;
        input.value = String(value);
        input.setAttribute("aria-valuetext", key === "intensity" && value === 0 ? "0%（静止）" : formatted);
        output.value = formatted;
      });
      presetButtons.forEach((button, name) => {
        const preset = MOTION_PRESETS[name];
        const selected = (Object.keys(preset) as (keyof MotionSettings)[]).every((key) => preset[key] === store.settings[key]);
        button.setAttribute("aria-pressed", String(selected));
      });
      renderHint();
    },
    dispose() {
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      fieldset.remove();
    },
  };
  panel.render();
  return panel;
}

/**
 * Fill descendant [data-motion-controls] markers (also accepts a marker itself).
 * Settings are document-wide; overlapping mounts are reference-counted per panel.
 * Optional actor attributes: data-waiting="true", data-reaction-source="voice|preview".
 * Returns an idempotent cleanup. It leaves other mounted panels and shared CSS intact.
 */
export function mountMotionControls(root: ParentNode): () => void {
  const markers = Array.from(root.querySelectorAll<HTMLElement>("[data-motion-controls]"));
  if (root instanceof Element && root.matches("[data-motion-controls]")) markers.unshift(root as HTMLElement);
  const releases: (() => void)[] = [];
  for (const marker of markers) {
    const store = storeFor(marker.ownerDocument);
    store.connect();
    let panel = store.panels.get(marker);
    if (!panel) {
      panel = bindPanel(marker, store);
      store.panels.set(marker, panel);
    }
    panel.owners += 1;
    const owned = panel;
    releases.push(() => {
      owned.owners -= 1;
      if (owned.owners > 0) return;
      owned.dispose();
      store.panels.delete(marker);
      if (store.panels.size === 0) store.disconnect();
    });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    releases.forEach((release) => release());
  };
}
