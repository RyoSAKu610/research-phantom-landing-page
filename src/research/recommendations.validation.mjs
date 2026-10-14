import assert from "node:assert/strict";
import test from "node:test";
import { PAPERS } from "./papers.ts";
import { EDITORIAL_STARTS, INTERESTS, editorialSuggestions, emptyReadingSignals, parseReadingSignals, recommendPapers, withReadingEvent } from "./recommendations.ts";

const ids = (suggestions) => suggestions.map(({ paper }) => paper.id);

test("editorial entries are curated, diverse, and remain available without any signals", () => {
  const starts = editorialSuggestions(PAPERS);
  assert.deepEqual(ids(starts), EDITORIAL_STARTS.map(({ id }) => id));
  assert.ok(starts.length >= 3);
  assert.ok(new Set(starts.map(({ paper }) => paper.field)).size >= 3);
  assert.deepEqual(recommendPapers(PAPERS, emptyReadingSignals(), []), []);
  assert.deepEqual(ids(editorialSuggestions(PAPERS.slice(2, 4))), ["ddpm"]);
});

test("explicit interests and reading interactions produce repeatable, explained suggestions", () => {
  const state = { interests: ["retrieval", "language"], opens: { attention: 1 }, completed: {} };
  const first = recommendPapers(PAPERS, state, ["rag"], "attention");
  assert.equal(first.length, 3);
  assert.equal(first[0].paper.id, "bert");
  assert.ok(first[0].reason.includes("検索と知識"));
  assert.deepEqual(recommendPapers(PAPERS, state, ["rag"], "attention"), first);
  assert.ok(!first.some(({ paper }) => paper.id === "attention"));
  assert.ok(!first.some(({ paper }) => paper.id === "rag"));
});

test("saved papers and completed reading are downranked; ties preserve supplied catalog order", () => {
  const initial = recommendPapers(PAPERS, { interests: ["image"], opens: {}, completed: {} }, [], undefined, 6);
  assert.deepEqual(ids(initial).slice(0, 2), ["ddpm", "clip"]);
  const state = withReadingEvent(withReadingEvent(emptyReadingSignals(), "ddpm", "open", PAPERS), "ddpm", "complete", PAPERS);
  state.interests = ["image"];
  assert.equal(recommendPapers(PAPERS, state, ["ddpm"])[0].paper.id, "clip");
  const subset = [PAPERS[4], PAPERS[3]];
  assert.deepEqual(ids(recommendPapers(subset, { interests: ["image"], opens: {}, completed: {} }, [], undefined, 2)), ["clip", "ddpm"]);
  assert.deepEqual(ids(recommendPapers(PAPERS, { interests: ["image"], opens: {}, completed: {} }, [], undefined, 0)), []);
  assert.equal(withReadingEvent(state, "not-a-paper", "open", PAPERS), state);
});

test("untrusted storage cannot inject IDs, counts, or excessive state", () => {
  for (const raw of [null, "", "{broken", "[]", "null", "42", "x".repeat(5000)]) {
    assert.deepEqual(parseReadingSignals(raw, PAPERS), emptyReadingSignals());
  }
  const raw = JSON.stringify({
    interests: ["image", "image", "not-real", ...INTERESTS.map((interest) => interest.id)],
    opens: { attention: 99999, bert: -2, ddpm: "9", unknown: 7, __proto__: { polluted: true } },
    completed: { rag: 1.5, clip: 2 },
  });
  assert.deepEqual(parseReadingSignals(raw, PAPERS), {
    interests: ["image", "language", "efficient", "multimodal", "retrieval"],
    opens: { attention: 12 },
    completed: { clip: 2 },
  });
  assert.equal(withReadingEvent({ interests: [], opens: { attention: 12 }, completed: {} }, "attention", "open", PAPERS).opens.attention, 12);
});
