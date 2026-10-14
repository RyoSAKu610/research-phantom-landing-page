import { useCallback, useEffect, useState } from "react";
import { GUIDES, type GuideId } from "./lib/guides";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import ResearchLibrary from "./components/ResearchLibrary";
import AgentPayments from "./components/AgentPayments";
import Features from "./components/Features";
import Showcase from "./components/Showcase";
import Benefits from "./components/Benefits";
import Pricing from "./components/Pricing";
import FAQ from "./components/FAQ";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

function isGuideId(value: unknown): value is GuideId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(GUIDES, value);
}

export default function App() {
  const [guide, setGuide] = useState<GuideId>(() => {
    try {
      const saved = localStorage.getItem("researchphantom-guide");
      return isGuideId(saved) ? saved : "phantom";
    } catch { return "phantom"; }
  });
  const selectGuide = useCallback((selected: GuideId) => {
    if (!isGuideId(selected)) return;
    setGuide(selected);
    try { localStorage.setItem("researchphantom-guide", selected); } catch { /* private browsing */ }
    window.dispatchEvent(new CustomEvent("researchphantom:guide-change", { detail: { guide: selected } }));
  }, []);

  useEffect(() => {
    const onGuideChange = (event: Event) => {
      const selected = (event as CustomEvent<{ guide?: unknown }>).detail?.guide;
      if (isGuideId(selected)) setGuide(selected);
    };
    window.addEventListener("researchphantom:guide-change", onGuideChange);
    return () => window.removeEventListener("researchphantom:guide-change", onGuideChange);
  }, []);

  useEffect(() => {
    // Restore direct hash links after React replaces the file-edition markup.
    const frame = window.requestAnimationFrame(() => {
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const playScene = (selected: GuideId, scene: number) => {
    window.dispatchEvent(new CustomEvent("researchphantom:play-scene", { detail: { guide: selected, scene } }));
    document.getElementById("story-theater")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return (
    <div className="relative min-h-screen bg-ink-900 font-sans text-cream-100">
      {/* ————— Ambient background ————— */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="animate-drift-a absolute -top-32 left-[-10%] h-[540px] w-[540px] rounded-full bg-gold-500/[0.06] blur-[140px]" />
        <div className="animate-drift-b absolute right-[-12%] top-[45%] h-[480px] w-[480px] rounded-full bg-gold-600/[0.05] blur-[150px]" />
        <div className="animate-drift-a absolute bottom-[-15%] left-[20%] h-[420px] w-[420px] rounded-full bg-[#7a5c3e]/[0.07] blur-[130px]" />
      </div>
      <div aria-hidden="true" className="grain pointer-events-none fixed inset-0 z-[70]" />

      <a
        href="#main"
        className="sr-only z-[80] rounded-full bg-gold-400 px-5 py-2.5 text-sm font-semibold text-ink-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <Navbar />

      <main id="main" className="relative z-10">
        <Hero selectedGuide={guide} onSelectGuide={selectGuide} />
        <ResearchLibrary />
        <AgentPayments />
        <Features selectedGuide={guide} onSelectGuide={selectGuide} />
        <Showcase onPlayScene={playScene} />
        <Benefits />
        <Pricing />
        <FAQ />
        <CTA />
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
