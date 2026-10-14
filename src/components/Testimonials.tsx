import { Quote, Star } from "lucide-react";
import { cn } from "../utils/cn";
import { Reveal, SectionHeading } from "../lib/ui";

const TESTIMONIALS = [
  {
    quote:
      "I read forty papers a month for my review article. The seven scenes cut my first pass to minutes — and for the first time, I can retell the caveats as confidently as the claims.",
    name: "Dr. Yuki Tanaka",
    role: "Photonics · The University of Tokyo",
    initials: "YT",
  },
  {
    quote:
      "The caution scene alone is worth the subscription. It taught my students to look for the limitation before the headline number — that's a habit, not a feature.",
    name: "Prof. Elena Marchetti",
    role: "Computational Biology · ETH Zürich",
    initials: "EM",
  },
  {
    quote:
      "I was skeptical of the characters. Then the phantom scholar walked me through an interleaving bound I'd misunderstood for two years. I'm a convert.",
    name: "Dr. Owen Whitfield",
    role: "Applied Topology · Oxford",
    initials: "OW",
  },
  {
    quote:
      "My thesis proposal cited nine papers I first met on the daily shelf. The BibTeX export with scene-anchored notes made my advisor ask what changed. ResearchPhantom changed.",
    name: "Sakura Nakamura",
    role: "MSc candidate · Kyoto University",
    initials: "SN",
  },
  {
    quote:
      "The full edition's figure walkthroughs are the honest kind of data analysis — every number traced to its source. I stopped printing ablation tables.",
    name: "Dr. Hana Kim",
    role: "Machine Learning · KAIST",
    initials: "HK",
  },
  {
    quote:
      "Forty-seven seconds to know whether a paper deserves my evening. That's the whole product, and it's the only one my whole lab actually renewed.",
    name: "Dr. Lars Bendix",
    role: "Cognitive Science · TU Delft",
    initials: "LB",
  },
];

export default function Testimonials() {
  return (
    <section aria-labelledby="testimonials-heading" className="relative py-24 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-10%] top-1/3 h-[380px] w-[380px] rounded-full bg-gold-600/[0.05] blur-[120px]"
      />
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="From the desk"
          jp="読者の声"
          title={
            <>
              Researchers, <em className="gold-text font-normal italic">on the scene</em>.
            </>
          }
          lead="Twelve thousand researchers stage their reading with us. Here is what a few of them wrote between scenes."
        />

        <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={(i % 3) * 110} className={cn(i % 3 === 1 && "lg:translate-y-6")}>
              <figure className="panel panel-hover group relative flex h-full flex-col rounded-3xl p-6 sm:p-7">
                <Quote
                  className="h-6 w-6 text-gold-400/50 transition-colors duration-500 group-hover:text-gold-400"
                  aria-hidden="true"
                />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-cream-100/90">
                  “{t.quote}”
                </blockquote>
                <div className="mt-6 flex items-center gap-3.5 border-t border-gold-400/10 pt-5">
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-gold-400/30 bg-gradient-to-br from-gold-400/20 to-transparent font-display text-sm font-semibold text-gold-300"
                  >
                    {t.initials}
                  </span>
                  <figcaption className="min-w-0">
                    <p className="truncate text-sm font-semibold text-cream-50">{t.name}</p>
                    <p className="truncate text-xs text-sand-400">{t.role}</p>
                  </figcaption>
                  <span className="ml-auto flex gap-0.5" aria-label="Five star review">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className="h-3 w-3 fill-gold-400/80 text-gold-400/80" aria-hidden="true" />
                    ))}
                  </span>
                </div>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
