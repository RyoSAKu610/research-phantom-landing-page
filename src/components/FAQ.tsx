import { useState } from "react";
import { ChevronDown, MessageCircleQuestion } from "lucide-react";
import { cn } from "../utils/cn";
import { Reveal, SectionHeading } from "../lib/ui";

const FAQS = [
  {
    q: "支払いはAI Agent経由だけですか？",
    a: "はい。有料プランのお支払いはAI Agent経由のみとする方針です。サイトでプランと希望する支払手段を選び、依頼文を作成してお使いのAgentへ渡せます。現在は決済サービス未接続のため、依頼文のコピー・JSON保存まで利用できます。",
  },
  {
    q: "JPYC・クリプト・カード・ポイントは使えますか？",
    a: "4つの支払手段から希望を選んだ依頼文を作成できます。JPYCの対象チェーン・受取先、暗号資産の種類やカード・ポイントの条件は本番接続時に確定します。現時点で送金や決済はできません。",
  },
  {
    q: "どのAI Agentに依頼できますか？ 今すぐ決済されますか？",
    a: "依頼文はテキストを受け取れるAI Agentに貼り付けられます。コピー・JSON保存では決済・申込は実行されません。Researcherは都度払い$5（1回で論文1本の7場面、暦月に最大3回）、月払い$15、年払い$144が参考価格です。JPYC参考額も選択時に表示します。",
  },
  {
    q: "How do you choose which papers to stage?",
    a: "Phantomresearchに実在する6論文の編集要約を収録し、タイトル・著者・分野で検索できます。各論文に7場面の要点と出典箇所、原文・PDFのリンクがあります。LPの音声付き解説は別の体験用デモです。",
  },
  {
    q: "Are the explanations checked against the original text?",
    a: "Phantomresearchの6本は原論文の抄録・本文に基づく編集要約で、各場面に出典箇所があります。逐語訳ではなく、厳密な条件・数値は原文で確認してください。LPの音声付き体験デモは原文照合前のため、論文の事実として引用しないでください。",
  },
  {
    q: "Are the characters the paper's authors?",
    a: "No. Every character — from the phantom scholar to the clockwork owl — is a metaphorical guide for this demo, not a representation of a real author.",
  },
  {
    q: "Can I request my own paper or thesis chapter?",
    a: "現在、お問い合わせの実送信先を設定中です。フォームは受付準備中で、送信されません。",
  },
  {
    q: "Which languages are supported?",
    a: "収録論文の読解は日本語の編集要約、書誌情報と原論文は英語です。LPの音声デモは日本語で、論文ごとの英語音声や言語切替は現在ありません。",
  },
  {
    q: "Do you offer student pricing?",
    a: "学生割引や機関向けプランの条件は未確定です。掲載中の料金はデモの参考情報です。",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number>(0);

  return (
    <section id="faq" aria-labelledby="faq-heading" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="relative mx-auto w-full max-w-4xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Questions"
          jp="質問"
          title={
            <>
              Answered, <em className="gold-text font-normal italic">scene by scene</em>.
            </>
          }
          lead="収録論文、音声デモ、料金下書きについて。"
        />

        <div className="mt-14 space-y-3.5">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 70}>
                <div
                  className={cn(
                    "panel overflow-hidden rounded-2xl transition-colors duration-500",
                    isOpen && "border-gold-400/35"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-button-${i}`}
                    className="flex w-full items-center gap-4 px-5 py-5 text-left sm:px-7"
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-all duration-500",
                        isOpen
                          ? "border-gold-400/50 bg-gold-400/15 text-gold-300"
                          : "border-white/10 bg-white/[0.03] text-sand-400"
                      )}
                    >
                      <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex-1 font-display text-base font-normal text-cream-50 sm:text-lg">{f.q}</span>
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 shrink-0 text-gold-400 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        isOpen && "rotate-180"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-button-${i}`}
                    className={cn(
                      "grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-6 pl-[4.25rem] pr-8 text-sm leading-relaxed text-sand-300 sm:px-7 sm:pl-[4.75rem]">
                        {f.a}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
