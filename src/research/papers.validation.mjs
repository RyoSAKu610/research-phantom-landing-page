import assert from "node:assert/strict";
import test from "node:test";
import { PAPERS, parseSavedPaperIds, searchPapers } from "./papers.ts";

const ids = (papers) => papers.map((paper) => paper.id);
const sceneKeys = ["question", "input", "process", "caution", "observation", "interpretation", "conclusion"];

test("catalog entries are unique, source-linked and ready for offline text reading", () => {
  assert.ok(PAPERS.length >= 4 && PAPERS.length <= 6);
  assert.equal(new Set(ids(PAPERS)).size, PAPERS.length);
  assert.equal(new Set(PAPERS.map((paper) => paper.arxivId)).size, PAPERS.length);

  for (const paper of PAPERS) {
    assert.match(paper.id, /^[a-z0-9-]+$/u);
    assert.match(paper.arxivId, /^\d{4}\.\d{5}$/u);
    assert.equal(paper.sourceUrl, `https://arxiv.org/abs/${paper.arxivId}`);
    assert.equal(paper.pdfUrl, `https://arxiv.org/pdf/${paper.arxivId}`);
    assert.equal(paper.year, 2000 + Number(paper.arxivId.slice(0, 2)));
    assert.ok(paper.title.length > 10 && paper.titleJa.length > 10);
    assert.ok(paper.authors.length >= 3);
    assert.ok(paper.authors.every((author) => typeof author === "string" && author.trim().length > 0));
    assert.equal(new Set(paper.authors).size, paper.authors.length);
    assert.ok(paper.field.trim().length > 0);
    assert.ok(paper.tags.length > 0);
    assert.ok(Number.isInteger(paper.readingMinutes) && paper.readingMinutes > 0);
    assert.match(paper.abstractJa, /^編集要約：/u);
    assert.equal(paper.audioStatus, "not-recorded");
    assert.deepEqual(paper.scenes.map((scene) => scene.key), sceneKeys);

    for (const scene of paper.scenes) {
      assert.ok(scene.label.trim().length > 0);
      assert.ok(scene.heading.trim().length > 0);
      assert.ok(scene.body.trim().length > 0);
      assert.ok(scene.sourceNote.includes(`arXiv:${paper.arxivId}v`), `${paper.id}/${scene.key} needs a versioned source`);
      assert.match(scene.sourceNote, /§|Abstract/u);
      if (scene.key === "caution" || scene.key === "interpretation") {
        assert.match(scene.body, /^編集部の(注意|解釈)：/u);
        assert.match(scene.sourceNote, /^編集部の(注意|解釈)/u);
      }
    }
  }
});

test("blank searches return the supplied catalog in order as a new array", () => {
  for (const query of ["", " \n\t\u3000", " ".repeat(20_000)]) {
    const results = searchPapers(PAPERS, query);
    assert.deepEqual(results, PAPERS);
    assert.notEqual(results, PAPERS);
  }
});

test("search combines English/Japanese metadata, authors, year and arXiv IDs", () => {
  const cases = [
    ["AtTeNtIoN VASWANI 2017", ["attention"]],
    ["Transformer 機械翻訳", ["attention"]],
    ["BERT Devlin 2018", ["bert"]],
    ["LoRA Hu 低ランク 2021", ["lora"]],
    ["パラメータ 効率的学習", ["lora"]],
    ["ノイズ 2020", ["ddpm"]],
    ["CLIP マルチモーダル", ["clip"]],
    ["Wikipedia 索引 2020", ["rag"]],
    ["1810.04805", ["bert"]],
    ["ARXIV:2005.11401", ["rag"]],
    ["KÜTTLER", ["rag"]],
  ];
  for (const [query, expected] of cases) {
    assert.deepEqual(ids(searchPapers(PAPERS, query)), expected, query);
  }
});

test("normalization supports full-width text, half-width kana and combining marks", () => {
  assert.deepEqual(ids(searchPapers(PAPERS, "　ＢＥＲＴ　ＤＥＶＬＩＮ　")), ["bert"]);
  assert.deepEqual(ids(searchPapers(PAPERS, "ｾﾞﾛｼｮｯﾄ")), ["clip"]);
  assert.deepEqual(ids(searchPapers(PAPERS, "Ku\u0308ttler")), ["rag"]);
});

test("every token must match the same paper and punctuation is literal", () => {
  for (const query of ["Vaswani Devlin", "2018 2021", "LoRA 未収録の検索語", "[.*]", "__proto__"]) {
    assert.deepEqual(searchPapers(PAPERS, query), [], query);
  }
});

test("field filtering is exact and combines with search", () => {
  assert.deepEqual(ids(searchPapers(PAPERS, "", "自然言語処理")), ["attention", "bert"]);
  assert.deepEqual(ids(searchPapers(PAPERS, "BERT", "自然言語処理")), ["bert"]);
  assert.deepEqual(searchPapers(PAPERS, "BERT", "画像生成"), []);
  assert.deepEqual(searchPapers(PAPERS, "", "自然言語"), []);
  assert.deepEqual(searchPapers(PAPERS, "", "ALL"), []);
  assert.deepEqual(searchPapers(PAPERS, "", " 自然言語処理 "), []);
});

test("search respects a readonly subset without falling back to global data", () => {
  const subset = Object.freeze([PAPERS[4], PAPERS[0]]);
  const snapshot = JSON.stringify(subset);
  assert.deepEqual(ids(searchPapers(subset, "")), ["clip", "attention"]);
  assert.deepEqual(ids(searchPapers(subset, "2021")), ["clip"]);
  assert.deepEqual(searchPapers(subset, "BERT"), []);
  assert.deepEqual(searchPapers([], ""), []);
  assert.equal(JSON.stringify(subset), snapshot);
});

test("oversized searches do not silently drop unmatched terms", () => {
  assert.deepEqual(searchPapers(PAPERS, `BERT ${"not-a-match ".repeat(100)}`), []);
  assert.deepEqual(searchPapers(PAPERS, "BERT ".repeat(200)), []);
  assert.deepEqual(searchPapers(PAPERS, "\ufdfa".repeat(100)), []);
});

test("malformed or nonarray favorite values are discarded", () => {
  for (const raw of [null, "", " ", "[", "{broken", "null", "42", "true", '"bert"', '{"ids":["bert"]}', '{"__proto__":{"id":"bert"}}']) {
    assert.deepEqual(parseSavedPaperIds(raw), [], String(raw));
  }
});

test("favorites whitelist IDs, keep first occurrence and ignore wrong types", () => {
  const raw = JSON.stringify(["rag", "bert", "rag", null, 1, true, {}, ["lora"], "unknown", "__proto__", "constructor", " BERT ", "bert", "lora"]);
  assert.deepEqual(parseSavedPaperIds(raw), ["rag", "bert", "lora"]);
  assert.deepEqual(parseSavedPaperIds(JSON.stringify(ids(PAPERS))), ids(PAPERS));
  assert.deepEqual(parseSavedPaperIds("[]"), []);
});

test("favorite results are bounded and returned independently on each call", () => {
  const allIds = ids(PAPERS);
  const duplicates = JSON.stringify(Array.from({ length: 100 }, () => allIds).flat());
  assert.deepEqual(parseSavedPaperIds(duplicates), allIds);
  assert.ok(parseSavedPaperIds(duplicates).length <= 100);
  assert.deepEqual(parseSavedPaperIds(JSON.stringify(Array(3_000).fill("bert"))), []);
  const raw = '["bert","rag"]';
  const result = parseSavedPaperIds(raw);
  result.push("unknown");
  assert.deepEqual(parseSavedPaperIds(raw), ["bert", "rag"]);
});
