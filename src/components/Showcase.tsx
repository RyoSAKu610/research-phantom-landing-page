import { useEffect, useState } from "react";
import type { GuideId } from "../lib/guides";
import GuidePet from "./GuidePet";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookmarkCheck,
  Check,
  Clapperboard,
  Captions,
  ChevronRight,
  Gauge,
  Library,
  Play,
  Search,
  Star,
} from "lucide-react";
import { cn } from "../utils/cn";
import { Reveal, SectionHeading } from "../lib/ui";
import fox from "../assets/guide-fox.jpg";
import owl from "../assets/guide-owl.jpg";

/* ————— Tab definitions ————— */

const TABS = [
  {
    id: "light",
    label: "Light",
    jp: "書架",
    icon: Library,
    title: "The bookshelf",
    desc: "Explore six curated papers in Phantomresearch. Save favorites and return to your last opened paper on this device.",
    features: ["Six source-linked papers", "Favorites on this device", "Search by title, author, or field"],
  },
  {
    id: "full",
    label: "Full",
    jp: "データ解析",
    icon: BarChart3,
    title: "The analyst's bench",
    desc: "A concept for visual, source-traced data analysis. The sample chart is an illustration, not a result from a paper.",
    features: ["Concept preview only", "Source checks before quantitative claims", "No live analysis in this demo"],
  },
  {
    id: "extra",
    label: "Extra",
    jp: "キャラ実演",
    icon: Clapperboard,
    title: "The character theater",
    desc: "An illustrated demo of a seven-scene story with characters, narration controls, and subtitles.",
    features: ["Four selectable character voices & captions", "Seven individually playable scripts", "Speed, volume & page-turn controls"],
  },
] as const;

/* ————— Bookshelf mock ————— */

const SHELF = [
  { title: "Persistent Entropy Transform", field: "TDA", h: "h-44", tone: "from-gold-500/70 to-gold-700/60", read: true },
  { title: "Diffusion Without Noise", field: "ML", h: "h-36", tone: "from-[#7a5c3e] to-[#4d3a28]", fav: true },
  { title: "Wireless Power via metamaterials", field: "PHYS", h: "h-48", tone: "from-[#5d4a33] to-[#392b1e]" },
  { title: "Sleep & Memory Consolidation", field: "NEURO", h: "h-40", tone: "from-gold-600/60 to-[#5d4a33]", read: true },
  { title: "Topological Qubits at Scale", field: "QUANT", h: "h-44", tone: "from-[#4d3a28] to-[#2b2118]", fav: true },
  { title: "Protein Folding Speedups", field: "BIO", h: "h-38", tone: "from-[#8f6a36]/60 to-[#392b1e]" },
  { title: "Language of Corvids", field: "BIO", h: "h-36", tone: "from-gold-700/50 to-[#392b1e]" },
];

function LightMock() {
  return (
    <div className="panel relative overflow-hidden rounded-3xl p-6 sm:p-7">
      <div className="flex items-center justify-between gap-3 border-b border-gold-400/10 pb-4">
        <p className="flex items-center gap-2 text-xs font-medium text-sand-300">
          <Library className="h-4 w-4 text-gold-400" aria-hidden="true" />
          Curated shelf · <span className="text-gold-300">visual concept</span>
        </p>
        <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-sand-400 sm:flex">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          title · author · field
        </div>
      </div>
      <div className="mt-6 flex items-end gap-2.5 overflow-hidden sm:gap-3.5" role="img" aria-label="Bookshelf of research papers">
        {SHELF.map((b, i) => (
          <div key={b.title} className="group/spine relative flex w-9 shrink-0 flex-col items-center sm:w-12" style={{ transitionDelay: `${i * 20}ms` }}>
            {b.fav && (
              <Star className="absolute -top-5 h-3.5 w-3.5 fill-gold-400 text-gold-400" aria-label="Favorited" />
            )}
            {b.read && (
              <BookmarkCheck className="absolute -top-5 h-3.5 w-3.5 text-gold-300" aria-label="Read" />
            )}
            <div
              className={cn(
                "flex w-full origin-bottom items-end justify-center rounded-t-md bg-gradient-to-b pb-2.5 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_10px_24px_-12px_rgba(0,0,0,0.9)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 hover:shadow-[0_0_28px_-8px_rgba(227,197,131,0.45)]",
                b.h,
                b.tone
              )}
            >
              <span className="[writing-mode:vertical-rl] text-[9px] font-semibold uppercase tracking-[0.14em] text-cream-100/90 sm:text-[10px]">
                {b.title}
              </span>
            </div>
            <span className="mt-1.5 text-[8px] font-bold tracking-[0.18em] text-sand-500">{b.field}</span>
          </div>
        ))}
      </div>
      <p className="mt-6 border-t border-gold-400/10 pt-4 text-[11px] text-sand-400">
        Decorative shelf illustration · <a href="#research-library" className="text-gold-300 underline underline-offset-2">search the real collection ↗</a>
      </p>
    </div>
  );
}

/* ————— Analysis mock ————— */

const BARS = [34, 52, 41, 68, 58, 88, 74, 96];

function FullMock() {
  return (
    <div className="panel relative overflow-hidden rounded-3xl p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gold-400/10 pb-4">
        <p className="flex items-center gap-2 text-xs font-medium text-sand-300">
          <BarChart3 className="h-4 w-4 text-gold-400" aria-hidden="true" />
          Figure concept · illustrative values
        </p>
        <div className="flex gap-1.5">
          {["SAMPLE", "NOT PAPER DATA"].map((m) => (
            <span key={m} className="rounded-full border border-gold-400/25 bg-gold-400/10 px-2.5 py-1 text-[10px] font-semibold text-gold-300">
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex h-40 items-end gap-2 sm:gap-3" role="img" aria-label="Concept illustration of a bar chart; values are not research results">
            {BARS.map((v, i) => (
              <div key={i} className="group/bar relative flex-1">
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    i === 7
                      ? "bg-gradient-to-t from-gold-600 to-gold-300 shadow-[0_0_24px_-4px_rgba(227,197,131,0.55)]"
                      : "bg-gradient-to-t from-ink-600 to-ink-500 group-hover/bar:from-gold-700/70 group-hover/bar:to-gold-500/70"
                  )}
                  style={{ height: `${v}%`, transitionDelay: `${i * 70}ms` }}
                />
                {i === 7 && (
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-gold-300">
                    sample
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[9px] font-semibold tracking-[0.14em] text-sand-500">
            <span>NOISE σ →</span>
            <span>STABILITY ↑</span>
          </div>
        </div>

        <div className="hidden shrink-0 text-center sm:block">
          <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-2xl border border-gold-400/30 shadow-[0_0_0_4px_rgba(21,16,12,0.9)]">
            <img src={owl} alt="The Clockwork Owl — analyst guide" className="h-full w-full object-cover" />
          </div>
          <p className="mt-2 font-jp text-[11px] text-cream-100">時計仕掛けのフクロウ</p>
          <p className="text-[9px] uppercase tracking-[0.14em] text-sand-400">The Clockwork Owl</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gold-400/10 pt-4 text-[11px] text-sand-400">
        <span className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5 text-gold-400" aria-hidden="true" /> Figure is a concept, not measured data
        </span>
        <span className="flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-gold-400" aria-hidden="true" /> Original papers linked in Phantomresearch
        </span>
      </div>
    </div>
  );
}

/* ————— Theater mock (Extra) ————— */

function ExtraMock({ onPlayScene }: { onPlayScene: (guide: GuideId, scene: number) => void }) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const onPlayback = (event: Event) => {
      const detail = (event as CustomEvent<{ guide: GuideId; scene: number; playing: boolean }>).detail;
      setPlaying(detail.playing && detail.guide === "kitsune" && detail.scene === 4);
    };
    window.addEventListener("researchphantom:playback", onPlayback);
    return () => window.removeEventListener("researchphantom:playback", onPlayback);
  }, []);
  return (
    <div className="panel relative overflow-hidden rounded-3xl p-6 sm:p-7">
      <div className="flex items-center justify-between border-b border-gold-400/10 pb-4">
        <p className="flex items-center gap-2 text-xs font-medium text-sand-300">
          <Clapperboard className="h-4 w-4 text-gold-400" aria-hidden="true" />
          Scene 05 of 07 · <span className="font-jp text-gold-300">観測</span>
        </p>
        <span className="rounded-full border border-gold-400/25 bg-gold-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-300">
          Demo
        </span>
      </div>

      <div className="mt-6 flex items-center gap-5">
        <div className="relative shrink-0">
           <div aria-hidden="true" className={cn("guide-motion-decoration absolute -inset-2.5 rounded-full bg-gold-400/20 blur-lg", playing && "animate-breathe")} />
            <GuidePet image={fox} alt="The Kitsune Librarian — guide character" scene={4} guide="kitsune" playing={playing} className="h-28 w-28 sm:h-32 sm:w-32" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-400">SCENE 05 · OBSERVATION</p>
          <h4 className="mt-1.5 font-display text-lg font-normal leading-snug text-cream-50">
            What did they measure?
          </h4>
          <p className="mt-1.5 text-xs leading-relaxed text-sand-300">
            Twelve shape classes, three noise regimes, five baselines — stability tracked as the noise grows.
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-500",
              i < 5 ? "bg-gradient-to-r from-gold-600 to-gold-300" : "bg-white/[0.07]"
            )}
            style={{ transitionDelay: `${i * 60}ms` }}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gold-400/10 pt-4">
        <p className="flex min-w-0 items-center gap-2 text-[11px] text-sand-300">
          <Captions className="h-3.5 w-3.5 shrink-0 text-gold-400" aria-hidden="true" />
          字幕 — “the stability bound holds in practice.”
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onPlayScene("kitsune", 4)} aria-label={playing ? "キツネ司書の場面05を停止" : "キツネ司書の場面05を再生"} aria-pressed={playing} className="btn-gold grid h-9 w-9 place-items-center rounded-full">
            {playing ? <span aria-hidden="true">■</span> : <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ————— Section ————— */

export default function Showcase({ onPlayScene }: { onPlayScene: (guide: GuideId, scene: number) => void }) {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("extra");
  const index = TABS.findIndex((t) => t.id === active);
  const tab = TABS[index];

  return (
    <section id="showcase" aria-labelledby="showcase-heading" className="relative scroll-mt-24 py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-12%] top-0 h-[420px] w-[420px] rounded-full bg-gold-500/[0.05] blur-[120px]"
      />
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Three editions"
          jp="三版"
          title={
            <>
              One studio. <em className="gold-text font-normal italic">Three ways to read</em>.
            </>
          }
          lead="Read source-linked summaries in Phantomresearch, explore a future analysis concept, or play the separate seven-scene audio illustration."
        />

        {/* Tabs */}
        <Reveal delay={140}>
          <div
            role="tablist"
            aria-label="Editions"
            className="relative mx-auto mt-12 grid max-w-xl grid-cols-3 rounded-full border border-gold-400/15 bg-ink-850/80 p-1.5 backdrop-blur-sm"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-1.5 left-1.5 w-[calc(33.333%-4px)] rounded-full border border-gold-400/40 bg-gradient-to-b from-gold-400/20 to-gold-400/10 shadow-[0_0_24px_-8px_rgba(227,197,131,0.5)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ transform: `translateX(${index * 100}%)` }}
            />
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={active === t.id}
                onClick={() => setActive(t.id)}
                className={cn(
                  "relative z-10 flex flex-col items-center gap-0.5 rounded-full px-2 py-2.5 transition-colors duration-300",
                  active === t.id ? "text-cream-50" : "text-sand-400 hover:text-cream-100"
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold sm:text-sm">
                  <t.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.label}
                </span>
                <span className="font-jp text-[9px] tracking-[0.2em] opacity-70">{t.jp}</span>
              </button>
            ))}
          </div>
        </Reveal>

        {/* Panel */}
        <Reveal delay={220}>
          <div className="mt-10 grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
            <div key={tab.id} className="tab-panel-enter order-2 lg:order-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-gold-400">
                {tab.label} edition · <span className="font-jp tracking-[0.2em]">{tab.jp}</span>
              </p>
              <h3 className="mt-4 font-display text-3xl font-light text-cream-50 sm:text-4xl">{tab.title}</h3>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-sand-300 sm:text-base">{tab.desc}</p>
              <ul className="mt-7 space-y-3">
                {tab.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-cream-100">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-gold-400/30 bg-gold-400/10">
                      <Check className="h-3.5 w-3.5 text-gold-300" aria-hidden="true" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={active === "extra" ? "#story-theater" : "#research-library"}
                className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-gold-300 transition-colors hover:text-gold-200"
              >
                {active === "full" ? "Read the source-linked papers" : active === "extra" ? "Play the audio demo" : "Open Phantomresearch"}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </a>
            </div>

            <div key={`${tab.id}-mock`} className="tab-panel-enter order-1 lg:order-2">
              {active === "light" && <LightMock />}
              {active === "full" && <FullMock />}
              {active === "extra" && <ExtraMock onPlayScene={onPlayScene} />}
            </div>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <p className="mt-12 flex items-center justify-center gap-2 text-center text-xs text-sand-400">
            Favorites and last-opened paper are saved in this browser. The chart and decorative bookshelf above are concept previews.
            <ChevronRight className="h-3.5 w-3.5 text-gold-400" aria-hidden="true" />
          </p>
        </Reveal>
      </div>
    </section>
  );
}
