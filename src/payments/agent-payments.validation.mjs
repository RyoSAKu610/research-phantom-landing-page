import assert from "node:assert/strict";
import { test } from "node:test";
import { createAgentConsultUrl, createPaymentDraft, formatAgentBrief } from "./agent-payments.ts";

test("Reader is a free reading path, not a payment or enrollment request", () => {
  const draft = createPaymentDraft("reader", "annual", "crypto");
  assert.equal(draft.reference_price.amount, 0);
  assert.equal(draft.reference_price.indicative_only, false);
  assert.equal(draft.billing, null);
  assert.equal(draft.preferred_payment_method, null);
  assert.equal(draft.route, "public_library_optional_agent_consultation");
  assert.equal(draft.integration.status, "not_connected");
  assert.equal(draft.execution_authorized, false);

  const brief = formatAgentBrief(draft);
  assert.match(brief, /登録・支払いは不要/);
  assert.match(brief, /日本語の編集要約と出典付き7場面/);
  assert.match(brief, /週3本の配信・既読管理などは構想中/);
  assert.match(brief, /Agentへの相談や申込は必要ありません/);
  assert.doesNotMatch(brief, /支払い窓口：AI Agent経由のみ/);
});

test("consultation URL carries the current brief to a public Agent route", () => {
  const brief = formatAgentBrief(createPaymentDraft("reader", "annual", "crypto"));
  const url = new URL(createAgentConsultUrl(brief));
  assert.equal(url.origin, "https://chatgpt.com");
  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("q"), brief);
});

test("paid and Lab drafts still describe requests without authorizing checkout", () => {
  const researcher = createPaymentDraft("researcher", "per_use", "jpyc");
  assert.equal(researcher.reference_price.amount, 680);
  assert.equal(researcher.usage?.max_per_calendar_month, 3);
  assert.match(formatAgentBrief(researcher), /決済・申込は未実行/);
  assert.match(formatAgentBrief(researcher), /外部AI AgentはResearchPhantomに接続されておらず/);
  const lab = createPaymentDraft("lab", "annual", "card");
  assert.equal(lab.reference_price.amount, null);
  assert.equal(lab.billing, null);
  assert.equal(lab.execution_authorized, false);
});
