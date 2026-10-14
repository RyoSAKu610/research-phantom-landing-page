import { useState } from "react";
import { ArrowUpRight, Check, Sparkles } from "lucide-react";
import { cn } from "../utils/cn";
import { Reveal, SectionHeading } from "../lib/ui";
import { RESEARCHER_PRICES, type Billing } from "../payments/agent-payments";

const PLANS = [
  {
    name: "Reader",
    jp: "読者",
    monthly: 0,
    annual: 0,
    tagline: "For the curious",
    cta: "Agentに無料プランを相談",
    features: [
      "収録論文の検索と分野別の絞り込み",
      "出典付きの日本語編集要約と7場面",
      "4人の案内役とテキストで読む",
      "お気に入り・最近開いた論文をブラウザに保存",
    ],
  },
  {
    name: "Researcher",
    jp: "研究者",
    monthly: 15,
    annual: 12,
    tagline: "For the daily reader",
    cta: "Agentへの依頼を作る",
    popular: true,
    features: [
      "Unlimited seven-scene stories",
      "Audio narration & page foley",
      "Full-edition data analysis",
      "New-paper alerts by field",
      "BibTeX & scene-anchored note export",
      "Priority staging requests",
    ],
  },
  {
    name: "Lab",
    jp: "研究室",
    monthly: null,
    annual: null,
    tagline: "For teams & institutions",
    cta: "Agentに見積もりを依頼",
    features: [
      "Everything in Researcher",
      "Shared team shelves & reading lists",
      "SSO, provisioning & admin console",
      "Onboarding workshop for your lab",
      "Custom paper pipelines",
    ],
  },
];

export default function Pricing() {
  const [billing, setBilling] = useState<Billing>("annual");
  const annual = billing === "annual";

  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="relative scroll-mt-24 py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-24 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-gold-500/[0.05] blur-[130px]"
      />
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Pricing"
          jp="料金"
          title={
            <>
              Curiosity, <em className="gold-text font-normal italic">priced kindly</em>.
            </>
          }
          lead="Readerの収録論文は、登録・支払いなしで今すぐ読めます。"
        />

        <p className="agent-pricing-note">
          <a href="#agent-payments">Researcher / Labの相談依頼を作る</a> · 決済連携準備中
          <small>Readerの公開ライブラリは無料。Researcher / Labの料金と機能は構想段階の参考情報です。</small>
        </p>

        {/* Choose the reference price for the Researcher plan. */}
        <Reveal delay={140}>
          <div className="mx-auto mt-10 grid w-full max-w-[440px] grid-cols-3 gap-1 rounded-full border border-gold-400/20 bg-black/20 p-1.5" role="group" aria-label="Researcherの支払い周期">
            {(["per_use", "monthly", "annual"] as const).map((option) => (
              <button key={option} type="button" aria-pressed={billing === option} onClick={() => setBilling(option)}
                className={cn("flex min-w-0 min-h-12 flex-col items-center justify-center rounded-full px-1 py-2 text-[11px] font-semibold leading-tight transition-colors sm:text-sm", billing === option ? "bg-gold-300 text-ink-900 shadow-[0_4px_18px_rgba(227,197,131,.18)]" : "text-sand-400 hover:text-cream-50")}>
                {option === "per_use" ? <>都度払い<span className="mt-0.5 text-[9px]">月3回まで</span></> : option === "monthly" ? "月払い" : <>年払い<span className="mt-0.5 text-[9px]">−20%</span></>}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
          {PLANS.map((p, i) => {
            const price = p.name === "Researcher" ? billing === "annual" ? 12 : RESEARCHER_PRICES[billing].usd : annual ? p.annual : p.monthly;
            return (
              <Reveal key={p.name} delay={i * 110} className="h-full">
                <article
                  className={cn(
                    "panel panel-hover relative flex h-full flex-col rounded-3xl p-7 sm:p-8",
                    p.popular &&
                      "border-gold-400/40 bg-gradient-to-b from-gold-400/[0.09] to-transparent shadow-[0_0_60px_-24px_rgba(227,197,131,0.35)]"
                  )}
                >
                  {p.popular && (
                    <span className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-gradient-to-r from-gold-300 to-gold-500 px-4 py-1.5 text-[11px] font-bold text-ink-900 shadow-[0_8px_24px_-8px_rgba(227,197,131,0.6)]">
                      <Sparkles className="h-3 w-3" aria-hidden="true" />
                      Most popular
                    </span>
                  )}

                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-2xl font-normal text-cream-50">{p.name}</h3>
                    <span className="font-jp text-xs tracking-[0.24em] text-sand-400">{p.jp}</span>
                  </div>
                  <p className="mt-1 text-xs text-sand-400">{p.tagline}</p>

                  <div className="mt-6 flex items-end gap-1.5" aria-live="polite">
                    {price === null ? (
                      <span className="font-display text-4xl font-light text-cream-50">Custom</span>
                    ) : (
                      <span
                        key={String(price) + String(annual)}
                        className="scene-shift font-display text-5xl font-light leading-none text-cream-50"
                      >
                        ${price}
                      </span>
                    )}
                    {price !== null && (
                       <span className="pb-0.5 text-xs text-sand-400">{price === 0 ? "無料プラン" : billing === "annual" ? "/ 月相当・年払い" : billing === "per_use" ? "/ 回" : "/ 月"}</span>
                    )}
                  </div>

                  {p.name === "Researcher" && (
                     <div className="mt-3 space-y-1 text-xs text-sand-300">
                       <p>{billing === "annual" ? "参考年額 $144（$12 × 12か月）" : billing === "per_use" ? "論文1本の7場面につき1回 · 暦月に最大3回" : "参考月額 $15"}</p>
                       <p className="text-gold-300">JPYCなら {RESEARCHER_PRICES[billing].jpyc.toLocaleString("ja-JP")} JPYC {billing === "per_use" ? "/ 回" : billing === "annual" ? "/ 年" : "/ 月"}（参考）</p>
                     </div>
                  )}

                  <p className="mt-7 border-t border-gold-400/10 pt-5 text-[11px] font-semibold tracking-wide text-gold-300">
                    {p.name === "Reader" ? "いま使える機能" : "構想中の機能（現在は提供前）"}
                  </p>
                  <ul className="mt-3 flex-1 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-cream-100/90">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden="true" />
                         {p.name === "Researcher" && f === "Unlimited seven-scene stories" && billing === "per_use" ? "1回につき論文1本の7場面 · 月3回まで" : f}
                      </li>
                    ))}
                  </ul>
                   {p.name === "Reader" && <p className="mt-4 text-xs leading-relaxed text-sand-400">arXivのオンライン検索はサーバー稼働時に利用できます。新着フィード・週3本の配信・既読管理は構想中です。ライブラリの閲覧にAgentへの相談は必要ありません。</p>}

                  <a
                    href="#agent-request"
                    data-agent-plan={p.name.toLowerCase()}
                    data-agent-billing={p.name === "Researcher" ? billing : "annual"}
                    className={cn(
                      "mt-8 flex items-center justify-center gap-1.5 rounded-full px-6 py-3 text-sm font-semibold",
                      p.popular ? "btn-gold" : "btn-ghost text-cream-100"
                    )}
                  >
                    {p.cta}
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={200}>
          <p className="mt-10 text-center text-xs text-sand-400">
              Researcher / Labの参考料金はUSDとJPYCで表示。JPYC額は1ドル＝150円の換算例より少し安い設定です。正式料金・税・ガス代と実際の為替は接続時に確定します。依頼文の作成では申込・請求は発生しません。
          </p>
        </Reveal>
      </div>
    </section>
  );
}
