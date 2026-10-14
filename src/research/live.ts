/** Client contract for live, unedited arXiv metadata and Unpaywall OA checks. */
export type LivePaper = {
  arxivId: string;
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  category: string;
  doi: string | null;
  sourceUrl: string;
  pdfUrl: string;
  published: string;
};

export type OAResult = {
  status: "open" | "closed" | "unknown" | "unconfigured";
  url?: string;
  license?: string;
  source?: string;
};

const localFile = () => typeof location !== "undefined" && location.protocol === "file:";
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;
const arxivIdPattern = /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[a-z]{2})?\/\d{7})$/iu;
/** Canonical HTTPS reading links; never interpolate an unvalidated upstream ID. */
export function arxivPaperLinks(id: string): { original: string; pdf: string } {
  if (!arxivIdPattern.test(id)) throw new Error("Invalid arXiv paper ID.");
  return { original: `https://arxiv.org/abs/${id}`, pdf: `https://arxiv.org/pdf/${id}` };
}
const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/iu;
const validEmail = (value: string): boolean => {
  const [local, domain] = value.split("@");
  return value.length <= 254 && local.length <= 64 && !local.startsWith(".") &&
    !local.endsWith(".") && !local.includes("..") &&
    !/(?:^|\.)(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/iu.test(domain ?? "") && emailPattern.test(value);
};

function isSafeExternalUrl(value: unknown): value is string {
  if (!isText(value, 2048)) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      host.includes(".") && !host.startsWith(".") && !host.endsWith(".") &&
      !/^\d+\.\d+\.\d+\.\d+$/u.test(host) && !host.startsWith("[") &&
      !/(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/u.test(host) &&
      !host.endsWith(".home.arpa");
  } catch {
    return false;
  }
}

function validatePaper(value: unknown): LivePaper {
  if (!isRecord(value)) throw new Error("The search service returned invalid paper data.");
  const { arxivId, title, authors, year, abstract, category, doi, sourceUrl, pdfUrl, published } = value;
  if (!isText(arxivId, 48) || !arxivIdPattern.test(arxivId) ||
    !isText(title, 600) || !title.trim() ||
    !Array.isArray(authors) || authors.length < 1 || authors.length > 100 ||
    !authors.every((author: unknown) => isText(author, 300) && author.trim()) ||
    !Number.isInteger(year) || (year as number) < 1900 || (year as number) > new Date().getUTCFullYear() + 1 ||
    !isText(abstract, 12_000) || !isText(category, 80) ||
    !(doi === null || (isText(doi, 220) && /^10\.\d{4,9}\/[!-~]{1,200}$/iu.test(doi) && !/[<>"\\]/u.test(doi))) ||
    !isText(published, 30) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(published) ||
    !Number.isFinite(Date.parse(published)) || Number(published.slice(0, 4)) !== year ||
    sourceUrl !== `https://arxiv.org/abs/${arxivId}` ||
    pdfUrl !== `https://arxiv.org/pdf/${arxivId}`) {
    throw new Error("The search service returned invalid paper data.");
  }
  return { arxivId, title, authors, year: year as number, abstract, category, doi,
    sourceUrl: sourceUrl as string, pdfUrl: pdfUrl as string, published };
}

async function request(url: string, options: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try { response = await fetch(url, { ...options, headers: { Accept: "application/json", ...options.headers } }); }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("The live research service is unreachable. Check your connection or open arXiv directly.");
  }
  if (!response.ok) {
    if (response.status === 400) throw new Error("The search or DOI was rejected. Check your input.");
    if (response.status === 429) throw new Error("Too many searches. Try again shortly.");
    throw new Error("The live research service is unavailable. Try again or open arXiv directly.");
  }
  try {
    if (Number(response.headers.get("content-length")) > 512_000) throw new Error("Too much data");
    const raw = await response.text();
    if (raw.length > 512_000) throw new Error("Too much data");
    return JSON.parse(raw) as unknown;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("The live research service returned an unreadable response.");
  }
}

/** A normal arXiv webpage, usable even when this app is opened from file://. */
export function arxivSearchUrl(query: string): string {
  const url = new URL("https://arxiv.org/search/");
  const trimmed = query.trim();
  if (trimmed) {
    url.searchParams.set("query", trimmed);
    url.searchParams.set("searchtype", "all");
    url.searchParams.set("abstracts", "show");
    url.searchParams.set("order", "-announced_date_first");
  }
  return url.href;
}

export async function searchArxiv(query: string, signal?: AbortSignal): Promise<LivePaper[]> {
  const normalized = query.trim().replace(/\s+/gu, " ");
  if (normalized.length < 2 || normalized.length > 120 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error("Enter a search query of 2–120 characters.");
  }
  if (localFile()) throw new Error("Live search requires npm run dev or npm run start. You can open arXiv directly.");
  const payload = await request(`/api/research/arxiv?q=${encodeURIComponent(normalized)}`, { signal });
  if (!Array.isArray(payload) || payload.length > 10) throw new Error("The search service returned invalid paper data.");
  return payload.map(validatePaper);
}

export async function lookupOA(doi: string, email?: string, signal?: AbortSignal): Promise<OAResult> {
  const trimmed = doi.trim();
  if (!/^10\.\d{4,9}\/[!-~]{1,200}$/iu.test(trimmed) || /[<>"\\]/u.test(trimmed)) {
    throw new Error("Enter a valid DOI.");
  }
  if (email !== undefined && !validEmail(email)) {
    throw new Error("Enter a real contact email; example.com, example.net and example.org are placeholders.");
  }
  if (/^10\.48550\//iu.test(trimmed)) return { status: "unknown" };
  if (localFile()) throw new Error("OA lookup requires npm run dev or npm run start.");
  const payload = await request("/api/research/oa", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doi: trimmed, ...(email ? { email } : {}) }), signal,
  });
  if (!isRecord(payload) || !["open", "closed", "unknown", "unconfigured"].includes(payload.status as string) ||
    (payload.url !== undefined && !isSafeExternalUrl(payload.url)) ||
    (payload.license !== undefined && !isText(payload.license, 80)) ||
    (payload.source !== undefined && !isText(payload.source, 80)) ||
    (payload.status === "open" && !payload.url)) {
    throw new Error("The OA service returned invalid status data.");
  }
  return {
    status: payload.status as OAResult["status"],
    ...(payload.url ? { url: payload.url as string } : {}),
    ...(payload.license ? { license: payload.license as string } : {}),
    ...(payload.source ? { source: payload.source as string } : {}),
  };
}

export async function researchStatus(signal?: AbortSignal): Promise<{ arxiv: boolean; unpaywall: boolean }> {
  if (localFile()) return { arxiv: false, unpaywall: false };
  const payload = await request("/api/research/status", { signal });
  if (!isRecord(payload) || typeof payload.arxiv !== "boolean" || typeof payload.unpaywall !== "boolean") {
    throw new Error("The live research service returned invalid status data.");
  }
  return { arxiv: payload.arxiv, unpaywall: payload.unpaywall };
}
