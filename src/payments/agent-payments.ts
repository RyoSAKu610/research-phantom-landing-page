/** Local draft builder. No payment provider, submission, or spending authority. */
export type Plan = "reader" | "researcher" | "lab";
export type Billing = "per_use" | "monthly" | "annual";
export type PaymentMethod = "crypto" | "jpyc" | "card" | "points";

export const RESEARCHER_PRICES = {
  per_use: { usd: 5, jpyc: 680, period: "story" },
  monthly: { usd: 15, jpyc: 2000, period: "month" },
  annual: { usd: 144, jpyc: 19000, period: "year" },
} as const;

const PLANS = { reader: "Reader", researcher: "Researcher", lab: "Lab" } as const;
const METHODS = { crypto: "暗号資産", jpyc: "JPYC", card: "カード", points: "ポイント" } as const;
const METHOD_NOTES = {
  crypto: "対応通貨・ネットワーク、換算レートと手数料は本番接続後の見積もりで確認します。",
  jpyc: "JPYCの表示額は参考値です。対象チェーン・送金先・ガス代と正式な料金は本番接続時に確認します。現在は送金できません。",
  card: "対応ブランド・発行国は接続先によります。カード情報の入力は本番連携後の決済サービスで行います。",
  points: "連携契約のあるポイントのみが対象です。対象サービス・交換率・利用条件は未確定です。",
};

export function createPaymentDraft(plan: Plan, billing: Billing, method: PaymentMethod) {
  if (!Object.prototype.hasOwnProperty.call(PLANS, plan) || !Object.prototype.hasOwnProperty.call(METHODS, method) || !Object.prototype.hasOwnProperty.call(RESEARCHER_PRICES, billing)) {
    throw new Error("Unknown payment selection");
  }
  const paid = plan === "researcher";
  const price = RESEARCHER_PRICES[billing];
  return {
    schema: "researchphantom.agent-payment-draft.v2",
    merchant: "ResearchPhantom Studio",
    status: "draft",
    route: plan === "reader" ? "public_library_optional_agent_consultation" : "ai_agent_only",
    intent: plan === "reader" ? "free_plan_inquiry" : plan === "lab" ? "request_quote" : billing === "per_use" ? "request_one_story" : "request_plan",
    plan,
    billing: paid ? billing : null,
    preferred_payment_method: plan === "reader" ? null : method,
    reference_price: {
      currency: paid && method === "jpyc" ? "JPYC" : "USD",
      amount: paid ? (method === "jpyc" ? price.jpyc : price.usd) : plan === "reader" ? 0 : null,
      period: paid ? price.period : null,
      indicative_only: plan !== "reader",
      tax_and_fees: plan === "reader" ? "not_applicable" : "unconfirmed",
    },
    usage: paid && billing === "per_use" ? {
      unit: "one_paper_seven_scene_story",
      max_per_calendar_month: 3,
      enforcement: "requires_account_and_payment_integration",
    } : null,
    integration: {
      status: "not_connected",
      agent_service: null,
      checkout_endpoint: null,
      supported_assets: [],
      supported_card_brands: [],
      supported_points_programs: [],
    },
    execution_authorized: false,
  };
}

type Draft = ReturnType<typeof createPaymentDraft>;

export function formatAgentBrief(draft: Draft) {
  if (draft.plan === "reader") return [
    "ResearchPhantom Studioの無料Readerについて相談したいです。",
    "現在このページで使える収録論文ライブラリは$0で、登録・支払いは不要です。",
    "収録論文の検索・分野での絞り込み、日本語の編集要約と出典付き7場面の閲覧、お気に入りと最近開いた論文のブラウザ保存ができます。",
    "新着フィード・週3本の配信・既読管理などは構想中で、現在の利用条件には含まれません。",
    "読んでみたい論文の探し方や、編集要約から原論文の出典を確認する方法を教えてください。あなたはこのページの収録論文に直接接続していません。必要なら私がタイトルや内容を共有します。",
    "これは会話用の下書きです。Readerの利用にAgentへの相談や申込は必要ありません。",
  ].join("\n");
  const { amount, currency } = draft.reference_price;
  const period = draft.billing === "annual" ? " / 年" : draft.billing === "monthly" ? " / 月" : draft.billing === "per_use" ? " / 回" : "";
  const price = amount === null ? "個別見積もり" : currency === "JPYC" ? `${amount.toLocaleString("ja-JP")} JPYC${period}` : `$${amount}${period}`;
  return [
    "ResearchPhantom Studioの利用条件を確認してください。",
    `希望プラン：${PLANS[draft.plan]}`,
    `支払い周期：${draft.billing === "annual" ? "年払い" : draft.billing === "monthly" ? "月払い" : draft.billing === "per_use" ? "都度払い" : "対象外"}`,
    ...(draft.usage ? ["都度払いは論文1本の7場面を1回として、暦月に最大3回まで。利用回数の確認と制限は決済連携後に行います。"] : []),
    `希望する支払手段：${draft.preferred_payment_method ? METHODS[draft.preferred_payment_method] : "なし（無料プラン）"}`,
    "支払い窓口：AI Agent経由のみ",
    `参考料金：${price}。正式料金・税・手数料は未確定。`,
    ...(draft.preferred_payment_method ? [METHOD_NOTES[draft.preferred_payment_method]] : []),
    "現在は決済サービス未接続の下書きです。決済・申込は未実行です。",
    "外部AI AgentはResearchPhantomに接続されておらず、正式な料金・利用条件の確約や申込はできません。",
    "接続先と正式な利用条件が提供されるまで支払いを実行しないでください。この依頼文は支払いの承認ではありません。",
  ].join("\n");
}

/** ChatGPT accepts a URL-encoded request on its public chat route. It is not a ResearchPhantom integration. */
export function createAgentConsultUrl(brief: string) {
  return `https://chatgpt.com/?q=${encodeURIComponent(brief)}`;
}

/** Binds the same trusted HTML in React and in the direct-file edition. */
export function mountAgentPayments(root: ParentNode) {
  const form = root.querySelector<HTMLFormElement>("#agent-request");
  if (!form) return () => {};
  const plan = form.querySelector<HTMLSelectElement>("#agent-plan");
  const billing = form.querySelector<HTMLSelectElement>("#agent-billing");
  const billingField = form.querySelector<HTMLElement>("[data-agent-billing-field]");
  const methodPicker = form.querySelector<HTMLFieldSetElement>(".agent-method-picker");
  const methodNote = form.querySelector<HTMLElement>("[data-agent-method-note]");
  const currencyLabel = form.querySelector<HTMLElement>("[data-agent-currency]");
  const total = form.querySelector<HTMLElement>("[data-agent-total]");
  const usageNote = form.querySelector<HTMLElement>("[data-agent-usage-note]");
  const priceNote = form.querySelector<HTMLElement>(".agent-price-note");
  const summary = form.querySelector<HTMLElement>("[data-agent-summary]");
  const freePath = form.querySelector<HTMLElement>("[data-agent-free-path]");
  const brief = form.querySelector<HTMLTextAreaElement>("#agent-brief");
  const preview = form.querySelector<HTMLDetailsElement>(".agent-brief-preview");
  const consult = form.querySelector<HTMLAnchorElement>("[data-agent-consult]");
  const feedback = form.querySelector<HTMLElement>("[data-agent-feedback]");
  if (!plan || !billing || !billingField || !methodPicker || !methodNote || !currencyLabel || !total || !usageNote || !priceNote || !summary || !freePath || !brief || !preview || !consult || !feedback) return () => {};
  const radios = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="payment-method"]'));
  let active = true;
  let revision = 0;

  const getDraft = () => createPaymentDraft(
    plan.value as Plan,
    billing.value as Billing,
    (radios.find((input) => input.checked)?.value || "crypto") as PaymentMethod,
  );

  const refresh = () => {
    revision += 1;
    const draft = getDraft();
    const free = draft.plan === "reader";
    billing.disabled = draft.plan !== "researcher";
    billingField.hidden = free;
    methodPicker.hidden = free;
    methodNote.hidden = free;
    priceNote.hidden = free;
    freePath.hidden = !free;
    radios.forEach((input) => { input.disabled = free; });
    methodNote.textContent = free ? "" : METHOD_NOTES[draft.preferred_payment_method!];
    const { amount, currency } = draft.reference_price;
    currencyLabel.textContent = free ? "Reader · 利用料金" : `参考料金 · ${currency}`;
    total.textContent = amount === null ? "個別見積もり" : currency === "JPYC" ? `${amount.toLocaleString("ja-JP")} JPYC` : `$${amount}`;
    if (draft.billing) {
      const period = document.createElement("small");
      period.textContent = draft.billing === "annual" ? " / 年" : draft.billing === "per_use" ? " / 回" : " / 月";
      total.appendChild(period);
    }
    usageNote.hidden = draft.billing !== "per_use";
    summary.textContent = free
      ? "Reader · 収録論文を無料で読む（登録・決済不要）"
      : draft.plan === "lab" ? "Lab · チームの利用条件に応じて見積もり"
      : draft.billing === "per_use" ? "Researcher · 1回で論文1本の7場面 · 月3回まで"
      : draft.billing === "annual" ? "Researcher · 年払い（USDなら $12 / 月相当）" : "Researcher · 月ごとの参考料金";
    brief.value = formatAgentBrief(draft);
    consult.href = createAgentConsultUrl(brief.value);
    feedback.textContent = free
      ? "無料の論文は上のリンクからすぐ読めます。Agentへの相談は任意です。"
      : "依頼文は下書きです。ChatGPTで相談しても申込・決済は行われません。";
  };

  const copy = async () => {
    const currentRevision = revision;
    const text = brief.value;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (active) feedback.textContent = currentRevision === revision
        ? "依頼文をコピーしました。お使いのAI Agentに貼り付けてください。決済は未実行です。"
        : "変更前の依頼文をコピーしました。現在の内容で再度コピーしてください。";
    } catch {
      if (!active) return;
      preview.open = true;
      brief.focus();
      brief.select();
      feedback.textContent = "自動コピーできませんでした。選択された依頼文を手動でコピーしてください。";
    }
  };

  const download = () => {
    const draft = getDraft();
    const blob = new Blob([JSON.stringify(draft, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `researchphantom-${draft.plan}-agent-draft.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    feedback.textContent = "下書きJSONの保存を開始しました。対応するAgentに添付できます。決済は未実行です。";
  };

  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[data-agent-plan][href="#agent-request"]');
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
      const selected = link.dataset.agentPlan;
      if (!selected || !Object.prototype.hasOwnProperty.call(PLANS, selected)) return;
      event.preventDefault();
      plan.value = selected;
      const selectedBilling = link.dataset.agentBilling;
      billing.value = selectedBilling === "monthly" || selectedBilling === "per_use" ? selectedBilling : "annual";
      refresh();
      // An explicit scroll also works when the same hash is clicked twice (including file:// pages).
      if (window.location.hash !== "#agent-request") window.location.hash = "agent-request";
      form.scrollIntoView({ block: "start" });
      plan.focus({ preventScroll: true });
    }
    const readLink = event.target.closest<HTMLAnchorElement>('a[data-agent-read-free][href="#research-library"]');
    if (readLink && form.contains(readLink) && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
      const library = document.getElementById("research-library");
      if (library) {
        event.preventDefault();
        if (window.location.hash !== "#research-library") window.location.hash = "research-library";
        library.scrollIntoView({ block: "start" });
        library.tabIndex = -1;
        library.focus({ preventScroll: true });
      }
    }
    if (form.contains(event.target)) {
      if (event.target.closest("[data-agent-consult]")) {
        feedback.textContent = "ChatGPTを別タブで開きます。外部サービスで会話が始まる場合がありますが、このサイトへの申込・決済は行われません。開かない場合は依頼文をコピーして貼り付けてください。";
      }
      if (event.target.closest("[data-agent-copy]")) void copy();
      if (event.target.closest("[data-agent-download]")) download();
    }
  };
  const onSubmit = (event: SubmitEvent) => { event.preventDefault(); };
  form.addEventListener("change", refresh);
  form.addEventListener("submit", onSubmit);
  document.addEventListener("click", onClick);
  refresh();

  return () => {
    active = false;
    form.removeEventListener("change", refresh);
    form.removeEventListener("submit", onSubmit);
    document.removeEventListener("click", onClick);
  };
}
