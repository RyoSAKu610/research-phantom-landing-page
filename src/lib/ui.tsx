import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "../utils/cn";

/* ————————— useInView ————————— */

export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  // Visible by default: motion enhancement must never hide core content.
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Content must remain available even when motion APIs are unavailable.
    if (reducedMotion || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        });
      },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );

    // Some embedded previews throttle observer callbacks. This check prevents
    // nearby content from remaining permanently transparent in those viewers.
    const failSafe = window.setTimeout(() => {
      const nextRect = el.getBoundingClientRect();
      if (nextRect.top <= viewportHeight * 1.35 && nextRect.bottom >= 0) {
        setInView(true);
        obs.disconnect();
      }
    }, 900);

    obs.observe(el);
    return () => {
      window.clearTimeout(failSafe);
      obs.disconnect();
    };
  }, [threshold]);

  return { ref, inView };
}

/* ————————— Reveal ————————— */

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: ElementType;
  y?: number;
}

export function Reveal({ children, delay = 0, className, as, y = 28 }: RevealProps) {
  const Tag = (as ?? "div") as ElementType;
  const { ref, inView } = useInView<HTMLDivElement>(0.12);
  return (
    <Tag
      ref={ref}
      className={cn(
        "transition-all duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
        inView ? "opacity-100" : "opacity-0",
        className
      )}
      style={{
        transitionDelay: `${delay}ms`,
        transform: inView ? "translateY(0)" : `translateY(${y}px)`,
        filter: inView ? "blur(0px)" : "blur(3px)",
      }}
    >
      {children}
    </Tag>
  );
}

/* ————————— Counter ————————— */

interface CounterProps {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

export function Counter({ to, decimals = 0, prefix = "", suffix = "", duration = 1800, className }: CounterProps) {
  const { ref, inView } = useInView<HTMLSpanElement>(0.4);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* ————————— SectionHeading ————————— */

interface SectionHeadingProps {
  eyebrow: string;
  jp?: string;
  title: ReactNode;
  lead?: string;
  align?: "center" | "left";
}

export function SectionHeading({ eyebrow, jp, title, lead, align = "center" }: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={cn("max-w-3xl", centered && "mx-auto text-center")}>
      <Reveal>
        <p
          className={cn(
            "flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-gold-400",
            centered && "justify-center"
          )}
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold-400/70" aria-hidden="true" />
          {eyebrow}
          {jp && <span className="font-jp text-sand-400 tracking-[0.2em]">{jp}</span>}
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-gold-400/70" aria-hidden="true" />
        </p>
      </Reveal>
      <Reveal delay={90}>
        <h2 className="mt-5 font-display text-4xl font-light leading-[1.08] tracking-tight text-cream-50 text-balance sm:text-5xl">
          {title}
        </h2>
      </Reveal>
      {lead && (
        <Reveal delay={180}>
          <p className="mt-5 text-base leading-relaxed text-sand-300 text-balance sm:text-lg">{lead}</p>
        </Reveal>
      )}
    </div>
  );
}
