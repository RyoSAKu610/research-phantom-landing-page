/** Same-origin research API, shared by Vite and the production HTTP server. */

const ARXIV_API = "https://export.arxiv.org/api/query";
const UNPAYWALL_API = "https://api.unpaywall.org/v2/";
const ARXIV_INTERVAL_MS = 3_000;
const ARXIV_CACHE_MS = 24 * 60 * 60 * 1_000;
const MAX_ARXIV_PENDING = 32;
const MAX_ARXIV_CACHE = 128;
const MAX_OA_CACHE = 256;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

function normalizeQuery(value) {
  if (typeof value !== "string") throw new ApiError(400, "Enter a search query of 2–120 characters.");
  const query = value.trim().replace(/\s+/gu, " ");
  if (query.length < 2 || query.length > 120 || /[\u0000-\u001f\u007f]/u.test(query)) {
    throw new ApiError(400, "Enter a search query of 2–120 characters.");
  }
  return query;
}

function validEmail(value) {
  if (typeof value !== "string" || value.length > 254) return false;
  const [local, domain] = value.split("@");
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..") &&
    !/(?:^|\.)(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/iu.test(domain ?? "") &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/iu.test(value);
}

function normalizeDoi(value) {
  if (typeof value !== "string") throw new ApiError(400, "Enter a valid DOI.");
  const doi = value.trim();
  // A registrant prefix and a nonempty printable suffix. Registry membership
  // cannot be inferred from DOI syntax; Unpaywall may return 404 for non-Crossref DOIs.
  if (!/^10\.\d{4,9}\/[!-~]{1,200}$/iu.test(doi) || /[<>"\\]/u.test(doi)) {
    throw new ApiError(400, "Enter a valid DOI.");
  }
  return doi;
}

function safeOaUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    // OA landing pages can be hosted by many publishers/repositories. Never
    // link to local networks, IP literals or a URL with embedded credentials.
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !host.includes(".") || host.startsWith(".") || host.endsWith(".") ||
      /^\d+\.\d+\.\d+\.\d+$/u.test(host) || host.startsWith("[") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/u.test(host) ||
      host.endsWith(".home.arpa")) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function decodeXml(value) {
  const decoded = value.replace(/&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos);/giu, (_, entity) => {
    const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
    if (!entity.startsWith("#")) return named[entity.toLowerCase()];
    const point = entity[1].toLowerCase() === "x"
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    if (!Number.isInteger(point) || point < 1 || point > 0x10ffff ||
      (point >= 0xd800 && point <= 0xdfff)) throw new Error("Invalid XML entity");
    return String.fromCodePoint(point);
  });
  if (value.replace(/&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos);/giu, "").includes("&")) {
    throw new Error("Unknown XML entity");
  }
  return decoded;
}

function parseAttributes(raw) {
  const attributes = Object.create(null);
  let remainder = raw.trim();
  while (remainder) {
    const match = /^([a-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*/iu.exec(remainder);
    if (!match || Object.hasOwn(attributes, match[1])) throw new Error("Invalid XML attribute");
    attributes[match[1]] = decodeXml(match[2] ?? match[3]);
    remainder = remainder.slice(match[0].length);
  }
  return attributes;
}

/** Small, bounded XML reader for Atom. DTDs/external entities are never expanded. */
function parseXml(xml) {
  const stack = [];
  let root;
  let count = 0;
  let index = 0;
  while (index < xml.length) {
    if (xml[index] !== "<") {
      const end = xml.indexOf("<", index);
      const text = decodeXml(xml.slice(index, end < 0 ? undefined : end));
      if (stack.length) stack.at(-1).text += text;
      else if (text.trim()) throw new Error("Text outside Atom feed");
      index = end < 0 ? xml.length : end;
      continue;
    }
    if (xml.startsWith("<!--", index) || xml.startsWith("<![CDATA[", index) || xml.startsWith("<?", index)) {
      const comment = xml.startsWith("<!--", index);
      const cdata = xml.startsWith("<![CDATA[", index);
      const endMarker = comment ? "-->" : cdata ? "]]>": "?>";
      const end = xml.indexOf(endMarker, index + (comment ? 4 : cdata ? 9 : 2));
      if (end < 0) throw new Error("Unclosed XML section");
      if (cdata) {
        if (!stack.length) throw new Error("CDATA outside Atom feed");
        stack.at(-1).text += xml.slice(index + 9, end);
      }
      index = end + endMarker.length;
      continue;
    }
    if (xml.startsWith("<!", index)) throw new Error("XML declarations and DTDs are not supported");

    // An XML attribute may itself contain '>', so find the tag end outside quotes.
    let end = index + 1;
    let quote = "";
    for (; end < xml.length; end++) {
      const char = xml[end];
      if (quote) { if (char === quote) quote = ""; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === ">") break;
    }
    if (end === xml.length) throw new Error("Unclosed XML tag");
    const tag = xml.slice(index + 1, end).trim();
    index = end + 1;
    if (tag.startsWith("/")) {
      const match = /^\/([a-z_][\w:.-]*)\s*$/iu.exec(tag);
      if (!match || stack.pop()?.name !== match[1]) throw new Error("Mismatched XML tag");
      continue;
    }
    const selfClosing = tag.endsWith("/");
    const opening = selfClosing ? tag.slice(0, -1).trimEnd() : tag;
    const match = /^([a-z_][\w:.-]*)(?=\s|$)/iu.exec(opening);
    if (!match || ++count > 5_000 || stack.length > 24) throw new Error("Invalid Atom feed");
    const node = { name: match[1], attributes: parseAttributes(opening.slice(match[0].length)), children: [], text: "" };
    if (stack.length) stack.at(-1).children.push(node);
    else if (root) throw new Error("Multiple XML roots");
    else root = node;
    if (!selfClosing) stack.push(node);
  }
  if (stack.length || root?.name !== "feed") throw new Error("Invalid Atom feed");
  return root;
}

const child = (node, name) => node.children.find((element) => element.name === name);
const text = (node) => node ? `${node.text}${node.children.map(text).join("")}`.replace(/\s+/gu, " ").trim() : "";
const limited = (value, length) => typeof value === "string" && value.length <= length;

export function parseArxivAtom(xml) {
  if (typeof xml !== "string" || xml.length > 1_000_000) throw new Error("Atom feed too large");
  const feed = parseXml(xml.replace(/^\uFEFF/u, ""));
  const entries = feed.children.filter((element) => element.name === "entry");
  if (entries.length > 10) throw new Error("Unexpected number of arXiv entries");
  return entries.map((entry) => {
    const rawId = text(child(entry, "id"));
    let idUrl;
    try { idUrl = new URL(rawId); } catch { throw new Error("Invalid arXiv ID"); }
    if (!(["https:", "http:"].includes(idUrl.protocol) &&
      ["arxiv.org", "www.arxiv.org", "export.arxiv.org"].includes(idUrl.hostname) &&
      !idUrl.username && !idUrl.password && !idUrl.search && !idUrl.hash)) throw new Error("Invalid arXiv ID");
    const rawPaperId = decodeURIComponent(idUrl.pathname.replace(/^\/abs\//u, ""));
    if (!idUrl.pathname.startsWith("/abs/") ||
      !/^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})(?:v[1-9]\d*)?$/iu.test(rawPaperId)) {
      throw new Error("Invalid arXiv ID");
    }
    const arxivId = rawPaperId.replace(/v[1-9]\d*$/iu, "");
    const title = text(child(entry, "title"));
    const abstract = text(child(entry, "summary"));
    const published = text(child(entry, "published"));
    const authors = entry.children.filter((element) => element.name === "author").map((author) => text(child(author, "name")));
    const category = child(entry, "arxiv:primary_category")?.attributes.term ??
      child(entry, "category")?.attributes.term ?? "";
    const doiText = text(child(entry, "arxiv:doi"));
    const doi = doiText && /^10\.\d{4,9}\/[!-~]{1,200}$/iu.test(doiText) &&
      !/[<>"\\]/u.test(doiText) ? doiText : null;
    const year = Number(published.slice(0, 4));
    if (!title || !limited(title, 600) || !limited(abstract, 12_000) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(published) ||
      !Number.isFinite(Date.parse(published)) || year < 1900 || year > new Date().getUTCFullYear() + 1 ||
      !authors.length || authors.length > 100 || authors.some((author) => !author || !limited(author, 300)) ||
      !limited(category, 80)) throw new Error("Incomplete arXiv entry");
    return {
      arxivId, title, authors, year, abstract, category, doi,
      sourceUrl: `https://arxiv.org/abs/${arxivId}`,
      pdfUrl: `https://arxiv.org/pdf/${arxivId}`,
      published,
    };
  });
}

async function limitedResponse(response, maxBytes) {
  const length = Number(response.headers.get("content-length"));
  if (length > maxBytes) {
    await response.body?.cancel();
    throw new Error("Upstream response too large");
  }
  if (!response.body) throw new Error("Empty upstream response");
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error("Upstream response too large");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(result);
}

function cacheSet(cache, key, value, expires, limit) {
  cache.delete(key);
  cache.set(key, { value, expires });
  if (cache.size > limit) cache.delete(cache.keys().next().value);
}

function cacheGet(cache, key, now) {
  const cached = cache.get(key);
  if (!cached) return undefined;
  if (cached.expires <= now) { cache.delete(key); return undefined; }
  return cached.value;
}

function pruneExpired(cache, now) {
  for (const [key, entry] of cache) {
    if (entry.expires <= now) cache.delete(key);
  }
}

function normalizeOaResult(record) {
  if (!record || typeof record !== "object") return { status: "unknown" };
  if (record.is_oa === false) return { status: "closed", source: "Unpaywall" };
  if (record.is_oa !== true) return { status: "unknown" };
  const locations = [record.best_oa_location, ...(Array.isArray(record.oa_locations) ? record.oa_locations.slice(0, 20) : [])];
  for (const location of locations) {
    if (!location || typeof location !== "object") continue;
    const url = safeOaUrl(location.url_for_pdf) ?? safeOaUrl(location.url);
    if (!url) continue;
    const license = limited(location.license, 80) && /^[\w.\-+ ]+$/u.test(location.license) ? location.license : undefined;
    return { status: "open", url, ...(license ? { license } : {}), source: "Unpaywall" };
  }
  return { status: "unknown" };
}

async function readBody(req, maxBytes) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new ApiError(413, "Request is too large.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "Enter a DOI in a JSON request."); }
}

/**
 * Express/Connect-compatible middleware. Dependencies can be injected for
 * deterministic tests; normal usage takes Node's fetch and environment.
 */
export function createResearchApi({
  fetchImpl = fetch,
  email = process.env.UNPAYWALL_EMAIL,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const arxivCache = new Map();
  const arxivPending = new Map();
  const oaCache = new Map();
  const oaPending = new Map();
  let nextArxivStart = 0;
  let arxivSchedule = Promise.resolve();
  const configuredEmail = typeof email === "string" ? email.trim() : "";

  async function arxiv(query, sort) {
    const key = `${sort}\n${query}`;
    const cached = cacheGet(arxivCache, key, now());
    if (cached) return cached;
    if (arxivPending.has(key)) return arxivPending.get(key);
    pruneExpired(arxivCache, now());
    // Every admitted pending key occupies a future cache slot. Never evict an
    // unexpired result just to admit a new query: arXiv requires a full-day cache.
    if (arxivCache.size + arxivPending.size >= MAX_ARXIV_CACHE) {
      throw new ApiError(429, "Live search capacity is full. Try again after cached queries expire.");
    }
    if (arxivPending.size >= MAX_ARXIV_PENDING) throw new ApiError(429, "Too many searches. Try again shortly.");
    // The queue covers the entire connection, including response body reading.
    // Starts remain >=3 seconds apart even when an upstream request fails fast.
    const request = arxivSchedule.then(async () => {
      const delay = Math.max(0, nextArxivStart - now());
      if (delay) await sleep(delay);
      const url = new URL(ARXIV_API);
      url.search = new URLSearchParams({
        search_query: `all:${query}`, start: "0", max_results: "10",
        sortBy: sort, sortOrder: "descending",
      }).toString();
      const controller = new AbortController();
      try {
        let response;
        try {
          const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
          nextArxivStart = now() + ARXIV_INTERVAL_MS;
          response = await fetchImpl(url.href, { headers: { Accept: "application/atom+xml" },
            redirect: "error", signal });
        } catch (error) {
          if (error?.name === "TimeoutError" || error?.cause?.code === "UND_ERR_HEADERS_TIMEOUT") {
            throw new ApiError(504, "arXiv search timed out. Try again later.");
          }
          throw new ApiError(503, "arXiv search is temporarily unavailable.");
        }
        if (!response.ok) {
          // Even an error response can still have an open body/connection.
          try { await response.body?.cancel(); } catch { /* Abort below also closes it. */ }
          if (response.status === 429) throw new ApiError(503, "arXiv is busy. Try again later.");
          throw new ApiError(502, "arXiv could not complete this search.");
        }
        let papers;
        try { papers = parseArxivAtom(await limitedResponse(response, 1_000_000)); }
        catch (error) {
          if (error?.name === "TimeoutError") throw new ApiError(504, "arXiv search timed out. Try again later.");
          throw new ApiError(502, "arXiv returned an unreadable search response.");
        }
        arxivCache.set(key, { value: papers, expires: now() + ARXIV_CACHE_MS });
        return papers;
      } finally {
        controller.abort();
      }
    });
    arxivSchedule = request.then(() => {}, () => {});
    arxivPending.set(key, request);
    try { return await request; } finally { arxivPending.delete(key); }
  }

  async function lookup(doi, requestEmail) {
    // arXiv's 10.48550 DOIs are DataCite DOIs, not Crossref/Unpaywall records.
    const contact = validEmail(configuredEmail) ? configuredEmail : requestEmail;
    if (!contact) return { status: "unconfigured" };
    if (/^10\.48550\//iu.test(doi)) return { status: "unknown" };
    const key = doi.toLowerCase();
    const cached = cacheGet(oaCache, key, now());
    if (cached) return cached;
    if (oaPending.has(key)) return oaPending.get(key);
    if (oaPending.size >= 32) return { status: "unknown" };
    const request = (async () => {
      const url = new URL(`${UNPAYWALL_API}${encodeURIComponent(doi)}`);
      url.searchParams.set("email", contact);
      try {
        const response = await fetchImpl(url.href, { headers: { Accept: "application/json" },
          redirect: "error", signal: AbortSignal.timeout(8_000) });
        if (response.status === 404 || response.status === 429 || !response.ok) return { status: "unknown" };
        const record = JSON.parse(await limitedResponse(response, 256_000));
        return normalizeOaResult(record);
      } catch { return { status: "unknown" }; }
    })();
    oaPending.set(key, request);
    try {
      const result = await request;
      cacheSet(oaCache, key, result, now() + (result.status === "unknown" ? 60_000 : 60 * 60_000), MAX_OA_CACHE);
      return result;
    } finally { oaPending.delete(key); }
  }

  return function researchApi(req, res, next) {
    let url;
    try { url = new URL(req.url ?? "", "http://localhost"); }
    catch { return next(); }
    if (!url.pathname.startsWith("/api/research/")) return next();
    (async () => {
      try {
        if (url.pathname === "/api/research/status") {
          if (req.method !== "GET") throw new ApiError(405, "Method not allowed.");
          return json(res, 200, { arxiv: true, unpaywall: validEmail(configuredEmail) });
        }
        if (url.pathname === "/api/research/arxiv") {
          if (req.method !== "GET") throw new ApiError(405, "Method not allowed.");
          if (url.searchParams.getAll("q").length !== 1 || url.searchParams.getAll("sort").length > 1) {
            throw new ApiError(400, "Enter a search query of 2–120 characters.");
          }
          const query = normalizeQuery(url.searchParams.get("q"));
          const sort = url.searchParams.get("sort") ?? "relevance";
          if (sort !== "relevance" && sort !== "submittedDate") throw new ApiError(400, "Invalid search order.");
          return json(res, 200, await arxiv(query, sort));
        }
        if (url.pathname === "/api/research/oa") {
          if (req.method !== "POST") throw new ApiError(405, "Method not allowed.");
          if (!/^application\/json(?:\s*;|$)/iu.test(req.headers["content-type"] ?? "")) {
            throw new ApiError(415, "Send JSON with a DOI.");
          }
          const body = await readBody(req, 4_096);
          if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "Enter a DOI in a JSON request.");
          const doi = normalizeDoi(body.doi);
           if (body.email !== undefined && !validEmail(body.email)) throw new ApiError(400, "Enter a real contact email; example.com, example.net and example.org are placeholders.");
          return json(res, 200, await lookup(doi, body.email));
        }
        throw new ApiError(404, "Research endpoint not found.");
      } catch (error) {
        if (!res.headersSent) json(res, error instanceof ApiError ? error.status : 500,
          { error: error instanceof ApiError ? error.message : "Research service is temporarily unavailable." });
      }
    })();
  };
}
