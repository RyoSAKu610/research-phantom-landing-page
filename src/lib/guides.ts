import phantom from "../assets/guide-phantom.jpg";
import kitsune from "../assets/guide-fox.jpg";
import owl from "../assets/guide-owl.jpg";
import meiji from "../assets/guide-meiji.jpg";

export type GuideId = "phantom" | "kitsune" | "owl" | "meiji";

export const GUIDES: Record<GuideId, { image: string; number: string; jp: string; name: string; voice: string }> = {
  phantom: { image: phantom, number: "No. 001", jp: "案内役", name: "The Phantom Scholar", voice: "静かな中低音 · 思索する語り" },
  kitsune: { image: kitsune, number: "No. 014", jp: "司書", name: "The Kitsune Librarian", voice: "柔らかな高音 · 好奇心のある語り" },
  owl: { image: owl, number: "No. 032", jp: "分析者", name: "The Clockwork Owl", voice: "低く明瞭 · 正確な語り" },
  meiji: { image: meiji, number: "No. 048", jp: "明治の語り手", name: "The Meiji Storykeeper", voice: "穏やかな女性声 · 丁寧な語り" },
};

export const GUIDE_IDS: GuideId[] = ["phantom", "kitsune", "owl", "meiji"];
