import { GUIDES, GUIDE_IDS, type GuideId } from "../lib/guides";
import { mountMotionControls } from "../character/motion";
import { PAPERS, parseSavedPaperIds, searchPapers, type Paper, type PaperScene } from "./papers";
import { arxivPaperLinks, arxivSearchUrl, lookupOA, researchStatus, searchArxiv, type LivePaper, type OAResult } from "./live";
import { INTERESTS, editorialSuggestions, emptyReadingSignals, parseReadingSignals, recommendPapers, withReadingEvent } from "./recommendations";

const STORAGE = {
  bookmarks: "researchphantom-bookmarks",
  recent: "researchphantom-recent-paper",
  guide: "researchphantom-guide",
  reading: "researchphantom-reading-v1",
  seconds: "researchphantom-scene-seconds",
} as const;

const GUIDE_NAMES: Record<GuideId, string> = { phantom: "Phantom", kitsune: "Kitsune", owl: "Owl", meiji: "Meiji" };
const REACTIONS: Record<PaperScene["key"], { scene: number; name: string }> = {
  question: { scene: 1, name: "問いかけ" },
  input: { scene: 2, name: "受け取り" },
  process: { scene: 3, name: "思考" },
  caution: { scene: 4, name: "注意" },
  observation: { scene: 5, name: "観測" },
  interpretation: { scene: 6, name: "整理" },
  conclusion: { scene: 7, name: "結論" },
};

const mountedLibraries = new WeakMap<HTMLElement, () => void>();
const isGuideId = (value: unknown): value is GuideId => typeof value === "string" && GUIDE_IDS.some((id) => id === value);
const folio = (value: number) => String(value).padStart(2, "0");
const DEFAULT_SECONDS = 16;
const sceneSeconds = (raw: unknown) => {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 8 && value <= 30 ? value : DEFAULT_SECONDS;
};

function liveId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return /^\d{4}\.\d{4,5}(?:v\d{1,3})?$/u.test(raw) || /^[a-z][a-z.-]*\/[0-9]{7}(?:v\d{1,3})?$/iu.test(raw) ? raw : null;
}

/** arXiv's own DOI is a preprint identifier, not evidence of a separately published OA version. */
function publishedDoi(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 256 || !/^10\.\d{4,9}\/[-._;()/:a-z0-9]+$/iu.test(raw)) return null;
  return /^10\.48550\//iu.test(raw) ? null : raw;
}

/** Only navigable public HTTPS domains are accepted from Unpaywall (never fetch these links). */
function publicOAUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048 || /[\u0000-\u001f\u007f]/u.test(raw)) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/u.test(host) ||
      /\.(?:local|localhost|localdomain|internal|intranet|test|invalid|example|home|lan|corp|onion|arpa)$/u.test(host)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Contiguous slices of the actual abstract: no generated transitions or implied review. */
function abstractSlides(text: string): string[] {
  if (!text) return ["抄録の本文がありません。"];
  const slides: string[] = [];
  let start = 0;
  while (start < text.length && slides.length < 24) {
    if (text.length - start <= 430 || slides.length === 23) { slides.push(text.slice(start)); break; }
    const begin = start + 240;
    const end = Math.min(text.length, start + 430);
    let cut = -1;
    for (let i = begin; i < end; i++) {
      if (/[.!?]/u.test(text[i]) && /\s/u.test(text[i + 1] || "")) cut = i + 1;
    }
    if (cut < 0) {
      for (let i = end; i > begin; i--) { if (/\s/u.test(text[i])) { cut = i; break; } }
    }
    if (cut < 0) cut = end;
    slides.push(text.slice(start, cut));
    start = cut;
  }
  return slides;
}

/** Only curated arXiv sources may become external paper links. Never interpret strings as HTML. */
function sourceHref(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !["arxiv.org", "www.arxiv.org"].includes(url.hostname) || url.username || url.password || url.port) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Shared by React and the direct-file edition. A second mount replaces the first binding. */
export function mountResearchLibrary(root: ParentNode): () => void {
  const workspace = root instanceof HTMLElement && root.matches("#research-library")
    ? root
    : root.querySelector<HTMLElement>("#research-library");
  if (!workspace) return () => {};
  mountedLibraries.get(workspace)?.();

  const doc = workspace.ownerDocument;
  const view = doc.defaultView;
  if (!view) return () => {};
  const find = <T extends Element = HTMLElement>(selector: string) => workspace.querySelector<T>(selector)!;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
    const element = doc.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const form = find<HTMLFormElement>("[data-research-search-form]");
  const query = find<HTMLInputElement>("[data-research-query]");
  const field = find<HTMLSelectElement>("[data-research-field]");
  const results = find<HTMLUListElement>("[data-research-results]");
  const resultsCount = find("[data-research-results-count]");
  const detail = find("[data-research-detail]");
  const title = find("[data-research-paper-title]");
  const feedback = find("[data-research-feedback]");
  const guideOptions = find("[data-research-guide-options]");
  const sceneTabs = find("[data-research-scene-tabs]");
  const scenePanel = find("[data-research-scene-panel]");
  const portrait = find("[data-research-portrait]");
  const portraitImage = find<HTMLImageElement>("[data-research-portrait-image]");
  const reactionStatus = find("[data-research-reaction-status]");
  const reactionButton = find<HTMLButtonElement>("[data-research-reaction]");
  const previousButton = find<HTMLButtonElement>("[data-research-prev]");
  const nextButton = find<HTMLButtonElement>("[data-research-next]");
  const liveForm = find<HTMLFormElement>("[data-research-live-form]");
  const liveQuery = find<HTMLInputElement>("[data-research-live-query]");
  const liveResults = find<HTMLUListElement>("[data-research-live-results]");
  const liveDetail = find<HTMLElement>("[data-research-live-detail]");
  const liveTitle = find<HTMLElement>("[data-research-live-title]");
  const liveStatus = find("[data-research-live-status]");
  const oaStatus = find("[data-research-oa-status]");
  const oaButton = find<HTMLButtonElement>("[data-research-oa-check]");
  const oaEmail = find<HTMLInputElement>("[data-research-oa-email]");
  const speedInputs = [find<HTMLInputElement>("[data-research-scene-seconds]"), find<HTMLInputElement>("[data-research-live-seconds]")];
  const reducedMotion = view.matchMedia("(prefers-reduced-motion: reduce)");
  const paperById = new Map(PAPERS.map((paper) => [paper.id, paper]));
  const rememberedScenes = new Map<string, number>();
  let active = true;
  let storageAvailable = true;
  let mode: "all" | "saved" = "all";
  let selectedPaper: Paper | undefined;
  let lastCurated: Paper | undefined;
  let sceneIndex = 0;
  let reactionRun = 0;
  let reactionTimers: number[] = [];
  let reading = emptyReadingSignals();
  let seconds = DEFAULT_SECONDS;
  let livePapers: LivePaper[] = [];
  let selectedLive: LivePaper | undefined;
  let slides: string[] = [];
  let slideIndex = 0;
  let searchController: AbortController | null = null;
  let oaController: AbortController | null = null;
  let searchRun = 0;
  let oaRun = 0;
  let playKind: "curated" | "live" | null = null;
  let playState: "idle" | "playing" | "paused" | "ended" = "idle";
  let playTimer: number | null = null;
  let startedAt = 0;
  let remainingMs = DEFAULT_SECONDS * 1000;
  let lastCountdown = -1;

  const storageUnavailable = () => {
    storageAvailable = false;
    find("[data-research-storage-note]").textContent = "ブラウザ保存を利用できません。お気に入り・興味・再生速度はこの表示中のみ保持します。";
  };
  const readStorage = (key: string) => {
    try { return view.localStorage.getItem(key); } catch { storageUnavailable(); return null; }
  };
  const writeStorage = (key: string, value: string) => {
    try { view.localStorage.setItem(key, value); } catch { storageUnavailable(); }
  };

  let bookmarks = new Set(parseSavedPaperIds(readStorage(STORAGE.bookmarks)));
  reading = parseReadingSignals(readStorage(STORAGE.reading), PAPERS);
  seconds = sceneSeconds(readStorage(STORAGE.seconds));
  remainingMs = seconds * 1000;
  const savedGuide = readStorage(STORAGE.guide);
  let selectedGuide: GuideId = isGuideId(savedGuide) ? savedGuide : "phantom";
  const recentPaper = readStorage(STORAGE.recent);

  function saveReading() {
    writeStorage(STORAGE.reading, JSON.stringify(reading));
  }

  function renderSuggestions() {
    const list = (items: ReturnType<typeof editorialSuggestions>, className: string) => items.map(({ paper, reason }, index) => {
      const item = make("li", className);
      const button = make("button", "research-suggestion-open");
      button.type = "button";
      button.dataset.researchOpen = paper.id;
      button.setAttribute("aria-label", `${paper.titleJa}を読む。${reason}`);
      button.append(make("span", "research-suggestion-number", folio(index + 1)), make("span", "research-suggestion-title", paper.titleJa), make("span", "research-suggestion-reason", reason));
      item.append(button);
      return item;
    });
    find("[data-research-editorial]").replaceChildren(...list(editorialSuggestions(PAPERS), "research-editorial-item"));
    const personalized = recommendPapers(PAPERS, reading, [...bookmarks], selectedPaper?.id);
    find("[data-research-personal]").replaceChildren(...list(personalized, "research-personal-item"));
    find("[data-research-personal-note]").textContent = personalized.length
      ? "選んだ興味・お気に入り・開いた論文から、この端末内で自動更新しています。"
      : "興味を選ぶか、論文を開くと候補が現れます。";
    find("[data-research-interests]").querySelectorAll<HTMLButtonElement>("[data-research-interest]").forEach((button) => {
      button.setAttribute("aria-pressed", String(reading.interests.includes(button.dataset.researchInterest || "")));
    });
  }

  function renderInterestOptions() {
    find("[data-research-interests]").replaceChildren(...INTERESTS.map((interest) => {
      const button = make("button", "research-interest-chip", interest.label);
      button.type = "button";
      button.dataset.researchInterest = interest.id;
      button.setAttribute("aria-pressed", String(reading.interests.includes(interest.id)));
      return button;
    }));
  }

  function currentReaction() {
    const scene = selectedPaper?.scenes[sceneIndex];
    return scene ? REACTIONS[scene.key] : REACTIONS.question;
  }

  function stopReaction() {
    reactionRun += 1;
    reactionTimers.forEach((timer) => view!.clearTimeout(timer));
    reactionTimers = [];
    portrait.dataset.playing = "false";
    portrait.dataset.beat = "0";
    reactionButton.textContent = "反応を見る ↗";
    reactionButton.setAttribute("aria-label", `${currentReaction().name}の演出プレビューを見る`);
    reactionStatus.textContent = reducedMotion.matches
      ? `${currentReaction().name} · 動きを減らして静止表示`
      : doc.documentElement.dataset.guideMotion === "off"
        ? `${currentReaction().name} · 動きの強さ0で静止表示`
      : `${currentReaction().name} · 待機中`;
  }

  function previewReaction() {
    stopReaction();
    if (!selectedPaper || reducedMotion.matches || doc.hidden || doc.documentElement.dataset.guideMotion === "off") return;
    const run = reactionRun;
    // Commit the idle frame so replaying the same gesture restarts its CSS animation.
    void portrait.offsetWidth;
    portrait.dataset.playing = "true";
    reactionButton.textContent = "演出を止める □";
    reactionButton.setAttribute("aria-label", "演出プレビューを止める");
    reactionStatus.textContent = `演出プレビュー · ${currentReaction().name}`;
    const later = (delay: number, callback: () => void) => {
      reactionTimers.push(view!.setTimeout(() => { if (active && run === reactionRun) callback(); }, delay));
    };
    later(800, () => { portrait.dataset.beat = "1"; });
    later(1600, () => { portrait.dataset.beat = "2"; });
    later(2600, () => {
      stopReaction();
      reactionStatus.textContent = `演出プレビュー終了 · ${currentReaction().name}`;
    });
  }

  function cancelPlayTimer() {
    if (playTimer !== null) view!.clearTimeout(playTimer);
    playTimer = null;
  }

  function currentRemaining() {
    return playState === "playing" ? Math.max(0, remainingMs - (view!.performance.now() - startedAt)) : remainingMs;
  }

  function updatePlayer() {
    for (const kind of ["curated", "live"] as const) {
      const prefix = kind === "curated" ? "[data-research-" : "[data-research-live-";
      const index = kind === "curated" ? sceneIndex : slideIndex;
      const total = kind === "curated" ? selectedPaper?.scenes.length || 7 : slides.length || 1;
      const engaged = playKind === kind;
      const remaining = engaged ? currentRemaining() : seconds * 1000;
      const playButton = find<HTMLButtonElement>(`${prefix}play]`);
      playButton.textContent = engaged && playState === "playing" ? "Ⅱ 一時停止" : engaged && playState === "paused" ? "▶ 再開" : kind === "live" ? "▶ 抄録を再生" : "▶ テキストを再生";
      find<HTMLButtonElement>(`${prefix}stop]`).disabled = !engaged || playState === "idle";
      const status = ` ${kind === "live" ? "画面" : "場面"} ${index + 1} / ${total} · ${engaged ? { idle: "停止中", playing: "再生中", paused: "一時停止中", ended: "再生完了" }[playState] : "停止中"}`.trim();
      const statusElement = find(`${prefix}play-status]`);
      if (statusElement.textContent !== status) statusElement.textContent = status;
      const whole = Math.ceil(remaining / 1000);
      const remainingElement = find(`${prefix}${kind === "live" ? "remaining" : "play-remaining"}]`);
      if (!engaged || lastCountdown !== whole || remainingElement.textContent !== `残り ${whole}秒`) remainingElement.textContent = `残り ${whole}秒`;
      find<HTMLProgressElement>(`${prefix}progress]`).value = engaged && playState === "ended" ? 100 : Math.max(0, Math.min(100, (1 - remaining / (seconds * 1000)) * 100));
    }
    lastCountdown = Math.ceil(currentRemaining() / 1000);
  }

  function stopPlayback() {
    cancelPlayTimer();
    playKind = null;
    playState = "idle";
    remainingMs = seconds * 1000;
    lastCountdown = -1;
    stopReaction();
    updatePlayer();
  }

  function restartSceneClock() {
    if (playKind === null || playState === "ended" || playState === "idle") { updatePlayer(); return; }
    remainingMs = seconds * 1000;
    startedAt = view!.performance.now();
    if (playState === "playing") { cancelPlayTimer(); playTimer = view!.setTimeout(tickPlayback, 250); }
    updatePlayer();
  }

  function tickPlayback() {
    playTimer = null;
    if (!active || playState !== "playing" || !playKind) return;
    if (doc.hidden) { pausePlayback(); return; }
    if (currentRemaining() <= 0) {
      if (playKind === "curated" && selectedPaper && sceneIndex < selectedPaper.scenes.length - 1) {
        selectScene(sceneIndex + 1, true, true, true);
      } else if (playKind === "live" && slideIndex < slides.length - 1) {
        selectLiveSlide(slideIndex + 1, true);
      } else {
        const completedKind = playKind;
        playState = "ended";
        remainingMs = 0;
        stopReaction();
        if (completedKind === "curated" && selectedPaper) {
          reading = withReadingEvent(reading, selectedPaper.id, "complete", PAPERS);
          saveReading();
          renderSuggestions();
        }
        updatePlayer();
        return;
      }
      // Each new scene gets its full duration even after a throttled timer; no catch-up burst.
      remainingMs = seconds * 1000;
      startedAt = view!.performance.now();
    }
    updatePlayer();
    playTimer = view!.setTimeout(tickPlayback, 250);
  }

  function pausePlayback() {
    if (playState !== "playing") return;
    remainingMs = currentRemaining();
    cancelPlayTimer();
    playState = "paused";
    stopReaction();
    updatePlayer();
  }

  function announceCurrentPassage(kind: "curated" | "live") {
    if (kind === "curated") {
      const scene = selectedPaper?.scenes[sceneIndex];
      if (scene) find("[data-research-scene-announcement]").textContent = `第${sceneIndex + 1}場面、${scene.label}。${scene.heading}。${scene.body}`;
    } else if (slides[slideIndex]) {
      find("[data-research-live-announcement]").textContent = `Abstract passage ${slideIndex + 1} of ${slides.length}. ${slides[slideIndex]}`;
    }
  }

  function togglePlayback(kind: "curated" | "live") {
    if (doc.hidden) return;
    if (playKind === kind && playState === "playing") { pausePlayback(); return; }
    const resuming = playKind === kind && playState === "paused";
    const replaying = playKind === kind && playState === "ended";
    if (replaying) {
      stopPlayback();
      if (kind === "curated") selectScene(0, false, false);
      else selectLiveSlide(0, false, false);
    }
    if (!resuming) {
      if (playKind !== kind && !replaying) stopPlayback();
      playKind = kind;
      remainingMs = seconds * 1000;
    }
    playState = "playing";
    startedAt = view!.performance.now();
    updatePlayer();
    if (!resuming) announceCurrentPassage(kind);
    cancelPlayTimer();
    playTimer = view!.setTimeout(tickPlayback, 250);
  }

  function resetPlayback(kind: "curated" | "live") {
    if (playKind !== kind) return;
    stopPlayback();
    if (kind === "curated") selectScene(0, false, false);
    else selectLiveSlide(0, false, false);
  }

  function setSpeed(value: unknown) {
    const updated = sceneSeconds(value);
    if (updated !== seconds) {
      const fraction = Math.max(0, Math.min(1, currentRemaining() / (seconds * 1000)));
      seconds = updated;
      remainingMs = playKind && playState !== "ended" ? updated * 1000 * fraction : updated * 1000;
      startedAt = view!.performance.now();
    }
    speedInputs.forEach((input) => { input.value = String(seconds); });
    find("[data-research-speed-output]").textContent = `${seconds}秒`;
    find("[data-research-live-speed-output]").textContent = `${seconds}秒`;
    updatePlayer();
  }

  function setGuide(guide: GuideId, notify: boolean, persist = true) {
    stopReaction();
    selectedGuide = guide;
    portrait.dataset.guide = guide;
    portraitImage.src = GUIDES[guide].image;
    portraitImage.alt = GUIDES[guide].name;
    find("[data-research-current-guide]").textContent = `${GUIDE_NAMES[guide]} / ${GUIDES[guide].jp}`;
    guideOptions.querySelectorAll<HTMLButtonElement>("[data-research-guide]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.researchGuide === guide));
    });
    if (persist) writeStorage(STORAGE.guide, guide);
    if (notify) {
      // Selection only: the LP decides how to reflect it. No demo audio is requested.
      view!.dispatchEvent(new CustomEvent("researchphantom:guide-change", { detail: { guide } }));
    }
  }

  function renderGuides() {
    guideOptions.replaceChildren(...GUIDE_IDS.map((id) => {
      const button = make("button", "research-guide-option");
      button.type = "button";
      button.dataset.researchGuide = id;
      button.setAttribute("aria-pressed", String(id === selectedGuide));
      button.setAttribute("aria-label", `${GUIDES[id].name}（${GUIDES[id].jp}）を選ぶ`);
      const image = make("img", "research-guide-image");
      image.src = GUIDES[id].image;
      image.alt = "";
      image.width = 80;
      image.height = 88;
      image.loading = "lazy";
      button.append(image, make("span", "research-guide-name", GUIDE_NAMES[id]), make("small", "research-guide-role", GUIDES[id].jp));
      return button;
    }));
  }

  function renderBookmark(button: HTMLButtonElement, paper: Paper, compact: boolean) {
    const saved = bookmarks.has(paper.id);
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", `${paper.titleJa}をお気に入り${saved ? "から外す" : "に保存"}`);
    button.title = saved ? "お気に入りから外す" : "お気に入りに保存";
    button.textContent = compact ? saved ? "★" : "☆" : saved ? "★ 保存済み" : "☆ お気に入りに保存";
  }

  function createCard(paper: Paper) {
    const item = make("li", "research-card");
    item.dataset.selected = String(selectedPaper?.id === paper.id);
    const open = make("button", "research-card-open");
    open.type = "button";
    open.dataset.researchOpen = paper.id;
    open.setAttribute("aria-controls", "research-paper-detail");
    open.setAttribute("aria-pressed", String(selectedPaper?.id === paper.id));
    open.setAttribute("aria-label", `${paper.titleJa} — ${paper.title}を読む`);
    const meta = make("span", "research-card-meta");
    meta.append(make("span", "research-card-folio", folio(PAPERS.indexOf(paper) + 1)), make("span", "", `${paper.year} · ${paper.field}`));
    const english = make("span", "research-card-original", paper.title);
    english.lang = "en";
    const tags = make("span", "research-card-tags");
    tags.append(...paper.tags.slice(0, 3).map((tag) => make("span", "", tag)));
    const foot = make("span", "research-card-foot");
    foot.append(make("span", "", `読了目安 ${paper.readingMinutes}分`), make("span", "research-card-read", selectedPaper?.id === paper.id ? "読書中 ↗" : `${paper.scenes.length}場面で読む ↗`));
    open.append(meta, make("span", "research-card-title", paper.titleJa), english, make("span", "research-card-authors", paper.authors.join(", ")), tags, foot);
    const save = make("button", "research-card-save");
    save.type = "button";
    save.dataset.researchBookmark = paper.id;
    renderBookmark(save, paper, true);
    item.append(open, save);
    return item;
  }

  function renderResults() {
    const matching = searchPapers(PAPERS, query.value, field.value);
    const visible = mode === "saved" ? matching.filter((paper) => bookmarks.has(paper.id)) : matching;
    results.replaceChildren(...visible.map(createCard));
    find("[data-research-all-count]").textContent = String(PAPERS.length);
    find("[data-research-saved-count]").textContent = String(bookmarks.size);
    resultsCount.textContent = mode === "saved"
      ? `${visible.length}本を表示 / お気に入り ${bookmarks.size}本`
      : `${visible.length}本を表示 / 収録 ${PAPERS.length}本`;
    workspace!.querySelectorAll<HTMLButtonElement>("[data-research-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.researchMode === mode));
    });
    const filtered = Boolean(query.value || field.value !== "all" || mode !== "all");
    workspace!.querySelectorAll<HTMLButtonElement>("[data-research-reset]").forEach((button) => { button.disabled = !filtered; });
    find("[data-research-clear-query]").hidden = !query.value;
    find("[data-research-empty]").hidden = visible.length !== 0;
    const emptyBookmarks = mode === "saved" && bookmarks.size === 0;
    find("[data-research-empty-heading]").textContent = emptyBookmarks ? "お気に入りは、まだ白紙です。" : "条件に合う論文が見つかりません。";
    find("[data-research-empty-copy]").textContent = emptyBookmarks
      ? "論文の☆を押すと、あとで読みたい一篇をここに残せます。"
      : "検索語を短くするか、分野やお気に入りの絞り込みを外してみてください。";
    const search = query.value.trim();
    find<HTMLAnchorElement>("[data-research-external-search]").href = search
      ? `https://arxiv.org/search/?query=${encodeURIComponent(search)}&searchtype=all&abstracts=show&order=-announced_date_first`
      : "https://arxiv.org/search/";
    find("[data-research-outside]").hidden = !selectedPaper || visible.some((paper) => paper.id === selectedPaper!.id);
    if (selectedPaper) renderBookmark(find<HTMLButtonElement>("[data-research-save-detail]"), selectedPaper, false);
    renderSuggestions();
  }

  function selectScene(index: number, preview: boolean, announce = true, autoAdvance = false) {
    if (!selectedPaper || !Number.isInteger(index) || index < 0 || index >= selectedPaper.scenes.length) return;
    if (!autoAdvance && playKind === "curated" && playState === "ended") stopPlayback();
    stopReaction();
    sceneIndex = index;
    rememberedScenes.set(selectedPaper.id, index);
    const scene = selectedPaper.scenes[index];
    sceneTabs.querySelectorAll<HTMLButtonElement>("[data-research-scene]").forEach((button, position) => {
      button.setAttribute("aria-selected", String(position === index));
      button.tabIndex = position === index ? 0 : -1;
    });
    scenePanel.setAttribute("aria-labelledby", `research-scene-tab-${index}`);
    portrait.dataset.scene = String(REACTIONS[scene.key].scene);
    find("[data-research-scene-number]").textContent = `SCENE ${folio(index + 1)} / ${scene.label}`;
    find("[data-research-scene-heading]").textContent = scene.heading;
    find("[data-research-scene-body]").textContent = scene.body;
    find("[data-research-scene-source]").textContent = scene.sourceNote;
    find("[data-research-scene-position]").textContent = `${folio(index + 1)} / ${folio(selectedPaper.scenes.length)}`;
    previousButton.disabled = index === 0;
    nextButton.disabled = index === selectedPaper.scenes.length - 1;
    if (announce) announceCurrentPassage("curated");
    else find("[data-research-scene-announcement]").textContent = "";
    if (preview) previewReaction();
    if (!autoAdvance) restartSceneClock();
  }

  function setSourceLink(selector: string, raw: string) {
    const link = find<HTMLAnchorElement>(selector);
    const href = sourceHref(raw);
    if (href) { link.href = href; link.hidden = false; }
    else { link.removeAttribute("href"); link.hidden = true; }
  }

  function reveal(element: HTMLElement) {
    const bounds = element.getBoundingClientRect();
    if (bounds.top < 100 || bounds.bottom > view!.innerHeight) {
      element.scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "instant" : "smooth" });
    }
  }

  function openPaper(paper: Paper, focus = false) {
    stopPlayback();
    oaController?.abort();
    oaRun += 1;
    selectedLive = undefined;
    liveDetail.hidden = true;
    selectedPaper = paper;
    lastCurated = paper;
    detail.hidden = false;
    detail.dataset.paper = paper.id;
    find("[data-research-paper-id]").textContent = `arXiv:${paper.arxivId}`;
    find("[data-research-paper-field]").textContent = paper.field;
    find("[data-research-paper-year]").textContent = `${paper.year}年`;
    find("[data-research-reading-time]").textContent = `読了目安 ${paper.readingMinutes}分`;
    title.textContent = paper.titleJa;
    find("[data-research-paper-original]").textContent = paper.title;
    find("[data-research-paper-authors]").textContent = paper.authors.join(", ");
    find("[data-research-paper-tags]").replaceChildren(...paper.tags.map((tag) => make("span", "research-paper-tag", tag)));
    find("[data-research-abstract]").textContent = paper.abstractJa;
    find("[data-research-provenance]").textContent = `出典：${paper.authors.join(", ")} (${paper.year}). ${paper.title}. arXiv:${paper.arxivId}。`;
    setSourceLink("[data-research-source]", paper.sourceUrl);
    setSourceLink("[data-research-pdf]", paper.pdfUrl);
    sceneTabs.replaceChildren(...paper.scenes.map((scene, index) => {
      const button = make("button", "research-scene-tab");
      button.type = "button";
      button.id = `research-scene-tab-${index}`;
      button.dataset.researchScene = String(index);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", "research-scene-panel");
      button.append(make("span", "research-scene-tab-number", folio(index + 1)), make("span", "", scene.label));
      return button;
    }));
    selectScene(rememberedScenes.get(paper.id) ?? 0, false, false);
    writeStorage(STORAGE.recent, paper.id);
    renderResults();
    if (focus) {
      title.focus({ preventScroll: true });
      reveal(title);
    }
  }

  function toggleBookmark(paper: Paper, fromCard: boolean) {
    if (bookmarks.has(paper.id)) bookmarks.delete(paper.id);
    else bookmarks.add(paper.id);
    writeStorage(STORAGE.bookmarks, JSON.stringify([...bookmarks]));
    renderResults();
    feedback.textContent = `${paper.titleJa}をお気に入り${bookmarks.has(paper.id) ? "に保存しました" : "から外しました"}。${storageAvailable ? "" : "この表示中のみ保持します。"}`;
    if (fromCard) {
      const replacement = [...results.querySelectorAll<HTMLButtonElement>("[data-research-bookmark]")].find((button) => button.dataset.researchBookmark === paper.id);
      (replacement ?? resultsCount).focus({ preventScroll: true });
    }
  }

  const safeText = (value: unknown, max = 300) => typeof value === "string" ? value.slice(0, max) : "";
  const online = () => view!.location.protocol !== "file:" && view!.navigator.onLine !== false;

  function setLiveFallback(search: string) {
    const candidate = arxivSearchUrl(search);
    const url = sourceHref(candidate);
    find<HTMLAnchorElement>("[data-research-live-fallback]").href = url && new URL(url).pathname.startsWith("/search/")
      ? url : `https://arxiv.org/search/?query=${encodeURIComponent(search)}&searchtype=all`;
  }

  function renderLiveResults() {
    liveResults.replaceChildren(...livePapers.map((paper, index) => {
      const id = liveId(paper.arxivId)!;
      const item = make("li", "research-live-card");
      const open = make("button", "research-live-card-open");
      open.type = "button";
      open.dataset.researchLiveOpen = String(index);
      open.setAttribute("aria-label", `${safeText(paper.title)}の原文抄録を開く`);
      const originalTitle = make("span", "research-live-card-title", safeText(paper.title, 600));
      originalTitle.lang = "en";
      const authors = Array.isArray(paper.authors) ? paper.authors.map((author) => safeText(author, 300)).filter(Boolean).join(", ") : "";
      const authorsElement = make("span", "research-live-card-authors", authors);
      const abstractElement = make("span", "research-live-card-abstract", safeText(paper.abstract, 30000));
      authorsElement.lang = "en";
      abstractElement.lang = "en";
      open.append(make("span", "research-live-card-meta", `${safeText(paper.category, 80)} · ${Number.isInteger(paper.year) ? paper.year : "—"} · arXiv:${id}`), originalTitle, authorsElement, abstractElement, make("span", "research-live-card-read", "原文抄録を見る →"));
      const links = make("div", "research-live-card-links");
      const reading = arxivPaperLinks(id);
      const source = make("a", "", "arXiv ↗");
      source.href = reading.original;
      const pdf = make("a", "", "PDF ↗");
      pdf.href = reading.pdf;
      for (const link of [source, pdf]) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
      links.append(source, pdf);
      item.append(open, links);
      return item;
    }));
  }

  async function runLiveSearch() {
    searchController?.abort();
    const run = ++searchRun;
    const search = liveQuery.value.trim().slice(0, 200);
    setLiveFallback(search);
    livePapers = [];
    renderLiveResults();
    find("[data-research-live-retry]").hidden = true;
    if (!search) { liveStatus.textContent = "検索語を入力してください。"; return; }
    if (!online()) { liveStatus.textContent = "このページではオンライン検索を利用できません。arXivのサイトで直接探すか、収録論文をお読みください。"; return; }
    if (search.length < 2 || search.length > 120) { liveStatus.textContent = "検索語は2〜120文字で入力してください。"; return; }
    const controller = new AbortController();
    searchController = controller;
    liveStatus.textContent = `「${search}」をarXivで検索しています…`;
    try {
      const response = await searchArxiv(search, controller.signal);
      if (!active || run !== searchRun || controller.signal.aborted) return;
      const seen = new Set<string>();
      livePapers = (Array.isArray(response) ? response : []).filter((paper) => {
        const id = liveId(paper?.arxivId);
        if (!id || seen.has(id) || typeof paper.title !== "string" || !paper.title.trim() || typeof paper.abstract !== "string" || !paper.abstract.trim() || paper.abstract.length > 30000) return false;
        seen.add(id);
        return true;
      }).slice(0, 12);
      renderLiveResults();
      liveStatus.textContent = livePapers.length ? `arXivの原文データ ${livePapers.length}件。編集済みの7場面は付いていません。` : "該当する論文が見つかりませんでした。検索語を変えてみてください。";
    } catch {
      if (!active || run !== searchRun || controller.signal.aborted) return;
      liveStatus.textContent = "arXivの検索に接続できませんでした。もう一度試すか、arXivのサイトで直接探してください。";
      find("[data-research-live-retry]").hidden = false;
    } finally {
      if (active && run === searchRun) {
        searchController = null;
      }
    }
  }

  function selectLiveSlide(index: number, autoAdvance = false, announce = true) {
    if (!selectedLive || !Number.isInteger(index) || index < 0 || index >= slides.length) return;
    if (!autoAdvance && playKind === "live" && playState === "ended") stopPlayback();
    slideIndex = index;
    find("[data-research-live-slide-position]").textContent = `ORIGINAL ${folio(index + 1)} / ${folio(slides.length)}`;
    find("[data-research-live-slide-body]").textContent = slides[index];
    find("[data-research-live-position]").textContent = `${folio(index + 1)} / ${folio(slides.length)}`;
    find<HTMLButtonElement>("[data-research-live-prev]").disabled = index === 0;
    find<HTMLButtonElement>("[data-research-live-next]").disabled = index === slides.length - 1;
    if (announce) announceCurrentPassage("live");
    else find("[data-research-live-announcement]").textContent = "";
    if (!autoAdvance) restartSceneClock();
  }

  function openLive(paper: LivePaper) {
    const id = liveId(paper.arxivId);
    if (!id) return;
    stopPlayback();
    oaController?.abort();
    oaRun += 1;
    selectedPaper = undefined;
    detail.hidden = true;
    selectedLive = paper;
    liveDetail.hidden = false;
    liveTitle.textContent = safeText(paper.title, 600);
    find("[data-research-live-id]").textContent = `arXiv:${id}`;
    find("[data-research-live-category]").textContent = safeText(paper.category, 80) || "分野未記載";
    find("[data-research-live-year]").textContent = Number.isInteger(paper.year) ? `${paper.year}年` : "年未記載";
    find("[data-research-live-published]").textContent = /^\d{4}-\d{2}-\d{2}T/u.test(paper.published) ? `初公開 ${paper.published.slice(0, 10)}` : "";
    find("[data-research-live-authors]").textContent = Array.isArray(paper.authors) ? paper.authors.map((author) => safeText(author, 300)).filter(Boolean).join(", ") : "";
    const abstract = safeText(paper.abstract, 30000);
    find("[data-research-live-abstract]").textContent = abstract;
    const reading = arxivPaperLinks(id);
    find<HTMLAnchorElement>("[data-research-live-source]").href = reading.original;
    find<HTMLAnchorElement>("[data-research-live-pdf]").href = reading.pdf;
    find<HTMLAnchorElement>("[data-research-oa-original]").href = reading.original;
    find<HTMLAnchorElement>("[data-research-oa-pdf]").href = reading.pdf;
    slides = abstractSlides(abstract);
    selectLiveSlide(0, false, false);
    const doi = publishedDoi(paper.doi);
    oaButton.hidden = !doi;
    oaButton.disabled = false;
    find("[data-research-live-doi]").textContent = doi ? `出版物のDOI: ${doi}` : "出版物のDOIは確認できません。arXiv上の原文をご覧ください。";
    oaStatus.textContent = doi ? "Unpaywallの確認には実際の連絡先メールが必要です。未設定でも下のarXiv原文を読めます。" : "出版物のDOIがないためUnpaywallでは確認できません。下のarXiv原文を読めます。";
    find("[data-research-oa-email-wrap]").hidden = true;
    oaEmail.value = "";
    const link = find<HTMLAnchorElement>("[data-research-oa-link]");
    link.hidden = true;
    link.removeAttribute("href");
    renderResults();
    updatePlayer();
    liveTitle.focus({ preventScroll: true });
    reveal(liveTitle);
  }

  function showOAResult(result: OAResult) {
    const link = find<HTMLAnchorElement>("[data-research-oa-link]");
    const url = result.status === "open" ? publicOAUrl(result.url) : null;
    if (url) { link.href = url; link.hidden = false; }
    else { link.hidden = true; link.removeAttribute("href"); }
    const details = [safeText(result.license, 90), safeText(result.source, 90)].filter(Boolean).join(" · ");
    if (result.status === "open") oaStatus.textContent = `OA版の記録があります${details ? `（${details}）` : ""}。${url ? "確認されたリンクから開けます。" : "公開版の安全なリンクは確認できませんでした。"}`;
    else if (result.status === "closed") oaStatus.textContent = "Unpaywallに公開版の記録は見つかりませんでした。非公開と断定するものではありません。";
    else if (result.status === "unconfigured") {
      oaStatus.textContent = "Unpaywallが未設定です。実際の連絡先メールを入力して再確認するか、下のarXiv原文・PDFを読めます。";
      find("[data-research-oa-email-wrap]").hidden = false;
    } else oaStatus.textContent = "OA状況を確認できませんでした。出版物のDOIや原論文をご確認ください。";
  }

  async function checkOA() {
    const doi = publishedDoi(selectedLive?.doi);
    if (!doi) return;
    oaController?.abort();
    const run = ++oaRun;
    if (!online()) { oaStatus.textContent = "オフラインではOAを確認できません。オンラインでお試しください。"; return; }
    const email = oaEmail.value.trim();
    if (email && (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(email) ||
      /(?:^|\.)(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/iu.test(email.split("@")[1] ?? ""))) {
      oaStatus.textContent = "実際の連絡先メールを入力してください。example.orgなどは使用できません。";
      oaEmail.focus();
      return;
    }
    const controller = new AbortController();
    oaController = controller;
    oaButton.disabled = true;
    oaStatus.textContent = "UnpaywallでOA状況を確認しています…";
    try {
      const status = await researchStatus(controller.signal);
      if (!active || run !== oaRun || controller.signal.aborted) return;
      if (!status.unpaywall && !email) { showOAResult({ status: "unconfigured" }); return; }
      const response = await lookupOA(doi, status.unpaywall ? undefined : email, controller.signal);
      if (!active || run !== oaRun || controller.signal.aborted) return;
      showOAResult(response);
    } catch {
      if (!active || run !== oaRun || controller.signal.aborted) return;
      oaStatus.textContent = "OA確認に接続できませんでした。時間をおいて再試行してください。";
    } finally {
      if (active && run === oaRun) { oaButton.disabled = false; oaController = null; }
    }
  }

  const onSubmit = (event: SubmitEvent) => { event.preventDefault(); renderResults(); };
  const onLiveSubmit = (event: SubmitEvent) => { event.preventDefault(); void runLiveSearch(); };
  const onQuery = () => renderResults();
  const onSpeedInput = (event: Event) => {
    if (event.target instanceof HTMLInputElement && speedInputs.includes(event.target)) setSpeed(event.target.value);
  };
  const onSpeedCommit = (event: Event) => {
    if (event.target instanceof HTMLInputElement && speedInputs.includes(event.target)) writeStorage(STORAGE.seconds, String(seconds));
  };
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>("button");
    if (!button || !workspace.contains(button) || button.disabled) return;
    if (button.matches("[data-research-clear-query]")) {
      query.value = "";
      renderResults();
      query.focus({ preventScroll: true });
    } else if (button.matches("[data-research-reset]")) {
      query.value = "";
      field.value = "all";
      mode = "all";
      renderResults();
      query.focus({ preventScroll: true });
    } else if (button.dataset.researchMode) {
      mode = button.dataset.researchMode === "saved" ? "saved" : "all";
      renderResults();
    } else if (button.dataset.researchOpen) {
      const paper = paperById.get(button.dataset.researchOpen);
      if (paper) {
        openPaper(paper, true);
        reading = withReadingEvent(reading, paper.id, "open", PAPERS);
        saveReading();
        renderSuggestions();
      }
    } else if (button.dataset.researchInterest) {
      const interest = INTERESTS.find((entry) => entry.id === button.dataset.researchInterest);
      if (interest) {
        reading = { ...reading, interests: reading.interests.includes(interest.id)
          ? reading.interests.filter((id) => id !== interest.id) : [...reading.interests, interest.id] };
        saveReading();
        renderSuggestions();
      }
    } else if (button.dataset.researchBookmark) {
      const paper = paperById.get(button.dataset.researchBookmark);
      if (paper) toggleBookmark(paper, true);
    } else if (button.matches("[data-research-save-detail]")) {
      if (selectedPaper) toggleBookmark(selectedPaper, false);
    } else if (isGuideId(button.dataset.researchGuide)) {
      setGuide(button.dataset.researchGuide, true);
    } else if (button.dataset.researchScene !== undefined) {
      selectScene(Number(button.dataset.researchScene), true);
    } else if (button.matches("[data-research-reaction]")) {
      if (portrait.dataset.playing === "true") stopReaction();
      else previewReaction();
    } else if (button.matches("[data-research-play]")) {
      togglePlayback("curated");
    } else if (button.matches("[data-research-stop]")) {
      resetPlayback("curated");
    } else if (button.matches("[data-research-live-play]")) {
      togglePlayback("live");
    } else if (button.matches("[data-research-live-stop]")) {
      resetPlayback("live");
    } else if (button.matches("[data-research-prev], [data-research-next]")) {
      selectScene(sceneIndex + (button.matches("[data-research-prev]") ? -1 : 1), true);
      if (button.disabled) sceneTabs.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
    } else if (button.matches("[data-research-live-prev], [data-research-live-next]")) {
      selectLiveSlide(slideIndex + (button.matches("[data-research-live-prev]") ? -1 : 1));
    } else if (button.dataset.researchLiveOpen !== undefined) {
      const index = Number(button.dataset.researchLiveOpen);
      if (Number.isInteger(index) && livePapers[index]) openLive(livePapers[index]);
    } else if (button.matches("[data-research-live-retry]")) {
      void runLiveSearch();
    } else if (button.matches("[data-research-oa-check]")) {
      void checkOA();
    } else if (button.matches("[data-research-live-back]")) {
      if (lastCurated) openPaper(lastCurated);
      query.focus({ preventScroll: true });
      reveal(query);
    } else if (button.matches("[data-research-back-to-catalog]")) {
      query.focus({ preventScroll: true });
      reveal(query);
    }
  };

  const onSceneKey = (event: KeyboardEvent) => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-research-scene]") || !selectedPaper) return;
    const last = selectedPaper.scenes.length - 1;
    let next = sceneIndex;
    if (event.key === "ArrowRight") next = (sceneIndex + 1) % (last + 1);
    else if (event.key === "ArrowLeft") next = (sceneIndex + last) % (last + 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    selectScene(next, true);
    sceneTabs.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
  };

  const onGuideChange = (event: Event) => {
    const value: unknown = (event as CustomEvent<unknown>).detail;
    if (!value || typeof value !== "object" || !("guide" in value) || !isGuideId(value.guide) || value.guide === selectedGuide) return;
    setGuide(value.guide, false);
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE.bookmarks || event.key === null) {
      bookmarks = new Set(parseSavedPaperIds(event.key === null ? readStorage(STORAGE.bookmarks) : event.newValue));
      const focusedBookmark = doc.activeElement instanceof HTMLElement ? doc.activeElement.dataset.researchBookmark : undefined;
      renderResults();
      if (focusedBookmark) {
        const replacement = [...results.querySelectorAll<HTMLButtonElement>("[data-research-bookmark]")].find((button) => button.dataset.researchBookmark === focusedBookmark);
        (replacement ?? resultsCount).focus({ preventScroll: true });
      }
    }
    if (event.key === STORAGE.guide || event.key === null) {
      const value = event.key === null ? readStorage(STORAGE.guide) : event.newValue;
      if (isGuideId(value) && value !== selectedGuide) setGuide(value, false, false);
    }
    if (event.key === STORAGE.reading || event.key === null) {
      reading = parseReadingSignals(event.key === null ? readStorage(STORAGE.reading) : event.newValue, PAPERS);
      renderSuggestions();
    }
    if (event.key === STORAGE.seconds || event.key === null) {
      setSpeed(sceneSeconds(event.key === null ? readStorage(STORAGE.seconds) : event.newValue));
    }
  };
  const onVisibility = () => { if (doc.hidden) { pausePlayback(); stopReaction(); } };
  const onReducedMotion = () => stopReaction();
  const onMotionChange = () => {
    if (doc.documentElement.dataset.guideMotion === "off") stopReaction();
  };

  // Rebuild generated children on every mount so StrictMode never duplicates controls.
  query.value = "";
  const allFields = make("option", "", "すべての分野");
  allFields.value = "all";
  field.replaceChildren(allFields, ...[...new Set(PAPERS.map((paper) => paper.field))].map((name) => {
    const option = make("option", "", name);
    option.value = name;
    return option;
  }));
  find("[data-research-total]").textContent = folio(PAPERS.length);
  feedback.textContent = "";
  find("[data-research-storage-note]").textContent = storageAvailable
    ? "お気に入り・興味・読書履歴・再生速度はこのブラウザだけに保存します。"
    : "ブラウザ保存を利用できません。選択はこの表示中のみ保持します。";
  renderInterestOptions();
  setSpeed(seconds);
  setLiveFallback("");
  if (!online()) liveStatus.textContent = "このページではオンライン検索を利用できません。arXivのサイトで直接探すか、収録論文をお読みください。";
  renderGuides();
  setGuide(selectedGuide, false, false);
  const initialPaper = (recentPaper ? paperById.get(recentPaper) : undefined) ?? PAPERS[0];
  if (initialPaper) openPaper(initialPaper);
  else { detail.hidden = true; renderResults(); }

  const cleanupMotion = mountMotionControls(workspace);
  form.addEventListener("submit", onSubmit);
  liveForm.addEventListener("submit", onLiveSubmit);
  query.addEventListener("input", onQuery);
  field.addEventListener("change", onQuery);
  workspace.addEventListener("click", onClick);
  workspace.addEventListener("input", onSpeedInput);
  workspace.addEventListener("change", onSpeedCommit);
  sceneTabs.addEventListener("keydown", onSceneKey);
  view.addEventListener("researchphantom:guide-change", onGuideChange);
  view.addEventListener("storage", onStorage);
  doc.addEventListener("visibilitychange", onVisibility);
  reducedMotion.addEventListener("change", onReducedMotion);
  view.addEventListener("researchphantom:motion", onMotionChange);

  const cleanup = () => {
    if (!active) return;
    active = false;
    searchController?.abort();
    oaController?.abort();
    searchRun += 1;
    oaRun += 1;
    oaEmail.value = "";
    stopPlayback();
    cleanupMotion();
    form.removeEventListener("submit", onSubmit);
    liveForm.removeEventListener("submit", onLiveSubmit);
    query.removeEventListener("input", onQuery);
    field.removeEventListener("change", onQuery);
    workspace.removeEventListener("click", onClick);
    workspace.removeEventListener("input", onSpeedInput);
    workspace.removeEventListener("change", onSpeedCommit);
    sceneTabs.removeEventListener("keydown", onSceneKey);
    view.removeEventListener("researchphantom:guide-change", onGuideChange);
    view.removeEventListener("storage", onStorage);
    doc.removeEventListener("visibilitychange", onVisibility);
    reducedMotion.removeEventListener("change", onReducedMotion);
    view.removeEventListener("researchphantom:motion", onMotionChange);
    if (mountedLibraries.get(workspace) === cleanup) mountedLibraries.delete(workspace);
  };
  mountedLibraries.set(workspace, cleanup);
  return cleanup;
}
