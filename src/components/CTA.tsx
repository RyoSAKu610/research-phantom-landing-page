import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, GraduationCap, Mail, Send } from "lucide-react";
import { Reveal } from "../lib/ui";

const ROLES = ["Undergraduate", "Masters candidate", "PhD candidate", "Postdoc", "Faculty", "Industry researcher"];

export default function CTA() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(ROLES[2]);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("現在、送信先は未設定です。問い合わせ受付の開始までお待ちください。");
  };

  return (
    <section id="contact" aria-labelledby="cta-heading" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="panel relative overflow-hidden rounded-[32px] px-6 py-16 sm:px-12 sm:py-20 lg:px-16">
            {/* ambient */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gold-400/[0.09] blur-[100px]" />
              <div className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-gold-600/[0.08] blur-[110px]" />
              <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />
              <span className="absolute right-8 top-8 select-none font-jp text-[10rem] font-bold leading-none text-gold-400/[0.04] sm:text-[16rem]">
                甲
              </span>
            </div>

            <div className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-gold-400">
                  <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold-400/70" aria-hidden="true" />
                  Get in touch
                  <span className="font-jp tracking-[0.2em] text-sand-400">contact</span>
                </p>
                <h2
                  id="cta-heading"
                  className="mt-5 font-display text-4xl font-light leading-[1.06] tracking-tight text-cream-50 text-balance sm:text-5xl"
                >
                  Your new thesis begins with a{" "}
                  <em className="gold-text font-normal italic">single scene</em>.
                </h2>
                <p className="mt-5 max-w-md text-base leading-relaxed text-sand-300">
                  Tell us what you're researching. We'll point you to the staged papers that matter to your
                  next chapter — or stage the paper behind it ourselves, scene by scene.
                </p>
                <ul className="mt-7 space-y-2.5 text-sm text-sand-300">
                  {[
                    "お問い合わせの受信先は準備中です",
                    "Paper staging requests, field alerts, and lab onboarding",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="mt-8 flex items-center gap-2 text-sm text-sand-400">
                  <Mail className="h-4 w-4 text-gold-400" aria-hidden="true" />
                  お問い合わせ先を確認中です。
                </p>
              </div>

              {/* form */}
              <div className="panel relative rounded-3xl bg-ink-850/60 p-6 sm:p-8">
                {sent ? (
                  <div className="scene-shift flex min-h-[320px] flex-col items-center justify-center text-center">
                    <span className="relative grid h-16 w-16 place-items-center rounded-full border border-gold-400/40 bg-gold-400/15">
                      <CheckCircle2 className="h-8 w-8 text-gold-300" aria-hidden="true" />
                      <span aria-hidden="true" className="animate-breathe absolute -inset-3 rounded-full bg-gold-400/20 blur-lg" />
                    </span>
                    <h3 className="mt-6 font-display text-2xl font-normal text-cream-50">Scene 01 — complete.</h3>
                    <p className="mt-3 max-w-xs text-sm leading-relaxed text-sand-300">
                      Thank you. We'll write back within one research day with staged papers for{" "}
                      <span className="text-cream-100">{role.toLowerCase()} work</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSent(false);
                        setEmail("");
                      }}
                      className="btn-ghost mt-7 rounded-full px-6 py-2.5 text-sm font-semibold text-cream-100"
                    >
                      Send another
                    </button>
                  </div>
                ) : (
                  <form onSubmit={submit} noValidate className="space-y-5">
                    <div>
                      <label htmlFor="cta-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sand-400">
                        Research email
                      </label>
                      <input
                        id="cta-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@university.edu"
                        aria-describedby={error ? "cta-error" : undefined}
                        className="w-full rounded-xl border border-gold-400/20 bg-ink-900/70 px-4 py-3.5 text-sm text-cream-50 placeholder:text-sand-500 outline-none transition-all duration-300 focus:border-gold-400/60 focus:bg-ink-900 focus:shadow-[0_0_0_4px_rgba(227,197,131,0.12)]"
                      />
                      {error && (
                        <p id="cta-error" role="alert" className="mt-2 text-xs font-medium text-[#e08a6a]">
                          {error}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="cta-role" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-sand-400">
                        You are a
                      </label>
                      <div className="relative">
                        <select
                          id="cta-role"
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          className="w-full appearance-none rounded-xl border border-gold-400/20 bg-ink-900/70 px-4 py-3.5 text-sm text-cream-50 outline-none transition-all duration-300 focus:border-gold-400/60 focus:shadow-[0_0_0_4px_rgba(227,197,131,0.12)]"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r} className="bg-ink-900">
                              {r}
                            </option>
                          ))}
                        </select>
                        <GraduationCap
                          className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gold-400"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled
                      className="btn-gold flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-bold opacity-50"
                    >
                      受付準備中
                      <Send className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <p className="text-center text-[11px] leading-relaxed text-sand-500">
                      このフォームはデモです。現在は送信されません。受信先と実送信の設定後に受付を開始します。
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <p className="mt-10 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-sand-400">
            ResearchPhantom Studio · 体験デモ
            <ArrowRight className="h-3.5 w-3.5 text-gold-400" aria-hidden="true" />
            <span className="font-jp tracking-[0.2em] text-gold-400/80">七場面で、論文を読む。</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
