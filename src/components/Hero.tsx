import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  AudioLines,
  BookOpenCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Cog,
  Flag,
  LineChart,
  Play,
  Rss,
  Scale,
  ScatterChart,
  Square,
  Captions,
  Volume2,
} from "lucide-react";
import { cn } from "../utils/cn";
import { Reveal } from "../lib/ui";
import { GUIDE_IDS, GUIDES, type GuideId } from "../lib/guides";
import GuidePet from "./GuidePet";
import GuideMotionControls from "./GuideMotionControls";
import narration from "../audio/narration.json";

/* ————— Seven-scene data for the featured paper ————— */

const SCENES = [
  {
    num: "01",
    jp: "問い",
    en: "QUESTION",
    icon: CircleHelp,
    title: "What did they set out to solve?",
    point:
      "Persistent entropy summarizes the shape of data — but it collapses far too much. The authors propose a transform that preserves more structure while staying provably stable under noise.",
    note: "No training data required — the contribution is purely mathematical.",
    subtitle: "Scene 01 — the question: can entropy keep its shape?",
    narration: narration[0],
  },
  {
    num: "02",
    jp: "入力",
    en: "INPUT",
    icon: ScatterChart,
    title: "What goes in",
    point:
      "Noisy point clouds sampled from unknown shapes. Each cloud becomes a persistence diagram — a record of features that appear and vanish across scales.",
    note: "Think of it as a seismograph for shape.",
    subtitle: "Scene 02 — point clouds in, diagrams out.",
    narration: narration[1],
  },
  {
    num: "03",
    jp: "処理",
    en: "PROCESS",
    icon: Cog,
    title: "The transform pipeline",
    point:
      "Diagrams are lifted into a functional space, weighted by persistence, and re-entropied. The result is a compact vector — informative, and stable by construction.",
    note: "Every step is differentiable, which surprises most readers.",
    subtitle: "Scene 03 — lift, weight, re-entropy.",
    narration: narration[2],
  },
  {
    num: "04",
    jp: "注意",
    en: "CAUTION",
    icon: AlertTriangle,
    title: "Where it can mislead",
    point:
      "Highly interleaved diagrams can collide in functional space. The authors quantify the collision bound and flag exactly when the transform should not be trusted.",
    note: "An honest limitation — staged with care.",
    subtitle: "Scene 04 — the caveat scene. Every paper has one.",
    narration: narration[3],
  },
  {
    num: "05",
    jp: "観測",
    en: "OBSERVATION",
    icon: LineChart,
    title: "What they measured",
    point:
      "Benchmarks across 12 shape classes, 3 noise regimes, and 5 competing summaries — with stability tracked as perturbation increases.",
    note: "The observation scene: raw results, no gloss.",
    subtitle: "Scene 05 — twelve shapes, three noise regimes.",
    narration: narration[4],
  },
  {
    num: "06",
    jp: "整理",
    en: "INTERPRETATION",
    icon: Scale,
    title: "What the numbers mean",
    point:
      "The transform matches or beats deep baselines on clean data — and degrades far more gracefully as noise increases. The stability bound holds in practice.",
    note: "This is where the metaphor becomes insight.",
    subtitle: "Scene 06 — graceful degradation, quantified.",
    narration: narration[5],
  },
  {
    num: "07",
    jp: "結論",
    en: "CONCLUSION",
    icon: Flag,
    title: "The takeaway",
    point:
      "A lightweight, stable descriptor for shape data — with a clear recipe for when to use it, and when to reach for something heavier.",
    note: "Conclusion: strong, modest, useful.",
    subtitle: "Scene 07 — when to use it, and when not to.",
    narration: narration[6],
  },
];

const FLOW = [
  { jp: "入力", en: "Input" },
  { jp: "処理", en: "Process" },
  { jp: "注意", en: "Caution" },
  { jp: "観測", en: "Observation" },
  { jp: "解釈", en: "Interpretation" },
  { jp: "結論", en: "Conclusion" },
];

export default function Hero({ selectedGuide, onSelectGuide }: { selectedGuide: GuideId; onSelectGuide: (guide: GuideId) => void }) {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [guideAudio] = useState<Record<GuideId, string[]>>(() => {
    if (typeof document === "undefined") return {} as Record<GuideId, string[]>;
    try {
      return JSON.parse(
        document.getElementById("embedded-guide-audio")?.textContent || "{}"
      ) as Record<GuideId, string[]>;
    } catch {
      return {} as Record<GuideId, string[]>;
    }
  });
  const [spokenVariants] = useState<Partial<Record<GuideId, Record<string, string>>>>(() => {
    try {
      const meta = JSON.parse(document.getElementById("embedded-guide-meta")?.textContent || "{}");
      return meta.spoken_variants || {};
    } catch { return {}; }
  });
  const [meijiProvider] = useState(() => {
    try {
      const meta = JSON.parse(document.getElementById("embedded-guide-meta")?.textContent || "{}");
      return meta?.guides?.meiji?.provider === "ondoku3-beta" ? "ondoku" :
        meta?.guides?.meiji?.provider === "local-qwen3-tts" ? "local" : "unknown";
    } catch { return "unknown"; }
  });
  const [uploadedAudio, setUploadedAudio] = useState<Partial<Record<GuideId, string[]>>>({});
  const ondokuUrls = uploadedAudio[selectedGuide] ?? guideAudio[selectedGuide] ?? [];
  const [ondokuSpeaking, setOndokuSpeaking] = useState(false);
  const [audioWaiting, setAudioWaiting] = useState(false);
  const [petBeat, setPetBeat] = useState(0);
  const [ondokuStatus, setOndokuStatus] = useState(
    "案内役を選んで、7場面の物語を再生できます"
  );
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(0.9);
  const [foleyEnabled, setFoleyEnabled] = useState(true);
  const playingRef = useRef(false);
  const narrateRef = useRef<(index: number, continuous: boolean, guide?: GuideId) => void>(() => {});
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeGuideRef = useRef<GuideId | null>(null);
  const activeSceneRef = useRef<number | null>(null);
  const playbackTokenRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playPageSound = useCallback(() => {
    if (!foleyEnabled) return;
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const context = audioContextRef.current;
    if (context.state === "suspended") void context.resume();
    const duration = 0.24;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      const envelope = Math.sin((Math.PI * index) / samples.length) * Math.pow(1 - index / samples.length, 0.45);
      samples[index] = (Math.random() * 2 - 1) * envelope;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "bandpass";
    filter.frequency.value = 1450;
    filter.Q.value = 0.55;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
  }, [foleyEnabled]);

  const stopOndokuAudio = useCallback(() => {
    playbackTokenRef.current += 1;
    const audio = activeAudioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.ontimeupdate = null;
      audio.onplay = null;
      audio.onplaying = null;
      audio.onwaiting = null;
      audio.onpause = null;
      audio.pause();
      audio.currentTime = 0;
    }
    if (activeGuideRef.current && activeSceneRef.current !== null) {
      window.dispatchEvent(new CustomEvent("researchphantom:playback", { detail: { guide: activeGuideRef.current, scene: activeSceneRef.current, playing: false } }));
    }
    activeAudioRef.current = null;
    activeGuideRef.current = null;
    activeSceneRef.current = null;
    setOndokuSpeaking(false);
    setAudioWaiting(false);
    setPetBeat(0);
  }, []);

  const stopNarration = useCallback(
    (message = "停止しました。オフライン音声を再生できます") => {
      stopOndokuAudio();
      setOndokuStatus(message);
    },
    [stopOndokuAudio]
  );

  const finishStory = useCallback(
    (message?: string) => {
      playingRef.current = false;
      setPlaying(false);
      if (message) setOndokuStatus(message);
    },
    []
  );

  const narrateScene = useCallback(
    (index: number, continuous: boolean, guide: GuideId = selectedGuide) => {
      setScene(index);
      const handleEnd = () => {
        activeAudioRef.current = null;
        setOndokuSpeaking(false);
        setAudioWaiting(false);
        setPetBeat(0);
        window.dispatchEvent(new CustomEvent("researchphantom:playback", { detail: { guide, scene: index, playing: false } }));
        activeGuideRef.current = null;
        activeSceneRef.current = null;
        if (!continuous || !playingRef.current) {
          setOndokuStatus(`場面${index + 1}の読み上げが完了しました`);
          return;
        }
          if (index >= SCENES.length - 1) {
           finishStory("7場面の音声解説が完了しました");
           setOndokuStatus("7場面の音声解説が完了しました");
            return;
          }
           const next = index + 1;
           const token = playbackTokenRef.current;
           setScene(next);
           playPageSound();
           window.setTimeout(() => {
             if (playingRef.current && token === playbackTokenRef.current) narrateRef.current(next, true, guide);
           }, 260);
      };

       const ondokuSource = (uploadedAudio[guide] ?? guideAudio[guide] ?? [])[index];
       if (ondokuSource) {
         stopOndokuAudio();
         const audio = new Audio(ondokuSource);
         activeAudioRef.current = audio;
         activeGuideRef.current = guide;
         activeSceneRef.current = index;
          const token = playbackTokenRef.current;
         audio.preload = "auto";
         audio.playbackRate = rate;
         audio.volume = volume;
          setAudioWaiting(true);
          audio.onplaying = () => {
             if (token !== playbackTokenRef.current) return;
             setOndokuSpeaking(true);
             setAudioWaiting(false);
             setPetBeat(0);
            setOndokuStatus(`${GUIDES[guide].name} · 場面${index + 1}を再生中`);
            window.dispatchEvent(new CustomEvent("researchphantom:playback", { detail: { guide, scene: index, playing: true } }));
           };
          audio.onwaiting = () => {
            if (token !== playbackTokenRef.current) return;
            setOndokuSpeaking(false);
            setAudioWaiting(true);
            setPetBeat(0);
            setOndokuStatus("音声を読み込み中です");
            window.dispatchEvent(new CustomEvent("researchphantom:playback", { detail: { guide, scene: index, playing: false } }));
          };
          audio.onpause = () => {
            if (token !== playbackTokenRef.current || audio.ended) return;
            setOndokuSpeaking(false);
            setAudioWaiting(false);
            setPetBeat(0);
            window.dispatchEvent(new CustomEvent("researchphantom:playback", { detail: { guide, scene: index, playing: false } }));
          };
          audio.ontimeupdate = () => {
            if (token !== playbackTokenRef.current || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
            setPetBeat(Math.min(2, Math.floor((audio.currentTime / audio.duration) * 3)));
          };
        audio.onended = handleEnd;
         audio.onerror = () => {
           if (token !== playbackTokenRef.current) return;
           stopOndokuAudio();
          finishStory();
           setOndokuStatus("音声を再生できません。ファイルを確認してください");
        };
         void audio.play().catch(() => {
           if (token !== playbackTokenRef.current) return;
           stopOndokuAudio();
          finishStory();
           setOndokuStatus("音声を開始できません。もう一度押してください");
        });
        return;
      }
      finishStory();
       setOndokuStatus("この場面の音声がありません。7本すべて読み込んでください");
    },
     [finishStory, guideAudio, playPageSound, rate, selectedGuide, stopOndokuAudio, uploadedAudio, volume]
  );

  useEffect(() => {
    narrateRef.current = narrateScene;
  }, [narrateScene]);

  useEffect(() => {
    if (activeGuideRef.current && activeGuideRef.current !== selectedGuide) {
      playingRef.current = false;
      setPlaying(false);
      stopNarration("案内役を切り替えました。再生ボタンを押してください");
    }
  }, [selectedGuide, stopNarration]);

  useEffect(() => {
    const onShowcasePlay = (event: Event) => {
      const { guide, scene: index } = (event as CustomEvent<{ guide: GuideId; scene: number }>).detail;
      if (!GUIDE_IDS.includes(guide) || !Number.isInteger(index) || index < 0 || index >= SCENES.length) return;
      if (activeAudioRef.current && activeGuideRef.current === guide && activeSceneRef.current === index) {
        playingRef.current = false;
        setPlaying(false);
        stopNarration();
        return;
      }
      onSelectGuide(guide);
      playingRef.current = false;
      setPlaying(false);
      stopNarration("場面の音声を開始します");
      narrateRef.current(index, false, guide);
    };
    window.addEventListener("researchphantom:play-scene", onShowcasePlay);
    return () => window.removeEventListener("researchphantom:play-scene", onShowcasePlay);
  }, [onSelectGuide, stopNarration]);

  const go = useCallback((n: number) => {
    playingRef.current = false;
    setPlaying(false);
    stopNarration();
    setScene((n + SCENES.length) % SCENES.length);
    playPageSound();
  }, [playPageSound, stopNarration]);

  const toggleStory = useCallback(() => {
    if (playingRef.current) {
      stopNarration();
      finishStory();
      return;
    }
    stopNarration("ナレーションを開始します");
    playPageSound();
    playingRef.current = true;
    setPlaying(true);
    narrateRef.current(scene, true);
  }, [finishStory, playPageSound, scene, stopNarration]);

  const readCurrentScene = useCallback(() => {
    if (ondokuSpeaking) {
      stopNarration();
      finishStory();
      return;
    }
    playingRef.current = false;
    setPlaying(false);
    playPageSound();
    narrateRef.current(scene, false);
  }, [finishStory, ondokuSpeaking, playPageSound, scene, stopNarration]);

  const loadOndokuFiles = useCallback(
    (files: FileList | null) => {
      const audioFiles = Array.from(files ?? [])
        .filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|m4a|mp4)$/i.test(file.name))
        .sort((a, b) => a.name.localeCompare(b.name, "ja", { numeric: true }))
        .slice(0, SCENES.length);
      stopNarration();
      if (audioFiles.length !== SCENES.length) {
        setOndokuStatus(`音声を7本まとめて選択してください。現在 ${audioFiles.length} 本です`);
        return;
      }
      void Promise.all(
        audioFiles.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(file);
            })
        )
      )
        .then((urls) => {
          setUploadedAudio((previous) => ({ ...previous, [selectedGuide]: urls }));
          setOndokuStatus("差し替え音声を7 / 7場面に接続しました");
        })
        .catch(() => {
          setUploadedAudio((previous) => ({ ...previous, [selectedGuide]: undefined }));
          setOndokuStatus("音声ファイルを確認できませんでした");
        });
    },
    [selectedGuide, stopNarration]
  );

  const clearOndokuFiles = useCallback(() => {
    stopNarration();
    setUploadedAudio((previous) => ({ ...previous, [selectedGuide]: undefined }));
    setOndokuStatus("内蔵の案内役音声に戻しました");
  }, [selectedGuide, stopNarration]);

  const copyCurrentScript = useCallback(async () => {
    const script = spokenVariants[selectedGuide]?.[String(scene + 1)] ?? SCENES[scene].narration;
    try {
      await navigator.clipboard.writeText(script);
      setOndokuStatus(`場面${scene + 1}の台本をコピーしました`);
    } catch {
      window.prompt("台本をコピーしてください", script);
    }
  }, [scene, selectedGuide, spokenVariants]);

  const readScene = useCallback(
    (index: number) => {
      playingRef.current = false;
      setPlaying(false);
      stopNarration();
      setScene(index);
      playPageSound();
      narrateRef.current(index, false);
    },
    [playPageSound, stopNarration]
  );

  useEffect(() => {
    const audio = activeAudioRef.current;
    if (!audio) return;
    audio.playbackRate = rate;
    audio.volume = volume;
  }, [rate, volume]);

  useEffect(
    () => () => {
      stopOndokuAudio();
      const context = audioContextRef.current;
      if (context && context.state !== "closed") void context.close();
    },
    [stopOndokuAudio]
  );

  const selectGuide = (guide: GuideId) => {
    if (guide === selectedGuide) return;
    playingRef.current = false;
    setPlaying(false);
    stopNarration(`${GUIDES[guide].name} を選びました`);
    onSelectGuide(guide);
  };

  const onParallax = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty("--py", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  }, []);

  const current = SCENES[scene];
  const activeFlow = scene - 1;

  return (
    <section id="top" aria-labelledby="hero-heading" className="relative overflow-hidden pt-[120px] sm:pt-[140px]">
      {/* ambient glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gold-500/[0.07] blur-[130px]" />
        <div className="absolute right-[-10%] top-[30%] h-[380px] w-[380px] rounded-full bg-gold-600/[0.05] blur-[110px]" />
      </div>

      <div
        className="relative mx-auto w-full max-w-7xl px-5 sm:px-8"
        onMouseMove={onParallax}
        style={{ ["--px" as string]: "0", ["--py" as string]: "0" }}
      >
        <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 xl:gap-16">
          {/* ————— Copy ————— */}
          <div className="min-w-0 max-w-2xl">
            <Reveal>
              <p className="inline-flex flex-wrap items-center gap-x-3 gap-y-2 rounded-full border border-gold-400/20 bg-gold-400/[0.06] px-4 py-2 text-xs font-medium text-sand-300 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-400" />
                </span>
                AI AGENT EXCLUSIVE
                <span className="h-3 w-px bg-gold-400/25" aria-hidden="true" />
                <span className="font-jp tracking-[0.18em] text-gold-400/90">体験デモ · CHARACTER STORY</span>
              </p>
            </Reveal>

            <Reveal delay={100}>
              <h1
                id="hero-heading"
                className="mt-7 font-display text-[2.85rem] font-light leading-[1.04] tracking-tight text-cream-50 text-balance sm:text-6xl xl:text-[4.35rem]"
              >
                Every paper is a{" "}
                <em className="gold-text font-normal italic">seven-scene story</em>.
              </h1>
            </Reveal>

            <Reveal delay={200}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-sand-300 text-balance sm:text-lg">
                ResearchPhantom stages dense preprints as guided, scene-by-scene narrations —{" "}
                <span className="font-jp text-cream-100">問い</span> through{" "}
                <span className="font-jp text-cream-100">結論</span> — with character guides, subtitles,
                and sound. Grasp the core of new research in minutes, not evenings.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="mt-9 flex flex-col gap-3.5 sm:flex-row sm:items-center">
                <a
                  href="#research-library"
                  className="btn-gold inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold"
                >
                  論文を探す
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    stopNarration("7場面の物語を開始します");
                    setScene(0);
                    playPageSound();
                    playingRef.current = true;
                    setPlaying(true);
                    narrateRef.current(0, true);
                    document.getElementById("story-theater")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="btn-ghost inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-semibold text-cream-100"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-gold-400/15 text-gold-300">
                    <Play className="h-3 w-3 fill-current" aria-hidden="true" />
                  </span>
                  Watch the seven scenes
                </button>
              </div>
            </Reveal>

            <Reveal delay={400}>
              <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-sand-400">
                {["7場面の論文プレビュー", "オフライン音声内蔵", "AI Agent専用決済を準備中"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-gold-400" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-sand-400">解説は体験用の例です。原文・台本の照合前のため、論文の事実として引用しないでください。</p>
              <a className="agent-hero-teaser" href="#agent-payments">
                <span>AGENT-ONLY PAYMENTS · お支払いはAI Agent経由のみ</span>
                 <strong>JPYCでも、カードでも。都度払いも。 ↗</strong>
                 <small>Researcherは月3回までの都度払いを追加 · 決済連携準備中</small>
              </a>
            </Reveal>
          </div>

          {/* ————— Interactive theater ————— */}
          <Reveal delay={250} y={40} className="relative min-w-0">
            <div
              className="relative mx-auto w-full max-w-[540px] transition-transform duration-300 ease-out will-change-transform"
              style={{
                transform:
                  "perspective(1400px) rotateX(calc(var(--py, 0) * -3.5deg)) rotateY(calc(var(--px, 0) * 4.5deg))",
              }}
            >
              {/* floating badges */}
              <div
                aria-hidden="true"
                className="absolute -right-4 -top-6 z-20 hidden transition-transform duration-500 ease-out sm:block"
                style={{ transform: "translate(calc(var(--px, 0) * 22px), calc(var(--py, 0) * 16px))" }}
              >
                <div className="panel animate-float flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-cream-100 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)]">
                  <AudioLines className="h-3.5 w-3.5 text-gold-400" />
                   Offline narration
                </div>
              </div>
              <div
                aria-hidden="true"
                className="absolute -left-5 top-1/3 z-20 hidden transition-transform duration-500 ease-out sm:block"
                style={{ transform: "translate(calc(var(--px, 0) * -18px), calc(var(--py, 0) * -14px))" }}
              >
                <div className="panel animate-float-slow flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-cream-100 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)]">
                  <Clapperboard className="h-3.5 w-3.5 text-gold-400" />
                  7 scenes · demo
                </div>
              </div>
              <div
                aria-hidden="true"
                className="absolute -bottom-6 right-10 z-20 hidden transition-transform duration-500 ease-out sm:block"
                style={{ transform: "translate(calc(var(--px, 0) * 14px), calc(var(--py, 0) * -20px))" }}
              >
                <div className="panel flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-cream-100 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8)]">
                  <Rss className="h-3.5 w-3.5 text-gold-400" />
                  Curated papers
                </div>
              </div>

              {/* theater card */}
               <div id="story-theater" className="panel relative scroll-mt-28 overflow-hidden rounded-[26px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85)]">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-gold-400/10 blur-[70px]"
                />

                {/* header */}
                <div className="relative flex items-center justify-between gap-3 border-b border-gold-400/10 px-5 py-3.5">
                  <p className="flex min-w-0 items-center gap-2 text-[11px] font-medium tracking-wide text-sand-400">
                    <BookOpenCheck className="h-3.5 w-3.5 shrink-0 text-gold-400" aria-hidden="true" />
                    <span className="truncate">
                       <span className="text-gold-300">PAPER DEMO</span> · 7-scene illustration
                    </span>
                  </p>
                  <span className="shrink-0 rounded-full border border-gold-400/25 bg-gold-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-300">
                    Live
                  </span>
                 </div>

                 <div className="relative border-b border-gold-400/10 px-5 py-3 sm:px-6" aria-label="案内役を選択">
                   <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-gold-300">案内役を選ぶ · 声も切り替わります</p>
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                     {GUIDE_IDS.map((id) => {
                       const guide = GUIDES[id];
                       return <button key={id} type="button" onClick={() => selectGuide(id)} aria-pressed={selectedGuide === id} aria-label={`${guide.name} を選ぶ`}
                          className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl border p-1.5 text-center transition-colors focus-visible:outline-gold-300 sm:flex-row sm:gap-2 sm:text-left", selectedGuide === id ? "border-gold-300 bg-gold-400/15 text-cream-50" : "border-white/10 text-sand-400 hover:border-gold-400/50")}>
                          <img src={guide.image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover sm:h-9 sm:w-9" />
                          <span className="min-w-0"><span className="block text-[10px] font-semibold">{{ phantom: "Phantom", kitsune: "Kitsune", owl: "Owl", meiji: "Meiji" }[id]}</span><span className="block text-[9px]">{guide.jp}</span></span>
                       </button>;
                     })}
                   </div>
                 </div>

                 <div className="relative grid gap-5 p-5 sm:grid-cols-[132px_1fr] sm:p-6">
                  {/* guide zone */}
                  <div className="flex items-start gap-4 sm:flex-col sm:items-center">
                    <div className="relative shrink-0">
                       <div
                         aria-hidden="true"
                         className={cn("guide-motion-decoration absolute -inset-3 rounded-full bg-gold-400/20 blur-xl", ondokuSpeaking && !audioWaiting && "animate-breathe")}
                       />
                        <GuidePet image={GUIDES[selectedGuide].image} alt={`${GUIDES[selectedGuide].name} — character guide`}
                          scene={scene} guide={selectedGuide} playing={ondokuSpeaking} waiting={audioWaiting} beat={petBeat} className="h-[104px] w-[104px] sm:h-[120px] sm:w-[120px]" />
                    </div>
                    <div className="sm:text-center">
                       <p className="text-[11px] font-semibold text-cream-100">{GUIDES[selectedGuide].jp}</p>
                       <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-sand-400">{GUIDES[selectedGuide].name}</p>
                        <p className="mt-1 text-[9px] text-gold-300">{GUIDES[selectedGuide].voice}</p>
                         {selectedGuide === "meiji" && (uploadedAudio.meiji ? (
                           <p className="mt-2 text-[11px] text-gold-300">声：差し替え音声</p>
                         ) : meijiProvider === "ondoku" ? (
                           <a href="https://ondoku3.com/" target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] text-gold-300 underline underline-offset-2">声：音読さん ↗</a>
                         ) : (
                           <p className="mt-2 text-[11px] text-gold-300">声：{meijiProvider === "local" ? "ローカル生成（Qwen3-TTS）" : "内蔵音声"}</p>
                         ))}
                    </div>
                    <div className="panel hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium text-cream-100 sm:flex">
                      <current.icon className="h-3 w-3 text-gold-400" aria-hidden="true" />
                      <span className="font-jp">{current.jp}</span>
                    </div>
                  </div>

                  {/* point zone */}
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-400">
                      Scene {current.num}
                      <span className="h-3 w-px bg-gold-400/30" aria-hidden="true" />
                      {current.en}
                      <span className="font-jp text-[11px] normal-case tracking-[0.3em] text-sand-400">
                        {current.jp}
                      </span>
                    </p>
                    <div key={scene} className="scene-shift">
                      <h3 className="mt-2 font-display text-xl font-normal leading-snug text-cream-50 sm:text-[1.35rem]">
                        {current.title}
                      </h3>
                      <p className="mt-2.5 text-[13px] leading-relaxed text-sand-300">{current.point}</p>
                      <p className="mt-3 border-l-2 border-gold-400/40 pl-3 text-[11px] italic leading-relaxed text-sand-400">
                        {current.note}
                      </p>
                    </div>

                    {/* experiment flow */}
                    <div className="mt-5 hidden flex-wrap items-center gap-1.5 md:flex" aria-label="Experiment flow">
                      {FLOW.map((f, i) => {
                        const state = i < activeFlow ? "done" : i === activeFlow ? "active" : "upcoming";
                        return (
                          <span
                            key={f.en}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all duration-500",
                              state === "done" && "border-gold-400/40 bg-gold-400/15 text-gold-300",
                              state === "active" &&
                                "border-gold-400/70 bg-gold-400/20 text-cream-50 shadow-[0_0_18px_-4px_rgba(227,197,131,0.5)]",
                              state === "upcoming" && "border-white/10 bg-white/[0.03] text-sand-500"
                            )}
                          >
                            <span className="font-jp">{f.jp}</span>
                            <span className="ml-1 hidden lg:inline">{f.en}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* scene rail */}
                <div className="relative border-t border-gold-400/10 px-5 py-3">
                  <ol className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Seven scenes">
                    {SCENES.map((s, i) => (
                      <li key={s.num} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => go(i)}
                          aria-current={i === scene ? "true" : undefined}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all duration-400",
                            i === scene
                              ? "border-gold-400/70 bg-gold-400/20 text-cream-50 shadow-[0_0_16px_-4px_rgba(227,197,131,0.5)]"
                              : "border-white/10 bg-white/[0.03] text-sand-400 hover:border-gold-400/30 hover:text-cream-100"
                          )}
                        >
                          <span className="font-semibold tracking-wider">{s.num}</span>
                          <span className="font-jp">{s.jp}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* subtitle + progress */}
                <div className="relative border-t border-gold-400/10 px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-400">
                      <Captions className="h-3.5 w-3.5" aria-hidden="true" />
                      字幕
                    </span>
                    <p key={`sub-${scene}`} className="scene-shift min-w-0 text-xs leading-relaxed text-sand-300">
                      {current.subtitle}
                    </p>
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold-600 to-gold-300 transition-all duration-700 ease-out"
                      style={{ width: `${((scene + 1) / SCENES.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* controls */}
                <div className="relative flex items-center justify-between border-t border-gold-400/10 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => go(scene - 1)}
                      aria-label="Previous scene"
                      className="btn-ghost grid h-9 w-9 place-items-center rounded-full text-cream-100"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleStory}
                      aria-pressed={playing}
                      disabled={ondokuUrls.length !== SCENES.length}
                       className="btn-gold flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-[11px] font-semibold sm:px-4 sm:text-xs"
                    >
                      {playing ? (
                        <>
                           <Square className="h-3 w-3 fill-current" aria-hidden="true" /> Stop
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> Play story
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => go(scene + 1)}
                      aria-label="Next scene"
                      className="btn-ghost grid h-9 w-9 place-items-center rounded-full text-cream-100"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-medium text-sand-400">
                    <span className="rounded-full border border-white/10 px-2 py-1">{rate.toFixed(1)}×</span>
                    <span className="rounded-full border border-gold-400/30 bg-gold-400/10 px-2 py-1 text-gold-300">
                      {current.num} / 07
                    </span>
                  </div>
                </div>

                 {/* All narration uses embedded or locally selected audio files. */}
                <div className="relative border-t border-gold-400/10 bg-black/10 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full transition-all duration-300",
                          ondokuUrls.length !== SCENES.length && "bg-[#d4856c] shadow-[0_0_10px_rgba(212,133,108,0.45)]",
                          ondokuUrls.length === SCENES.length && !ondokuSpeaking && "bg-gold-400 shadow-[0_0_10px_rgba(227,197,131,0.45)]",
                          ondokuSpeaking && "animate-pulse bg-[#9fd4ac] shadow-[0_0_12px_rgba(159,212,172,0.6)]"
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-cream-100">{GUIDES[selectedGuide].name} · 音声</p>
                        <p className="truncate text-[9px] text-sand-500" role="status" aria-live="polite">
                          {ondokuStatus}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={readCurrentScene}
                      disabled={!ondokuUrls[scene]}
                      className="btn-ghost flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold text-gold-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {ondokuSpeaking && !playing ? "停止" : "この場面を読む"}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-[0.7fr_1fr_auto] sm:items-end">
                    <label className="grid gap-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-sand-500">
                      速度
                      <select
                        value={rate}
                        onChange={(event) => setRate(Number(event.target.value))}
                        className="h-8 rounded-lg border border-gold-400/15 bg-ink-900 px-2 text-[9px] font-normal normal-case tracking-normal text-cream-100 outline-none focus:border-gold-400/50"
                      >
                        <option value={0.8}>0.8×</option>
                        <option value={1}>1.0×</option>
                        <option value={1.2}>1.2×</option>
                        <option value={1.4}>1.4×</option>
                      </select>
                    </label>
                    <label className="grid grid-cols-[1fr_auto] gap-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-sand-500">
                      音量 <output className="text-gold-400">{Math.round(volume * 100)}%</output>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={volume}
                        onChange={(event) => setVolume(Number(event.target.value))}
                        className="col-span-2 h-4 w-full accent-gold-400"
                        aria-label="ナレーション音量"
                      />
                    </label>
                    <label className="flex h-8 items-center gap-1.5 rounded-lg border border-gold-400/15 px-2 text-[9px] font-medium text-sand-300">
                      <input
                        type="checkbox"
                        checked={foleyEnabled}
                        onChange={(event) => setFoleyEnabled(event.target.checked)}
                        className="accent-gold-400"
                      />
                      ページ音
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-gold-400/10 pt-3">
                    <label className="btn-ghost inline-flex min-h-8 cursor-pointer items-center justify-center rounded-lg px-2.5 text-[9px] font-semibold text-gold-300">
                       別の音声7本に差し替える
                      <input
                        type="file"
                        accept="audio/mpeg,audio/mp3,audio/wav,audio/x-m4a,audio/mp4"
                        multiple
                        onChange={(event) => loadOndokuFiles(event.target.files)}
                        className="sr-only"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={copyCurrentScript}
                      className="btn-ghost min-h-8 rounded-lg px-2.5 text-[9px] font-semibold text-sand-300"
                    >
                      現在の台本をコピー
                    </button>
                     {uploadedAudio[selectedGuide] && (
                      <button
                        type="button"
                        onClick={clearOndokuFiles}
                        className="btn-ghost min-h-8 rounded-lg px-2.5 text-[9px] font-semibold text-sand-400"
                      >
                        読み込みを解除
                      </button>
                    )}
                  </div>

                   <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4" aria-label="場面ごとの音声解説">
                    {SCENES.map((item, index) => (
                      <button
                        key={`read-${item.num}`}
                        type="button"
                        onClick={() => readScene(index)}
                        disabled={!ondokuUrls[index]}
                        className="rounded-lg border border-white/[0.07] bg-white/[0.015] px-2 py-2 text-[8px] text-sand-400 transition-all hover:-translate-y-0.5 hover:border-gold-400/30 hover:text-cream-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <b className="mr-1 text-gold-400">{item.num}</b>
                        {item.jp}を音読
                      </button>
                    ))}
                   </div>
                   <details className="mt-3 border-t border-gold-400/15 pt-3 text-xs text-sand-300">
                     <summary className="cursor-pointer text-gold-300">案内役の演出を調整 · 7つの反応</summary>
                     <GuideMotionControls className="mt-3" />
                   </details>

                 </div>
              </div>

              {/* under-glow */}
              <div
                aria-hidden="true"
                className="absolute -inset-x-8 -bottom-10 h-24 rounded-full bg-gold-500/[0.08] blur-[60px]"
              />
            </div>
          </Reveal>
        </div>

      </div>
    </section>
  );
}
