import { Compass, LibraryBig, ListVideo, Quote } from "lucide-react";
import { Reveal, SectionHeading } from "../lib/ui";

const JOURNEY = [
  {
    icon: Compass,
    step: "01",
    jp: "見つける",
    title: "Discover",
    body: "Search the curated offline collection by field, author, or title; follow a paper to its original arXiv source.",
    edition: "Light",
  },
  {
    icon: ListVideo,
    step: "02",
    jp: "理解する",
    title: "Understand",
    body: "Seven scenes, one guide, subtitles on. The structure of the argument becomes a story you can actually retell — to your advisor, or to yourself.",
    edition: "Extra",
  },
  {
    icon: LibraryBig,
    step: "03",
    jp: "整理する",
    title: "Organize",
    body: "Save favorites and return to your last opened paper in this browser. Your choices are stored locally on this device.",
    edition: "Light",
  },
  {
    icon: Quote,
    step: "04",
    jp: "引用する",
    title: "Cite",
    body: "A planned workflow for checking original claims and organizing scene-anchored notes before citation.",
    edition: "Full",
  },
];

export default function Benefits() {
  return (
    <section id="benefits" aria-labelledby="benefits-heading" className="relative scroll-mt-24 py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold-400/20 to-transparent"
      />
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          {/* ————— Sticky copy + metrics ————— */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              align="left"
              eyebrow="Why it works"
              jp="効果"
              title={
                <>
                  From first skim to <em className="gold-text font-normal italic">final citation</em>.
                </>
              }
              lead="Reading papers is a craft. The studio gives you a workflow that respects your time, your memory, and your advisor's patience."
            />

            <p className="mt-10 max-w-md border-l border-gold-400/40 pl-5 text-sm leading-relaxed text-sand-300">
              収録論文は出典付きの編集要約です。LPの音声解説は体験用デモで、料金・追加機能は構想段階です。
            </p>
          </div>

          {/* ————— Journey timeline ————— */}
          <ol className="relative space-y-5" aria-label="The four-step reading journey">
            <span
              aria-hidden="true"
                className="absolute bottom-8 left-[27px] top-8 w-px bg-gradient-to-b from-gold-400/50 via-gold-400/20 to-transparent"
            />
            {JOURNEY.map((j, i) => (
              <Reveal key={j.title} delay={i * 120}>
                <li className="group relative flex gap-5 sm:gap-7">
                  <div className="relative shrink-0">
                    <span className="panel panel-hover grid h-14 w-14 place-items-center rounded-2xl text-gold-300 transition-all duration-500 group-hover:shadow-[0_0_28px_-8px_rgba(227,197,131,0.45)]">
                      <j.icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border border-gold-400/40 bg-ink-900 font-display text-[10px] font-semibold text-gold-300">
                      {j.step}
                    </span>
                  </div>
                  <div className="panel panel-hover min-w-0 flex-1 rounded-2xl p-5 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-xl font-normal text-cream-50">
                        {j.title}
                        <span className="ml-2.5 font-jp text-xs font-medium tracking-[0.2em] text-sand-400">
                          {j.jp}
                        </span>
                      </h3>
                      <span className="rounded-full border border-gold-400/25 bg-gold-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-300">
                        {j.edition}
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-sand-300">{j.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
