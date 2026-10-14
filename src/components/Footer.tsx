import { ArrowUpRight } from "lucide-react";

const COLUMNS = [
  {
    title: "Studio",
    links: [
      { label: "About", href: "#top" },
      { label: "Editions", href: "#showcase" },
      { label: "Features", href: "#features" },
    ],
  },
  {
    title: "Product",
    links: [
      { label: "論文を探す", href: "#research-library" },
      { label: "Features", href: "#features" },
      { label: "Showcase", href: "#showcase" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "AI Agent",
    links: [
      { label: "AI Agent決済", href: "#agent-payments" },
      { label: "依頼文を作る", href: "#agent-request" },
      { label: "支払方法・FAQ", href: "#faq" },
    ],
  },
  {
    title: "Contact",
    links: [{ label: "お問い合わせ", href: "#contact" }],
  },
];

const EDITIONS = [
  { label: "Light", jp: "書架" },
  { label: "Full", jp: "データ解析" },
  { label: "Extra", jp: "キャラ実演" },
];

export default function Footer() {
  let meijiProvider = "unknown";
  if (typeof document !== "undefined") {
    try {
      const meta = JSON.parse(document.getElementById("embedded-guide-meta")?.textContent || "{}");
      if (meta?.guides?.meiji?.provider === "ondoku3-beta") meijiProvider = "ondoku";
      if (meta?.guides?.meiji?.provider === "local-qwen3-tts") meijiProvider = "local";
    } catch { /* Unknown metadata must not imply a vendor. */ }
  }
  return (
    <footer className="relative border-t border-gold-400/10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent"
      />
      <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          {/* brand */}
          <div className="max-w-sm">
            <a href="#top" className="flex items-center gap-3" aria-label="ResearchPhantom Studio — back to top">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-gold-400/30 bg-gradient-to-br from-gold-400/15 to-transparent font-jp text-lg font-semibold text-gold-300">
                甲
              </span>
              <span className="leading-tight">
                <span className="block font-display text-lg font-medium tracking-tight text-cream-50">ResearchPhantom</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-gold-400/80">Studio · 甲版</span>
              </span>
            </a>
            <p className="mt-5 text-sm leading-relaxed text-sand-400">
              出典付きの収録論文を7場面で読むPhantomresearchと、4人の音声付きLPデモ。決済条件は参考表示です。
            </p>
            <a href="#agent-payments" className="mt-5 block text-xs leading-relaxed text-gold-300">
              お支払いはAI Agent経由のみ。<br />
               JPYC・暗号資産・カード・ポイントを選択可能。
            </a>
            <div className="mt-6 flex flex-wrap gap-2">
              {EDITIONS.map((e) => (
                <span
                  key={e.label}
                  className="flex items-center gap-2 rounded-full border border-gold-400/20 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-sand-300"
                >
                  {e.label}
                  <span className="font-jp text-[10px] tracking-[0.16em] text-gold-400/80">{e.jp}</span>
                </span>
              ))}
            </div>
          </div>

          {/* link columns */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.26em] text-gold-400/90">{col.title}</h3>
                <ul className="mt-5 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="group inline-flex items-center gap-1 text-sm text-sand-400 transition-colors duration-300 hover:text-cream-50"
                      >
                        {l.label}
                        <ArrowUpRight
                          className="h-3 w-3 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-gold-400/10 pt-8 sm:flex-row">
          <p className="text-xs text-sand-500">© 2026 ResearchPhantom Studio · 体験デモ</p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-sand-500">
            <span>Set in ink &amp; gold</span>
            <span aria-hidden="true" className="h-3 w-px bg-gold-400/20" />
            <span>Characters are metaphorical guides, never the paper's authors.</span>
          </p>
        </div>
        <p className="mt-4 text-center text-[11px] text-sand-500 sm:text-left">
           内蔵の明治の語り手の声：{meijiProvider === "ondoku" ? <a href="https://ondoku3.com/" target="_blank" rel="noreferrer" className="text-gold-300 underline underline-offset-2">音読さん</a> : meijiProvider === "local" ? "ローカル生成（Qwen3-TTS）" : "内蔵音声"}
          {" · "}肖像：<a href="https://commons.wikimedia.org/wiki/File:Seated_Woman_(Kusakabe_Kimbei).jpg" target="_blank" rel="noreferrer" className="text-gold-300 underline underline-offset-2">日下部金兵衛（Public Domain）</a>
        </p>
      </div>
    </footer>
  );
}
