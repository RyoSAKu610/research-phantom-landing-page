import { Star } from "lucide-react";
import { Reveal } from "../lib/ui";

const INSTITUTIONS = [
  { name: "The University of Tokyo", style: "font-display text-sm tracking-[0.18em]" },
  { name: "RIKEN", style: "font-sans text-base font-bold tracking-[0.32em]" },
  { name: "Kyoto University", style: "font-display text-base italic" },
  { name: "MIT Media Lab", style: "font-sans text-sm font-semibold lowercase tracking-[0.14em]" },
  { name: "Oxford", style: "font-display text-base font-semibold tracking-[0.08em]" },
  { name: "ETH ZÜRICH", style: "font-sans text-sm font-bold tracking-[0.22em]" },
  { name: "Stanford HAI", style: "font-display text-sm tracking-[0.12em]" },
  { name: "KAIST", style: "font-sans text-base font-bold tracking-[0.26em]" },
  { name: "NUS", style: "font-display text-base font-semibold" },
  { name: "TU Delft", style: "font-sans text-sm font-semibold tracking-[0.18em]" },
  { name: "Caltech", style: "font-display text-sm italic tracking-[0.06em]" },
  { name: "Tsinghua", style: "font-sans text-sm font-bold tracking-[0.3em]" },
];

export default function SocialProof() {
  return (
    <section aria-label="Trusted by researchers" className="relative py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <Reveal>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-sand-400">
            Trusted by researchers and research teams at
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="mask-fade-x mt-9 overflow-hidden" aria-hidden="true">
            <div className="marquee-track animate-marquee flex w-max items-center gap-14 pr-14">
              {[...INSTITUTIONS, ...INSTITUTIONS].map((inst, i) => (
                <span
                  key={`${inst.name}-${i}`}
                  className={`whitespace-nowrap text-sand-400/70 transition-colors duration-300 hover:text-gold-300 ${inst.style}`}
                >
                  {inst.name}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={220}>
          <p className="mt-9 flex flex-wrap items-center justify-center gap-2 text-sm text-sand-300">
            <span className="flex items-center gap-0.5" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-gold-400 text-gold-400" />
              ))}
            </span>
            <span className="font-semibold text-cream-50">4.9 / 5</span>
            <span className="text-sand-400">from 1,200+ reader reviews across 40 countries</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
