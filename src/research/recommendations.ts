import type { Paper } from "./papers";

/** Editorial starting points, chosen across different subjects, never popularity rankings. */
export const EDITORIAL_STARTS = [
  { id: "attention", reason: "言語モデルの設計を、原点からたどる。" },
  { id: "ddpm", reason: "画像生成を、ノイズ除去から考える。" },
  { id: "rag", reason: "検索と生成のつながりを見渡す。" },
  { id: "clip", reason: "画像と言葉の交点から入る。" },
] as const;

export const INTERESTS = [
  { id: "language", label: "言語モデル", paperIds: ["attention", "bert", "lora", "rag"] },
  { id: "efficient", label: "軽量な学習", paperIds: ["lora", "attention"] },
  { id: "image", label: "画像生成", paperIds: ["ddpm", "clip"] },
  { id: "multimodal", label: "画像と言葉", paperIds: ["clip", "ddpm"] },
  { id: "retrieval", label: "検索と知識", paperIds: ["rag", "bert"] },
] as const;

export type ReadingSignals = {
  interests: string[];
  opens: Record<string, number>;
  completed: Record<string, number>;
};

export type PaperSuggestion = { paper: Paper; reason: string; score: number };

const INTEREST_IDS = new Set<string>(INTERESTS.map((interest) => interest.id));
const MAX_STORAGE_LENGTH = 4096;
const MAX_COUNT = 12;

export function emptyReadingSignals(): ReadingSignals {
  return { interests: [], opens: {}, completed: {} };
}

/** Storage is untrusted: discard oversized/broken JSON and retain only catalog IDs and small counts. */
export function parseReadingSignals(raw: string | null, papers: readonly Paper[]): ReadingSignals {
  const state = emptyReadingSignals();
  if (typeof raw !== "string" || raw.length > MAX_STORAGE_LENGTH || !raw.length) return state;
  const known = new Set(papers.map((paper) => paper.id));
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return state;
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.interests)) {
      state.interests = [...new Set(record.interests.filter((id): id is string => typeof id === "string" && INTEREST_IDS.has(id)))].slice(0, INTERESTS.length);
    }
    for (const key of ["opens", "completed"] as const) {
      const counts = record[key];
      if (!counts || typeof counts !== "object" || Array.isArray(counts)) continue;
      for (const paper of papers) {
        if (!known.has(paper.id)) continue;
        const count: unknown = (counts as Record<string, unknown>)[paper.id];
        if (typeof count === "number" && Number.isInteger(count) && count > 0) state[key][paper.id] = Math.min(count, MAX_COUNT);
      }
    }
    return state;
  } catch {
    return state;
  }
}

export function withReadingEvent(state: ReadingSignals, paperId: string, event: "open" | "complete", papers: readonly Paper[]): ReadingSignals {
  if (!papers.some((paper) => paper.id === paperId)) return state;
  const key = event === "open" ? "opens" : "completed";
  return { ...state, [key]: { ...state[key], [paperId]: Math.min(MAX_COUNT, (state[key][paperId] || 0) + 1) } };
}

export function editorialSuggestions(papers: readonly Paper[]): PaperSuggestion[] {
  return EDITORIAL_STARTS.flatMap((start) => {
    const paper = papers.find((entry) => entry.id === start.id);
    return paper ? [{ paper, reason: start.reason, score: 0 }] : [];
  });
}

/** All signals are local, explicit or generated from actual reading interactions. Ties follow catalog order. */
export function recommendPapers(
  papers: readonly Paper[],
  signals: ReadingSignals,
  bookmarkedIds: readonly string[],
  currentId?: string,
  limit = 3,
): PaperSuggestion[] {
  if (!signals.interests.length && !bookmarkedIds.length && !Object.keys(signals.opens).length && !Object.keys(signals.completed).length) return [];
  const known = new Set(papers.map((paper) => paper.id));
  const selected = new Set(signals.interests.filter((id) => INTEREST_IDS.has(id)));
  const bookmarks = new Set(bookmarkedIds.filter((id) => known.has(id)));
  const hasPaper = (ids: readonly string[], id: string) => ids.includes(id);
  const relatedTo = (id: string, otherId: string) => INTERESTS.some((interest) => hasPaper(interest.paperIds, id) && hasPaper(interest.paperIds, otherId));
  return papers.map((paper, index) => {
    const matching = INTERESTS.filter((interest) => selected.has(interest.id) && hasPaper(interest.paperIds, paper.id));
    const bookmarkedNeighbor = [...bookmarks].find((id) => id !== paper.id && relatedTo(paper.id, id));
    const readNeighbor = papers.find((other) => other.id !== paper.id && (signals.opens[other.id] || signals.completed[other.id]) && relatedTo(paper.id, other.id));
    const score = matching.length * 12 + (bookmarkedNeighbor ? 5 : 0) + (readNeighbor ? 3 : 0)
      - (bookmarks.has(paper.id) ? 40 : 0) - Math.min(signals.opens[paper.id] || 0, 3) * 5
      - Math.min(signals.completed[paper.id] || 0, 3) * 10 - (paper.id === currentId ? 35 : 0);
    const reason = matching.length ? `選んだ興味「${matching.map((interest) => interest.label).join("・")}」から。`
      : bookmarkedNeighbor ? `お気に入りの「${papers.find((other) => other.id === bookmarkedNeighbor)?.titleJa}」と近い話題。`
        : readNeighbor ? `読んだ「${readNeighbor.titleJa}」と近い話題。`
          : "選んだ分野とは別の視点も、書架から。";
    return { paper, reason, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, Math.max(0, Math.min(6, Math.trunc(limit))));
}
