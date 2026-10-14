import { mountAgentPayments } from "./payments/agent-payments";
import { mountResearchLibrary } from "./research/library";
import { mountMotionControls } from "./character/motion";

// HTTP(S) is handled by React. file:// uses the pre-rendered fallback edition.
if (window.location.protocol === "file:") {
  const voiceCredit = document.querySelector("[data-meiji-voice-credit]");
  if (voiceCredit) {
    let provider = "unknown";
    try {
      const meta = JSON.parse(document.getElementById("embedded-guide-meta")?.textContent || "{}");
      if (meta?.guides?.meiji?.provider === "ondoku3-beta") provider = "ondoku";
      if (meta?.guides?.meiji?.provider === "local-qwen3-tts") provider = "local";
    } catch { /* Keep the neutral credit if metadata is unavailable. */ }
    voiceCredit.textContent = "内蔵の明治の語り手の声：";
    if (provider === "ondoku") {
      const link = document.createElement("a");
      link.href = "https://ondoku3.com/";
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "音読さん";
      voiceCredit.append(link);
    } else {
      voiceCredit.append(document.createTextNode(provider === "local" ? "ローカル生成（Qwen3-TTS）" : "内蔵音声"));
    }
  }
  const cleanups = [mountAgentPayments(document), mountResearchLibrary(document)];
  const storyTheaterRoot = document.getElementById("story-theater");
  // The research library owns its own controls and their lifecycle.
  if (storyTheaterRoot) cleanups.push(mountMotionControls(storyTheaterRoot));

  const frame = window.requestAnimationFrame(() => {
    let id: string;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  });

  window.addEventListener("beforeunload", () => {
    window.cancelAnimationFrame(frame);
    cleanups.forEach((cleanup) => cleanup());
  }, { once: true });
}
