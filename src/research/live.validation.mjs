import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import test from "node:test";
import { createResearchApi, parseArxivAtom } from "../../server/research.mjs";
import { arxivPaperLinks, arxivSearchUrl, lookupOA, researchStatus, searchArxiv } from "./live.ts";

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <title>arXiv search</title>
  <entry>
    <id>http://arxiv.org/abs/2401.01234v2</id>
    <published>2024-01-04T08:09:10Z</published>
    <title>Attention &amp; Retrieval</title>
    <summary>A bounded abstract with a &lt;literal&gt; tag.</summary>
    <author><name>Test Author</name></author>
    <author><name>Second Author</name></author>
    <arxiv:primary_category term="cs.AI" />
    <arxiv:doi>10.1145/1234567</arxiv:doi>
  </entry>
</feed>`;

async function apiServer(t, { fetchImpl = async () => new Response(feed), email, now, sleep } = {}) {
  const api = createResearchApi({ fetchImpl, email, now, sleep });
  const server = createServer((req, res) => api(req, res, () => res.writeHead(404).end()));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    get: async (path) => {
      const response = await fetch(`${base}${path}`);
      return { status: response.status, body: await response.json() };
    },
    post: async (body) => {
      const response = await fetch(`${base}/api/research/oa`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
  };
}

test("Atom parser preserves sourced metadata, canonicalizes links and rejects forged/malformed entries", () => {
  const [paper] = parseArxivAtom(feed);
  assert.deepEqual(paper, {
    arxivId: "2401.01234", title: "Attention & Retrieval", authors: ["Test Author", "Second Author"],
    year: 2024, abstract: "A bounded abstract with a <literal> tag.", category: "cs.AI",
    doi: "10.1145/1234567", sourceUrl: "https://arxiv.org/abs/2401.01234",
    pdfUrl: "https://arxiv.org/pdf/2401.01234", published: "2024-01-04T08:09:10Z",
  });
  assert.throws(() => parseArxivAtom(feed.replace("http://arxiv.org/abs/", "https://bad.example/abs/")), /Invalid arXiv ID/);
  assert.throws(() => parseArxivAtom(`<!DOCTYPE feed [<!ENTITY leak SYSTEM "file:///etc/passwd">]>${feed}`), /DTD/);
  assert.throws(() => parseArxivAtom(feed.replace("&amp;", "&unknown;")), /Unknown XML entity/);
  assert.throws(() => parseArxivAtom(feed.replace("</entry>", "</wrong>")), /Mismatched XML tag/);
});

test("same-origin search validates input, uses ten-result official API and coalesces repeated queries", async (t) => {
  const upstream = [];
  const api = await apiServer(t, { fetchImpl: async (url, options) => {
    upstream.push({ url: new URL(url), options });
    return new Response(feed, { headers: { "Content-Type": "application/atom+xml" } });
  } });
  assert.deepEqual(await api.get("/api/research/status"), { status: 200, body: { arxiv: true, unpaywall: false } });
  for (const invalid of ["x", "x".repeat(121), ""]) {
    const response = await api.get(`/api/research/arxiv?q=${encodeURIComponent(invalid)}`);
    assert.equal(response.status, 400);
    assert.ok(!Array.isArray(response.body));
  }
  const query = encodeURIComponent("graph & retrieval");
  const [first, second] = await Promise.all([
    api.get(`/api/research/arxiv?q=${query}`), api.get(`/api/research/arxiv?q=${query}`),
  ]);
  assert.equal(first.status, 200);
  assert.deepEqual(first, second);
  assert.equal(first.body.length, 1);
  assert.equal((await api.get(`/api/research/arxiv?q=${query}`)).status, 200);
  assert.equal(upstream.length, 1);
  assert.equal(upstream[0].url.origin, "https://export.arxiv.org");
  assert.equal(upstream[0].url.pathname, "/api/query");
  assert.equal(upstream[0].url.searchParams.get("search_query"), "all:graph & retrieval");
  assert.equal(upstream[0].url.searchParams.get("max_results"), "10");
  assert.equal(upstream[0].options.redirect, "error");
  assert.equal((await api.get(`/api/research/arxiv?q=${query}&sort=invalid`)).status, 400);
});

test("slow arXiv responses keep the only upstream connection until the body is read", async (t) => {
  let clock = 1_000;
  let activeConnections = 0;
  const timeline = [];
  let signalFirstStart;
  let releaseFirst;
  const firstStarted = new Promise((resolve) => { signalFirstStart = resolve; });
  const firstCanFinish = new Promise((resolve) => { releaseFirst = resolve; });
  const api = await apiServer(t, {
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    fetchImpl: async (rawUrl) => {
      const query = new URL(rawUrl).searchParams.get("search_query");
      timeline.push({ event: "start", query, at: clock, activeAtStart: activeConnections });
      activeConnections++;
      if (query === "all:transformer") signalFirstStart();
      return new Response(new ReadableStream({
        async start(controller) {
          if (query === "all:transformer") {
            await firstCanFinish;
            clock += 4_500; // Fake a 4.5-second upstream connection / streamed body.
          }
          controller.enqueue(new TextEncoder().encode(feed));
          controller.close();
          activeConnections--;
          timeline.push({ event: "finish", query, at: clock });
        },
      }));
    },
  });
  const first = api.get("/api/research/arxiv?q=transformer");
  await firstStarted;
  const second = api.get("/api/research/arxiv?q=diffusion&sort=submittedDate");
  // Let the second request reach the middleware while the first body is blocked.
  await new Promise((resolve) => setImmediate(resolve));
  const countBeforeFirstFinishes = timeline.filter((event) => event.event === "start").length;
  releaseFirst();
  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.equal(firstResult.status, 200);
  assert.equal(secondResult.status, 200);
  const starts = timeline.filter((event) => event.event === "start");
  assert.equal(countBeforeFirstFinishes, 1, "a second upstream connection must wait for the first body");
  assert.equal(starts.length, 2);
  assert.equal(starts[1].activeAtStart, 0);
  assert.ok(starts[1].at - starts[0].at >= 4_500, "the 4.5-second connection is fully serialized");
  assert.ok(starts[1].at - starts[0].at >= 3_000, "starts remain at least three seconds apart");
  assert.ok(timeline.findIndex((event) => event.event === "finish" && event.query === "all:transformer") <
    timeline.findIndex((event) => event.event === "start" && event.query === "all:diffusion"));
  assert.equal((await api.get("/api/research/arxiv?q=vision")).status, 200);
  const thirdStart = timeline.find((event) => event.event === "start" && event.query === "all:vision");
  assert.equal(thirdStart.activeAtStart, 0);
  assert.ok(thirdStart.at - starts[1].at >= 3_000, "fast responses also keep the start interval");
});

test("arXiv cache retains every unexpired result at capacity and admits only expired slots", async (t) => {
  let clock = 1_000;
  let upstreamCalls = 0;
  const api = await apiServer(t, {
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    fetchImpl: async () => { upstreamCalls++; return new Response(feed); },
  });
  const path = (index) => `/api/research/arxiv?q=capacity-${index}`;
  for (let index = 0; index < 128; index++) {
    assert.equal((await api.get(path(index))).status, 200, `query ${index} should be admitted`);
  }
  assert.equal(upstreamCalls, 128);
  assert.equal((await api.get(path(0))).status, 200, "oldest unexpired query stays cached");
  assert.equal((await api.get(path(127))).status, 200, "newest unexpired query stays cached");
  assert.equal((await api.get(path(128))).status, 429, "the 129th unique query is not admitted");
  assert.equal((await api.get(`${path(0)}&sort=submittedDate`)).status, 429, "sort is part of the key");
  assert.equal(upstreamCalls, 128, "neither cache hits nor rejected queries contact arXiv");

  clock = 1_000 + 24 * 60 * 60 * 1_000 + 1;
  assert.equal((await api.get(path(128))).status, 200, "an expired slot becomes available");
  assert.equal(upstreamCalls, 129);
  assert.equal((await api.get(path(1))).status, 200, "the remaining unexpired results survive pruning");
  assert.equal(upstreamCalls, 129);
  assert.equal((await api.get(path(0))).status, 429, "only the expired entry was removed");
});

test("arXiv error responses close their bodies before the next upstream connection", async (t) => {
  let clock = 1_000;
  let activeConnections = 0;
  let cancelled = false;
  const starts = [];
  const api = await apiServer(t, {
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    fetchImpl: async (rawUrl) => {
      const query = new URL(rawUrl).searchParams.get("search_query");
      starts.push({ query, at: clock, activeAtStart: activeConnections });
      activeConnections++;
      if (query === "all:broken") {
        return new Response(new ReadableStream({
          cancel() { cancelled = true; activeConnections--; },
        }), { status: 503 });
      }
      activeConnections--;
      return new Response(feed);
    },
  });
  const [first, second] = await Promise.all([
    api.get("/api/research/arxiv?q=broken"), api.get("/api/research/arxiv?q=working"),
  ]);
  assert.equal(first.status, 502);
  assert.equal(second.status, 200);
  assert.equal(cancelled, true);
  assert.equal(starts[1].activeAtStart, 0);
  assert.ok(starts[1].at - starts[0].at >= 3_000);
});

test("arXiv upstream failures return JSON errors rather than invented papers", async (t) => {
  const api = await apiServer(t, { fetchImpl: async () => new Response("<html>Unavailable</html>") });
  const response = await api.get("/api/research/arxiv?q=attention");
  assert.equal(response.status, 502);
  assert.equal(typeof response.body.error, "string");
  assert.ok(!("papers" in response.body));
});

test("OA requires contact, skips DataCite arXiv DOIs and accepts safe Unpaywall locations", async (t) => {
  const requested = [];
  const api = await apiServer(t, { fetchImpl: async (rawUrl) => {
    const url = new URL(rawUrl);
    requested.push(url);
    if (url.pathname.includes("unfound")) return new Response("{}", { status: 404 });
    if (url.pathname.includes("busy")) return new Response("{}", { status: 429 });
    if (url.pathname.includes("closed")) return Response.json({ is_oa: false });
    return Response.json({ is_oa: true, best_oa_location: { url: "https://127.0.0.1/private" },
      oa_locations: [{ url: "https://repository.example.org/paper", license: "cc-by" }] });
  } });
  assert.deepEqual((await api.post({ doi: "10.1145/1234567" })).body, { status: "unconfigured" });
  assert.deepEqual((await api.post({ doi: "10.48550/arXiv.2401.01234" })).body,
    { status: "unconfigured" });
  assert.equal(requested.length, 0);
  assert.equal((await api.post({ doi: "10.1145/123", email: "invalid" })).status, 400);
  assert.equal((await api.post({ doi: "10.1145/123", email: "reader@research-institute.edu?extra=1" })).status, 400);
  assert.equal((await api.post({ doi: `10.1145/${"x".repeat(5_000)}` })).status, 413);
  assert.equal((await api.post({ doi: "https://evil.example", email: "reader@research-institute.edu" })).status, 400);
  assert.deepEqual((await api.post({ doi: "10.1145/closed", email: "reader@research-institute.edu" })).body,
    { status: "closed", source: "Unpaywall" });
  assert.deepEqual((await api.post({ doi: "10.1145/unfound", email: "reader@research-institute.edu" })).body,
    { status: "unknown" });
  assert.deepEqual((await api.post({ doi: "10.1145/busy", email: "reader@research-institute.edu" })).body,
    { status: "unknown" });
  assert.deepEqual((await api.post({ doi: "10.1145/open", email: "reader@research-institute.edu" })).body,
    { status: "open", url: "https://repository.example.org/paper", license: "cc-by", source: "Unpaywall" });
  assert.equal(requested.length, 4);
  assert.ok(requested.every((url) => url.origin === "https://api.unpaywall.org" &&
    url.searchParams.get("email") === "reader@research-institute.edu"));
  await api.post({ doi: "10.1145/open", email: "other@research-institute.edu" });
  assert.equal(requested.length, 4, "public OA result is cached by DOI, never by email");
});

test("configured email enables OA status without disclosing the email", async (t) => {
  const api = await apiServer(t, { email: "contact@research-institute.edu", fetchImpl: async (url) => {
    assert.equal(new URL(url).searchParams.get("email"), "contact@research-institute.edu");
    return Response.json({ is_oa: true, best_oa_location: { url: "http://publisher.example/paper" } });
  } });
  assert.deepEqual((await api.get("/api/research/status")).body, { arxiv: true, unpaywall: true });
  assert.deepEqual((await api.post({ doi: "10.1000/paper", email: "reader@research-institute.edu" })).body, { status: "unknown" });
});

test("reserved example contacts never enable Unpaywall or trigger an upstream request", async (t) => {
  for (const email of ["you@example.org", "test@example.com", "person@example.net", "you@sub.example.org"]) {
    let requests = 0;
    const api = await apiServer(t, { email, fetchImpl: async () => { requests++; return Response.json({ is_oa: true }); } });
    assert.deepEqual((await api.get("/api/research/status")).body, { arxiv: true, unpaywall: false });
    assert.deepEqual((await api.post({ doi: "10.1145/1234567" })).body, { status: "unconfigured" });
    const rejected = await api.post({ doi: "10.1145/1234567", email });
    assert.equal(rejected.status, 400);
    assert.match(rejected.body.error, /real contact email/);
    assert.equal(requests, 0);
  }
});

test("canonical arXiv reading links remain safe for OA-unconfigured and DOI-less papers", async (t) => {
  let requests = 0;
  const api = await apiServer(t, { email: "you@example.org", fetchImpl: async () => { requests++; throw new Error("unexpected upstream request"); } });
  for (const doi of ["10.48550/arXiv.2401.01234", "10.1145/1234567"]) {
    const result = await api.post({ doi });
    assert.deepEqual(result.body, { status: "unconfigured" });
  }
  const paper = parseArxivAtom(feed.replace("<arxiv:doi>10.1145/1234567</arxiv:doi>", ""))[0];
  assert.equal(paper.doi, null);
  assert.deepEqual(arxivPaperLinks(paper.arxivId), { original: paper.sourceUrl, pdf: paper.pdfUrl });
  assert.throws(() => arxivPaperLinks("2401.01234?redirect=https://evil.test"), /Invalid arXiv paper ID/);
  assert.equal(requests, 0);
});

test("root server.mjs starts the same API and treats placeholder env as unconfigured", async (t) => {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("../../", import.meta.url),
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), UNPAYWALL_EMAIL: "you@example.org" },
    stdio: "ignore",
  });
  t.after(() => { child.kill(); });
  let status;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) throw new Error(`server exited: ${child.exitCode}`);
    try { status = await fetch(`http://127.0.0.1:${port}/api/research/status`).then((response) => response.json()); break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  assert.deepEqual(status, { arxiv: true, unpaywall: false });
});

test("typed client validates network metadata, preserves errors and offers an HTTPS file fallback", async () => {
  const originalFetch = globalThis.fetch;
  const originalLocation = globalThis.location;
  try {
    const [paper] = parseArxivAtom(feed);
    globalThis.fetch = async (url) => {
      if (String(url).includes("/status")) return Response.json({ arxiv: true, unpaywall: false });
      if (String(url).includes("/arxiv")) return Response.json([paper]);
      return Response.json({ status: "closed", source: "Unpaywall" });
    };
    assert.deepEqual(await searchArxiv("  Attention   retrieval  "), [paper]);
    assert.deepEqual(await researchStatus(), { arxiv: true, unpaywall: false });
    assert.deepEqual(await lookupOA("10.1145/1234567"), { status: "closed", source: "Unpaywall" });
    await assert.rejects(lookupOA("10.1145/1234567", "you@example.org"), /real contact email/);
    assert.equal((await lookupOA("10.48550/arXiv.2401.01234")).status, "unknown");
    globalThis.fetch = async () => Response.json([{ ...paper, pdfUrl: "https://evil.example/paper" }]);
    await assert.rejects(searchArxiv("attention"), /invalid paper data/);
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
    await assert.rejects(searchArxiv("attention"), /unreachable/);
    const external = new URL(arxivSearchUrl("AI & optics"));
    assert.equal(external.origin, "https://arxiv.org");
    assert.equal(external.searchParams.get("query"), "AI & optics");
    globalThis.location = { protocol: "file:" };
    assert.deepEqual(await researchStatus(), { arxiv: false, unpaywall: false });
    await assert.rejects(searchArxiv("attention"), /npm run dev/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
});
