import {
  AudioLines,
  ChartNoAxesCombined,
  Drama,
  ListVideo,
  Newspaper,
  ShieldCheck,
} from "lucide-react";
import { Reveal, SectionHeading } from "../lib/ui";
import { cn } from "../utils/cn";
import { GUIDE_IDS, GUIDES, type GuideId } from "../lib/guides";

const MINI_SCENES = [
  { jp: "問い", en: "Question" },
  { jp: "入力", en: "Input" },
  { jp: "処理", en: "Process" },
  { jp: "注意", en: "Caution" },
  { jp: "観測", en: "Observation" },
  { jp: "整理", en: "Interpretation" },
  { jp: "結論", en: "Conclusion" },
];

const SMALL_FEATURES = [
  {
    icon: Newspaper,
    title: "A curated reading room",
    body: "Search arXiv online when the server is running, or browse six curated source-linked papers offline. Save favorites and read their seven edited scenes; per-paper narration is text-only for now.",
  },
  {
    icon: AudioLines,
    title: "LP demo audio, subtitles & foley",
    body: "The locally generated LP demo lets you choose one of four character voices across seven scenes, with captions and page-turn sounds. Demo playback works offline; paper scenes remain text-only.",
  },
  {
    icon: ShieldCheck,
    title: "Source-linked reading",
    body: "Every paper in the reading room has an original-text link and source notes. The separate LP audio illustration has not been checked against an original paper.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "An honest path to the original",
    body: "Follow each scene’s source note to the paper and check definitions, numbers, tables, and limits in the author’s own words.",
  },
];

export default function Features({ selectedGuide, onSelectGuide }: { selectedGuide: GuideId; onSelectGuide: (guide: GuideId) => void }) {
  return (
    <section id="features" aria-labelledby="features-heading" className="relative scroll-mt-24 py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-15%] top-1/4 h-[420px] w-[420px] rounded-full bg-gold-600/[0.05] blur-[120px]"
      />
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="The Studio"
          jp="機能"
          title={
            <>
              Serious reading, <em className="gold-text font-normal italic">beautifully staged</em>.
            </>
          }
          lead="Everything a researcher needs to move from first skim to real understanding — arranged with the care of a well-bound book."
        />

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {/* ————— Large: seven-scene method ————— */}
          <Reveal className="md:col-span-2 lg:row-span-2">
            <article className="panel panel-hover group relative h-full overflow-hidden rounded-3xl p-7 sm:p-9">
              <div
                aria-hidden="true"
                className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold-400/[0.07] blur-[70px] transition-all duration-700 group-hover:bg-gold-400/[0.14]"
              />
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold-400/25 bg-gold-400/10 text-gold-300">
                  <ListVideo className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="font-display text-2xl font-normal text-cream-50">The seven-scene method</h3>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-sand-300">
                Every paper unfolds through the same seven scenes —{" "}
                <span className="font-jp text-cream-100">問い</span> to{" "}
                <span className="font-jp text-cream-100">結論</span> — so you always know where you are in an
                argument. The method is the map: question, input, process, caution, observation,
                interpretation, conclusion.
              </p>

              <ol className="mt-8 space-y-0">
                {MINI_SCENES.map((s, i) => (
                  <li key={s.en} className="relative flex items-center gap-4 py-2.5">
                    <span className="font-display text-xs font-medium text-gold-500/80">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-jp text-sm text-cream-100">{s.jp}</span>
                    <span className="h-px flex-1 bg-gradient-to-r from-gold-400/25 to-transparent" aria-hidden="true" />
                    <span className="text-xs uppercase tracking-[0.18em] text-sand-400">{s.en}</span>
                  </li>
                ))}
              </ol>
            </article>
          </Reveal>

          {/* ————— Large: character guides ————— */}
          <Reveal delay={100} className="md:col-span-2">
            <article className="panel panel-hover group relative h-full overflow-hidden rounded-3xl p-7 sm:p-9">
              <div
                aria-hidden="true"
                className="absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-gold-400/[0.06] blur-[70px]"
              />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold-400/25 bg-gold-400/10 text-gold-300">
                    <Drama className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-2xl font-normal text-cream-50">Four guides in your corner</h3>
                </div>
                <span className="rounded-full border border-gold-400/25 bg-gold-400/10 px-3 py-1 font-jp text-[11px] text-gold-300">
                    4人から選べる
                </span>
              </div>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-sand-300">
                Four illustrated guides respond to all seven scenes, with adjustable motion. Their voices narrate the LP demo; the source-linked papers are text-only for now.
              </p>
               <ul className="mt-7 grid grid-cols-4 gap-2 sm:gap-4">
                 {GUIDE_IDS.map((id, i) => {
                   const g = GUIDES[id];
                   return <li key={id} className="group/guide text-center">
                     <button
                       type="button"
                       onClick={() => {
                         onSelectGuide(id);
                         document.getElementById("story-theater")?.scrollIntoView({ behavior: "smooth", block: "center" });
                       }}
                       aria-pressed={selectedGuide === id}
                       aria-label={`${g.name} を案内役に選ぶ`}
                       className="w-full rounded-2xl text-center focus-visible:outline-gold-300"
                     >
                     <div
                       className={cn("relative mx-auto aspect-[4/5] w-full max-w-[130px] overflow-hidden rounded-2xl border shadow-[0_12px_30px_-14px_rgba(0,0,0,0.8)] transition-all duration-500 group-hover/guide:-translate-y-1.5 group-hover/guide:shadow-[0_0_28px_-8px_rgba(227,197,131,0.4)]", selectedGuide === id ? "border-gold-300 ring-2 ring-gold-400/50" : "border-gold-400/25 group-hover/guide:border-gold-400/60")}
                       style={{ transitionDelay: `${i * 30}ms` }}
                     >
                       <img src={g.image} alt="" className="h-full w-full object-cover" />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent opacity-80"
                      />
                      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold tracking-[0.14em] text-gold-300">
                         {g.number}
                      </span>
                    </div>
                     <span className="mt-2 block font-jp text-xs text-cream-100">{g.jp}</span>
                     <span className="block text-[10px] leading-snug text-sand-400">{g.name}</span>
                     <span className="mt-1 block text-[9px] text-gold-300">{selectedGuide === id ? "選択中" : "選ぶ ↗"}</span>
                     </button>
                   </li>;
                 })}
              </ul>
            </article>
          </Reveal>

          {/* ————— Small features ————— */}
          {SMALL_FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={150 + i * 80}>
              <article className="panel panel-hover group h-full rounded-3xl p-6 sm:p-7">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold-400/25 bg-gold-400/10 text-gold-300 transition-all duration-500 group-hover:scale-110 group-hover:shadow-[0_0_24px_-6px_rgba(227,197,131,0.5)]">
                  <f.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-lg font-normal leading-snug text-cream-50">{f.title}</h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-sand-300">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
