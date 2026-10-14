import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { cn } from "../utils/cn";

const LINKS = [
  { href: "#agent-payments", label: "AI Agent決済" },
  { href: "#features", label: "Features" },
  { href: "#showcase", label: "Showcase" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(y / max, 1) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-gold-400/10 bg-ink-900/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      )}
    >
      {/* scroll progress */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px] origin-left bg-gradient-to-r from-gold-600 via-gold-300 to-gold-500 transition-transform duration-150 ease-out"
        style={{ transform: `scaleX(${progress})` }}
      />

      <nav
        aria-label="Primary"
        className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-8"
      >
        <a href="#top" className="group flex items-center gap-3" aria-label="ResearchPhantom Studio — home">
          <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-gold-400/30 bg-gradient-to-br from-gold-400/15 to-transparent font-jp text-lg font-semibold text-gold-300 shadow-[0_0_24px_-8px_rgba(227,197,131,0.4)] transition-all duration-500 group-hover:shadow-[0_0_32px_-6px_rgba(227,197,131,0.55)]">
            甲
            <span className="absolute inset-0 rounded-xl border border-gold-400/10" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[17px] font-medium tracking-tight text-cream-50">
              ResearchPhantom
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-gold-400/80">
              Studio · 甲版
            </span>
          </span>
        </a>

        <ul className="hidden items-center gap-6 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="group relative text-sm font-medium text-sand-300 transition-colors duration-300 hover:text-cream-50"
              >
                {l.label}
                <span className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-gradient-to-r from-gold-400 to-gold-600 transition-transform duration-400 ease-out group-hover:scale-x-100" />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a
            href="#research-library"
            className="btn-gold hidden items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold sm:inline-flex"
          >
            論文を探す
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="btn-ghost grid h-10 w-10 place-items-center rounded-full text-cream-100 lg:hidden"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden",
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="panel mx-4 mb-4 rounded-2xl p-3">
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-medium text-sand-300 transition-colors hover:bg-gold-400/8 hover:text-cream-50"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="mt-2 border-t border-gold-400/10 pt-2">
              <a
                href="#research-library"
                onClick={() => setOpen(false)}
                className="btn-gold flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold"
              >
                論文を探す
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
